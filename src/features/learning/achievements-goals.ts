// ========== 成就系统和学习目标 (v17.2.0) ==========
// 成就系统：学习进度徽章
// 学习目标：每日/每周学习目标

/**
 * 成就定义
 */
const ACHIEVEMENTS = [
  {
    id: "first-step",
    name: "初出茅庐",
    description: "学习第一个知识点",
    icon: "🌱",
    condition: (stats) => stats.totalStudied >= 1,
  },
  {
    id: "ten-learned",
    name: "小有收获",
    description: "学习 10 个知识点",
    icon: "📚",
    condition: (stats) => stats.totalStudied >= 10,
  },
  {
    id: "fifty-learned",
    name: "勤学不辍",
    description: "学习 50 个知识点",
    icon: "📖",
    condition: (stats) => stats.totalStudied >= 50,
  },
  {
    id: "hundred-learned",
    name: "学富五车",
    description: "学习 100 个知识点",
    icon: "🎓",
    condition: (stats) => stats.totalStudied >= 100,
  },
  {
    id: "first-mastered",
    name: "融会贯通",
    description: "掌握第一个知识点",
    icon: "✨",
    condition: (stats) => stats.totalMastered >= 1,
  },
  {
    id: "ten-mastered",
    name: "得心应手",
    description: "掌握 10 个知识点",
    icon: "💪",
    condition: (stats) => stats.totalMastered >= 10,
  },
  {
    id: "streak-3",
    name: "三日打鱼",
    description: "连续打卡 3 天",
    icon: "🔥",
    condition: (stats) => stats.streak >= 3,
  },
  {
    id: "streak-7",
    name: "一周坚持",
    description: "连续打卡 7 天",
    icon: "⚡",
    condition: (stats) => stats.streak >= 7,
  },
  {
    id: "streak-30",
    name: "月度坚持",
    description: "连续打卡 30 天",
    icon: "🏆",
    condition: (stats) => stats.streak >= 30,
  },
  {
    id: "accuracy-90",
    name: "百发百中",
    description: "正确率达到 90%",
    icon: "🎯",
    condition: (stats) => parseFloat(stats.accuracy) >= 90,
  },
];

/**
 * 成就管理器
 */
class AchievementManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.storageKey = "chemfig-achievements";
    this.unlocked = {}; // { achievementId: unlockDate }
    this.load();
  }

  async load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.unlocked = JSON.parse(data);
      }
    } catch (e) {
      console.warn("[Achievement] 加载成就失败:", e.message);
      this.unlocked = {};
    }
  }

  async save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.unlocked));
    } catch (e) {
      console.warn("[Achievement] 保存成就失败:", e.message);
    }
  }

  /**
   * 检查并解锁成就
   */
  async checkAchievements(stats) {
    const newlyUnlocked = [];
    
    ACHIEVEMENTS.forEach((achievement) => {
      if (!this.unlocked[achievement.id] && achievement.condition(stats)) {
        this.unlocked[achievement.id] = Date.now();
        newlyUnlocked.push(achievement);
        new Notice(`🏆 解锁成就: ${achievement.name}`, 3000);
      }
    });
    
    if (newlyUnlocked.length > 0) {
      await this.save();
    }
    
    return newlyUnlocked;
  }

  /**
   * 获取所有成就状态
   */
  getAllAchievements() {
    return ACHIEVEMENTS.map((achievement) => ({
      ...achievement,
      unlocked: !!this.unlocked[achievement.id],
      unlockDate: this.unlocked[achievement.id]
        ? new Date(this.unlocked[achievement.id]).toLocaleDateString()
        : null,
    }));
  }
}

/**
 * 学习目标管理器
 */
class LearningGoalManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.storageKey = "chemfig-learning-goals";
    this.goals = {
      daily: 10, // 每日学习 10 个知识点
      weekly: 50, // 每周学习 50 个知识点
    };
    this.progress = {
      today: 0,
      thisWeek: 0,
      weekStart: null,
    };
    this.load();
  }

  async load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        this.goals = parsed.goals || this.goals;
        this.progress = parsed.progress || this.progress;
      }
      // 检查是否是新的一周
      this.resetWeekIfNeeded();
      this.resetDailyIfNeeded();
    } catch (e) {
      console.warn("[LearningGoals] 加载目标失败:", e.message);
    }
  }

  async save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        goals: this.goals,
        progress: this.progress,
      }));
    } catch (e) {
      console.warn("[LearningGoals] 保存目标失败:", e.message);
    }
  }

  /**
   * 重置每日进度
   */
  resetDailyIfNeeded() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.progress.lastDay !== today) {
      this.progress.today = 0;
      this.progress.lastDay = today;
      this.save();
    }
  }

  /**
   * 重置每周进度
   */
  resetWeekIfNeeded() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekStartStr = weekStart.toISOString().slice(0, 10);
    
    if (this.progress.weekStart !== weekStartStr) {
      this.progress.thisWeek = 0;
      this.progress.weekStart = weekStartStr;
      this.save();
    }
  }

  /**
   * 更新进度
   */
  async updateProgress(studied = 1) {
    this.resetDailyIfNeeded();
    this.resetWeekIfNeeded();
    
    this.progress.today += studied;
    this.progress.thisWeek += studied;
    
    await this.save();
    
    // 检查目标完成
    this.checkGoalCompletion();
  }

  /**
   * 检查目标完成
   */
  checkGoalCompletion() {
    if (this.progress.today >= this.goals.daily) {
      new Notice(`🎉 今日目标完成！已学习 ${this.progress.today} 个知识点`, 3000);
    }
    if (this.progress.thisWeek >= this.goals.weekly) {
      new Notice(`🎉 本周目标完成！已学习 ${this.progress.thisWeek} 个知识点`, 3000);
    }
  }

  /**
   * 设置目标
   */
  async setGoals(daily, weekly) {
    this.goals.daily = daily;
    this.goals.weekly = weekly;
    await this.save();
  }

  /**
   * 获取目标进度
   */
  getProgress() {
    this.resetDailyIfNeeded();
    this.resetWeekIfNeeded();
    
    return {
      daily: {
        current: this.progress.today,
        target: this.goals.daily,
        percent: Math.min(100, (this.progress.today / this.goals.daily * 100).toFixed(1)),
      },
      weekly: {
        current: this.progress.thisWeek,
        target: this.goals.weekly,
        percent: Math.min(100, (this.progress.thisWeek / this.goals.weekly * 100).toFixed(1)),
      },
    };
  }
}

// 导出全局变量
// ACHIEVEMENTS, AchievementManager, LearningGoalManager
