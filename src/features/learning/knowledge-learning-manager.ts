// ========== 知识库学习功能 (v17.2.0) ==========
// 学习进度追踪、复习提醒、掌握度评估

class KnowledgeLearningManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.storageKey = "chemfig-knowledge-learning";
    this.progress = {};
    this.load();
  }

  /**
   * 加载学习进度
   */
  async load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.progress = JSON.parse(data);
      }
    } catch (e) {
      console.warn("[KnowledgeLearning] 加载学习进度失败:", e.message);
      this.progress = {};
    }
  }

  /**
   * 保存学习进度
   */
  async save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.progress));
    } catch (e) {
      console.warn("[KnowledgeLearning] 保存学习进度失败:", e.message);
    }
  }

  /**
   * 标记知识点为已学习
   */
  async markAsLearned(knowledgeId, masteryLevel = "review") {
    if (!this.progress[knowledgeId]) {
      this.progress[knowledgeId] = {};
    }
    
    this.progress[knowledgeId].lastStudied = Date.now();
    this.progress[knowledgeId].masteryLevel = masteryLevel; // new, learning, review, mastered
    this.progress[knowledgeId].studyCount = (this.progress[knowledgeId].studyCount || 0) + 1;
    
    await this.save();
  }

  /**
   * 获取知识点学习状态
   */
  getKnowledgeStatus(knowledgeId) {
    return this.progress[knowledgeId] || null;
  }

  /**
   * 获取待复习的知识点
   */
  getDueForReview(daysSinceLastStudy = 7) {
    const now = Date.now();
    const due = [];
    
    Object.keys(this.progress).forEach((id) => {
      const item = this.progress[id];
      if (item.masteryLevel === "mastered") return;
      
      const daysPassed = (now - item.lastStudied) / (1000 * 60 * 60 * 24);
      if (daysPassed >= daysSinceLastStudy) {
        due.push({
          id,
          ...item,
          daysPassed: Math.floor(daysPassed),
        });
      }
    });
    
    return due.sort((a, b) => a.daysPassed - b.daysPassed);
  }

  /**
   * 获取学习统计
   */
  getStats() {
    const total = Object.keys(this.progress).length;
    const mastered = Object.values(this.progress).filter((p) => p.masteryLevel === "mastered").length;
    const learning = Object.values(this.progress).filter((p) => p.masteryLevel === "learning").length;
    const review = Object.values(this.progress).filter((p) => p.masteryLevel === "review").length;
    
    return {
      total,
      mastered,
      learning,
      review,
      masterRate: total > 0 ? (mastered / total * 100).toFixed(1) : 0,
    };
  }

  /**
   * 重置学习进度
   */
  async reset() {
    this.progress = {};
    await this.save();
  }
}

// 导出全局变量
// KnowledgeLearningManager
