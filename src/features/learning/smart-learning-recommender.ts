// ========== 智能学习推荐 (v17.2.0) ==========
// 基于知识库和学习进度的智能推荐
// 推荐学习路径、薄弱知识点、相关内容

class SmartLearningRecommender {
  constructor() {
    this.learningProgress = this.loadLearningProgress();
    this.network = new KnowledgeRelationNetwork();
  }

  /**
   * 加载学习进度
   */
  loadLearningProgress() {
    try {
      const saved = localStorage.getItem("chemfig-learning-progress");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("[SmartRecommender] 加载学习进度失败:", e);
    }
    return {};
  }

  /**
   * 保存学习进度
   */
  saveLearningProgress() {
    localStorage.setItem("chemfig-learning-progress", JSON.stringify(this.learningProgress));
  }

  /**
   * 标记知识点为已学
   */
  markAsLearned(knowledgeId, level = 1) {
    this.learningProgress[knowledgeId] = {
      learned: true,
      level: level, // 1=了解, 2=熟悉, 3=掌握
      learnedAt: Date.now(),
    };
    this.saveLearningProgress();
  }

  /**
   * 获取推荐学习列表
   */
  getRecommendations(limit = 10) {
    const recommendations = [];
    const allKnowledge = this.network.getAllKnowledge();

    // 1. 优先推荐未学的基础知识点
    const unlearned = allKnowledge.filter((item) => {
      return !this.learningProgress[item.id]?.learned;
    });

    // 2. 按难度排序（简单的优先）
    const sorted = unlearned.sort((a, b) => {
      // 基础章节优先
      const chapterA = parseInt(a.chapter) || 999;
      const chapterB = parseInt(b.chapter) || 999;
      return chapterA - chapterB;
    });

    recommendations.push(...sorted.slice(0, limit));

    return recommendations;
  }

  /**
   * 获取复习推荐
   */
  getReviewRecommendations(limit = 10) {
    const reviews = [];
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;

    // 找出需要复习的知识点
    Object.keys(this.learningProgress).forEach((id) => {
      const progress = this.learningProgress[id];
      if (!progress.learned) return;

      const daysSinceLearned = (now - progress.learnedAt) / oneDay;
      
      // 根据掌握度计算复习间隔
      let reviewInterval;
      switch (progress.level) {
        case 3: // 掌握
          reviewInterval = 30; // 30天复习一次
          break;
        case 2: // 熟悉
          reviewInterval = 7; // 7天复习一次
          break;
        case 1: // 了解
        default:
          reviewInterval = 1; // 1天复习一次
          break;
      }

      // 如果超过复习间隔，加入复习列表
      if (daysSinceLearned >= reviewInterval) {
        const knowledge = this.network.getKnowledgeById(id);
        if (knowledge) {
          reviews.push({
            ...knowledge,
            daysSinceLearned: Math.floor(daysSinceLearned),
            reviewInterval: reviewInterval,
            level: progress.level,
          });
        }
      }
    });

    // 按需要紧急程度排序
    return reviews.sort((a, b) => {
      const urgencyA = a.daysSinceLearned / a.reviewInterval;
      const urgencyB = b.daysSinceLearned / b.reviewInterval;
      return urgencyB - urgencyA;
    }).slice(0, limit);
  }

  /**
   * 获取薄弱知识点
   */
  getWeakPoints(limit = 10) {
    const weakPoints = [];
    const allKnowledge = this.network.getAllKnowledge();

    // 找出学习进度低的知识点
    allKnowledge.forEach((item) => {
      const progress = this.learningProgress[item.id];
      if (progress && progress.level <= 1) {
        weakPoints.push({
          ...item,
          level: progress.level,
          learnedAt: progress.learnedAt,
        });
      }
    });

    // 按章节排序
    return weakPoints.sort((a, b) => {
      const chapterA = parseInt(a.chapter) || 999;
      const chapterB = parseInt(b.chapter) || 999;
      return chapterA - chapterB;
    }).slice(0, limit);
  }

