// ========== 配对游戏 (v17.1.0) ==========
// 学习辅助: 多种类型的配对练习

// ========== 官能团配对数据 ==========
const FUNCTIONAL_GROUPS = [
  { id: "hydroxyl", name: "羟基", formula: "-OH", example: "乙醇 CH3CH2OH" },
  { id: "carbonyl", name: "羰基", formula: "C=O", example: "丙酮 CH3COCH3" },
  { id: "carboxyl", name: "羧基", formula: "-COOH", example: "乙酸 CH3COOH" },
  { id: "amino", name: "氨基", formula: "-NH2", example: "甲胺 CH3NH2" },
  { id: "ether", name: "醚键", formula: "C-O-C", example: "乙醚 CH3CH2OCH2CH3" },
  { id: "ester", name: "酯基", formula: "-COOR", example: "乙酸乙酯 CH3COOCH2CH3" },
  { id: "aldehyde", name: "醛基", formula: "-CHO", example: "乙醛 CH3CHO" },
  { id: "ketone", name: "酮基", formula: "-CO-", example: "丙酮 CH3COCH3" },
  { id: "halide", name: "卤代烃", formula: "-X (Cl, Br, I)", example: "氯甲烷 CH3Cl" },
  { id: "alkene", name: "双键", formula: "C=C", example: "乙烯 CH2=CH2" },
  { id: "alkyne", name: "三键", formula: "C≡C", example: "乙炔 HC≡CH" },
  { id: "benzene", name: "苯环", formula: "C6H5-", example: "苯 C6H6" },
];

// ========== 反应条件配对数据 ==========
const REACTION_CONDITIONS = [
  { id: "h2-pd", name: "H2/Pd", type: "催化氢化", example: "烯烃加氢生成烷烃" },
  { id: "kmno4", name: "KMnO4", type: "氧化反应", example: "烯烃氧化生成酮/羧酸" },
  { id: "nabh4", name: "NaBH4", type: "还原反应", example: "醛酮还原生成醇" },
  { id: "lialh4", name: "LiAlH4", type: "还原反应", example: "羧酸还原生成醇" },
  { id: "h2so4", name: "浓H2SO4", type: "脱水反应", example: "醇脱水生成烯烃" },
  { id: "hbr", name: "HBr", type: "亲电加成", example: "烯烃加成生成卤代烃" },
  { id: "agno3", name: "AgNO3", type: "银镜反应", example: "醛氧化生成羧酸" },
  { id: "br2", name: "Br2/FeBr3", type: "亲电取代", example: "苯环溴代" },
];

// ========== 化合物分类配对数据 ==========
const COMPOUND_CATEGORIES = [
  { id: "alcohol", name: "乙醇", category: "醇类", formula: "CH3CH2OH" },
  { id: "acetic-acid", name: "乙酸", category: "羧酸", formula: "CH3COOH" },
  { id: "acetone", name: "丙酮", category: "酮类", formula: "CH3COCH3" },
  { id: "benzene", name: "苯", category: "芳香烃", formula: "C6H6" },
  { id: "glucose", name: "葡萄糖", category: "糖类", formula: "C6H12O6" },
  { id: "aspirin", name: "阿司匹林", category: "药物", formula: "C9H8O4" },
  { id: "caffeine", name: "咖啡因", category: "生物碱", formula: "C8H10N4O2" },
  { id: "urea", name: "尿素", category: "有机氮", formula: "CO(NH2)2" },
];

// ========== 游戏类型枚举 ==========
const GameType = {
  FUNCTIONAL_GROUP: "functional-group",
  REACTION_CONDITION: "reaction-condition",
  COMPOUND_CATEGORY: "compound-category",
};

