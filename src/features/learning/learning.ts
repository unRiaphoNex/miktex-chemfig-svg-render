// ========== 学习辅助模块 (v11.0.0) ==========
// 功能: 化合物学习卡片 + 间隔重复 + 学习进度追踪
// 学习自 Anki, RemNote 等记忆类插件

// ========== 数据模型 ==========
/**
 * 学习卡片数据结构
 * @typedef {Object} LearningCard
 * @property {string} id - 唯一标识
 * @property {string} name - 化合物名称 (中文)
 * @property {string} englishName - 英文名称
 * @property {string} formula - 分子式
 * @property {string} chemfigCode - chemfig 代码
 * @property {string} smiles - SMILES 结构
 * @property {string} category - 分类 (醇/醛/酮/酸...)
 * @property {string} usage - 用途
 * @property {string} source - 来源
 * @property {string[]} tags - 标签
 * @property {number} difficulty - 难度 (1-5)
 * @property {LearningState} state - 学习状态
 */

/**
 * 学习状态 (SM-2 间隔重复算法)
 * @typedef {Object} LearningState
 * @property {number} repetitions - 重复次数
 * @property {number} interval - 当前间隔 (天)
 * @property {number} easeFactor - 难度因子 (默认 2.5)
 * @property {number} nextReview - 下次复习时间 (timestamp)
 * @property {number} lastReview - 上次复习时间 (timestamp)
 * @property {string} status - 状态: new/learning/review/known
 */

// ========== SM-2 间隔重复算法 ==========
class SM2Algorithm {
  /**
   * 计算复习后的新状态
   * @param {LearningState} state - 当前状态
   * @param {number} quality - 评分 (0-5): 0=完全忘记, 1=困难, 2=好, 3=容易, 4=非常容易, 5=完美
   * @returns {LearningState} 新的学习状态
   */
  static review(state, quality) {
    const newState = { ...state };
    const now = Date.now();

    if (quality < 3) {
      // 忘记了, 重置重复次数
      newState.repetitions = 0;
      newState.interval = 1; // 1天后
    } else {
      // 记住了
      newState.repetitions = (state.repetitions || 0) + 1;

      if (newState.repetitions === 1) {
        newState.interval = 1;
      } else if (newState.repetitions === 2) {
        newState.interval = 3;
      } else {
        newState.interval = Math.round(
          (state.interval || 1) * (state.easeFactor || 2.5)
        );
      }
    }

    // 更新难度因子
    newState.easeFactor =
      (state.easeFactor || 2.5) + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    if (newState.easeFactor < 1.3) newState.easeFactor = 1.3;

    newState.lastReview = now;
    newState.nextReview = now + newState.interval * 24 * 60 * 60 * 1000;
    newState.status = newState.repetitions >= 3 ? "known" : "learning";

    return newState;
  }

  /**
   * 获取默认状态
   * @returns {LearningState}
   */
  static defaultState() {
    return {
      repetitions: 0,
      interval: 0,
      easeFactor: 2.5,
      nextReview: Date.now(),
      lastReview: 0,
      status: "new",
    };
  }
}

// ========== FSRS 间隔重复算法 (v15.3.0) ==========
// 学习自 open-spaced-repetition/fsrs4anki
// 比 SM-2 更精准的记忆调度算法
class FsrsAlgorithm {
  /**
   * FSRS 默认参数 (简化版)
   */
  static defaultWeights = [
    0.4072, 1.1829, 3.1262, 1.4954, 0.8814,
    0.0422, 1.5542, 0.1364, 1.0503, 0.0208,
    0.0115, 0.2194, 0.152, 1.3167, 0.002,
    1.0921, 0.0, 0.3158, 0.2303,
  ];

  /**
   * 计算遗忘概率
   * @param {number} elapsedDays - 经过天数
   * @param {number} stability - 记忆稳定性
   * @returns {number} 遗忘概率 (0-1)
   */
  static forgettingProbability(elapsedDays, stability) {
    if (stability <= 0) return 1;
    return Math.pow(1 + elapsedDays / (9 * stability), -1);
  }

  /**
   * 更新记忆稳定性
   * @param {number} stability - 当前稳定性
   * @param {number} difficulty - 难度
   * @param {boolean} recall - 是否回忆成功
   * @param {number} elapsedDays - 经过天数
   * @returns {number} 新的稳定性
   */
  static updateStability(stability, difficulty, recall, elapsedDays) {
    const w = this.defaultWeights;
    if (recall) {
      // 回忆成功
      return (
        stability *
        (1 + Math.exp(w[4]) *
          (11 - difficulty) *
          Math.pow(stability, -w[5]) *
          (Math.exp((1 - elapsedDays / stability) * w[6]) - 1))
      );
    } else {
      // 回忆失败
      return w[17] * Math.pow(difficulty, -w[18]) * (Math.pow(stability + 1, w[15]) - 1) * Math.exp(-w[16] * elapsedDays / stability);
    }
  }

  /**
   * 更新难度
   * @param {number} difficulty - 当前难度
   * @param {boolean} recall - 是否回忆成功
   * @returns {number} 新的难度
   */
  static updateDifficulty(difficulty, recall) {
    const w = this.defaultWeights;
    const newDifficulty = difficulty + (recall ? 0 : w[7]);
    return Math.min(10, Math.max(1, newDifficulty));
  }

  /**
   * 计算下次复习间隔
   * @param {number} stability - 记忆稳定性
   * @param {number} desiredRetrievability - 期望回忆率 (默认 0.9)
   * @returns {number} 间隔 (天)
   */
  static nextInterval(stability, desiredRetrievability = 0.9) {
    return Math.round(
      9 * stability * (1 / desiredRetrievability - 1)
    );
  }

  /**
   * FSRS 复习调度
   * @param {LearningState} state - 当前状态
   * @param {number} quality - 评分 (1-4): 1=忘记, 2=困难, 3=好, 4=简单
   * @returns {LearningState} 新的学习状态
   */
  static review(state, quality) {
    const now = Date.now();
    const w = this.defaultWeights;

    // 初始化难度和稳定性
    let difficulty = state.difficulty || 5;
    let stability = state.stability || 0;

    const elapsedDays = state.lastReview
      ? (now - state.lastReview) / (24 * 60 * 60 * 1000)
      : 0;

    const recall = quality >= 2;

    if (state.repetitions === 0) {
      // 新卡片
      difficulty = w[0] - w[1] * (quality - 3);
      stability = w[2];
    } else {
      // 复习过的卡片
      difficulty = this.updateDifficulty(difficulty, recall);
      stability = this.updateStability(stability, difficulty, recall, elapsedDays);
    }

    // 确保难度在 1-10 之间
    difficulty = Math.min(10, Math.max(1, difficulty));
    stability = Math.max(0.1, stability);

    // 计算下次间隔
    const interval = this.nextInterval(stability);

    return {
      repetitions: state.repetitions + (recall ? 1 : 0),
      interval: interval,
      stability: stability,
      difficulty: difficulty,
      nextReview: now + interval * 24 * 60 * 60 * 1000,
      lastReview: now,
      status: state.repetitions >= 3 ? "known" : "learning",
      algorithm: "fsrs",
    };
  }

  /**
   * 获取默认状态
   * @returns {Object}
   */
  static defaultState() {
    return {
      repetitions: 0,
      interval: 0,
      stability: 0,
      difficulty: 5,
      nextReview: Date.now(),
      lastReview: 0,
      status: "new",
      algorithm: "fsrs",
    };
  }
}

// ========== 学习卡片模态框 ==========
class LearningCardModal extends Modal {
  /**
   * @param {App} app - Obsidian App
   * @param {LearningCard} card - 学习卡片
   * @param {Function} onReview - 复习回调 (quality) => void
   * @param {Object} options - 选项
   */
  constructor(app, card, onReview, options = {}) {
    super(app);
    this.card = card;
    this.onReview = onReview;
    this.options = options;
    this.flipped = false;
    this.clozeRevealed = false; // 填空卡片状态
    this.listIndex = 0; // 列表卡片当前索引
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("chemfig-learning-modal");

    const cardType = this.card.type || "basic";

    // 根据卡片类型渲染
    if (cardType === "cloze") {
      this.renderClozeCard(contentEl);
    } else if (cardType === "list") {
      this.renderListCard(contentEl);
    } else {
      this.renderBasicCard(contentEl);
    }
  }

  // ========== 基础卡片 ==========
  renderBasicCard(container) {
    const cardContainer = container.createDiv({ cls: "chemfig-learning-card" });

    // 正面
    const front = cardContainer.createDiv({ cls: "chemfig-card-front" });
    front.createEl("h3", { text: this.card.name });
    front.createEl("p", { text: this.card.formula || "", cls: "chemfig-card-formula" });
    front.createEl("div", { text: "点击卡片查看答案", cls: "chemfig-card-hint" });

    // 背面
    const back = cardContainer.createDiv({ cls: "chemfig-card-back" });
    back.createEl("h3", { text: this.card.name });
    if (this.card.englishName) {
      back.createEl("p", { text: this.card.englishName, cls: "chemfig-card-formula" });
    }
    back.createEl("p", { text: `分子式: ${this.card.formula || "未知"}` });
    back.createEl("p", { text: `分类: ${this.card.category || "未分类"}` });
    if (this.card.usage) back.createEl("p", { text: `用途: ${this.card.usage}` });
    if (this.card.smiles) back.createEl("p", { text: `SMILES: ${this.card.smiles}` });

    // ========== v11.9.0: FSRS 参数显示 ==========
    if (this.card.state) {
      const state = this.card.state;
      if (state.stability || state.difficulty || state.retrievability) {
        const paramsDiv = back.createDiv({ cls: "chemfig-fsrs-params" });
        paramsDiv.createEl("hr");
        paramsDiv.createEl("p", { text: "📊 FSRS 参数:", cls: "fsrs-params-title" });

        if (state.stability) {
          paramsDiv.createEl("p", {
            text: `稳定性 (S): ${state.stability.toFixed(1)} 天`,
            cls: "fsrs-param",
          });
        }
        if (state.difficulty) {
          paramsDiv.createEl("p", {
            text: `难度 (D): ${state.difficulty.toFixed(1)} / 10`,
            cls: "fsrs-param",
          });
        }
        if (state.retrievability) {
          const pct = (state.retrievability * 100).toFixed(1);
          paramsDiv.createEl("p", {
            text: `可回忆性 (R): ${pct}%`,
            cls: "fsrs-param",
          });
        }
        if (state.due) {
          const dueDate = new Date(state.due).toLocaleDateString();
          paramsDiv.createEl("p", {
            text: `下次复习: ${dueDate}`,
            cls: "fsrs-param",
          });
        }
      }
    }

    cardContainer.onclick = () => {
      this.flipped = !this.flipped;
      cardContainer.classList.toggle("flipped", this.flipped);
    };

    this.renderReviewButtons(container);
  }

  // ========== 填空卡片 ==========
  renderClozeCard(container) {
    const cardContainer = container.createDiv({ cls: "chemfig-learning-card" });

    const front = cardContainer.createDiv({ cls: "chemfig-card-front" });
    front.createEl("h3", { text: this.card.name });

    const clozeText = this.card.clozeText || "";
    const displayText = clozeText.replace(/\{\{.*?\}\}/g, "_____");
    front.createEl("p", { text: displayText, cls: "chemfig-cloze-text" });
    front.createEl("div", { text: "点击显示答案", cls: "chemfig-card-hint" });

    const back = cardContainer.createDiv({ cls: "chemfig-card-back" });
    back.createEl("h3", { text: this.card.name });
    const fullText = clozeText.replace(/\{\{(.*?)\}\}/g, "[$1]");
    back.createEl("p", { text: fullText, cls: "chemfig-cloze-text" });

    cardContainer.onclick = () => {
      this.clozeRevealed = !this.clozeRevealed;
      cardContainer.classList.toggle("flipped", this.clozeRevealed);
    };

    this.renderReviewButtons(container);
  }

  // ========== 列表卡片 ==========
  renderListCard(container) {
    const cardContainer = container.createDiv({ cls: "chemfig-learning-card" });
    cardContainer.style.minHeight = "250px";

    cardContainer.createEl("h3", { text: this.card.name });

    const items = this.card.listItems || [];
    const listContainer = cardContainer.createDiv({ cls: "chemfig-list-items" });

    this.listItemEls = items.map((item, idx) => {
      const itemEl = listContainer.createDiv({
        cls: "chemfig-list-item",
        text: `• ${item}`,
      });
      itemEl.style.opacity = idx === 0 ? "1" : "0.3";
      return itemEl;
    });

    cardContainer.onclick = () => {
      if (this.listIndex < this.listItemEls.length - 1) {
        this.listIndex++;
        this.listItemEls.forEach((el, idx) => {
          el.style.opacity = idx <= this.listIndex ? "1" : "0.3";
        });
      } else {
        this.flipped = true;
        cardContainer.classList.add("flipped");
      }
    };

    const back = cardContainer.createDiv({ cls: "chemfig-card-back" });
    back.createEl("h3", { text: this.card.name });
    items.forEach((item) => {
      back.createEl("p", { text: `• ${item}` });
    });

    this.renderReviewButtons(container);
  }

  // 渲染评分按钮
  renderReviewButtons(container) {
    const btnContainer = container.createDiv({ cls: "chemfig-card-buttons" });
    const buttons = [
      { quality: 1, label: "😫 忘记了" },
      { quality: 2, label: "😐 困难" },
      { quality: 3, label: "😊 好" },
      { quality: 4, label: "😎 容易" },
    ];

    buttons.forEach((btn) => {
      const el = btnContainer.createEl("button", {
        text: `${btn.label}`,
        cls: "chemfig-card-review-btn",
      });
      el.onclick = (e) => {
        e.stopPropagation();
        this.onReview(btn.quality);
        this.close();
      };
    });
  }