  /**
   * 获取学习路径
   */
  getLearningPath(targetKnowledgeId) {
    const path = [];
    const visited = new Set();

    // BFS 找路径
    const queue = [[targetKnowledgeId]];
    
    while (queue.length > 0 && path.length < 10) {
      const currentPath = queue.shift();
      const currentId = currentPath[currentPath.length - 1];

      if (visited.has(currentId)) continue;
      visited.add(currentId);

      // 获取关联知识点
      const related = this.network.getRelatedKnowledge(currentId, 1);
      
      related.forEach((item) => {
        if (!visited.has(item.id)) {
          queue.push([...currentPath, item.id]);
        }
      });

      path.push(currentId);
    }

    return path;
  }

  /**
   * 获取学习统计
   */
  getLearningStats() {
    const allKnowledge = this.network.getAllKnowledge();
    const total = allKnowledge.length;
    
    let learned = 0;
    let mastered = 0;
    let familiar = 0;
    let understood = 0;

    Object.keys(this.learningProgress).forEach((id) => {
      const progress = this.learningProgress[id];
      if (progress.learned) {
        learned++;
        switch (progress.level) {
          case 3:
            mastered++;
            break;
          case 2:
            familiar++;
            break;
          case 1:
            understood++;
            break;
        }
      }
    });

    return {
      total: total,
      learned: learned,
      mastered: mastered,
      familiar: familiar,
      understood: understood,
      progress: ((learned / total) * 100).toFixed(1),
    };
  }
}

/**
 * 智能学习推荐模态框
 */
class SmartLearningRecommendModal extends Modal {
  constructor(app) {
    super(app);
    this.recommender = new SmartLearningRecommender();
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("smart-learning-modal");

    // 标题
    contentEl.createEl("h2", { text: "🎯 智能学习推荐" });

    // 标签页
    const tabs = contentEl.createDiv({ cls: "smart-learning-tabs" });
    
    const tabRecommend = tabs.createEl("button", {
      text: "推荐学习",
      cls: "smart-learning-tab active",
    });
    
    const tabReview = tabs.createEl("button", {
      text: "复习提醒",
      cls: "smart-learning-tab",
    });
    
    const tabWeak = tabs.createEl("button", {
      text: "薄弱点",
      cls: "smart-learning-tab",
    });
    
    const tabStats = tabs.createEl("button", {
      text: "学习统计",
      cls: "smart-learning-tab",
    });

    // 内容区域
    this.contentArea = contentEl.createDiv({ cls: "smart-learning-content" });

    // 标签切换事件
    tabRecommend.onclick = () => {
      this.setActiveTab(tabs, tabRecommend);
      this.showRecommendations();
    };

    tabReview.onclick = () => {
      this.setActiveTab(tabs, tabReview);
      this.showReviews();
    };

    tabWeak.onclick = () => {
      this.setActiveTab(tabs, tabWeak);
      this.showWeakPoints();
    };

    tabStats.onclick = () => {
      this.setActiveTab(tabs, tabStats);
      this.showStats();
    };

    // 默认显示推荐
    this.showRecommendations();
  }

  /**
   * 设置活动标签
   */
  setActiveTab(tabs, activeTab) {
    tabs.querySelectorAll(".smart-learning-tab").forEach((tab) => {
      tab.removeClass("active");
    });
    activeTab.addClass("active");
  }

  /**
   * 显示推荐学习
   */
  showRecommendations() {
    this.contentArea.empty();
    
    const recommendations = this.recommender.getRecommendations(15);
    
    this.contentArea.createEl("h3", { text: "推荐学习知识点" });

    if (recommendations.length === 0) {
      this.contentArea.createDiv({
        text: "所有知识点都已学习！",
        cls: "no-recommendations",
      });
      return;
    }

    recommendations.forEach((item) => {
      const recItem = this.contentArea.createDiv({ cls: "recommendation-item" });
      
      const header = recItem.createDiv({ cls: "recommendation-header" });
      header.createSpan({ text: item.id, cls: "recommendation-id" });
      header.createSpan({ text: item.title, cls: "recommendation-title" });
      
      const meta = recItem.createDiv({ cls: "recommendation-meta" });
      meta.createSpan({ text: item.bookName, cls: "recommendation-book" });
      meta.createSpan({ text: `第 ${item.chapter} 章`, cls: "recommendation-chapter" });
      
      const preview = recItem.createDiv({
        text: item.content.substring(0, 100) + "...",
        cls: "recommendation-preview",
      });

      // 标记为已学按钮
      const actions = recItem.createDiv({ cls: "recommendation-actions" });
      const learnBtn = actions.createEl("button", {
        text: "标记为已学",
        cls: "mark-learned-btn",
      });
      
      learnBtn.onclick = () => {
        this.recommender.markAsLearned(item.id, 2);
        new Notice(`已标记 ${item.id} 为已学`, 2000);
        this.showRecommendations(); // 刷新
      };
    });
  }

