// ========== 学习报告生成 (v17.2.0) ==========
// 自动生成学习进度报告

class LearningReportGenerator {
  constructor(plugin) {
    this.plugin = plugin;
    this.calendarManager = new LearningCalendarManager(plugin);
    this.learningManager = new KnowledgeLearningManager(plugin);
    this.achievementManager = new AchievementManager(plugin);
    this.goalManager = new LearningGoalManager(plugin);
  }

  /**
   * 生成每日学习报告
   */
  generateDailyReport() {
    const today = new Date().toISOString().slice(0, 10);
    const calendarData = this.calendarManager.getMonthData(
      new Date().getFullYear(),
      new Date().getMonth() + 1
    );
    const todayData = calendarData[today] || { studied: 0, mastered: 0, correct: 0, wrong: 0 };

    let report = `# 每日学习报告\n\n`;
    report += `**日期**: ${today}\n\n`;
    
    report += `## 今日学习概况\n\n`;
    report += `- 学习知识点: ${todayData.studied} 个\n`;
    report += `- 掌握知识点: ${todayData.mastered} 个\n`;
    report += `- 答对题目: ${todayData.correct} 题\n`;
    report += `- 答错题目: ${todayData.wrong} 题\n`;
    report += `- 正确率: ${todayData.correct + todayData.wrong > 0 
      ? (todayData.correct / (todayData.correct + todayData.wrong) * 100).toFixed(1) 
      : 0}%\n\n`;

    // 今日目标完成情况
    const goalProgress = this.goalManager.getProgress();
    report += `## 今日目标完成情况\n\n`;
    report += `- 学习目标: ${goalProgress.daily.current} / ${goalProgress.daily.target} (${goalProgress.daily.percent}%)\n`;
    report += `- 完成进度: ${"█".repeat(Math.floor(goalProgress.daily.percent / 10))}${"░".repeat(10 - Math.floor(goalProgress.daily.percent / 10))}\n\n`;

    return report;
  }

  /**
   * 生成每周学习报告
   */
  generateWeeklyReport() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    
    const calendarData = this.calendarManager.getMonthData(
      now.getFullYear(),
      now.getMonth() + 1
    );

    let report = `# 每周学习报告\n\n`;
    report += `**周期**: ${weekStart.toLocaleDateString()} - ${now.toLocaleDateString()}\n\n`;

    // 统计本周数据
    let totalStudied = 0;
    let totalMastered = 0;
    let totalCorrect = 0;
    let totalWrong = 0;
    let activeDays = 0;

    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateStr = date.toISOString().slice(0, 10);
      const dayData = calendarData[dateStr];
      