  renderCard(container) {
    const cardEl = container.querySelector(".chemfig-learning-card");
    if (!cardEl) return;
    cardEl.classList.toggle("flipped", this.flipped);
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// ========== 学习进度面板 ==========
class LearningStatsModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("chemfig-stats-modal");

    contentEl.createEl("h2", { text: "📊 学习进度统计" });

    // 获取学习数据
    const cards = this.plugin.learningCards || [];
    const now = Date.now();

    const stats = {
      total: cards.length,
      new: cards.filter((c) => c.state?.status === "new").length,
      learning: cards.filter((c) => c.state?.status === "learning").length,
      known: cards.filter((c) => c.state?.status === "known").length,
      due: cards.filter((c) => (c.state?.nextReview || 0) <= now).length,
    };

    // 统计面板
    const statsGrid = contentEl.createDiv({ cls: "chemfig-stats-grid" });
    const statItems = [
      { label: "总卡片数", value: stats.total, icon: "📚" },
      { label: "新卡片", value: stats.new, icon: "✨" },
      { label: "学习中", value: stats.learning, icon: "📖" },
      { label: "已掌握", value: stats.known, icon: "✅" },
      { label: "待复习", value: stats.due, icon: "⏰" },
    ];

    statItems.forEach((item) => {
      const statEl = statsGrid.createDiv({ cls: "chemfig-stat-item" });
      statEl.createEl("div", { text: item.icon, cls: "chemfig-stat-icon" });
      statEl.createEl("div", { text: item.value, cls: "chemfig-stat-value" });
      statEl.createEl("div", { text: item.label, cls: "chemfig-stat-label" });
    });

    // 复习日历热力图 (最近 12 周)
    contentEl.createEl("h3", { text: "📅 最近复习情况" });
    const heatmap = this.renderReviewHeatmap(contentEl);

    // ========== v11.4.0: 今日学习目标进度 ==========
    contentEl.createEl("h3", { text: "🎯 今日学习目标" });

    // 获取今日复习数量
    const today = new Date().toISOString().split("T")[0];
    // chemfig-review-history 损坏时不应让整个学习统计面板打不开
    const parsedHistory = readLocalStorageJson("chemfig-review-history", {});
    const history =
      parsedHistory && typeof parsedHistory === "object" && !Array.isArray(parsedHistory)
        ? parsedHistory
        : {};
    const todayCount = history[today] || 0;

    // 获取目标 (默认 10)
    const dailyGoal = this.plugin.settings?.dailyReviewLimit || 10;
    const progress = Math.min(todayCount / dailyGoal, 1);

    const goalEl = contentEl.createDiv({ cls: "chemfig-goal-container" });

    // 进度条
    const progressBar = goalEl.createDiv({ cls: "chemfig-progress-bar" });
    const progressFill = progressBar.createDiv({ cls: "chemfig-progress-fill" });
    progressFill.style.width = `${progress * 100}%`;

    // 进度文字
    goalEl.createEl("p", {
      text: `今日已复习 ${todayCount} / ${dailyGoal} 张卡片 (${Math.round(progress * 100)}%)`,
      cls: "chemfig-goal-text",
    });

    // 完成提示
    if (progress >= 1) {
      goalEl.createEl("p", {
        text: "🎉 今日目标已完成! 太棒了!",
        cls: "chemfig-goal-complete",
      });
    }

    // 今日学习按钮
    const btnContainer = contentEl.createDiv({ cls: "chemfig-stats-buttons" });
    const startBtn = btnContainer.createEl("button", {
      text: `开始今日复习 (${stats.due})`,
      cls: "chemfig-action-btn",
    });
    startBtn.onclick = () => {
      this.close();
      this.plugin.startReviewSession();
    };

    // 薄弱卡片复习按钮
    const weakBtn = btnContainer.createEl("button", {
      text: "📝 复习薄弱卡片",
      cls: "chemfig-action-btn",
    });
    weakBtn.style.marginLeft = "8px";
    weakBtn.onclick = () => {
      this.close();
      this.plugin.startWeakCardsReview();
    };

    // ========== v11.4.0: 每日一题 ==========
    const dailyCard = this.plugin.getDailyCard();
    if (dailyCard) {
      contentEl.createEl("h3", { text: "🌟 今日推荐化合物" });

      const dailyEl = contentEl.createDiv({ cls: "chemfig-daily-card" });
      dailyEl.createEl("h4", { text: dailyCard.name });
      dailyEl.createEl("p", {
        text: `分子式: ${dailyCard.formula || "未知"}`,
        cls: "chemfig-card-formula",
      });
      if (dailyCard.category) {
        dailyEl.createEl("p", { text: `分类: ${dailyCard.category}` });
      }

      // 点击查看详情
      dailyEl.style.cursor = "pointer";
      dailyEl.onclick = () => {
        this.close();
        this.plugin.showDailyCard();
      };
    }

    // ========== v11.3.0: 分类筛选复习 ==========
    contentEl.createEl("h3", { text: "🏷️ 按分类复习" });

    // 统计所有分类 (cards 变量已在前面声明过)
    const categories = {};
    cards.forEach((card) => {
      const cat = card.category || "未分类";
      if (!categories[cat]) {
        categories[cat] = { total: 0, due: 0 };
      }
      categories[cat].total++;
      if ((card.state?.due || card.state?.nextReview || 0) <= now) {
        categories[cat].due++;
      }
    });

    // 分类列表
    const categoryList = contentEl.createDiv({ cls: "chemfig-category-list" });

    Object.entries(categories).forEach(([cat, data]) => {
      const catEl = categoryList.createDiv({ cls: "chemfig-category-item" });

      catEl.createSpan({ text: cat, cls: "chemfig-category-name" });
      catEl.createSpan({
        text: `${data.due} 待复习 / ${data.total} 总`,
        cls: "chemfig-category-count",
      });

      // 点击开始该分类的复习
      catEl.onclick = () => {
        this.close();
        this.plugin.startReviewSession(cat);
      };
    });
  }

  /**
   * 渲染复习日历热力图
   */
  renderReviewHeatmap(container) {
    // 从 localStorage 获取复习历史
    // 本方法在 onOpen 中先于其它逻辑被调用, 一旦 chemfig-review-history 被写坏,
    // 整个学习统计面板会在打开时直接抛错 (此前无任何保护)。
    const parsedHistory = readLocalStorageJson("chemfig-review-history", {});
    const history =
      parsedHistory && typeof parsedHistory === "object" && !Array.isArray(parsedHistory)
        ? parsedHistory
        : {};

    const heatmapEl = container.createDiv({ cls: "chemfig-heatmap" });

    // 生成最近 12 周的格子
    const today = new Date();
    const weeks = 12;
    const days = weeks * 7;

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const count = history[dateStr] || 0;

      const cell = heatmapEl.createDiv({ cls: "chemfig-heatmap-cell" });
      cell.setAttribute("data-date", dateStr);
      cell.setAttribute("data-count", String(count));

      // 根据复习数量设置颜色深浅
      if (count === 0) {
        cell.addClass("level-0");
      } else if (count <= 3) {
        cell.addClass("level-1");
      } else if (count <= 7) {
        cell.addClass("level-2");
      } else if (count <= 15) {
        cell.addClass("level-3");
      } else {
        cell.addClass("level-4");
      }

      // 工具提示
      cell.title = `${dateStr}: 复习 ${count} 张卡片`;
    }