  /**
   * 显示复习提醒
   */
  showReviews() {
    this.contentArea.empty();
    
    const reviews = this.recommender.getReviewRecommendations(15);
    
    this.contentArea.createEl("h3", { text: "需要复习的知识点" });

    if (reviews.length === 0) {
      this.contentArea.createDiv({
        text: "暂时没有需要复习的知识点",
        cls: "no-reviews",
      });
      return;
    }

    reviews.forEach((item) => {
      const reviewItem = this.contentArea.createDiv({ cls: "review-item" });
      
      const header = reviewItem.createDiv({ cls: "review-header" });
      header.createSpan({ text: item.id, cls: "review-id" });
      header.createSpan({ text: item.title, cls: "review-title" });
      header.createSpan({ text: `已学 ${item.daysSinceLearned} 天`, cls: "review-days" });
      
      const meta = reviewItem.createDiv({ cls: "review-meta" });
      meta.createSpan({ text: item.bookName, cls: "review-book" });
      meta.createSpan({ text: `掌握度: ${["", "了解", "熟悉", "掌握"][item.level]}`, cls: "review-level" });
    });
  }

  /**
   * 显示薄弱点
   */
  showWeakPoints() {
    this.contentArea.empty();
    
    const weakPoints = this.recommender.getWeakPoints(15);
    
    this.contentArea.createEl("h3", { text: "薄弱知识点" });

    if (weakPoints.length === 0) {
      this.contentArea.createDiv({
        text: "没有薄弱知识点，继续保持！",
        cls: "no-weak-points",
      });
      return;
    }

    weakPoints.forEach((item) => {
      const weakItem = this.contentArea.createDiv({ cls: "weak-point-item" });
      
      const header = weakItem.createDiv({ cls: "weak-point-header" });
      header.createSpan({ text: item.id, cls: "weak-point-id" });
      header.createSpan({ text: item.title, cls: "weak-point-title" });
      
      const meta = weakItem.createDiv({ cls: "weak-point-meta" });
      meta.createSpan({ text: item.bookName, cls: "weak-point-book" });
      meta.createSpan({ text: `掌握度: ${["", "了解", "熟悉", "掌握"][item.level]}`, cls: "weak-point-level" });
    });
  }

  /**
   * 显示学习统计
   */
  showStats() {
    this.contentArea.empty();
    
    const stats = this.recommender.getLearningStats();
    
    this.contentArea.createEl("h3", { text: "学习统计" });

    const statsDiv = this.contentArea.createDiv({ cls: "learning-stats" });
    
    const statItems = [
      { label: "总知识点", value: stats.total },
      { label: "已学习", value: stats.learned },
      { label: "掌握", value: stats.mastered },
      { label: "熟悉", value: stats.familiar },
      { label: "了解", value: stats.understood },
      { label: "完成进度", value: stats.progress + "%" },
    ];

    statItems.forEach(({ label, value }) => {
      const statRow = statsDiv.createDiv({ cls: "stat-row" });
      statRow.createSpan({ text: label, cls: "stat-label" });
      statRow.createSpan({ text: value, cls: "stat-value" });
    });

    // 进度条
    const progressBar = statsDiv.createDiv({ cls: "progress-bar" });
    const progressFill = progressBar.createDiv({ cls: "progress-fill" });
    progressFill.style.width = stats.progress + "%";
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// 导出全局变量
// SmartLearningRecommender, SmartLearningRecommendModal
