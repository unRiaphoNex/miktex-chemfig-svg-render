// ========== 学习卡片系统 (v17.2.0) ==========
// 基于 FSRS 算法的间隔重复学习卡片
// 翻转卡片：正面显示结构，背面显示详细信息

const FSRS_DEFAULTS = {
  // FSRS v6 默认参数
  w: [
    0.4072, 1.1829, 3.1262, 1.0431, 5.1182,
    1.7623, 0.0049, 0.4582, 0.7538, 0.2626,
    0.7598, 0.9927, 0.1340, 1.2198, 0.2790,
    0.0851, 0.9720,
  ],
  requestedRetention: 0.9,
  maximumInterval: 36500,
};

class LearningCard {
  constructor(knowledgeId, front, back) {
    this.knowledgeId = knowledgeId;
    this.front = front;
    this.back = back;
    this.state = "new"; // new, learning, review, relearning
    this.step = 0;
    this.learningSteps = [1 / 24, 1, 3, 10]; // 步骤间隔（天）
    this.reviewSteps = [10];
    this.lapses = 0;
    this.lastReview = null;
    this.due = null;
    this.stability = 0;
    this.difficulty = 0;
  }

  /**
   * FSRS 算法：根据评分计算下一次复习时间
   * rating: 1=Again, 2=Hard, 3=Good, 4=Easy
   */
  schedule(rating) {
    const now = Date.now() / 1000; // 秒
    
    if (this.state === "new") {
      // 新卡片
      if (rating >= 3) {
        // Good or Easy：进入复习阶段
        this.state = "review";
        this.stability = this.initStability(rating);
        this.difficulty = this.initDifficulty(rating);
      } else {
        // Again or Hard：学习阶段
        this.state = "learning";
        this.step = Math.max(0, this.step - (rating === 1 ? 1 : 0));
        this.due = now + this.learningSteps[this.step] * 86400;
        this.step++;
        return this.due;
      }
    } else if (this.state === "learning" || this.state === "relearning") {
      // 学习阶段
      if (rating >= 3) {
        // Good：完成学习，进入复习
        this.state = "review";
        this.stability = Math.max(this.stability, this.initStability(rating));
        this.due = now + this.stability * 86400;
      } else {
        // Again：保持学习
        this.step = 0;
        this.due = now + this.learningSteps[this.step] * 86400;
        this.step++;
      }
      return this.due;
    } else if (this.state === "review") {
      // 复习阶段
      if (rating === 1) {
        // Again：遗忘，重新学习
        this.lapses++;
        this.state = "relearning";
        this.step = 0;
        this.difficulty = Math.min(this.difficulty + 0.2, 10);
        this.stability = this.stability * 0.5;
        this.due = now + this.reviewSteps[this.step] * 86400;
        this.step++;
      } else {
        // Hard, Good, Easy：更新稳定性和难度
        this.difficulty = this.nextDifficulty(this.difficulty, rating);
        this.stability = this.nextStability(this.stability, this.difficulty, rating);
        this.due = now + this.stability * 86400;
      }
      return this.due;
    }

    this.lastReview = now;
    return this.due;
  }

  /**
   * 初始化稳定性
   */
  initStability(rating) {
    const w = FSRS_DEFAULTS.w;
    return Math.max(0.1, w[rating - 1]);
  }

  /**
   * 初始化难度
   */
  initDifficulty(rating) {
    const w = FSRS_DEFAULTS.w;
    return Math.max(1, Math.min(10, w[4] - (rating - 3) * w[5]));
  }

  /**
   * 更新难度
   */
  nextDifficulty(difficulty, rating) {
    const w = FSRS_DEFAULTS.w;
    const next = difficulty - w[6] * (rating - 3);
    return Math.max(1, Math.min(10, next));
  }