// ========== 配对游戏模态框 ==========
class MatchingGameModal extends Modal {
  constructor(app, gameType = GameType.FUNCTIONAL_GROUP) {
    super(app);
    this.gameType = gameType;
    this.score = 0;
    this.mistakes = 0;
    this.currentRound = 0;
    this.totalRounds = 5;
    this.selectedLeft = null;
    this.selectedRight = null;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("chemfig-matching-modal");

    // 根据游戏类型设置标题
    let title = "🎯 配对游戏";
    let leftLabel = "";
    let rightLabel = "";
    let gameData = [];

    switch (this.gameType) {
      case GameType.FUNCTIONAL_GROUP:
        title = "🎯 官能团配对游戏";
        leftLabel = "官能团名称";
        rightLabel = "结构式";
        gameData = FUNCTIONAL_GROUPS;
        break;
      case GameType.REACTION_CONDITION:
        title = "⚗️ 反应条件配对游戏";
        leftLabel = "反应条件";
        rightLabel = "反应类型";
        gameData = REACTION_CONDITIONS;
        break;
      case GameType.COMPOUND_CATEGORY:
        title = "🧪 化合物分类配对游戏";
        leftLabel = "化合物名称";
        rightLabel = "分类";
        gameData = COMPOUND_CATEGORIES;
        break;
    }

    contentEl.createEl("h2", { text: title });

    // 游戏类型选择
    const typeBar = contentEl.createDiv({ cls: "game-type-bar" });
    typeBar.createEl("span", { text: "选择游戏类型:", cls: "game-type-label" });
    
    const typeButtons = [
      { type: GameType.FUNCTIONAL_GROUP, label: "官能团" },
      { type: GameType.REACTION_CONDITION, label: "反应条件" },
      { type: GameType.COMPOUND_CATEGORY, label: "化合物分类" },
    ];

    typeButtons.forEach(({ type, label }) => {
      const btn = typeBar.createEl("button", {
        text: label,
        cls: `game-type-btn ${type === this.gameType ? "active" : ""}`,
      });
      btn.onclick = () => {
        this.gameType = type;
        this.score = 0;
        this.mistakes = 0;
        this.currentRound = 0;
        this.onOpen();
      };
    });

    // 状态栏
    const statusBar = contentEl.createDiv({ cls: "chemfig-game-status" });
    statusBar.createSpan({ text: `第 ${this.currentRound + 1} / ${this.totalRounds} 轮`, cls: "game-round" });
    statusBar.createSpan({ text: `得分: ${this.score}`, cls: "game-score" });
    statusBar.createSpan({ text: `错误: ${this.mistakes}`, cls: "game-mistakes" });

    // 游戏区域
    this.gameArea = contentEl.createDiv({ cls: "chemfig-game-area" });
    this.leftLabel = leftLabel;
    this.rightLabel = rightLabel;
    this.gameData = gameData;

    // 开始第一轮
    this.nextRound();
  }

  nextRound() {
    this.gameArea.empty();

    if (this.currentRound >= this.totalRounds) {
      this.showResult();
      return;
    }

    // 随机选 4 个
    const shuffled = [...this.gameData].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 4);

    // 随机打乱左右两列
    const leftItems = [...selected].sort(() => Math.random() - 0.5);
    const rightItems = [...selected].sort(() => Math.random() - 0.5);

    // 左侧: 名称列表
    const leftCol = this.gameArea.createDiv({ cls: "game-col" });
    leftCol.createEl("h4", { text: this.leftLabel });

    // 右侧: 结构列表
    const rightCol = this.gameArea.createDiv({ cls: "game-col" });
    rightCol.createEl("h4", { text: this.rightLabel });

    // 根据游戏类型设置显示内容
    leftItems.forEach((item) => {
      let displayText = "";
      if (this.gameType === GameType.FUNCTIONAL_GROUP) {
        displayText = item.name;
      } else if (this.gameType === GameType.REACTION_CONDITION) {
        displayText = item.name;
      } else if (this.gameType === GameType.COMPOUND_CATEGORY) {
        displayText = item.name;
      }

      const btn = leftCol.createEl("button", {
        text: displayText,
        cls: "game-btn game-left-btn",
      });
      btn.dataset.id = item.id;
      btn.onclick = () => this.onLeftClick(btn);
    });

