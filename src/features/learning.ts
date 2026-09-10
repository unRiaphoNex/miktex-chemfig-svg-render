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
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("chemfig-learning-modal");

    // 卡片容器
    const cardContainer = contentEl.createDiv({ cls: "chemfig-learning-card" });

    // 正面: 只显示结构式
    const front = cardContainer.createDiv({ cls: "chemfig-card-front" });
    front.createEl("h3", { text: this.card.name });
    front.createEl("p", { text: this.card.formula || "", cls: "chemfig-card-formula" });

    // 结构式预览区
    const previewArea = front.createDiv({ cls: "chemfig-card-preview" });
    previewArea.createEl("div", { text: "点击卡片查看答案", cls: "chemfig-card-hint" });

    // 点击翻转
    cardContainer.onclick = () => {
      this.flipped = !this.flipped;
      this.renderCard(cardContainer);
    };

    this.renderCard(cardContainer);

    // 底部评分按钮
    const btnContainer = contentEl.createDiv({ cls: "chemfig-card-buttons" });
    const buttons = [
      { quality: 1, label: "😫 忘记了", desc: "1天" },
      { quality: 2, label: "😐 困难", desc: "3天" },
      { quality: 3, label: "😊 好", desc: "7天" },
      { quality: 4, label: "😎 容易", desc: "15天" },
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
    const front = container.querySelector(".chemfig-card-front");
    if (!front) return;

    const previewArea = front.querySelector(".chemfig-card-preview");
    const hint = front.querySelector(".chemfig-card-hint");

    if (this.flipped) {
      // 背面: 显示详细信息
      if (hint) hint.remove();
      previewArea.empty();

      // 显示 chemfig 代码 (简化版)
      previewArea.createEl("pre", {
        text: this.card.chemfigCode || "暂无代码",
        cls: "chemfig-card-code",
      });

      // 详细信息
      const details = container.createDiv({ cls: "chemfig-card-details" });
      details.createEl("p", { text: `分子式: ${this.card.formula || "未知"}` });
      details.createEl("p", { text: `分类: ${this.card.category || "未分类"}` });
      if (this.card.usage) details.createEl("p", { text: `用途: ${this.card.usage}` });
      if (this.card.smiles) details.createEl("p", { text: `SMILES: ${this.card.smiles}` });
    } else {
      // 正面: 只显示名称
      if (details) details.remove();
      previewArea.empty();
      previewArea.createEl("div", { text: "点击卡片查看答案", cls: "chemfig-card-hint" });
    }
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
  }
}

// ========== 学习模块 CSS ==========
const LEARNING_CSS = `
.chemfig-learning-modal {
  max-width: 600px;
}
.chemfig-learning-card {
  background: var(--background-secondary);
  border-radius: 12px;
  padding: 32px;
  margin-bottom: 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  min-height: 300px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.chemfig-learning-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
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

// 导出全局变量 (合并到 main.js)
// LearningCardModal, LearningStatsModal, SM2Algorithm, LEARNING_CSS, DEFAULT_LEARNING_CARDS
// QuizModal, QUIZ_CSS
