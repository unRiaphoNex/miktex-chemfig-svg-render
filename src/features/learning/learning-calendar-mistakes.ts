// ========== 学习日历和错题本 (v17.2.0) ==========
// 学习日历：可视化打卡记录
// 错题本：自动收集错误题目

/**
 * 学习日历管理器
 */
class LearningCalendarManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.storageKey = "chemfig-learning-calendar";
    this.calendar = {}; // { "2024-01-15": { studied: 5, mastered: 2, correct: 8, wrong: 2 } }
    this.load();
  }

  async load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.calendar = JSON.parse(data);
      }
    } catch (e) {
      console.warn("[LearningCalendar] 加载日历失败:", e.message);
      this.calendar = {};
    }
  }

  async save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.calendar));
    } catch (e) {
      console.warn("[LearningCalendar] 保存日历失败:", e.message);
    }
  }

  /**
   * 记录今日学习
   */
  async recordToday(stats = {}) {
    const today = new Date().toISOString().slice(0, 10);
    if (!this.calendar[today]) {
      this.calendar[today] = { studied: 0, mastered: 0, correct: 0, wrong: 0 };
    }
    
    this.calendar[today].studied += stats.studied || 0;
    this.calendar[today].mastered += stats.mastered || 0;
    this.calendar[today].correct += stats.correct || 0;
    this.calendar[today].wrong += stats.wrong || 0;
    
    await this.save();
  }

  /**
   * 获取月度数据
   */
  getMonthData(year, month) {
    const result = {};
    const prefix = `${year}-${String(month).padStart(2, "0")}`;
    
    Object.keys(this.calendar).forEach((date) => {
      if (date.startsWith(prefix)) {
        result[date] = this.calendar[date];
      }
    });
    
    return result;
  }

  /**
   * 获取统计
   */
  getStats() {
    let totalStudied = 0;
    let totalMastered = 0;
    let totalCorrect = 0;
    let totalWrong = 0;
    let streak = 0;
    let currentDate = new Date();
    
    // 计算连续打卡天数
    while (true) {
      const dateStr = currentDate.toISOString().slice(0, 10);
      if (this.calendar[dateStr] && this.calendar[dateStr].studied > 0) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    // 总计
    Object.values(this.calendar).forEach((day) => {
      totalStudied += day.studied;
      totalMastered += day.mastered;
      totalCorrect += day.correct;
      totalWrong += day.wrong;
    });
    
    return {
      totalDays: Object.keys(this.calendar).length,
      totalStudied,
      totalMastered,
      totalCorrect,
      totalWrong,
      streak,
      accuracy: totalCorrect + totalWrong > 0 
        ? (totalCorrect / (totalCorrect + totalWrong) * 100).toFixed(1) 
        : 0,
    };
  }
}

/**
 * 错题本管理器
 */
class MistakeBookManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.storageKey = "chemfig-mistake-book";
    this.mistakes = [];
    this.load();
  }

  async load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.mistakes = JSON.parse(data);
      }
    } catch (e) {
      console.warn("[MistakeBook] 加载错题本失败:", e.message);
      this.mistakes = [];
    }
  }

  async save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.mistakes));
    } catch (e) {
      console.warn("[MistakeBook] 保存错题本失败:", e.message);
    }
  }

  /**
   * 添加错题
   */
  async addMistake(item) {
    // 检查是否已存在
    const existing = this.mistakes.findIndex((m) => m.knowledgeId === item.knowledgeId);
    
    if (existing >= 0) {
      // 增加错误次数
      this.mistakes[existing].wrongCount++;
      this.mistakes[existing].lastWrong = Date.now();
    } else {
      // 新增错题
      this.mistakes.push({
        knowledgeId: item.knowledgeId,
        title: item.title,
        wrongCount: 1,
        lastWrong: Date.now(),
        mastered: false,
      });
    }
    
    await this.save();
  }

  /**
   * 标记为已掌握
   */
  async markAsMastered(knowledgeId) {
    const item = this.mistakes.find((m) => m.knowledgeId === knowledgeId);
    if (item) {
      item.mastered = true;
      await this.save();
    }
  }

  /**
   * 获取错题列表
   */
  getMistakes(includeMastered = false) {
    if (includeMastered) {
      return this.mistakes.sort((a, b) => b.wrongCount - a.wrongCount);
    }
    return this.mistakes
      .filter((m) => !m.mastered)
      .sort((a, b) => b.wrongCount - a.wrongCount);
  }

  /**
   * 清空错题本
   */
  async clear() {
    this.mistakes = [];
    await this.save();
  }
}

/**
 * 学习日历模态框
 */
class StudyCalendarModal extends Modal {
  constructor(app) {
    super(app);
    this.calendarManager = new LearningCalendarManager(null);
    this.currentDate = new Date();
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("learning-calendar-modal");

    contentEl.createEl("h2", { text: "📅 学习日历" });

    // 统计概览
    const stats = this.calendarManager.getStats();
    const statsBar = contentEl.createDiv({ cls: "calendar-stats" });
    statsBar.createSpan({ text: `连续打卡: ${stats.streak} 天`, cls: "stat-streak" });
    statsBar.createSpan({ text: `总学习天数: ${stats.totalDays}`, cls: "stat-days" });
    statsBar.createSpan({ text: `正确率: ${stats.accuracy}%`, cls: "stat-accuracy" });

    // 日历
    this.calendarContainer = contentEl.createDiv({ cls: "calendar-container" });
    this.renderCalendar();
  }

  renderCalendar() {
    this.calendarContainer.empty();
    
    const year = this.currentDate.getFullYear();
    const month = this.currentDate.getMonth();
    
    // 月份标题
    const header = this.calendarContainer.createDiv({ cls: "calendar-header" });
    
    const prevBtn = header.createEl("button", { text: "‹", cls: "calendar-nav" });
    prevBtn.onclick = () => {
      this.currentDate.setMonth(month - 1);
      this.renderCalendar();
    };
    
    header.createSpan({ text: `${year}年${month + 1}月`, cls: "calendar-title" });
    
    const nextBtn = header.createEl("button", { text: "›", cls: "calendar-nav" });
    nextBtn.onclick = () => {
      this.currentDate.setMonth(month + 1);
      this.renderCalendar();
    };

    // 星期标题
    const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
    const weekHeader = this.calendarContainer.createDiv({ cls: "calendar-week-header" });
    weekDays.forEach((day) => {
      weekHeader.createDiv({ text: day, cls: "week-day" });
    });

    // 日期格子
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    
    const monthData = this.calendarManager.getMonthData(year, month);
    
    const grid = this.calendarContainer.createDiv({ cls: "calendar-grid" });
    
    // 前面的空格
    for (let i = 0; i < startOffset; i++) {
      grid.createDiv({ cls: "calendar-day empty" });
    }
    
    // 日期
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dayData = monthData[dateStr];
      
      const dayEl = grid.createDiv({
        cls: `calendar-day ${dayData && dayData.studied > 0 ? "studied" : ""}`,
      });
      dayEl.createSpan({ text: day, cls: "day-number" });
      
      if (dayData && dayData.studied > 0) {
        dayEl.createDiv({ text: dayData.studied, cls: "day-count" });
      }
    }
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// 导出全局变量
// LearningCalendarManager, MistakeBookManager, LearningCalendarModal