    // 图例
    const legend = container.createDiv({ cls: "chemfig-heatmap-legend" });
    legend.createSpan({ text: "少 " });
    ["level-0", "level-1", "level-2", "level-3", "level-4"].forEach((level) => {
      legend.createSpan({ cls: `chemfig-heatmap-cell ${level}` });
    });
    legend.createSpan({ text: " 多" });
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// ========== 学习模块 CSS ==========
const LEARNING_CSS = `
.chemfig-learning-modal {
  max-width: 600px;
  perspective: 1000px;
}
.chemfig-learning-card {
  background: var(--background-secondary);
  border-radius: 12px;
  padding: 32px;
  margin-bottom: 20px;
  cursor: pointer;
  transition: transform 0.6s, box-shadow 0.3s ease;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  transform-style: preserve-3d;
  position: relative;
}
.chemfig-learning-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}
.chemfig-learning-card.flipped {
  transform: rotateY(180deg);
}
.chemfig-card-front,
.chemfig-card-back {
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  width: 100%;
}
.chemfig-card-back {
  position: absolute;
  top: 0;
  left: 0;
  padding: 32px;
  transform: rotateY(180deg);
}
.chemfig-card-front h3 {
  margin: 0 0 8px 0;
  font-size: 24px;
  color: var(--text-normal);
}
.chemfig-card-formula {
  margin: 0 0 16px 0;
  font-size: 16px;
  color: var(--text-muted);
  font-family: monospace;
}
.chemfig-card-preview {
  width: 100%;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chemfig-card-hint {
  color: var(--text-faint);
  font-size: 14px;
}
.chemfig-card-code {
  text-align: left;
  font-size: 12px;
  background: var(--background-primary);
  padding: 12px;
  border-radius: 6px;
  overflow-x: auto;
  max-width: 100%;
}
.chemfig-card-details {
  margin-top: 16px;
  text-align: left;
  font-size: 14px;
  color: var(--text-muted);
}
.chemfig-card-details p {
  margin: 4px 0;
}
.chemfig-card-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}
.chemfig-card-review-btn {
  padding: 10px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-secondary);
  color: var(--text-normal);
  cursor: pointer;
  transition: all 0.2s ease;
}
.chemfig-card-review-btn:hover {
  background: var(--interactive-hover);
  border-color: var(--interactive-accent);
  transform: translateY(-2px);
}
.chemfig-card-review-btn:active {
  transform: translateY(0);
}
.chemfig-stats-modal {
  max-width: 500px;
}
.chemfig-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 16px;
  margin: 20px 0;
}
.chemfig-stat-item {
  text-align: center;
  padding: 16px;
  background: var(--background-secondary);
  border-radius: 8px;
  transition: transform 0.2s ease;
}
.chemfig-stat-item:hover {
  transform: translateY(-2px);
}
.chemfig-stat-icon {
  font-size: 24px;
  margin-bottom: 8px;
}
.chemfig-stat-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--interactive-accent);
}
.chemfig-stat-label {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
}
.chemfig-stats-buttons {
  margin-top: 20px;
  text-align: center;
}
.chemfig-action-btn {
  padding: 10px 20px;
  background: var(--interactive-accent);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.chemfig-action-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

// 热力图样式
.chemfig-heatmap {
  display: grid;
  grid-template-columns: repeat(24, 12px);
  gap: 3px;
  margin: 16px 0;
  justify-content: center;
}
.chemfig-heatmap-cell {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  transition: transform 0.15s ease;
}
.chemfig-heatmap-cell:hover {
  transform: scale(1.2);
}
.chemfig-heatmap-cell.level-0 {
  background: var(--background-modifier-border);
}
.chemfig-heatmap-cell.level-1 {
  background: #9be9a8;
}
.chemfig-heatmap-cell.level-2 {
  background: #40c463;
}
.chemfig-heatmap-cell.level-3 {
  background: #30a14e;
}
.chemfig-heatmap-cell.level-4 {
  background: #216e39;
}
.chemfig-heatmap-legend {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 11px;
  color: var(--text-muted);
  margin-bottom: 16px;
}
.chemfig-heatmap-legend .chemfig-heatmap-cell {
  width: 10px;
  height: 10px;
}

// 分类列表样式
.chemfig-category-list {
  margin: 12px 0;
  max-height: 200px;
  overflow-y: auto;
}
.chemfig-category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  margin: 4px 0;
  background: var(--background-secondary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.chemfig-category-item:hover {
  background: var(--background-modifier-hover);
  transform: translateX(4px);
}
.chemfig-category-name {
  font-weight: 500;
  color: var(--text-normal);
}
.chemfig-category-count {
  font-size: 12px;
  color: var(--text-muted);
}

// 每日一题卡片样式
.chemfig-daily-card {
  padding: 16px;
  background: linear-gradient(135deg, var(--background-secondary) 0%, var(--background-modifier-hover) 100%);
  border-radius: 12px;
  margin-bottom: 16px;
  transition: all 0.3s ease;
  border: 1px solid var(--background-modifier-border);
}
.chemfig-daily-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  border-color: var(--interactive-accent);
}
.chemfig-daily-card h4 {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: var(--interactive-accent);
}
.chemfig-daily-card p {
  margin: 4px 0;
  font-size: 13px;
  color: var(--text-muted);
}

// 学习目标进度条样式
.chemfig-goal-container {
  margin: 12px 0 20px 0;
}
.chemfig-progress-bar {
  width: 100%;
  height: 20px;
  background: var(--background-modifier-border);
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 8px;
}
.chemfig-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--interactive-accent) 0%, #4ade80 100%);
  border-radius: 10px;
  transition: width 0.5s ease;
}
.chemfig-goal-text {
  margin: 0;
  font-size: 14px;
  color: var(--text-normal);
  text-align: center;
}
.chemfig-goal-complete {
  margin: 8px 0 0 0;
  font-size: 14px;
  color: #22c55e;
  text-align: center;
  font-weight: 500;
}

// 多卡片类型样式
.chemfig-cloze-text {
  font-size: 16px;
  line-height: 1.8;
  margin: 16px 0;
  color: var(--text-normal);
}
.chemfig-cloze-answer {
  background: var(--background-modifier-error);
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--text-error);
  font-weight: 500;
}
.chemfig-list-items {
  width: 100%;
  text-align: left;
  margin: 16px 0;
}
.chemfig-list-item {
  padding: 8px 0;
  font-size: 15px;
  transition: opacity 0.3s ease;
  border-bottom: 1px solid var(--background-modifier-border);
}
.chemfig-list-item:last-child {
  border-bottom: none;
}

// 反应条件速查样式
.chemfig-reaction-modal {
  max-width: 700px;
}
.chemfig-modal-desc {
  color: var(--text-muted);
  font-size: 14px;
  margin-bottom: 16px;
}
.chemfig-search-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  background: var(--background-primary);
  color: var(--text-normal);
  font-size: 14px;
  margin-bottom: 16px;
}
.chemfig-search-input:focus {
  outline: none;
  border-color: var(--interactive-accent);
  box-shadow: 0 0 0 2px var(--background-modifier-border-focus);
}
.chemfig-reaction-results {
  max-height: 500px;
  overflow-y: auto;
}
.chemfig-reaction-card {
  padding: 16px;
  margin: 8px 0;
  background: var(--background-secondary);
  border-radius: 8px;
  border-left: 3px solid var(--interactive-accent);
  transition: all 0.2s ease;
}
.chemfig-reaction-card:hover {
  transform: translateX(4px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
.chemfig-reaction-card h4 {
  margin: 0 0 12px 0;
  color: var(--interactive-accent);
  font-size: 16px;
}
.chemfig-reaction-info p {
  margin: 4px 0;
  font-size: 13px;
  color: var(--text-muted);
}
.chemfig-reaction-notes {
  margin-top: 8px !important;
  color: #f59e0b !important;
  font-size: 13px !important;
}
.chemfig-reaction-example {
  margin-top: 8px;
  font-size: 13px;
  color: var(--text-normal);
  font-style: italic;
}
.chemfig-no-result {
  text-align: center;
  color: var(--text-muted);
  padding: 32px;
  font-size: 14px;
}

// 配对游戏样式
.chemfig-matching-modal {
  max-width: 600px;
}
.chemfig-game-status {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: var(--background-secondary);
  border-radius: 8px;
  margin-bottom: 16px;
  font-size: 14px;
}
.game-score {
  color: var(--interactive-accent);
  font-weight: 600;
}
.game-mistakes {
  color: #ef4444;
}
.chemfig-game-area {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin: 20px 0;
}
.game-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.game-col h4 {
  text-align: center;
  margin: 0 0 8px 0;
  color: var(--text-muted);
  font-size: 14px;
}
.game-btn {
  padding: 12px;
  border: 2px solid var(--background-modifier-border);
  border-radius: 8px;
  background: var(--background-primary);
  color: var(--text-normal);
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.game-btn:hover:not(:disabled) {
  border-color: var(--interactive-accent);
  transform: translateY(-2px);
}
.game-btn.selected {
  border-color: var(--interactive-accent);
  background: var(--background-modifier-hover);
}
.game-btn.correct {
  border-color: #22c55e;
  background: #22c55e20;
  color: #22c55e;
}
.game-btn.wrong {
  border-color: #ef4444;
  background: #ef444420;
  color: #ef4444;
}
.game-btn:disabled {
  cursor: default;
  opacity: 0.8;
}
.game-result {
  text-align: center;
  padding: 32px;
}
.game-result h3 {
  font-size: 24px;
  margin: 0 0 16px 0;
}
.game-result p {
  font-size: 16px;
  margin: 8px 0;
}
.game-rating {
  font-size: 18px !important;
  color: var(--interactive-accent);
  font-weight: 500;
  margin: 16px 0 !important;
}
// FSRS 参数样式
.chemfig-fsrs-params {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--background-modifier-border);
}
.fsrs-params-title {
  font-weight: 600;
  font-size: 14px;
  margin: 8px 0;
  color: var(--text-normal);
}
.fsrs-param {
  font-size: 13px;
  color: var(--text-muted);
  margin: 4px 0;
  padding-left: 8px;
  border-left: 2px solid var(--interactive-accent);
}
`;

// ========== 内置学习卡片 (常用药物/化合物) ==========
const DEFAULT_LEARNING_CARDS = [
  {
    name: "阿司匹林",
    englishName: "Aspirin",
    formula: "C9H8O4",
    category: "解热镇痛药",
    smiles: "CC(=O)Oc1ccccc1C(=O)O",
    usage: "解热、镇痛、抗炎、抗血小板聚集",
    source: "水杨酸类",
    chemfigCode: "\\chemfig{*6(-=-(-OAc)=-(COOH)=-)}",
  },
  {
    name: "对乙酰氨基酚",
    englishName: "Paracetamol",
    formula: "C8H9NO2",
    category: "解热镇痛药",
    smiles: "CC(=O)Nc1ccc(O)cc1",
    usage: "解热镇痛, 无抗炎作用",
    source: "苯胺类",
    chemfigCode: "\\chemfig{*6(-=-(-OH)=-(NHCOCH_3)=-)}",
  },
  {
    name: "布洛芬",
    englishName: "Ibuprofen",
    formula: "C13H18O2",
    category: "非甾体抗炎药",
    smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O",
    usage: "抗炎、镇痛、解热",
    source: "丙酸类",
    chemfigCode: "\\chemfig{*6(-=-(-CH(CH_3)CH_2CH(CH_3)_2)=-(COOH)=-)}",
  },
  {
    name: "青霉素 G",
    englishName: "Penicillin G",
    formula: "C16H18N2O4S",
    category: "β-内酰胺类抗生素",
    smiles: "CC1(C(N2C(S1)C(C2=O)NC(=O)CCc3ccccc3)C(=O)O)C",
    usage: "革兰阳性菌感染",
    source: "天然抗生素",
    chemfigCode: "\\chemfig{N(-[:30]CO)(-[:-30]CO)S(-[:90]C(-[:30](=O)OH)-[:-30]CH(CH_3)_2)}",
  },
  {
    name: "阿莫西林",
    englishName: "Amoxicillin",
    formula: "C16H19N3O5S",
    category: "β-内酰胺类抗生素",
    smiles: "CC1(C(N2C(S1)C(C2=O)NC(=O)C(C3=CC=C(C=C3)O)N)C(=O)O)C",
    usage: "广谱抗生素, 呼吸道感染",
    source: "半合成青霉素",
    chemfigCode: "\\chemfig{*6(-=-(-OH)=-(CH(NH_2)CONH-)=-)}",
  },
  {
    name: "吗啡",
    englishName: "Morphine",
    formula: "C17H19NO3",
    category: "阿片类镇痛药",
    smiles: "CN1CCC23C4C1CC5=C2C(=C(C=C5)O)OC4C(C3)O",
    usage: "强效镇痛, 麻醉性镇痛药",
    source: "阿片生物碱",
    chemfigCode: "\\chemfig{N(-[:30]CH_3)(-[:-30]...)}",
  },
  {
    name: "咖啡因",
    englishName: "Caffeine",
    formula: "C8H10N4O2",
    category: "中枢兴奋药",
    smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
    usage: "中枢兴奋, 提神",
    source: "黄嘌呤类",
    chemfigCode: "\\chemfig{N(-[:30]CH_3)(-[:-30]C(=O))...}",
  },
  {
    name: "尼古丁",
    englishName: "Nicotine",
    formula: "C10H14N2",
    category: "生物碱",
    smiles: "CN1CCCC1C2=CN=CC=C2",
    usage: "烟草成瘾成分",
    source: "吡啶类生物碱",
    chemfigCode: "\\chemfig{N(-[:30]CH_3)(-[:-30]CCCC)-pyridine}",
  },
  {
    name: "吗啡",
    englishName: "Morphine",
    formula: "C17H19NO3",
    category: "阿片类生物碱",
    smiles: "CN1CCC23C4C1CC5=C2C(=C(C=C5)O)OC3C(C4O)O",
    usage: "强效镇痛药",
    source: "阿片类生物碱",
    chemfigCode: "\\chemfig{*6(-=-(-OH)=-(O-)=-)}",
  },
  {
    name: "咖啡因",
    englishName: "Caffeine",
    formula: "C8H10N4O2",
    category: "黄嘌呤类生物碱",
    smiles: "CN1C=NC2=C1C(=O)N(C)C(=O)N2C",
    usage: "中枢兴奋, 提神醒脑",
    source: "黄嘌呤类",
    chemfigCode: "\\chemfig{N(-[:30]CH_3)(-[:-30]C=O)-purine}",
  },
  {
    name: "葡萄糖",
    englishName: "Glucose",
    formula: "C6H12O6",
    category: "单糖",
    smiles: "OC[C@H]1OC(O)[C@@H](O)[C@H](O)[C@H]1O",
    usage: "主要能源物质",
    source: "己醛糖",
    chemfigCode: "\\chemfig{HOCH_2-CH(OH)-CH(OH)-CH(OH)-CH(OH)-CHO}",
  },
  {
    name: "果糖",
    englishName: "Fructose",
    formula: "C6H12O6",
    category: "单糖",
    smiles: "OCC[C@H](O)[C@@H](O)C(=O)CO",
    usage: "最甜的天然糖",
    source: "己酮糖",
    chemfigCode: "\\chemfig{HOCH_2-CO-CH(OH)-CH(OH)-CH(OH)-CH_2OH}",
  },
  {
    name: "维生素C",
    englishName: "Vitamin C",
    formula: "C6H8O6",
    category: "维生素",
    smiles: "OCC1OC(C(O)C1O)O",
    usage: "抗氧化, 胶原蛋白合成",
    source: "抗坏血酸",
    chemfigCode: "\\chemfig{HOCH_2-C(OH)=C(OH)-CO-O-CH(OH)-}",
  },
  {
    name: "胆固醇",
    englishName: "Cholesterol",
    formula: "C27H46O",
    category: "甾体化合物",
    smiles: "C[C@H](CCCC(C)C)[C@H]1CC[C@@]2C3=CC[C@H]4C[C@@H](O)CC[C@]4(C)C3CC[C@]12C",
    usage: "细胞膜成分, 合成激素前体",
    source: "甾体醇类",
    chemfigCode: "\\chemfig{steroid*4(-OH)}",
  },
  {
    name: "雌二醇",
    englishName: "Estradiol",
    formula: "C18H24O2",
    category: "甾体激素",
    smiles: "C[C@]12CC[C@H]3[C@@H](CCC4=CC(=O)C=C[C@]34C)[C@@H]1CC[C@@H]2O",
    usage: "雌性激素",
    source: "甾体雌激素",
    chemfigCode: "\\chemfig{steroid*3(-OH)(=O)}",
  },
  {
    name: "睾酮",
    englishName: "Testosterone",
    formula: "C19H28O2",
    category: "甾体激素",
    smiles: "C[C@]12CC[C@H]3[C@@H](CCC4=CC(=O)CC[C@]34C)[C@@H]1CC[C@@H]2O",
    usage: "雄性激素, 促进肌肉生长",
    source: "甾体雄激素",
    chemfigCode: "\\chemfig{steroid*3(-OH)(=O)(CH_3)}",
  },
  {
    name: "阿司匹林",
    englishName: "Aspirin",
    formula: "C9H8O4",
    category: "解热镇痛药",
    smiles: "CC(=O)Oc1ccccc1C(=O)O",
    usage: "解热镇痛, 抗血小板聚集",
    source: "水杨酸类",
    chemfigCode: "\\chemfig{*6(-=-(-OAc)=-(COOH)=-)}",
  },
  {
    name: "苯",
    englishName: "Benzene",
    formula: "C6H6",
    category: "芳烃",
    smiles: "c1ccccc1",
    usage: "有机溶剂, 合成原料",
    source: "芳香烃",
    chemfigCode: "\\chemfig{*6(-=-=-=)}",
  },
  {
    name: "乙醇",
    englishName: "Ethanol",
    formula: "C2H6O",
    category: "醇类",
    smiles: "CCO",
    usage: "酒类饮品, 消毒剂, 溶剂",
    source: "伯醇",
    chemfigCode: "\\chemfig{CH_3CH_2OH}",
  },
  {
    name: "甲醛",
    englishName: "Formaldehyde",
    formula: "CH2O",
    category: "醛类",
    smiles: "C=O",
    usage: "防腐剂, 合成树脂",
    source: "脂肪醛",
    chemfigCode: "\\chemfig{H_2C=O}",
  },
  {
    name: "乙酸",
    englishName: "Acetic acid",
    formula: "C2H4O2",
    category: "羧酸",
    smiles: "CC(=O)O",
    usage: "食醋主要成分, 溶剂",
    source: "脂肪酸",
    chemfigCode: "\\chemfig{CH_3COOH}",
  },
  {
    name: "丙酮",
    englishName: "Acetone",
    formula: "C3H6O",
    category: "酮类",
    smiles: "CC(=O)C",
    usage: "有机溶剂, 洗甲水",
    source: "脂肪酮",
    chemfigCode: "\\chemfig{CH_3COCH_3}",
  },
  {
    name: "甘油",
    englishName: "Glycerol",
    formula: "C3H8O3",
    category: "醇类",
    smiles: "OCC(O)CO",
    usage: "保湿剂, 化妆品, 炸药原料",
    source: "三元醇",
    chemfigCode: "\\chemfig{HOCH_2-CH(OH)-CH_2OH}",
  },
  {
    name: "尿素",
    englishName: "Urea",
    formula: "CH4N2O",
    category: "酰胺类",
    smiles: "NC(=O)N",
    usage: "化肥, 塑料, 化妆品",
    source: "碳酰胺",
    chemfigCode: "\\chemfig{H_2N-CO-NH_2}",
  },
  {
    name: "甲苯",
    englishName: "Toluene",
    formula: "C7H8",
    category: "芳烃",
    smiles: "Cc1ccccc1",
    usage: "有机溶剂",
    source: "烷基苯",
    chemfigCode: "\\chemfig{*6(-=-=-=)-CH_3}",
  },
  {
    name: "苯酚",
    englishName: "Phenol",
    formula: "C6H6O",
    category: "酚类",
    smiles: "Oc1ccccc1",
    usage: "消毒剂, 合成树脂",
    source: "芳香醇",
    chemfigCode: "\\chemfig{*6(-=-=-=)-OH}",
  },
  {
    name: "苯胺",
    englishName: "Aniline",
    formula: "C6H7N",
    category: "芳香胺",
    smiles: "Nc1ccccc1",
    usage: "染料合成",
    source: "芳香胺",
    chemfigCode: "\\chemfig{*6(-=-=-=)-NH_2}",
  },
  {
    name: "萘",
    englishName: "Naphthalene",
    formula: "C10H8",
    category: "稠环芳烃",
    smiles: "c1ccc2ccccc2c1",
    usage: "樟脑丸, 染料原料",
    source: "稠环芳烃",
    chemfigCode: "\\chemfig{*6-*6(-=-=-=)}",
  },
  {
    name: "咖啡因",
    englishName: "Caffeine",
    formula: "C8H10N4O2",
    category: "生物碱",
    smiles: "CN1C=NC2=C1C(=O)N(C)C(=O)N2C",
    usage: "中枢兴奋, 提神",
    source: "黄嘌呤类",
    chemfigCode: "\\chemfig{N1-C=N-C2=C1-C(=O)-N(C)-C(=O)-N2-C}",
  },
  {
    name: "氯仿",
    englishName: "Chloroform",
    formula: "CHCl3",
    category: "卤代烃",
    smiles: "ClC(Cl)Cl",
    usage: "溶剂, 早期麻醉剂",
    source: "三卤甲烷",
    chemfigCode: "\\chemfig{CHCl_3}",
  },
  {
    name: "碘仿",
    englishName: "Iodoform",
    formula: "CHI3",
    category: "卤代烃",
    smiles: "IC(I)I",
    usage: "消毒剂",
    source: "三卤甲烷",
    chemfigCode: "\\chemfig{CHI_3}",
  },
  {
    name: "硬脂酸",
    englishName: "Stearic acid",
    formula: "C18H36O2",
    category: "脂肪酸",
    smiles: "CCCCCCCCCCCCCCCCCC(=O)O",
    usage: "肥皂, 蜡烛",
    source: "饱和脂肪酸",
    chemfigCode: "\\chemfig{CH_3(CH_2)_{16}COOH}",
  },
  {
    name: "油酸",
    englishName: "Oleic acid",
    formula: "C18H34O2",
    category: "不饱和脂肪酸",
    smiles: "CCCCCCCC/C=C\\CCCCCCCC(=O)O",
    usage: "橄榄油主要成分",
    source: "单不饱和脂肪酸",
    chemfigCode: "\\chemfig{CH_3(CH_2)_7CH=CH(CH_2)_7COOH}",
  },
  {
    name: "亚油酸",
    englishName: "Linoleic acid",
    formula: "C18H32O2",
    category: "不饱和脂肪酸",
    smiles: "CCCCCC/C=C\\C/C=C\\CCCCCCCC(=O)O",
    usage: "必需脂肪酸",
    source: "多不饱和脂肪酸",
    chemfigCode: "\\chemfig{CH_3(CH_2)_4CH=CHCH_2CH=CH(CH_2)_7COOH}",
  },
  {
    name: "乳酸",
    englishName: "Lactic acid",
    formula: "C3H6O3",
    category: "羟基酸",
    smiles: "CC(O)C(=O)O",
    usage: "酸奶, 肌肉代谢产物",
    source: "α-羟基酸",
    chemfigCode: "\\chemfig{CH_3-CH(OH)-COOH}",
  },
  {
    name: "柠檬酸",
    englishName: "Citric acid",
    formula: "C6H8O7",
    category: "羟基酸",
    smiles: "OC(=O)CC(O)(C(=O)O)CC(=O)O",
    usage: "酸味剂, 三羧酸循环",
    source: "三元羧酸",
    chemfigCode: "\\chemfig{HOOC-CH_2-C(OH)(COOH)-CH_2-COOH}",
  },
  {
    name: "水杨酸",
    englishName: "Salicylic acid",
    formula: "C7H6O3",
    category: "酚酸类",
    smiles: "O=C(O)c1ccccc1O",
    usage: "阿司匹林前体, 外用防腐剂",
    source: "邻羟基苯甲酸",
    chemfigCode: "\\chemfig{*6(-=-(-COOH)=-(OH)=-)}",
  },
  {
    name: "香草醛",
    englishName: "Vanillin",
    formula: "C8H8O3",
    category: "芳香醛",
    smiles: "COc1cc(C=O)ccc1O",
    usage: "香料, 香草味",
    source: "香草豆提取物",
    chemfigCode: "\\chemfig{*6(-=-(-OCH_3)=-(OH)=-(CHO)=-)}",
  },
  {
    name: "薄荷醇",
    englishName: "Menthol",
    formula: "C10H20O",
    category: "萜类",
    smiles: "CC(C)C1CCC(C(C)C)CC1O",
    usage: "薄荷清凉感",
    source: "单萜醇",
    chemfigCode: "\\chemfig{环己烷-OH}(CH(CH_3)_2)(CH_3)}",
  },
  {
    name: "樟脑",
    englishName: "Camphor",
    formula: "C10H16O",
    category: "萜类酮",
    smiles: "CC1(C)C2CCC1(C)C(=O)C2",
    usage: "驱虫, 药用",
    source: "双环单萜酮",
    chemfigCode: "\\chemfig{莰酮}",
  },
  {
    name: "奎宁",
    englishName: "Quinine",
    formula: "C20H24N2O2",
    category: "生物碱",
    smiles: "COc1ccc2c(c1)C(=O)N(CC2C3=CC=CC=C3O)C",
    usage: "抗疟疾药物",
    source: "喹啉类生物碱",
    chemfigCode: "\\chemfig{quinoline-alcohol}",
  },
  {
    name: "咖啡因",
    englishName: "Caffeine",
    formula: "C8H10N4O2",
    category: "黄嘌呤类",
    smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
    usage: "中枢神经兴奋剂",
    source: "黄嘌呤衍生物",
    chemfigCode: "\\chemfig{purine-dione}",
  },
  {
    name: "尼古丁",
    englishName: "Nicotine",
    formula: "C10H14N2",
    category: "生物碱",
    smiles: "CN1CCCC1C2=CN=CC=C2",
    usage: "烟草成瘾成分",
    source: "吡啶类生物碱",
    chemfigCode: "\\chemfig{pyrrolidine-pyridine}",
  },
  {
    name: "麻黄碱",
    englishName: "Ephedrine",
    formula: "C10H15NO",
    category: "生物碱",
    smiles: "CC(C(C1=CC=CC=C1)O)NC",
    usage: "平喘药, 感冒药",
    source: "苯乙胺类生物碱",
    chemfigCode: "\\chemfig{phenylpropanolamine}",
  },
  {
    name: "阿托品",
    englishName: "Atropine",
    formula: "C17H23NO3",
    category: "莨菪烷类",
    smiles: "CN1C2CCC1CC(C2)OC(=O)C(CO)C3=CC=CC=C3",
    usage: "抗胆碱药, 散瞳",
    source: "颠茄生物碱",
    chemfigCode: "\\chemfig{tropane-ester}",
  },
  {
    name: "吗啡",
    englishName: "Morphine",
    formula: "C17H19NO3",
    category: "阿片类",
    smiles: "CN1CCC23C4C1CC5=C2C(=C(C=C5)O)OC3C(C4)O",
    usage: "强效镇痛药",
    source: "阿片生物碱",
    chemfigCode: "\\chemfig{phenanthrene-derivative}",
  },
  {
    name: "可待因",
    englishName: "Codeine",
    formula: "C18H21NO3",
    category: "阿片类",
    smiles: "CN1CCC23C4C1CC5=C2C(=C(C=C5)OC)OC3C(C4)O",
    usage: "镇咳药, 弱镇痛药",
    source: "阿片生物碱",
    chemfigCode: "\\chemfig{morphine-methyl-ether}",
  },
  {
    name: "青霉素G",
    englishName: "Penicillin G",
    formula: "C16H18N2O4S",
    category: "β-内酰胺类",
    smiles: "CC1(C(N2C(S1)C(C2=O)NC(=O)CC3=CC=CC=C3)C(=O)O)C",
    usage: "抗生素",
    source: "青霉菌发酵",
    chemfigCode: "\\chemfig{beta-lactam}",
  },
  {
    name: "阿莫西林",
    englishName: "Amoxicillin",
    formula: "C16H19N3O5S",
    category: "β-内酰胺类",
    smiles: "CC1(C(N2C(S1)C(C2=O)NC(=O)C(C3=CC=C(C=C3)O)N)C(=O)O)C",
    usage: "广谱抗生素",
    source: "半合成青霉素",
    chemfigCode: "\\chemfig{aminopenicillin}",
  },
  {
    name: "头孢氨苄",
    englishName: "Cefalexin",
    formula: "C16H17N3O4S",
    category: "头孢菌素类",
    smiles: "CC1(C(N2C(S1)C(C2=O)NC(=O)C(C3=CC=CC=C3)N)C(=O)O)C",
    usage: "口服头孢抗生素",
    source: "半合成头孢",
    chemfigCode: "\\chemfig{cephalosporin}",
  },
  {
    name: "奥美拉唑",
    englishName: "Omeprazole",
    formula: "C17H19N3O3S",
    category: "质子泵抑制剂",
    smiles: "CC1=NC=C(N1CCOC)C2=NC3=C(O2)C=C(C=C3)S(=O)(=O)N",
    usage: "抑制胃酸分泌",
    source: "苯并咪唑类",
    chemfigCode: "\\chemfig{benzimidazole-sulfoxide}",
  },
  {
    name: "二甲双胍",
    englishName: "Metformin",
    formula: "C4H11N5",
    category: "双胍类",
    smiles: "CN(C)C(=N)N=C(N)N",
    usage: "降血糖药物",
    source: "双胍类降糖药",
    chemfigCode: "\\chemfig{biguanide}",
  },
  {
    name: "阿托伐他汀",
    englishName: "Atorvastatin",
    formula: "C33H35FN2O5",
    category: "他汀类",
    smiles: "CC(C)C1=CC=C(C=C1)C2=C(C(=O)NC2=O)C3=C(C=CC(=C3)C(C(C(=O)O)O)O)F",
    usage: "降血脂药物",
    source: "HMG-CoA还原酶抑制剂",
    chemfigCode: "\\chemfig{statin}",
  },
  {
    name: "氯雷他定",
    englishName: "Loratadine",
    formula: "C22H23ClN2O2",
    category: "抗组胺药",
    smiles: "CC(=O)ON1C(=O)CC2=C1C3=CC=CC=C3C(=C2)C4=CC=C(C=C4)Cl",
    usage: "抗过敏药物",
    source: "三环类抗组胺",
    chemfigCode: "\\chemfig{antihistamine}",
  },
  {
    name: "阿司匹林",
    englishName: "Aspirin",
    formula: "C9H8O4",
    category: "解热镇痛药",
    smiles: "CC(=O)OC1=CC=CC=C1C(=O)O",
    usage: "解热镇痛, 抗血小板",
    source: "乙酰水杨酸",
    chemfigCode: "\\chemfig{acetylsalicylic-acid}",
  },
  {
    name: "对乙酰氨基酚",
    englishName: "Paracetamol",
    formula: "C8H9NO2",
    category: "解热镇痛药",
    smiles: "CC(=O)NC1=CC=C(C=C1)O",
    usage: "解热镇痛",
    source: "扑热息痛",
    chemfigCode: "\\chemfig{acetaminophen}",
  },
  {
    name: "布洛芬",
    englishName: "Ibuprofen",
    formula: "C13H18O2",
    category: "非甾体抗炎药",
    smiles: "CC(C)CC1=CC=C(C=C1)C(C)C(=O)O",
    usage: "抗炎镇痛",
    source: "异丁苯丙酸",
    chemfigCode: "\\chemfig{ibuprofen}",
  },
  {
    name: "萘普生",
    englishName: "Naproxen",
    formula: "C14H14O3",
    category: "非甾体抗炎药",
    smiles: "CC(C(=O)O)C1=CC2=C(C=C1)C=CC=C2O",
    usage: "抗炎镇痛",
    source: "芳基丙酸类",
    chemfigCode: "\\chemfig{naproxen}",
  },
  {
    name: "双氯芬酸",
    englishName: "Diclofenac",
    formula: "C14H11Cl2NO2",
    category: "非甾体抗炎药",
    smiles: "C1=CC(=C(C=C1Cl)Cl)NC2=CC=CC=C2CC(=O)O",
    usage: "抗炎镇痛",
    source: "邻氨基苯甲酸类",
    chemfigCode: "\\chemfig{diclofenac}",
  },
  // ========== 心血管药物 ==========
  {
    name: "硝苯地平",
    englishName: "Nifedipine",
    formula: "C17H18N2O6",
    category: "钙通道阻滞剂",
    smiles: "CC1=C(C(=O)OC)C(=O)C(C)=C(N1C2=CC=CC=C2)[N+](=O)[O-]",
    usage: "降血压, 抗心绞痛",
    source: "二氢吡啶类",
    chemfigCode: "\\chemfig{dihydropyridine}",
  },
  {
    name: "维拉帕米",
    englishName: "Verapamil",
    formula: "C27H38N2O4",
    category: "钙通道阻滞剂",
    smiles: "CC(C)N(C)CCC(C)(C(=O)OC1=CC=C(C=C1)OC)CCCN2CCOCC2",
    usage: "抗心律失常, 降血压",
    source: "苯烷胺类",
    chemfigCode: "\\chemfig{verapamil}",
  },
  {
    name: "卡托普利",
    englishName: "Captopril",
    formula: "C9H15NO3S",
    category: "ACE抑制剂",
    smiles: "CC(C)C1C(=O)N(C(=O)C1)CC(=O)O",
    usage: "降血压, 心力衰竭",
    source: "巯基类ACE抑制剂",
    chemfigCode: "\\chemfig{captopril}",
  },
  {
    name: "氯沙坦",
    englishName: "Losartan",
    formula: "C22H23ClN6O",
    category: "ARB类",
    smiles: "CCCCc1nnc(n1)c2ccc(cc2)c3cnc(nc3)c4ccc(Cl)cc4",
    usage: "降血压",
    source: "血管紧张素II受体拮抗剂",
    chemfigCode: "\\chemfig{losartan}",
  },
  {
    name: "美托洛尔",
    englishName: "Metoprolol",
    formula: "C15H25NO3",
    category: "β受体阻滞剂",
    smiles: "CC(C)NCC(COC1=CC=C(C=C1)OCC(=O)O)O",
    usage: "降血压, 抗心律失常",
    source: "选择性β1受体阻滞剂",
    chemfigCode: "\\chemfig{metoprolol}",
  },
  {
    name: "阿司匹林(心血管)",
    englishName: "Aspirin (Cardio)",
    formula: "C9H8O4",
    category: "抗血小板药",
    smiles: "CC(=O)OC1=CC=CC=C1C(=O)O",
    usage: "抗血小板聚集, 预防血栓",
    source: "环氧合酶抑制剂",
    chemfigCode: "\\chemfig{aspirin}",
  },
  {
    name: "华法林",
    englishName: "Warfarin",
    formula: "C19H16O4",
    category: "抗凝药",
    smiles: "CC(=O)C(C1=CC=CC=C1)c2cc(=O)c3ccccc3o2",
    usage: "抗凝, 预防血栓",
    source: "香豆素类抗凝剂",
    chemfigCode: "\\chemfig{warfarin}",
  },
  // ========== 呼吸系统药物 ==========
  {
    name: "沙丁胺醇",
    englishName: "Salbutamol",
    formula: "C13H21NO3",
    category: "β2受体激动剂",
    smiles: "CC(C)(C)NCC(C1=CC(=C(C=C1)O)CO)O",
    usage: "支气管哮喘, 平喘",
    source: "短效β2激动剂",
    chemfigCode: "\\chemfig{salbutamol}",
  },
  {
    name: "茶碱",
    englishName: "Theophylline",
    formula: "C7H8N4O2",
    category: "甲基黄嘌呤类",
    smiles: "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
    usage: "平喘, 支气管扩张",
    source: "黄嘌呤衍生物",
    chemfigCode: "\\chemfig{theophylline}",
  },
  {
    name: "右美沙芬",
    englishName: "Dextromethorphan",
    formula: "C18H25NO",
    category: "镇咳药",
    smiles: "CN1CCC23c4c5ccc(OCC4C2C1CCC5)c3",
    usage: "中枢性镇咳",
    source: "吗啡喃衍生物",
    chemfigCode: "\\chemfig{dextromethorphan}",
  },
  // ========== 消化系统药物 ==========
  {
    name: "雷尼替丁",
    englishName: "Ranitidine",
    formula: "C13H22N4O3S",
    category: "H2受体拮抗剂",
    smiles: "CN1C=NC=C(CCSCCOC(=O)C(=O)N)C1",
    usage: "抑制胃酸分泌",
    source: "呋喃类H2受体拮抗剂",
    chemfigCode: "\\chemfig{ranitidine}",
  },
  {
    name: "法莫替丁",
    englishName: "Famotidine",
    formula: "C8H15N7O2S3",
    category: "H2受体拮抗剂",
    smiles: "NS(=O)(=O)CCNCc1nc(sc1)N",
    usage: "抑制胃酸分泌",
    source: "噻唑类H2受体拮抗剂",
    chemfigCode: "\\chemfig{famotidine}",
  },
  {
    name: "甲氧氯普胺",
    englishName: "Metoclopramide",
    formula: "C14H22ClN3O2",
    category: "促胃肠动力药",
    smiles: "CN(C)CCC1=CC(=C(C=C1)Cl)NC(=O)OCC",
    usage: "止吐, 促胃动力",
    source: "多巴胺受体拮抗剂",
    chemfigCode: "\\chemfig{metoclopramide}",
  },
  {
    name: "洛哌丁胺",
    englishName: "Loperamide",
    formula: "C29H33ClN2O2",
    category: "止泻药",
    smiles: "CC(C)(C)N1CCC(CC1)(C2=CC=C(C=C2)Cl)C(=O)OCC3=CC=CC=C3",
    usage: "止泻",
    source: "阿片类止泻药",
    chemfigCode: "\\chemfig{loperamide}",
  },
  // ========== 神经系统药物 ==========
  {
    name: "地西泮",
    englishName: "Diazepam",
    formula: "C16H13ClN2O",
    category: "苯二氮䓬类",
    smiles: "CN1C(=O)C2=CC=CC=C2N=C(C3=CC=C(C=C3)Cl)1",
    usage: "抗焦虑, 镇静催眠",
    source: "苯二氮䓬类",
    chemfigCode: "\\chemfig{diazepam}",
  },
  {
    name: "艾司唑仑",
    englishName: "Estazolam",
    formula: "C16H11ClN4",
    category: "苯二氮䓬类",
    smiles: "ClC1=CC2=C(C=C1)C3=NC=CN3C(=O)N2",
    usage: "镇静催眠, 抗焦虑",
    source: "三唑苯二氮䓬类",
    chemfigCode: "\\chemfig{estazolam}",
  },
  {
    name: "苯妥英钠",
    englishName: "Phenytoin Sodium",
    formula: "C15H11N2NaO2",
    category: "抗癫痫药",
    smiles: "C1=CC=C(C=C1)C2(C3=CC=CC=C3)C(=O)NC(=O)N2[Na]",
    usage: "抗癫痫, 抗心律失常",
    source: "乙内酰脲类",
    chemfigCode: "\\chemfig{phenytoin}",
  },
  {
    name: "卡马西平",
    englishName: "Carbamazepine",
    formula: "C15H12N2O",
    category: "抗癫痫药",
    smiles: "C1=CC=C2C(=C1)C=CC3=C2C(=O)N(C3)C4=CC=CC=C4",
    usage: "抗癫痫, 三叉神经痛",
    source: "三环类抗癫痫药",
    chemfigCode: "\\chemfig{carbamazepine}",
  },
  {
    name: "左旋多巴",
    englishName: "Levodopa",
    formula: "C9H11NO4",
    category: "抗帕金森病药",
    smiles: "C1=CC(=C(C=C1CC(C(=O)O)N)O)O",
    usage: "帕金森病治疗",
    source: "多巴胺前体药物",
    chemfigCode: "\\chemfig{levodopa}",
  },
  {
    name: "氯丙嗪",
    englishName: "Chlorpromazine",
    formula: "C17H19ClN2S",
    category: "抗精神病药",
    smiles: "CN1CCC(CC1)N2C3=CC=CC=C3SC4=C2C=C(C=C4)Cl",
    usage: "抗精神病, 镇吐",
    source: "吩噻嗪类",
    chemfigCode: "\\chemfig{chlorpromazine}",
  },
  {
    name: "氟西汀",
    englishName: "Fluoxetine",
    formula: "C17H18F3NO",
    category: "抗抑郁药",
    smiles: "CNCCC(C1=CC=C(C=C1)O)C2=CC=C(C=C2)C(F)(F)F",
    usage: "抗抑郁, 强迫症",
    source: "SSRI类",
    chemfigCode: "\\chemfig{fluoxetine}",
  },
  {
    name: "帕罗西汀",
    englishName: "Paroxetine",
    formula: "C19H20FNO3",
    category: "抗抑郁药",
    smiles: "C1CC(C(C1)O)CN2C(=O)C3=CC=CC=C3C2=O",
    usage: "抗抑郁, 社交焦虑障碍",
    source: "SSRI类",
    chemfigCode: "\\chemfig{paroxetine}",
  },
  // ========== 内分泌系统药物 ==========
  {
    name: "格列本脲",
    englishName: "Glibenclamide",
    formula: "C23H28ClN3O5S",
    category: "磺酰脲类",
    smiles: "CCCCC1=CC=C(C=C1)S(=O)(=O)NC(=O)NCC2CCCCC2",
    usage: "降血糖",
    source: "第二代磺酰脲类",
    chemfigCode: "\\chemfig{glibenclamide}",
  },
  {
    name: "甲巯咪唑",
    englishName: "Thiamazole",
    formula: "C4H6N2S",
    category: "抗甲状腺药",
    smiles: "CN1C=CSC1=N",
    usage: "甲状腺功能亢进",
    source: "咪唑类抗甲状腺药",
    chemfigCode: "\\chemfig{thiamazole}",
  },
  {
    name: "氢化可的松",
    englishName: "Hydrocortisone",
    formula: "C21H30O5",
    category: "糖皮质激素",
    smiles: "CC12CCC3C(C1CCC2O)CCC4=CC(=O)CCC34C",
    usage: "抗炎, 免疫抑制",
    source: "内源性糖皮质激素",
    chemfigCode: "\\chemfig{hydrocortisone}",
  },
  {
    name: "地塞米松",
    englishName: "Dexamethasone",
    formula: "C22H29FO5",
    category: "糖皮质激素",
    smiles: "CC12CCC3C(C1CCC2O)CCC4=CC(=O)C=C(C34C)F",
    usage: "抗炎, 抗过敏",
    source: "人工合成糖皮质激素",
    chemfigCode: "\\chemfig{dexamethasone}",
  },
  // ========== 抗肿瘤药物 ==========
  {
    name: "环磷酰胺",
    englishName: "Cyclophosphamide",
    formula: "C7H15Cl2N2O2P",
    category: "烷化剂",
    smiles: "ClCCN1P(=O)(OCC1)N(CCCl)CCCl",
    usage: "抗肿瘤, 免疫抑制",
    source: "氮芥类烷化剂",
    chemfigCode: "\\chemfig{cyclophosphamide}",
  },
  {
    name: "甲氨蝶呤",
    englishName: "Methotrexate",
    formula: "C20H22N8O5",
    category: "抗代谢药",
    smiles: "CC1=C(C(=NC=N1)N)N2C=CC(=C2)C3=CC=C(C=C3)C(=O)NCCCC(=O)O",
    usage: "抗肿瘤, 类风湿关节炎",
    source: "叶酸拮抗剂",
    chemfigCode: "\\chemfig{methotrexate}",
  },
  {
    name: "顺铂",
    englishName: "Cisplatin",
    formula: "Cl2H6N2Pt",
    category: "铂类配合物",
    smiles: "[Pt](Cl)(Cl)(N)(N)",
    usage: "抗肿瘤",
    source: "铂类配合物",
    chemfigCode: "\\chemfig{cisplatin}",
  },
  // ========== 维生素类 ==========
  {
    name: "维生素C",
    englishName: "Vitamin C",
    formula: "C6H8O6",
    category: "水溶性维生素",
    smiles: "C(C(C(C(C(=O)O)O)O)O)O",
    usage: "抗氧化, 抗坏血病",
    source: "抗坏血酸",
    chemfigCode: "\\chemfig{vitamin-c}",
  },
  {
    name: "维生素B1",
    englishName: "Vitamin B1",
    formula: "C12H17N4OS",
    category: "水溶性维生素",
    smiles: "CC1=C(C(=NC=N1)N)SCC2=CN=C(N=C2N)C",
    usage: "脚气病防治",
    source: "硫胺素",
    chemfigCode: "\\chemfig{vitamin-b1}",
  },
  {
    name: "维生素B2",
    englishName: "Vitamin B2",
    formula: "C17H20N4O6",
    category: "水溶性维生素",
    smiles: "CC1=C(C(=O)OCC2=NC3=C(N=C2)C(=O)NC3=O)N=C1N",
    usage: "口角炎防治",
    source: "核黄素",
    chemfigCode: "\\chemfig{vitamin-b2}",
  },
  {
    name: "维生素B6",
    englishName: "Vitamin B6",
    formula: "C8H11NO3",
    category: "水溶性维生素",
    smiles: "CC1=NC=C(CO)C(=C1)CO",
    usage: "神经炎, 妊娠呕吐",
    source: "吡哆醇",
    chemfigCode: "\\chemfig{vitamin-b6}",
  },
  {
    name: "维生素E",
    englishName: "Vitamin E",
    formula: "C29H50O2",
    category: "脂溶性维生素",
    smiles: "CC(C)CCCC(C)C1CCC2(C)C3=CC(=C(C=C3CCC2C1(C)C)O)CC=C(C)C",
    usage: "抗氧化, 抗衰老",
    source: "生育酚",
    chemfigCode: "\\chemfig{vitamin-e}",
  },
  {
    name: "维生素D3",
    englishName: "Vitamin D3",
    formula: "C27H44O",
    category: "脂溶性维生素",
    smiles: "CC(C)CCCC(C)C1CCC2C1(CCC3C2CC=C4C3(CCC(C4)O)C)C",
    usage: "佝偻病防治",
    source: "胆钙化醇",
    chemfigCode: "\\chemfig{vitamin-d3}",
  },
];

// ========== 默写练习模态框 ==========
/**
 * 默写练习模式
 * - name_to_structure: 命名→结构 (显示名称, 输入结构)
 * - structure_to_name: 结构→命名 (显示结构, 输入名称)
 * - formula_to_name: 分子式→命名 (显示分子式, 输入名称)
 */
class QuizModal extends Modal {
  /**
   * @param {App} app
   * @param {LearningCard[]} cards - 题库
   * @param {string} mode - 练习模式
   * @param {Object} options
   */
  constructor(app, cards, mode = "structure_to_name", options = {}) {
    super(app);
    this.cards = cards;
    this.mode = mode;
    this.options = options;
    this.currentCard = null;
    this.score = { correct: 0, total: 0 };
    this.totalQuestions = options.questionCount || 10;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("chemfig-quiz-modal");

    // 标题
    const modeNames = {
      structure_to_name: "结构 → 命名",
      name_to_structure: "命名 → 结构",
      formula_to_name: "分子式 → 命名",
    };
    contentEl.createEl("h2", { text: `📝 默写练习: ${modeNames[this.mode] || this.mode}` });

    // 进度条
    this.progressEl = contentEl.createDiv({ cls: "chemfig-quiz-progress" });
    this.progressBarEl = this.progressEl.createDiv({ cls: "chemfig-quiz-progress-bar" });

    // 题目区域
    this.questionEl = contentEl.createDiv({ cls: "chemfig-quiz-question" });

    // 输入区域
    const inputContainer = contentEl.createDiv({ cls: "chemfig-quiz-input" });
    this.inputEl = inputContainer.createEl("input", {
      type: "text",
      placeholder: "输入答案...",
      cls: "chemfig-quiz-input-field",
    });

    // 按钮
    const btnContainer = contentEl.createDiv({ cls: "chemfig-quiz-buttons" });
    this.submitBtn = btnContainer.createEl("button", {
      text: "提交答案",
      cls: "chemfig-action-btn",
    });
    this.skipBtn = btnContainer.createEl("button", {
      text: "跳过",
      cls: "chemfig-secondary-btn",
    });

    // 结果显示
    this.resultEl = contentEl.createDiv({ cls: "chemfig-quiz-result" });

    // 事件绑定
    this.submitBtn.onclick = () => this.checkAnswer();
    this.skipBtn.onclick = () => this.nextQuestion();
    this.inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") this.checkAnswer();
    });