      if (dayData && dayData.studied > 0) {
        activeDays++;
        totalStudied += dayData.studied;
        totalMastered += dayData.mastered;
        totalCorrect += dayData.correct;
        totalWrong += dayData.wrong;
      }
    }

    report += `## 本周学习概况\n\n`;
    report += `- 活跃天数: ${activeDays} / 7 天\n`;
    report += `- 学习知识点: ${totalStudied} 个\n`;
    report += `- 掌握知识点: ${totalMastered} 个\n`;
    report += `- 答对题目: ${totalCorrect} 题\n`;
    report += `- 答错题目: ${totalWrong} 题\n`;
    report += `- 正确率: ${totalCorrect + totalWrong > 0 
      ? (totalCorrect / (totalCorrect + totalWrong) * 100).toFixed(1) 
      : 0}%\n\n`;

    // 本周目标完成情况
    const goalProgress = this.goalManager.getProgress();
    report += `## 本周目标完成情况\n\n`;
    report += `- 学习目标: ${goalProgress.weekly.current} / ${goalProgress.weekly.target} (${goalProgress.weekly.percent}%)\n`;
    report += `- 完成进度: ${"█".repeat(Math.floor(goalProgress.weekly.percent / 10))}${"░".repeat(10 - Math.floor(goalProgress.weekly.percent / 10))}\n\n`;

    // 每日学习详情
    report += `## 每日学习详情\n\n`;
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
      const dateStr = date.toISOString().slice(0, 10);
      const dayData = calendarData[dateStr];
      
      const dayName = ["日", "一", "二", "三", "四", "五", "六"][date.getDay()];
      if (dayData && dayData.studied > 0) {
        report += `- 周${dayName}: 学习 ${dayData.studied} 个, 掌握 ${dayData.mastered} 个\n`;
      } else {
        report += `- 周${dayName}: 未学习\n`;
      }
    }
    report += `\n`;

    return report;
  }

  /**
   * 生成月度学习报告
   */
  generateMonthlyReport() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const calendarData = this.calendarManager.getMonthData(year, month);
    const stats = this.calendarManager.getStats();

    let report = `# 月度学习报告\n\n`;
    report += `**月份**: ${year}年${month}月\n\n`;

    report += `## 月度学习概况\n\n`;
    report += `- 活跃天数: ${stats.totalDays} 天\n`;
    report += `- 学习知识点: ${stats.totalStudied} 个\n`;
    report += `- 掌握知识点: ${stats.totalMastered} 个\n`;
    report += `- 答对题目: ${stats.totalCorrect} 题\n`;
    report += `- 答错题目: ${stats.totalWrong} 题\n`;
    report += `- 正确率: ${stats.accuracy}%\n`;
    report += `- 连续打卡: ${stats.streak} 天\n\n`;

    // 成就解锁情况
    const achievements = this.achievementManager.getAllAchievements();
    const unlockedCount = achievements.filter((a) => a.unlocked).length;
    
    report += `## 成就解锁情况\n\n`;
    report += `- 已解锁: ${unlockedCount} / ${achievements.length} 个\n\n`;

    // 新解锁的成就
    const newlyUnlocked = achievements.filter((a) => {
      if (!a.unlockDate) return false;
      const unlockDate = new Date(a.unlockDate);
      return unlockDate.getMonth() === now.getMonth() && 
             unlockDate.getFullYear() === now.getFullYear();
    });

    if (newlyUnlocked.length > 0) {
      report += `### 本月新解锁成就\n\n`;
      newlyUnlocked.forEach((a) => {
        report += `- ${a.icon} ${a.name}: ${a.description}\n`;
      });
      report += `\n`;
    }

    return report;
  }

  /**
   * 生成综合学习报告
   */
  generateComprehensiveReport() {
    let report = `# 化学学习综合报告\n\n`;
    report += `**生成时间**: ${new Date().toLocaleString()}\n\n`;

    // 学习概况
    const stats = this.calendarManager.getStats();
    report += `## 一、学习概况\n\n`;
    report += `- 总学习天数: ${stats.totalDays} 天\n`;
    report += `- 总学习知识点: ${stats.totalStudied} 个\n`;
    report += `- 总掌握知识点: ${stats.totalMastered} 个\n`;
    report += `- 总答题数: ${stats.totalCorrect + stats.totalWrong} 题\n`;
    report += `- 总正确率: ${stats.accuracy}%\n`;
    report += `- 当前连续打卡: ${stats.streak} 天\n\n`;

    // 学习进度
    const learningStats = this.learningManager.getStats();
    report += `## 二、学习进度\n\n`;
    report += `- 总学习知识点: ${learningStats.total}\n`;
    report += `- 已掌握: ${learningStats.mastered} (${learningStats.masterRate}%)\n`;
    report += `- 学习中: ${learningStats.learning}\n`;
    report += `- 待复习: ${learningStats.review}\n\n`;

    // 成就系统
    const achievements = this.achievementManager.getAllAchievements();
    const unlockedCount = achievements.filter((a) => a.unlocked).length;
    report += `## 三、成就系统\n\n`;
    report += `- 已解锁成就: ${unlockedCount} / ${achievements.length}\n`;
    report += `- 完成率: ${(unlockedCount / achievements.length * 100).toFixed(1)}%\n\n`;

    // 待改进建议
    report += `## 四、学习建议\n\n`;
    
    if (parseFloat(stats.accuracy) < 70) {
      report += `- ⚠️ 正确率较低，建议多复习错题本中的知识点\n`;
    }
    if (stats.streak < 7) {
      report += `- 💪 建议保持连续学习，争取连续打卡 7 天以上\n`;
    }
    if (learningStats.review > 20) {
      report += `- 📚 待复习知识点较多，建议安排时间集中复习\n`;
    }
    if (learningStats.masterRate < 30) {
      report += `- 🎯 掌握率较低，建议增加学习时间，重点掌握核心知识点\n`;
    }
    
    report += `\n`;

    return report;
  }

  /**
   * 导出报告为 Markdown 文件
   */
  async exportReport(type = "comprehensive") {
    let report = "";
    let fileName = "";

    switch (type) {
      case "daily":
        report = this.generateDailyReport();
        fileName = `学习日报-${new Date().toISOString().slice(0, 10)}.md`;
        break;
      case "weekly":
        report = this.generateWeeklyReport();
        fileName = `学习周报-${new Date().toISOString().slice(0, 10)}.md`;
        break;
      case "monthly":
        report = this.generateMonthlyReport();
        fileName = `学习月报-${new Date().toISOString().slice(0, 7)}.md`;
        break;
      default:
        report = this.generateComprehensiveReport();
        fileName = `学习综合报告-${new Date().toISOString().slice(0, 10)}.md`;
    }

    // 创建新笔记
    await this.plugin.app.vault.create(fileName, report);
    new Notice(`报告已导出到: ${fileName}`, 3000);
  }
}

// 导出全局变量
// LearningReportGenerator