    rightItems.forEach((item) => {
      let displayText = "";
      if (this.gameType === GameType.FUNCTIONAL_GROUP) {
        displayText = item.formula;
      } else if (this.gameType === GameType.REACTION_CONDITION) {
        displayText = item.type;
      } else if (this.gameType === GameType.COMPOUND_CATEGORY) {
        displayText = item.category;
      }

      const btn = rightCol.createEl("button", {
        text: displayText,
        cls: "game-btn game-right-btn",
      });
      btn.dataset.id = item.id;
      btn.onclick = () => this.onRightClick(btn);
    });

    this.selectedLeft = null;
    this.selectedRight = null;
  }

  onLeftClick(btn) {
    document.querySelectorAll(".game-left-btn.selected").forEach((el) => {
      el.classList.remove("selected");
    });

    btn.classList.add("selected");
    this.selectedLeft = btn;

    this.checkMatch();
  }

  onRightClick(btn) {
    document.querySelectorAll(".game-right-btn.selected").forEach((el) => {
      el.classList.remove("selected");
    });

    btn.classList.add("selected");
    this.selectedRight = btn;

    this.checkMatch();
  }

  checkMatch() {
    if (!this.selectedLeft || !this.selectedRight) return;

    const leftBtn = this.selectedLeft;
    const rightBtn = this.selectedRight;

    if (leftBtn.dataset.id === rightBtn.dataset.id) {
      // 配对正确
      this.score += 10;
      leftBtn.classList.remove("selected");
      leftBtn.classList.add("correct");
      rightBtn.classList.remove("selected");
      rightBtn.classList.add("correct");

      leftBtn.disabled = true;
      rightBtn.disabled = true;

      new Notice("✅ 配对正确! +10 分", 1000);

      const scope = this.gameArea || document;
      const remaining = scope.querySelectorAll(".game-btn:not(.correct)").length;
      if (remaining === 0) {
        this.currentRound++;
        setTimeout(() => this.nextRound(), 1000);
      }
    } else {
      // 配对错误
      this.mistakes++;
      this.score = Math.max(0, this.score - 2);
      leftBtn.classList.remove("selected");
      leftBtn.classList.add("wrong");
      rightBtn.classList.remove("selected");
      rightBtn.classList.add("wrong");

      new Notice("❌ 配对错误! -2 分", 1000);

      setTimeout(() => {
        document.querySelectorAll(".game-btn.wrong").forEach((el) => {
          el.classList.remove("wrong");
        });
      }, 500);
    }

    this.selectedLeft = null;
    this.selectedRight = null;
    this.updateStatus();
  }

  updateStatus() {
    const statusBar = document.querySelector(".chemfig-game-status");
    if (statusBar) {
      statusBar.innerHTML = `
        <span class="game-round">第 ${this.currentRound + 1} / ${this.totalRounds} 轮</span>
        <span class="game-score">得分: ${this.score}</span>
        <span class="game-mistakes">错误: ${this.mistakes}</span>
      `;
    }
  }

  showResult() {
    this.gameArea.empty();

    const resultEl = this.gameArea.createDiv({ cls: "game-result" });
    resultEl.createEl("h3", { text: "🎉 游戏结束!" });

    resultEl.createEl("p", { text: `最终得分: ${this.score}` });
    resultEl.createEl("p", { text: `错误次数: ${this.mistakes}` });

    let rating;
    if (this.score >= 80) rating = "🏆 优秀! 你是化学专家!";
    else if (this.score >= 60) rating = "😊 不错! 继续加油!";
    else if (this.score >= 40) rating = "📖 还需努力，多复习!";
    else rating = "💪 别灰心，再试一次!";

    resultEl.createEl("p", { text: rating, cls: "game-rating" });

    const restartBtn = resultEl.createEl("button", {
      text: "🔄 再来一局",
      cls: "chemfig-action-btn",
    });
    restartBtn.onclick = () => {
      this.score = 0;
      this.mistakes = 0;
      this.currentRound = 0;
      this.nextRound();
    };
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// 导出
// FUNCTIONAL_GROUPS, MatchingGameModal, GameType