    // 开始第一题
    this.nextQuestion();
  }

  // 生成下一题
  nextQuestion() {
    if (this.score.total >= this.totalQuestions) {
      this.showFinalResult();
      return;
    }

    // 随机选一张卡片
    this.currentCard = this.cards[Math.floor(Math.random() * this.cards.length)];
    this.score.total++;

    // 更新进度
    this.progressBarEl.style.width = `${(this.score.total / this.totalQuestions) * 100}%`;

    // 清空输入和结果
    this.inputEl.value = "";
    this.resultEl.empty();
    this.inputEl.focus();

    // 显示题目
    this.renderQuestion();
  }

  // 渲染题目
  renderQuestion() {
    this.questionEl.empty();
    const card = this.currentCard;

    switch (this.mode) {
      case "structure_to_name":
        // 显示结构(用名称占位, 实际应该显示结构式图片)
        this.questionEl.createEl("div", {
          text: "请写出该化合物的名称",
          cls: "chemfig-quiz-prompt",
        });
        this.questionEl.createEl("div", {
          text: `分子式: ${card.formula}`,
          cls: "chemfig-quiz-hint",
        });
        this.questionEl.createEl("div", {
          text: `分类: ${card.category}`,
          cls: "chemfig-quiz-hint",
        });
        break;

      case "name_to_structure":
        this.questionEl.createEl("div", {
          text: `请写出 ${card.name} 的 chemfig 代码`,
          cls: "chemfig-quiz-prompt",
        });
        this.questionEl.createEl("div", {
          text: `(输入 chemfig 代码片段, 如 \\chemfig{...})`,
          cls: "chemfig-quiz-hint",
        });
        break;

      case "formula_to_name":
        this.questionEl.createEl("div", {
          text: "请写出该分子式对应的化合物名称",
          cls: "chemfig-quiz-prompt",
        });
        this.questionEl.createEl("div", {
          text: `分子式: ${card.formula}`,
          cls: "chemfig-quiz-formula",
        });
        break;
    }
  }

  // 检查答案
  checkAnswer() {
    const userAnswer = this.inputEl.value.trim().toLowerCase();
    if (!userAnswer) {
      new Notice("请输入答案", 2000);
      return;
    }

    const card = this.currentCard;
    let isCorrect = false;

    switch (this.mode) {
      case "structure_to_name":
        // 检查名称 (支持中英文模糊匹配)
        isCorrect =
          userAnswer === card.name.toLowerCase() ||
          userAnswer === (card.englishName || "").toLowerCase();
        break;

      case "name_to_structure":
        // 简化检查: 只要包含 chemfig 关键字就算对 (实际应该用 OCL 比对)
        isCorrect = userAnswer.includes("chemfig");
        break;

      case "formula_to_name":
        isCorrect =
          userAnswer === card.name.toLowerCase() ||
          userAnswer === (card.englishName || "").toLowerCase();
        break;
    }

    this.score.correct += isCorrect ? 1 : 0;

    // 显示结果
    this.resultEl.empty();
    if (isCorrect) {
      this.resultEl.createEl("div", {
        text: "✅ 回答正确!",
        cls: "chemfig-quiz-correct",
      });
    } else {
      this.resultEl.createEl("div", {
        text: `❌ 正确答案: ${card.name} (${card.englishName || ""})`,
        cls: "chemfig-quiz-wrong",
      });
      if (card.usage) {
        this.resultEl.createEl("div", {
          text: `用途: ${card.usage}`,
          cls: "chemfig-quiz-explanation",
        });
      }
    }

    // 禁用提交按钮, 等待下一题
    this.submitBtn.disabled = true;
    setTimeout(() => {
      this.submitBtn.disabled = false;
      this.nextQuestion();
    }, 2000);
  }

  // 显示最终结果
  showFinalResult() {
    this.questionEl.empty();
    this.inputEl.style.display = "none";
    this.submitBtn.style.display = "none";
    this.skipBtn.style.display = "none";
    this.resultEl.empty();

    const accuracy = Math.round((this.score.correct / this.score.total) * 100);

    this.resultEl.createEl("h3", { text: "🎉 练习完成!" });
    this.resultEl.createEl("p", {
      text: `答对: ${this.score.correct} / ${this.score.total} (${accuracy}%)`,
    });

    // 评价
    let message = "";
    if (accuracy >= 90) message = "太棒了! 你对这些化合物非常熟悉!";
    else if (accuracy >= 70) message = "不错! 继续保持!";
    else if (accuracy >= 50) message = "还需要多加练习哦~";
    else message = "别灰心, 多复习几次就会记住了!";

    this.resultEl.createEl("p", { text: message, cls: "chemfig-quiz-feedback" });

    // 关闭按钮
    const closeBtn = this.resultEl.createEl("button", {
      text: "关闭",
      cls: "chemfig-action-btn",
    });
    closeBtn.onclick = () => this.close();
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// 追加默写练习 CSS
const QUIZ_CSS = `
.chemfig-quiz-modal {
  max-width: 600px;
}
.chemfig-quiz-progress {
  width: 100%;
  height: 8px;
  background: var(--background-modifier-border);
  border-radius: 4px;
  margin-bottom: 24px;
  overflow: hidden;
}
.chemfig-quiz-progress-bar {
  height: 100%;
  background: var(--interactive-accent);
  transition: width 0.3s ease;
  width: 0%;
}
.chemfig-quiz-question {
  text-align: center;
  margin-bottom: 24px;
  min-height: 100px;
}
.chemfig-quiz-prompt {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
}
.chemfig-quiz-hint {
  font-size: 14px;
  color: var(--text-muted);
  margin: 4px 0;
}
.chemfig-quiz-formula {
  font-size: 24px;
  font-family: monospace;
  color: var(--interactive-accent);
  margin: 16px 0;
}
.chemfig-quiz-input {
  margin-bottom: 16px;
}
.chemfig-quiz-input-field {
  width: 100%;
  padding: 12px;
  font-size: 16px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-primary);
  color: var(--text-normal);
}
.chemfig-quiz-input-field:focus {
  outline: none;
  border-color: var(--interactive-accent);
}
.chemfig-quiz-buttons {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.chemfig-quiz-buttons button {
  flex: 1;
}
.chemfig-secondary-btn {
  padding: 10px 20px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-secondary);
  color: var(--text-normal);
  cursor: pointer;
}
.chemfig-quiz-result {
  text-align: center;
  min-height: 60px;
}
.chemfig-quiz-correct {
  color: var(--text-success, #4caf50);
  font-size: 18px;
  font-weight: 600;
}
.chemfig-quiz-wrong {
  color: var(--text-error, #f44336);
  font-size: 16px;
  margin-bottom: 8px;
}
.chemfig-quiz-explanation {
  font-size: 14px;
  color: var(--text-muted);
}
.chemfig-quiz-feedback {
  font-size: 16px;
  color: var(--text-muted);
  margin: 12px 0;
}
`;

// ========== v11.9.0: 从 Markdown 文本解析卡片 ==========
/**
 * 从 Markdown 文本解析卡片
 * 支持格式:
 * 1. Question::Answer (单行基础卡片)
 * 2. Question:::Answer (反向卡片)
 * 3. Question\n?\nAnswer (多行卡片)
 */
function parseCardsFromMarkdown(text) {
  const cards = [];
  const lines = text.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trim();

    // 跳过空行和注释
    if (!line || line.startsWith("//") || line.startsWith("#")) {
      i++;
      continue;
    }

    // 格式 2: Question:::Answer (反向卡片)
    if (line.includes(":::")) {
      const parts = line.split(":::").map(s => s.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) {
        cards.push({
          name: parts[0],
          formula: parts[1],
          type: "reverse",
          category: "imported",
          id: "import_" + cards.length,
        });
      }
      i++;
      continue;
    }

    // 格式 1: Question::Answer
    if (line.includes("::")) {
      const parts = line.split("::").map(s => s.trim());
      if (parts.length >= 2 && parts[0] && parts[1]) {
        cards.push({
          name: parts[0],
          formula: parts[1],
          type: "basic",
          category: "imported",
          id: "import_" + cards.length,
        });
      }
      i++;
      continue;
    }

    // 格式 3: 多行卡片 (Question\n?\nAnswer)
    if (i + 2 < lines.length && lines[i + 1].trim() === "?") {
      const question = line;
      const answer = lines[i + 2].trim();
      if (question && answer) {
        cards.push({
          name: question,
          formula: answer,
          type: "multi",
          category: "imported",
          id: "import_" + cards.length,
        });
      }
      i += 3;
      continue;
    }

    i++;
  }

  return cards;
}