  /**
   * 更新稳定性
   */
  nextStability(stability, difficulty, rating) {
    const w = FSRS_DEFAULTS.w;
    const easyBonus = rating === 4 ? w[9] : 1;
    const hardPenalty = rating === 2 ? w[10] : 1;
    
    const next = stability * (1 + Math.exp(w[11]) * 
      (11.83 - difficulty) * 
      Math.pow(stability, -w[12]) * 
      (Math.exp(w[13] * (1 - FSRS_DEFAULTS.requestedRetention)) - 1) * 
      easyBonus * hardPenalty);
    
    return Math.min(next, FSRS_DEFAULTS.maximumInterval);
  }

  /**
   * 获取卡片状态
   */
  getStatus() {
    return {
      state: this.state,
      step: this.step,
      stability: this.stability,
      difficulty: this.difficulty,
      due: this.due ? new Date(this.due * 1000).toLocaleDateString() : "未设置",
      lastReview: this.lastReview ? new Date(this.lastReview * 1000).toLocaleDateString() : "未复习",
    };
  }
}

/**
 * 学习卡片模态框
 */
class FSLearningCardModal extends Modal {
  constructor(app, cards = []) {
    super(app);
    this.cards = cards;
    this.currentIndex = 0;
    this.isFlipped = false;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("learning-card-modal");

    if (this.cards.length === 0) {
      contentEl.createDiv({
        text: "暂无待学习卡片",
        cls: "learning-card-empty",
      });
      return;
    }

    // 卡片统计
    const stats = contentEl.createDiv({ cls: "learning-card-stats" });
    stats.createSpan({ text: `第 ${this.currentIndex + 1} / ${this.cards.length} 张`, cls: "card-count" });

    // 卡片容器
    this.cardContainer = contentEl.createDiv({ cls: "card-container" });
    
    // 卡片
    this.cardEl = this.cardContainer.createDiv({ cls: "learning-card" });
    this.cardFront = this.cardEl.createDiv({ cls: "card-front" });
    this.cardBack = this.cardEl.createDiv({ cls: "card-back" });

    // 显示当前卡片
    this.showCurrentCard();

    // 点击翻转
    this.cardEl.onclick = () => this.flipCard();

    // 评分按钮
    const ratingBar = contentEl.createDiv({ cls: "rating-bar" });
    
    const ratings = [
      { value: 1, label: "忘记", cls: "rating-again" },
      { value: 2, label: "困难", cls: "rating-hard" },
      { value: 3, label: "良好", cls: "rating-good" },
      { value: 4, label: "简单", cls: "rating-easy" },
    ];

    ratings.forEach(({ value, label, cls }) => {
      const btn = ratingBar.createEl("button", {
        text: label,
        cls: `rating-btn ${cls}`,
      });
      btn.onclick = () => this.rateCard(value);
    });
  }

  showCurrentCard() {
    const card = this.cards[this.currentIndex];
    if (!card) return;

    this.isFlipped = false;
    this.cardEl.classList.remove("flipped");

    // 正面
    this.cardFront.empty();
    this.cardFront.createDiv({ text: card.knowledgeId, cls: "card-id" });
    this.cardFront.createDiv({ text: card.front, cls: "card-title" });

    // 背面
    this.cardBack.empty();
    this.cardBack.createDiv({ text: card.back, cls: "card-content" });
  }

  flipCard() {
    this.isFlipped = !this.isFlipped;
    this.cardEl.classList.toggle("flipped");
  }

  rateCard(rating) {
    const card = this.cards[this.currentIndex];
    card.schedule(rating);

    // 下一张
    this.currentIndex++;
    if (this.currentIndex >= this.cards.length) {
      // 全部完成
      this.contentEl.empty();
      this.contentEl.createDiv({
        text: "🎉 学习完成！",
        cls: "learning-complete",
      });
      return;
    }

    this.showCurrentCard();
    // 更新统计
    const stats = this.contentEl.querySelector(".card-count");
    if (stats) {
      stats.textContent = `第 ${this.currentIndex + 1} / ${this.cards.length} 张`;
    }
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// 导出全局变量
// LearningCard, LearningCardModal
