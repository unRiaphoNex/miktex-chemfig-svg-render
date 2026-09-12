// ========== 学习日历 & 错题本 (v17.1.0) ==========
// 学习辅助: 学习日历展示 + 错题本功能

import { Modal } from 'obsidian';

// ========== 学习日历模态框 ==========
class LearningCalendarModal extends Modal {
  constructor(app) {
    super(app);
    this.currentYear = new Date().getFullYear();
    this.currentMonth = new Date().getMonth();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("chemfig-calendar-modal");

    contentEl.createEl("h2", { text: "📅 学习日历" });

    // 月份切换
    const navBar = contentEl.createDiv({ cls: "calendar-nav" });
    
    const prevBtn = navBar.createEl("button", { text: "◀", cls: "calendar-nav-btn" });
    prevBtn.onclick = () => {
      this.currentMonth--;
      if (this.currentMonth < 0) {
        this.currentMonth = 11;
        this.currentYear--;
      }
      this.renderCalendar();
    };

    const monthLabel = navBar.createEl("span", { 
      text: `${this.currentYear}年${this.currentMonth + 1}月`,
      cls: "calendar-month-label"
    });

    const nextBtn = navBar.createEl("button", { text: "▶", cls: "calendar-nav-btn" });
    nextBtn.onclick = () => {
      this.currentMonth++;
      if (this.currentMonth > 11) {
        this.currentMonth = 0;
        this.currentYear++;
      }
      this.renderCalendar();
    };

    // 日历网格
    this.calendarEl = contentEl.createDiv({ cls: "calendar-grid" });

    // 统计信息
    const statsEl = contentEl.createDiv({ cls: "calendar-stats" });
    this.renderStats(statsEl);

    this.renderCalendar();
  }

  renderCalendar() {
    this.calendarEl.empty();

    // 星期标题
    const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
    weekDays.forEach((day) => {
      this.calendarEl.createEl("div", { 
        text: day, 
        cls: "calendar-weekday" 
      });
    });

    // 获取当月第一天是星期几
    const firstDay = new Date(this.currentYear, this.currentMonth, 1).getDay();
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

    // 获取学习数据
    const reviewData = this.getReviewData();

    // 填充空白
    for (let i = 0; i < firstDay; i++) {
      this.calendarEl.createEl("div", { cls: "calendar-day empty" });
    }

    // 填充日期
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEl = this.calendarEl.createEl("div", { 
        cls: "calendar-day",
        attr: { "data-date": dateStr }
      });

      dayEl.createEl("span", { text: String(day), cls: "day-number" });

      // 检查是否有学习记录
      if (reviewData[dateStr]) {
        dayEl.addClass("has-activity");
        const count = reviewData[dateStr].count || 0;
        if (count > 0) {
          dayEl.createEl("span", { text: String(count), cls: "day-count" });
        }
      }

      // 今天高亮
      const today = new Date();
      if (today.getFullYear() === this.currentYear &&
          today.getMonth() === this.currentMonth &&
          today.getDate() === day) {
        dayEl.addClass("today");
      }
    }
  }

  renderStats(container) {
    const reviewData = this.getReviewData();
    
    // 计算本月统计
    let totalReviews = 0;
    let activeDays = 0;
    let streak = this.calculateStreak();

    const yearMonth = `${this.currentYear}-${String(this.currentMonth + 1).padStart(2, '0')}`;
    
    Object.keys(reviewData).forEach((date) => {
      if (date.startsWith(yearMonth)) {
        totalReviews += reviewData[date].count || 0;
        activeDays++;
      }
    });

    container.empty();
    container.createEl("div", { cls: "stat-item" }).createEl("span", { 
      text: `本月复习: ${totalReviews} 次` 
    });
    container.createEl("div", { cls: "stat-item" }).createEl("span", { 
      text: `活跃天数: ${activeDays} 天` 
    });
    container.createEl("div", { cls: "stat-item" }).createEl("span", { 
      text: `连续学习: ${streak} 天` 
    });
  }

  getReviewData() {
    try {
      return JSON.parse(localStorage.getItem("chemfig-review-data") || "{}");
    } catch (e) {
      return {};
    }
  }

  calculateStreak() {
    const reviewData = this.getReviewData();
    let streak = 0;
    const today = new Date();

    for (let i = 0; i < 365; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      
      if (reviewData[dateStr] && reviewData[dateStr].count > 0) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }

    return streak;
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// ========== 错题本模态框 ==========
class MistakeBookModal extends Modal {
  constructor(app) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("chemfig-mistake-book-modal");

    contentEl.createEl("h2", { text: "❌ 错题本" });

    // 获取错题数据
    const mistakes = this.getMistakes();

    if (mistakes.length === 0) {
      contentEl.createEl("p", { 
        text: "暂无错题记录，继续保持！",
        cls: "no-mistakes"
      });
      return;
    }

    // 按错误次数排序
    mistakes.sort((a, b) => b.count - a.count);

    // 错题列表
    const listEl = contentEl.createDiv({ cls: "mistake-list" });

    mistakes.forEach((mistake, index) => {
      const itemEl = listEl.createDiv({ cls: "mistake-item" });
      
      const headerEl = itemEl.createDiv({ cls: "mistake-header" });
      headerEl.createEl("span", { text: `${index + 1}. ${mistake.name}`, cls: "mistake-name" });
      headerEl.createEl("span", { text: `错误 ${mistake.count} 次`, cls: "mistake-count" });

      const detailEl = itemEl.createDiv({ cls: "mistake-detail" });
      detailEl.createEl("p", { text: `SMILES: ${mistake.smiles || '未知'}` });
      detailEl.createEl("p", { text: `最后错误: ${mistake.lastError || '未知'}` });

      // 重新练习按钮
      const practiceBtn = itemEl.createEl("button", { 
        text: "重新练习", 
        cls: "mistake-practice-btn" 
      });
      practiceBtn.onclick = () => {
        new Notice(`开始练习: ${mistake.name}`, 2000);
      };
    });

    // 清空错题本按钮
    const clearBtn = contentEl.createEl("button", { 
      text: "清空错题本", 
      cls: "mistake-clear-btn" 
    });
    clearBtn.onclick = () => {
      localStorage.removeItem("chemfig-mistakes");
      this.onOpen();
    };
  }

  getMistakes() {
    try {
      return JSON.parse(localStorage.getItem("chemfig-mistakes") || "[]");
    } catch (e) {
      return [];
    }
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// ========== 导出 ==========
// LearningCalendarModal, MistakeBookModal