// 导出全局变量 (合并到 main.js)
// LearningCardModal, LearningStatsModal, SM2Algorithm, LEARNING_CSS, DEFAULT_LEARNING_CARDS

// ========== 官能团配对游戏 (v15.5.0) ==========
class FunctionalGroupMatchingGameModal extends Modal {
  constructor(app) {
    super(app);
    this.score = 0;
    this.matched = 0;
    this.total = 10;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("fg-matching-game-modal");

    contentEl.createEl("h2", { text: "🎮 官能团配对游戏" });
    contentEl.createEl("p", {
      text: "将官能团名称与对应的结构进行配对",
      cls: "fg-matching-desc",
    });

    // 分数显示
    this.scoreEl = contentEl.createDiv({ cls: "fg-matching-score" });
    this.updateScore();

    // 游戏区域
    this.gameEl = contentEl.createDiv({ cls: "fg-matching-game" });

    // 开始游戏
    this.startRound();

    this.addCSS();
  }

  startRound() {
    this.gameEl.empty();
    this.selectedLeft = null;
    this.selectedRight = null;

    // 官能团数据
    const groups = [
      { name: "羟基", pattern: "-OH", example: "乙醇" },
      { name: "醛基", pattern: "-CHO", example: "甲醛" },
      { name: "酮羰基", pattern: "C=O", example: "丙酮" },
      { name: "羧基", pattern: "-COOH", example: "乙酸" },
      { name: "氨基", pattern: "-NH₂", example: "甲胺" },
      { name: "酯基", pattern: "-COOR", example: "乙酸乙酯" },
      { name: "醚键", pattern: "C-O-C", example: "乙醚" },
      { name: "苯环", pattern: "C₆H₅-", example: "苯" },
    ];

    // 随机选 4 对
    const shuffled = [...groups].sort(() => Math.random() - 0.5).slice(0, 4);

    // 左列: 名称
    const leftCol = this.gameEl.createDiv({ cls: "fg-col" });
    leftCol.createEl("h4", { text: "官能团名称" });
    shuffled.forEach((g) => {
      const btn = leftCol.createEl("button", {
        text: g.name,
        cls: "fg-item left",
      });
      btn.dataset.name = g.name;
      btn.onclick = () => this.selectItem(btn, "left");
    });

    // 右列: 结构 (打乱顺序)
    const rightCol = this.gameEl.createDiv({ cls: "fg-col" });
    rightCol.createEl("h4", { text: "结构特征" });
    const shuffledRight = [...shuffled].sort(() => Math.random() - 0.5);
    shuffledRight.forEach((g) => {
      const btn = rightCol.createEl("button", {
        text: g.pattern,
        cls: "fg-item right",
      });
      btn.dataset.name = g.name;
      btn.onclick = () => this.selectItem(btn, "right");
    });

    this.currentPairs = shuffled;
  }

  selectItem(btn, side) {
    // 取消之前的选中
    this.gameEl.querySelectorAll(".fg-item.selected").forEach((b) => b.classList.remove("selected"));
    btn.classList.add("selected");

    if (side === "left") {
      this.selectedLeft = btn;
    } else {
      this.selectedRight = btn;
    }

    // 两边都选了, 检查配对
    if (this.selectedLeft && this.selectedRight) {
      setTimeout(() => this.checkMatch(), 300);
    }
  }

  checkMatch() {
    const leftName = this.selectedLeft.dataset.name;
    const rightName = this.selectedRight.dataset.name;

    if (leftName === rightName) {
      // 配对成功
      this.selectedLeft.classList.add("correct");
      this.selectedRight.classList.add("correct");
      this.score += 10;
      this.matched++;
      new Notice("✅ 配对正确!", 1500);

      // 禁用已配对的按钮
      setTimeout(() => {
        if (this.selectedLeft) this.selectedLeft.disabled = true;
        if (this.selectedRight) this.selectedRight.disabled = true;
        this.selectedLeft = null;
        this.selectedRight = null;

        // 检查是否全部配对完成
        if (this.matched >= this.total) {
          this.showFinalResult();
        }
      }, 500);
    } else {
      // 配对失败
      this.selectedLeft.classList.add("wrong");
      this.selectedRight.classList.add("wrong");
      this.score = Math.max(0, this.score - 2);
      new Notice("❌ 配对错误", 1500);

      setTimeout(() => {
        if (this.selectedLeft) this.selectedLeft.classList.remove("wrong", "selected");
        if (this.selectedRight) this.selectedRight.classList.remove("wrong", "selected");
        this.selectedLeft = null;
        this.selectedRight = null;
      }, 800);
    }

    this.updateScore();
  }

  updateScore() {
    if (this.scoreEl) {
      this.scoreEl.textContent = `得分: ${this.score} | 已配对: ${this.matched} / ${this.total}`;
    }
  }

  showFinalResult() {
    this.gameEl.empty();
    this.gameEl.createEl("h3", { text: "🎉 恭喜完成!" });
    this.gameEl.createEl("p", { text: `最终得分: ${this.score}` });

    const restartBtn = this.gameEl.createEl("button", {
      text: "再来一局",
      cls: "fg-matching-restart",
    });
    restartBtn.onclick = () => {
      this.score = 0;
      this.matched = 0;
      this.updateScore();
      this.startRound();
    };
  }

  addCSS() {
    if (document.getElementById("fg-matching-game-css")) return;
    const style = document.createElement("style");
    style.id = "fg-matching-game-css";
    style.textContent = `
      .fg-matching-game-modal .fg-matching-desc {
        color: var(--text-muted);
        margin-bottom: 15px;
      }
      .fg-matching-game-modal .fg-matching-score {
        font-size: 18px;
        font-weight: bold;
        margin-bottom: 15px;
        color: var(--interactive-accent);
      }
      .fg-matching-game-modal .fg-matching-game {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 30px;
        margin-top: 20px;
      }
      .fg-matching-game-modal .fg-col h4 {
        text-align: center;
        margin-bottom: 10px;
        color: var(--text-muted);
      }
      .fg-matching-game-modal .fg-item {
        display: block;
        width: 100%;
        padding: 12px;
        margin: 8px 0;
        border: 2px solid var(--background-modifier-border);
        border-radius: 8px;
        background: var(--background-primary);
        color: var(--text-normal);
        cursor: pointer;
        font-size: 14px;
        text-align: center;
        transition: all 0.2s;
      }
      .fg-matching-game-modal .fg-item:hover {
        border-color: var(--interactive-accent);
        transform: translateY(-2px);
      }
      .fg-matching-game-modal .fg-item.selected {
        border-color: var(--interactive-accent);
        background: var(--background-modifier-hover);
      }
      .fg-matching-game-modal .fg-item.correct {
        border-color: #4caf50;
        background: #e8f5e9;
        color: #2e7d32;
      }
      .fg-matching-game-modal .fg-item.wrong {
        border-color: #f44336;
        background: #ffebee;
        color: #c62828;
      }
      .fg-matching-game-modal .fg-item:disabled {
        opacity: 0.6;
        cursor: default;
      }
      .fg-matching-game-modal .fg-matching-restart {
        margin-top: 20px;
        padding: 10px 20px;
        border: none;
        border-radius: 6px;
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        cursor: pointer;
        font-size: 14px;
      }
    `;
    document.head.appendChild(style);
  }
}
// QuizModal, QUIZ_CSS
// parseCardsFromMarkdown

// ========== v14.5.0: 学习数据统计面板 ==========

/**
 * 学习数据统计模态框
 */
class LearningAnalyticsModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "📊 学习数据分析" });

    const cards = this.plugin.learningCards || [];

    if (cards.length === 0) {
      contentEl.createEl("p", { text: "暂无学习数据" });
      return;
    }

    // 统计基本信息
    const totalCards = cards.length;
    const newCards = cards.filter(c => c.state?.reps === 0).length;
    const learningCards = cards.filter(c => c.state?.reps > 0 && c.state?.reps < 3).length;
    const reviewCards = cards.filter(c => c.state?.reps >= 3).length;
    const lapses = cards.reduce((sum, c) => sum + (c.state?.lapses || 0), 0);

    // 总复习次数
    const totalReps = cards.reduce((sum, c) => sum + (c.state?.reps || 0), 0);

    // 今日复习数量
    const today = new Date().toDateString();
    const todayReviews = cards.filter(c => {
      if (!c.state?.lastReview) return false;
      return new Date(c.state.lastReview).toDateString() === today;
    }).length;

    // ========== 总览卡片 ==========
    const overview = contentEl.createDiv({ cls: "analytics-overview" });

    this.createStatCard(overview, "总卡片数", totalCards, "📚");
    this.createStatCard(overview, "新卡片", newCards, "🆕");
    this.createStatCard(overview, "学习中", learningCards, "📖");
    this.createStatCard(overview, "复习中", reviewCards, "✅");
    this.createStatCard(overview, "今日复习", todayReviews, "📅");
    this.createStatCard(overview, "总复习次数", totalReps, "🔄");
    this.createStatCard(overview, "遗忘次数", lapses, "😅");

    // ========== 掌握度分析 ==========
    contentEl.createEl("h3", { text: "🎯 掌握度分析" });

    // 按难度统计
    const easyCards = cards.filter(c => c.state?.difficulty <= 3).length;
    const normalCards = cards.filter(c => c.state?.difficulty > 3 && c.state?.difficulty <= 7).length;
    const hardCards = cards.filter(c => c.state?.difficulty > 7).length;

    const masteryDiv = contentEl.createDiv({ cls: "analytics-mastery" });
    this.createMasteryBar(masteryDiv, "简单", easyCards, totalCards, "#22c55e");
    this.createMasteryBar(masteryDiv, "中等", normalCards, totalCards, "#eab308");
    this.createMasteryBar(masteryDiv, "困难", hardCards, totalCards, "#ef4444");

    // ========== 薄弱点分析 ==========
    contentEl.createEl("h3", { text: "⚠️ 薄弱点分析" });

    // 找出遗忘次数最多的卡片
    const weakCards = cards
      .filter(c => (c.state?.lapses || 0) > 0)
      .sort((a, b) => (b.state?.lapses || 0) - (a.state?.lapses || 0))
      .slice(0, 5);

    if (weakCards.length === 0) {
      contentEl.createEl("p", { text: "🎉 太棒了！没有薄弱卡片！" });
    } else {
      const weakList = contentEl.createDiv({ cls: "analytics-weak-list" });
      weakCards.forEach(card => {
        const item = weakList.createDiv({ cls: "weak-item" });
        item.createEl("span", { text: card.front, cls: "weak-name" });
        item.createEl("span", {
          text: `遗忘 ${card.state?.lapses} 次`,
          cls: "weak-count",
        });
      });
    }

    // ========== 复习趋势 ==========
    contentEl.createEl("h3", { text: "📈 复习趋势 (最近7天)" });

    const trendDiv = contentEl.createDiv({ cls: "analytics-trend" });

    // 模拟最近7天的复习数据
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStr = date.toDateString().slice(4, 10);

      // 统计当天复习的卡片数
      const count = cards.filter(c => {
        if (!c.state?.lastReview) return false;
        return new Date(c.state.lastReview).toDateString() === date.toDateString();
      }).length;

      days.push({ day: dayStr, count });
    }

    const maxCount = Math.max(...days.map(d => d.count), 1);

    days.forEach(({ day, count }) => {
      const barItem = trendDiv.createDiv({ cls: "trend-bar-item" });
      barItem.createEl("div", { text: day, cls: "trend-day" });

      const barContainer = barItem.createDiv({ cls: "trend-bar-container" });
      const barHeight = (count / maxCount) * 60;
      barContainer.createDiv({
        cls: "trend-bar",
        attr: { style: `height: ${barHeight}px;` },
      });

      barItem.createEl("div", { text: count, cls: "trend-count" });
    });
  }

  createStatCard(parent, label, value, icon) {
    const card = parent.createDiv({ cls: "analytics-stat-card" });
    card.createEl("div", { text: icon, cls: "stat-icon" });
    card.createEl("div", { text: String(value), cls: "stat-value" });
    card.createEl("div", { text: label, cls: "stat-label" });
  }

  createMasteryBar(parent, label, count, total, color) {
    const row = parent.createDiv({ cls: "mastery-row" });
    row.createEl("div", { text: label, cls: "mastery-label" });

    const barContainer = row.createDiv({ cls: "mastery-bar-container" });
    const percent = total > 0 ? (count / total) * 100 : 0;

    barContainer.createDiv({
      cls: "mastery-bar",
      attr: {
        style: `width: ${percent}%; background: ${color};`,
      },
    });

    row.createEl("div", { text: `${count} (${percent.toFixed(0)}%)`, cls: "mastery-count" });
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// 统计面板 CSS
const ANALYTICS_CSS = `
.analytics-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
  margin: 16px 0;
}
.analytics-stat-card {
  text-align: center;
  padding: 16px;
  background: var(--background-secondary);
  border-radius: 8px;
}
.stat-icon { font-size: 24px; margin-bottom: 8px; }
.stat-value { font-size: 24px; font-weight: 700; color: var(--interactive-accent); }
.stat-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

.analytics-mastery { margin: 12px 0; }
.mastery-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0;
}
.mastery-label { width: 40px; font-size: 13px; }
.mastery-bar-container {
  flex: 1;
  height: 20px;
  background: var(--background-modifier-border);
  border-radius: 10px;
  overflow: hidden;
}
.mastery-bar { height: 100%; transition: width 0.3s ease; }
.mastery-count { width: 80px; font-size: 12px; color: var(--text-muted); }

.analytics-weak-list { margin: 12px 0; }
.weak-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 12px;
  margin: 4px 0;
  background: var(--background-secondary);
  border-radius: 6px;
}
.weak-name { font-weight: 500; }
.weak-count { color: #ef4444; font-size: 13px; }

.analytics-trend {
  display: flex;
  align-items: flex-end;
  justify-content: space-around;
  height: 100px;
  margin: 16px 0;
  padding: 0 12px;
}
.trend-bar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.trend-bar-container {
  width: 24px;
  height: 60px;
  display: flex;
  align-items: flex-end;
  background: var(--background-modifier-border);
  border-radius: 4px 4px 0 0;
}
.trend-bar {
  width: 100%;
  background: var(--interactive-accent);
  border-radius: 4px 4px 0 0;
  min-height: 2px;
}
.trend-day { font-size: 11px; color: var(--text-muted); }
.trend-count { font-size: 11px; font-weight: 600; }
`;

// ========== 每日一题模态框 (v15.5.0) ==========
class DailyQuestionModal extends Modal {
  constructor(app, plugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("daily-question-modal");

    // 标题
    const today = new Date().toLocaleDateString("zh-CN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
    contentEl.createEl("h2", { text: `📅 每日一题 - ${today}` });

    // 获取今日化合物 (基于日期随机)
    const cards = this.plugin.learningCards || DEFAULT_LEARNING_CARDS;
    const todaySeed = this.getTodaySeed();
    const card = cards[todaySeed % cards.length];

    // 显示卡片
    const cardEl = contentEl.createDiv({ cls: "daily-card" });
    cardEl.createEl("h3", { text: card.name });
    cardEl.createEl("p", { text: card.englishName, cls: "daily-card-english" });
    cardEl.createEl("p", { text: `分子式: ${card.formula}`, cls: "daily-card-formula" });
    cardEl.createEl("p", { text: `分类: ${card.category}`, cls: "daily-card-category" });

    // 点击显示详情
    const detailBtn = contentEl.createEl("button", {
      text: "查看详情",
      cls: "daily-detail-btn",
    });
    detailBtn.onclick = () => {
      this.showDetails(cardEl, card);
    };

    // 操作按钮
    const btnContainer = contentEl.createDiv({ cls: "daily-actions" });

    const studyBtn = btnContainer.createEl("button", {
      text: "开始学习",
      cls: "daily-action-btn primary",
    });
    studyBtn.onclick = () => {
      new LearningCardModal(this.app, card, () => {}, {}).open();
    };

    const quizBtn = btnContainer.createEl("button", {
      text: "默写练习",
      cls: "daily-action-btn",
    });
    quizBtn.onclick = () => {
      new QuizModal(this.app, [card], "structure_to_name", { questionCount: 1 }).open();
    };

    // 提示
    contentEl.createEl("p", {
      text: "💡 每天学习一个新化合物，积少成多！",
      cls: "daily-hint",
    });

    this.addCSS();
  }

  getTodaySeed() {
    const now = new Date();
    return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  }

  showDetails(container, card) {
    container.empty();
    container.createEl("h3", { text: card.name });
    if (card.englishName) {
      container.createEl("p", { text: card.englishName, cls: "daily-card-english" });
    }
    container.createEl("p", { text: `分子式: ${card.formula}` });
    container.createEl("p", { text: `分类: ${card.category}` });
    if (card.usage) {
      container.createEl("p", { text: `用途: ${card.usage}`, cls: "daily-detail" });
    }
    if (card.source) {
      container.createEl("p", { text: `来源: ${card.source}`, cls: "daily-detail" });
    }
    if (card.smiles) {
      container.createEl("p", { text: `SMILES:`, cls: "daily-detail-title" });
      container.createEl("code", { text: card.smiles, cls: "daily-smiles" });
    }
  }

  addCSS() {
    if (document.getElementById("daily-question-css")) return;
    const style = document.createElement("style");
    style.id = "daily-question-css";
    style.textContent = `
      .daily-question-modal h2 {
        text-align: center;
        margin-bottom: 20px;
      }
      .daily-question-modal .daily-card {
        padding: 20px;
        background: var(--background-secondary);
        border-radius: 12px;
        text-align: center;
        margin-bottom: 20px;
      }
      .daily-question-modal .daily-card-english {
        color: var(--text-muted);
        font-style: italic;
      }
      .daily-question-modal .daily-card-formula {
        font-size: 18px;
        font-weight: bold;
        color: var(--interactive-accent);
      }
      .daily-question-modal .daily-card-category {
        color: var(--text-muted);
      }
      .daily-question-modal .daily-detail {
        text-align: left;
        margin: 8px 0;
      }
      .daily-question-modal .daily-detail-title {
        margin-top: 12px;
        margin-bottom: 4px;
        font-weight: bold;
      }
      .daily-question-modal .daily-smiles {
        display: block;
        padding: 8px;
        background: var(--background-primary);
        border-radius: 4px;
        font-size: 12px;
        word-break: break-all;
      }
      .daily-question-modal .daily-detail-btn {
        display: block;
        width: 100%;
        padding: 10px;
        margin-bottom: 15px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        color: var(--text-normal);
        cursor: pointer;
      }
      .daily-question-modal .daily-detail-btn:hover {
        background: var(--background-modifier-hover);
      }
      .daily-question-modal .daily-actions {
        display: flex;
        gap: 10px;
      }
      .daily-question-modal .daily-action-btn {
        flex: 1;
        padding: 10px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        color: var(--text-normal);
        cursor: pointer;
      }
      .daily-question-modal .daily-action-btn.primary {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border-color: var(--interactive-accent);
      }
      .daily-question-modal .daily-hint {
        text-align: center;
        color: var(--text-muted);
        margin-top: 20px;
        font-size: 13px;
      }
    `;
    document.head.appendChild(style);
  }
}

// ========== 反应机理可视化模态框 (v15.5.0) ==========
class ReactionMechanismModal extends Modal {
  constructor(app) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("reaction-mechanism-modal");

    contentEl.createEl("h2", { text: "⚗️ 反应机理可视化" });
    contentEl.createEl("p", {
      text: "选择常见有机反应，查看反应历程和关键要点",
      cls: "mechanism-desc",
    });

    // 反应类型选择
    const typeBar = contentEl.createDiv({ cls: "mechanism-type-bar" });
    const reactions = [
      { id: "sn1", name: "SN1 亲核取代" },
      { id: "sn2", name: "SN2 亲核取代" },
      { id: "e1", name: "E1 消除" },
      { id: "e2", name: "E2 消除" },
      { id: "electrophilic-addition", name: "烯烃亲电加成" },
      { id: "nucleophilic-addition", name: "羰基亲核加成" },
      { id: "friedel-crafts", name: "Friedel-Crafts" },
      { id: "aldol", name: "羟醛缩合" },
      { id: "diels-alder", name: "Diels-Alder" },
      { id: "grignard", name: "格氏试剂" },
      { id: "wittig", name: "Wittig 反应" },
      { id: "ester-hydrolysis", name: "酯水解" },
    ];

    this.currentReaction = null;
    reactions.forEach((r) => {
      const btn = typeBar.createEl("button", {
        text: r.name,
        cls: "mechanism-type-btn",
      });
      btn.dataset.id = r.id;
      btn.onclick = () => {
        typeBar.querySelectorAll(".mechanism-type-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.renderMechanism(r.id);
      };
    });

    // 机理显示区域
    this.mechanismEl = contentEl.createDiv({ cls: "mechanism-display" });
    this.mechanismEl.createEl("p", {
      text: "👆 请选择一个反应类型查看机理",
      cls: "mechanism-placeholder",
    });

    this.addCSS();
  }

  renderMechanism(reactionId) {
    const mech = this.mechanismEl;
    mech.empty();

    const mechanisms = this.getMechanismData(reactionId);
    if (!mechanisms) {
      mech.createEl("p", { text: "该反应机理正在开发中..." });
      return;
    }

    // 反应名称
    mech.createEl("h3", { text: mechanisms.name });

    // 反应类型说明
    mech.createEl("p", {
      text: mechanisms.description,
      cls: "mechanism-desc",
    });

    // 分步显示
    mechanisms.steps.forEach((step, i) => {
      const stepDiv = mech.createDiv({ cls: "mechanism-step" });
      stepDiv.createEl("h4", { text: `步骤 ${i + 1}: ${step.title}` });

      // 反应物 → 产物
      const equationDiv = stepDiv.createDiv({ cls: "mechanism-equation" });
      equationDiv.createEl("code", { text: step.reactants });
      equationDiv.createEl("span", { text: " → ", cls: "mechanism-arrow" });
      equationDiv.createEl("code", { text: step.products });

      // 说明
      if (step.note) {
        stepDiv.createEl("p", { text: `💡 ${step.note}`, cls: "mechanism-note" });
      }
    });

    // 关键要点
    if (mechanisms.keyPoints) {
      const keyDiv = mech.createDiv({ cls: "mechanism-key-points" });
      keyDiv.createEl("h4", { text: "🔑 关键要点" });
      mechanisms.keyPoints.forEach((point) => {
        keyDiv.createEl("li", { text: point });
      });
    }
  }

  getMechanismData(id) {
    const data = {
      sn1: {
        name: "SN1 亲核取代反应",
        description: "单分子亲核取代，分两步进行，生成碳正离子中间体",
        steps: [
          {
            title: "离去基团离去",
            reactants: "R-LG → R⁺ + LG⁻",
            products: "碳正离子中间体",
            note: "慢步骤，决定反应速率",
          },
          {
            title: "亲核试剂进攻",
            reactants: "R⁺ + Nu⁻ → R-Nu",
            products: "取代产物",
            note: "快步骤，两面进攻生成外消旋体",
          },
        ],
        keyPoints: [
          "三级卤代烷 > 二级 > 一级",
          "生成碳正离子中间体",
          "外消旋化产物",
          "极性溶剂加速反应",
        ],
      },
      sn2: {
        name: "SN2 亲核取代反应",
        description: "双分子亲核取代，一步完成，背面进攻",
        steps: [
          {
            title: "背面进攻 + 离去基团离去",
            reactants: "Nu⁻ + R-LG → [Nu---R---LG]‡ → Nu-R + LG⁻",
            products: "取代产物",
            note: "协同反应，构型翻转 (Walden 翻转)",
          },
        ],
        keyPoints: [
          "一级卤代烷 > 二级 > 三级",
          "背面进攻，构型翻转",
          "动力学二级反应",
          "极性非质子溶剂加速",
        ],
      },
      e1: {
        name: "E1 消除反应",
        description: "单分子消除，分两步进行，生成碳正离子中间体",
        steps: [
          {
            title: "离去基团离去",
            reactants: "R-LG → R⁺ + LG⁻",
            products: "碳正离子中间体",
            note: "慢步骤",
          },
          {
            title: "去质子化",
            reactants: "R⁺ + B: → 烯烃 + BH⁺",
            products: "消除产物",
            note: "Zaitsev 规则，生成更稳定烯烃",
          },
        ],
        keyPoints: [
          "三级 > 二级 > 一级",
          "生成碳正离子，可能重排",
          "Zaitsev 规则",
          "与 SN1 竞争",
        ],
      },
      e2: {
        name: "E2 消除反应",
        description: "双分子消除，一步完成，反式共平面",
        steps: [
          {
            title: "碱夺取质子 + 离去基团离去",
            reactants: "B: + H-C-C-LG → B-H + C=C + LG⁻",
            products: "烯烃产物",
            note: "反式共平面要求",
          },
        ],
        keyPoints: [
          "三级 > 二级 > 一级",
          "反式共平面要求",
          "Zaitsev 规则 (一般情况)",
          "大体积碱给出 Hofmann 产物",
        ],
      },
      "electrophilic-addition": {
        name: "烯烃亲电加成",
        description: "烯烃与亲电试剂的加成反应",
        steps: [
          {
            title: "亲电试剂进攻 π 键",
            reactants: "C=C + E⁺ → E-C-C⁺",
            products: "碳正离子中间体",
            note: "生成更稳定碳正离子 (马氏规则)",
          },
          {
            title: "亲核试剂进攻",
            reactants: "C⁺ + Nu⁻ → C-Nu",
            products: "加成产物",
            note: "完成加成",
          },
        ],
        keyPoints: [
          "马氏规则: H 加在氢多的碳上",
          "碳正离子中间体",
          "可能重排",
          "过氧化物效应 (反马氏)",
        ],
      },
      "nucleophilic-addition": {
        name: "羰基亲核加成",
        description: "醛酮与亲核试剂的加成反应",
        steps: [
          {
            title: "亲核试剂进攻羰基碳",
            reactants: "C=O + Nu⁻ → Nu-C-O⁻",
            products: "四面体中间体",
            note: "羰基碳带部分正电",
          },
          {
            title: "质子化",
            reactants: "O⁻ + H⁺ → OH",
            products: "加成产物",
            note: "生成醇/半缩醛等",
          },
        ],
        keyPoints: [
          "醛 > 酮 (空间位阻)",
          "亲核性强的试剂更容易反应",
          "酸性/碱性催化",
          "生成四面体中间体",
        ],
      },
      "friedel-crafts": {
        name: "Friedel-Crafts 反应",
        description: "芳烃的亲电取代反应",
        steps: [
          {
            title: "生成亲电试剂",
            reactants: "R-Cl + AlCl3 → R⁺ + AlCl4⁻",
            products: "碳正离子亲电试剂",
            note: "Lewis 酸催化",
          },
          {
            title: "芳环进攻",
            reactants: "Ar-H + R⁺ → Ar-H-R⁺",
            products: "σ 络合物",
            note: "破坏芳香性",
          },
          {
            title: "去质子化",
            reactants: "Ar-H-R⁺ → Ar-R + H⁺",
            products: "取代芳烃",
            note: "恢复芳香性",
          },
        ],
        keyPoints: [
          "需要 Lewis 酸催化",
          "烷基化可能重排",
          "酰基化不重排",
          "强吸电子基钝化芳环",
        ],
      },
      aldol: {
        name: "羟醛缩合反应",
        description: "含 α-H 的醛酮之间的缩合反应",
        steps: [
          {
            title: "烯醇负离子生成",
            reactants: "R-CH2-CHO + OH⁻ → R-CH(-)-CHO + H2O",
            products: "烯醇负离子",
            note: "夺取 α-H",
          },
          {
            title: "亲核加成",
            reactants: "R-CH(-)-CHO + R-CHO → β-羟基醛",
            products: "β-羟基醛/酮",
            note: "两分子醛酮加成",
          },
          {
            title: "脱水 (加热)",
            reactants: "β-羟基醛 → α,β-不饱和醛 + H2O",
            products: "α,β-不饱和羰基化合物",
            note: "形成共轭体系",
          },
        ],
        keyPoints: [
          "需要 α-H",
          "稀碱催化",
          "分子间/分子内均可",
          "脱水生成 α,β-不饱和羰基",
        ],
      },
      "diels-alder": {
        name: "Diels-Alder 反应",
        description: "双烯体与亲双烯体的[4+2]环加成反应",
        steps: [
          {
            title: "协同环加成",
            reactants: "双烯体 + 亲双烯体 → 环己烯衍生物",
            products: "六元环产物",
            note: "协同反应, 无中间体",
          },
        ],
        keyPoints: [
          "协同反应, 立体专一",
          "内型规则 (Endo)",
          "顺式加成",
          "富电子双烯 + 缺电子亲双烯",
        ],
      },
      "grignard": {
        name: "格氏试剂反应",
        description: "格氏试剂与羰基化合物的加成反应",
        steps: [
          {
            title: "格氏试剂生成",
            reactants: "R-X + Mg → R-MgX",
            products: "格氏试剂",
            note: "无水乙醚/THF 溶剂",
          },
          {
            title: "亲核加成",
            reactants: "R-MgX + R'-CHO → R-CH(O-MgX)-R'",
            products: "醇盐中间体",
            note: "亲核加成到羰基",
          },
          {
            title: "水解",
            reactants: "醇盐 + H2O → R-CH(OH)-R' + MgX(OH)",
            products: "醇产物",
            note: "酸性水解",
          },
        ],
        keyPoints: [
          "严格无水条件",
          "甲醛 → 伯醇",
          "醛 → 仲醇",
          "酮 → 叔醇",
        ],
      },
      "wittig": {
        name: "Wittig 反应",
        description: "磷叶立德与醛酮反应生成烯烃",
        steps: [
          {
            title: "叶立德生成",
            reactants: "Ph3P + R-CH2-X → Ph3P+-CH2-R X- → Ph3P=CH-R",
            products: "磷叶立德",
            note: "强碱去质子化",
          },
          {
            title: "[2+2] 环加成",
            reactants: "Ph3P=CH-R + R'-CHO → 氧磷杂四元环",
            products: "氧磷杂环丁烷",
            note: "协同环加成",
          },
          {
            title: "分解",
            reactants: "氧磷杂环丁烷 → R-CH=CH-R' + Ph3P=O",
            products: "烯烃 + 三苯基氧膦",
            note: "分解生成烯烃",
          },
        ],
        keyPoints: [
          "高选择性生成烯烃",
          "Z/E 选择性取决于叶立德",
          "无重排",
          "官能团兼容性好",
        ],
      },
      "ester-hydrolysis": {
        name: "酯的水解反应",
        description: "酯在酸或碱催化下的水解反应",
        steps: [
          {
            title: "亲核加成",
            reactants: "RCOOR' + OH⁻ → R-C(O⁻)(OH)-OR'",
            products: "四面体中间体",
            note: "碱催化机理",
          },
          {
            title: "离去基团离去",
            reactants: "四面体中间体 → RCOO⁻ + R'OH",
            products: "羧酸盐 + 醇",
            note: "生成羧酸盐",
          },
        ],
        keyPoints: [
          "碱催化: 不可逆, 生成羧酸盐",
          "酸催化: 可逆, 生成羧酸 + 醇",
          "SN2 酰基氧断裂",
          "伯/仲醇酯易水解",
        ],
      },
    };

    return data[id] || null;
  }

  addCSS() {
    if (document.getElementById("reaction-mechanism-css")) return;
    const style = document.createElement("style");
    style.id = "reaction-mechanism-css";
    style.textContent = `
      .reaction-mechanism-modal h2 {
        text-align: center;
      }
      .reaction-mechanism-modal .mechanism-desc {
        color: var(--text-muted);
        text-align: center;
        margin-bottom: 15px;
      }
      .reaction-mechanism-modal .mechanism-type-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-bottom: 20px;
      }
      .reaction-mechanism-modal .mechanism-type-btn {
        padding: 6px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 15px;
        background: var(--background-primary);
        color: var(--text-muted);
        cursor: pointer;
        font-size: 13px;
      }
      .reaction-mechanism-modal .mechanism-type-btn:hover,
      .reaction-mechanism-modal .mechanism-type-btn.active {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border-color: var(--interactive-accent);
      }
      .reaction-mechanism-modal .mechanism-display {
        min-height: 300px;
      }
      .reaction-mechanism-modal .mechanism-placeholder {
        text-align: center;
        color: var(--text-muted);
        padding: 60px 20px;
      }
      .reaction-mechanism-modal .mechanism-step {
        padding: 15px;
        margin: 10px 0;
        background: var(--background-secondary);
        border-radius: 8px;
      }
      .reaction-mechanism-modal .mechanism-equation {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 10px 0;
        flex-wrap: wrap;
      }
      .reaction-mechanism-modal .mechanism-equation code {
        padding: 6px 10px;
        background: var(--background-primary);
        border-radius: 4px;
        font-size: 13px;
      }
      .reaction-mechanism-modal .mechanism-arrow {
        font-size: 18px;
        color: var(--interactive-accent);
        font-weight: bold;
      }
      .reaction-mechanism-modal .mechanism-note {
        color: var(--text-muted);
        font-size: 13px;
        margin: 8px 0 0 0;
      }
      .reaction-mechanism-modal .mechanism-key-points {
        margin-top: 20px;
        padding: 15px;
        background: var(--background-secondary);
        border-radius: 8px;
      }
      .reaction-mechanism-modal .mechanism-key-points li {
        margin: 6px 0;
      }
    `;
    document.head.appendChild(style);
  }
}

// ========== v15.8.0: 成就系统 (学习自 Carden) ==========
class AchievementSystem {
  static ACHIEVEMENTS = [
    {
      id: "first_card",
      name: "初出茅庐",
      description: "完成第一张学习卡片",
      icon: "🌱",
      condition: (stats) => stats.totalCards >= 1,
    },
    {
      id: "cards_10",
      name: "小有所成",
      description: "掌握 10 个化合物",
      icon: "📚",
      condition: (stats) => stats.masteredCards >= 10,
    },
    {
      id: "cards_50",
      name: "学富五车",
      description: "掌握 50 个化合物",
      icon: "🎓",
      condition: (stats) => stats.masteredCards >= 50,
    },
    {
      id: "cards_100",
      name: "化学大师",
      description: "掌握 100 个化合物",
      icon: "👨‍🔬",
      condition: (stats) => stats.masteredCards >= 100,
    },
    {
      id: "streak_7",
      name: "七日坚持",
      description: "连续学习 7 天",
      icon: "🔥",
      condition: (stats) => stats.currentStreak >= 7,
    },
    {
      id: "streak_30",
      name: "月度达人",
      description: "连续学习 30 天",
      icon: "🏆",
      condition: (stats) => stats.currentStreak >= 30,
    },
    {
      id: "perfect_10",
      name: "十全十美",
      description: "连续答对 10 题",
      icon: "💯",
      condition: (stats) => stats.perfectStreak >= 10,
    },
    {
      id: "quiz_100",
      name: "百题斩",
      description: "完成 100 道默写题",
      icon: "⚔️",
      condition: (stats) => stats.totalQuizAttempts >= 100,
    },
  ];

  static getUnlockedAchievements(stats, unlockedIds) {
    return this.ACHIEVEMENTS.filter((a) => {
      if (unlockedIds.has(a.id)) return true;
      try {
        return a.condition(stats);
      } catch {
        return false;
      }
    });
  }

  static getNewlyUnlocked(stats, unlockedIds) {
    const newOnes = [];
    for (const achievement of this.ACHIEVEMENTS) {
      if (unlockedIds.has(achievement.id)) continue;
      try {
        if (achievement.condition(stats)) {
          newOnes.push(achievement);
          unlockedIds.add(achievement.id);
        }
      } catch {}
    }
    return newOnes;
  }
}

// ========== 成就展示模态框 ==========
class AchievementModal extends Modal {
  constructor(app, stats, unlockedIds) {
    super(app);
    this.stats = stats;
    this.unlockedIds = unlockedIds;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("achievement-modal");

    contentEl.createEl("h2", { text: "🏆 成就系统" });
    contentEl.createEl("p", {
      text: `已解锁 ${this.unlockedIds.size} / ${AchievementSystem.ACHIEVEMENTS.length} 个成就`,
      cls: "achievement-subtitle",
    });

    const grid = contentEl.createDiv("achievement-grid");

    for (const achievement of AchievementSystem.ACHIEVEMENTS) {
      const isUnlocked = this.unlockedIds.has(achievement.id);
      const card = grid.createDiv("achievement-card");
      card.classList.toggle("unlocked", isUnlocked);

      card.createEl("div", {
        text: achievement.icon,
        cls: "achievement-icon",
      });

      card.createEl("div", {
        text: achievement.name,
        cls: "achievement-name",
      });

      card.createEl("div", {
        text: achievement.description,
        cls: "achievement-desc",
      });

      if (!isUnlocked) {
        card.classList.add("locked");
        card.querySelector(".achievement-icon").textContent = "🔒";
      }
    }

    // CSS
    const style = document.createElement("style");
    style.textContent = `
      .achievement-modal h2 {
        margin: 0 0 8px 0;
      }
      .achievement-subtitle {
        color: var(--text-muted);
        margin: 0 0 20px 0;
      }
      .achievement-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
        gap: 12px;
      }
      .achievement-card {
        padding: 16px;
        border: 2px solid var(--background-modifier-border);
        border-radius: 12px;
        text-align: center;
        transition: all 0.3s;
      }
      .achievement-card.unlocked {
        border-color: var(--interactive-accent);
        background: var(--background-modifier-hover);
      }
      .achievement-card.locked {
        opacity: 0.5;
      }
      .achievement-icon {
        font-size: 32px;
        margin-bottom: 8px;
      }
      .achievement-name {
        font-weight: 600;
        margin-bottom: 4px;
      }
      .achievement-desc {
        font-size: 11px;
        color: var(--text-muted);
      }
    `;
    document.head.appendChild(style);
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ========== v15.8.0: 游戏化学习统计面板 (学习自 Carden) ==========
class GamifiedStatsModal extends Modal {
  constructor(app, stats) {
    super(app);
    this.stats = stats || {
      totalCards: 0,
      masteredCards: 0,
      currentStreak: 0,
      perfectStreak: 0,
      totalQuizAttempts: 0,
    };
    this.unlockedAchievements = new Set();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("gamified-stats-modal");

    contentEl.createEl("h2", { text: "📊 学习数据面板" });

    // 积分系统
    const pointsCard = contentEl.createDiv("stats-points-card");
    const totalPoints = this.stats.masteredCards * 10 + this.stats.currentStreak * 5;
    pointsCard.createEl("div", {
      text: "⭐ 总积分",
      cls: "points-label",
    });
    pointsCard.createEl("div", {
      text: totalPoints.toString(),
      cls: "points-value",
    });
    pointsCard.createEl("div", {
      text: "掌握化合物 +10 | 连续学习 +5/天",
      cls: "points-hint",
    });

    // 统计网格
    const statsGrid = contentEl.createDiv("stats-grid");

    const statsItems = [
      { icon: "📚", label: "已学卡片", value: this.stats.totalCards },
      { icon: "✅", label: "已掌握", value: this.stats.masteredCards },
      { icon: "🔥", label: "连续学习", value: this.stats.currentStreak + " 天" },
      { icon: "💯", label: "完美连胜", value: this.stats.perfectStreak },
      { icon: "⚔️", label: "答题总数", value: this.stats.totalQuizAttempts },
      {
        icon: "🏆",
        label: "成就",
        value: `${this.unlockedAchievements.size} / ${AchievementSystem.ACHIEVEMENTS.length}`,
      },
    ];

    for (const item of statsItems) {
      const card = statsGrid.createDiv("stats-item-card");
      card.createEl("div", { text: item.icon, cls: "stats-icon" });
      card.createEl("div", { text: item.label, cls: "stats-label" });
      card.createEl("div", { text: item.value, cls: "stats-value" });
    }

    // 成就按钮
    const achievementBtn = contentEl.createEl("button", {
      text: "🏆 查看成就",
      cls: "achievement-btn",
    });
    achievementBtn.onclick = () => {
      new AchievementModal(this.app, this.stats, this.unlockedAchievements).open();
    };

    // CSS
    const style = document.createElement("style");
    style.textContent = `
      .gamified-stats-modal h2 {
        margin: 0 0 16px 0;
      }
      .stats-points-card {
        padding: 20px;
        background: linear-gradient(135deg, var(--interactive-accent), var(--interactive-accent-hover));
        border-radius: 12px;
        text-align: center;
        color: var(--text-on-accent);
        margin-bottom: 16px;
      }
      .points-label {
        font-size: 12px;
        opacity: 0.9;
      }
      .points-value {
        font-size: 36px;
        font-weight: 700;
        margin: 8px 0;
      }
      .points-hint {
        font-size: 11px;
        opacity: 0.8;
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-bottom: 16px;
      }
      .stats-item-card {
        padding: 16px;
        background: var(--background-secondary);
        border-radius: 8px;
        text-align: center;
      }
      .stats-icon {
        font-size: 24px;
        margin-bottom: 8px;
      }
      .stats-label {
        font-size: 11px;
        color: var(--text-muted);
        margin-bottom: 4px;
      }
      .stats-value {
        font-size: 18px;
        font-weight: 600;
      }
      .achievement-btn {
        width: 100%;
        padding: 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        background: var(--background-secondary);
        cursor: pointer;
        font-size: 13px;
        transition: all 0.2s;
      }
      .achievement-btn:hover {
        background: var(--background-modifier-hover);
        border-color: var(--interactive-accent);
      }
    `;
    document.head.appendChild(style);
  }

  onClose() {
    this.contentEl.empty();
  }
}
