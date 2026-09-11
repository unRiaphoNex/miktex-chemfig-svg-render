// ========== 官能团配对游戏 (v11.8.0) ==========
// 学习辅助: 官能团名称与结构配对游戏

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

// ========== 配对游戏模态框 ==========
class MatchingGameModal extends Modal {
  constructor(app) {
    super(app);
    this.score = 0;
    this.mistakes = 0;
    this.currentRound = 0;
    this.totalRounds = 5;
    this.selectedName = null;
    this.selectedStructure = null;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("chemfig-matching-modal");

    contentEl.createEl("h2", { text: "🎯 官能团配对游戏" });

    // 状态栏
    const statusBar = contentEl.createDiv({ cls: "chemfig-game-status" });
    statusBar.createSpan({ text: `第 ${this.currentRound + 1} / ${this.totalRounds} 轮`, cls: "game-round" });
    statusBar.createSpan({ text: `得分: ${this.score}`, cls: "game-score" });
    statusBar.createSpan({ text: `错误: ${this.mistakes}`, cls: "game-mistakes" });

    // 游戏区域
    this.gameArea = contentEl.createDiv({ cls: "chemfig-game-area" });

    // 开始第一轮
    this.nextRound();
  }

  nextRound() {
    this.gameArea.empty();

    if (this.currentRound >= this.totalRounds) {
      this.showResult();
      return;
    }

    // 随机选 4 个官能团
    const shuffled = [...FUNCTIONAL_GROUPS].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, 4);

    // 随机打乱名称和结构
    const names = [...selected].sort(() => Math.random() - 0.5);
    const structures = [...selected].sort(() => Math.random() - 0.5);

    // 左侧: 名称列表
    const leftCol = this.gameArea.createDiv({ cls: "game-col" });
    leftCol.createEl("h4", { text: "官能团名称" });

    // 右侧: 结构列表
    const rightCol = this.gameArea.createDiv({ cls: "game-col" });
    rightCol.createEl("h4", { text: "结构式" });

    // 名称按钮
    names.forEach((group) => {
      const btn = leftCol.createEl("button", {
        text: group.name,
        cls: "game-btn game-name-btn",
      });
      btn.dataset.id = group.id;
      btn.onclick = () => this.onNameClick(btn);
    });

    // 结构按钮
    structures.forEach((group) => {
      const btn = rightCol.createEl("button", {
        text: group.formula,
        cls: "game-btn game-structure-btn",
      });
      btn.dataset.id = group.id;
      btn.onclick = () => this.onStructureClick(btn);
    });

    this.selectedName = null;
    this.selectedStructure = null;
  }

  onNameClick(btn) {
    // 取消之前选中的名称; 结构侧的选中态保留, 因此支持「先点结构再点名称」
    document.querySelectorAll(".game-name-btn.selected").forEach((el) => {
      el.classList.remove("selected");
    });

    btn.classList.add("selected");
    this.selectedName = btn;

    // 两侧都选中后才判定配对。
    // 注意: 此处原先调用的 this.checkMatch() 在本类中从未定义 (方法只有
    // constructor/onOpen/nextRound/onNameClick/onStructureClick/updateStatus/
    // showResult/onClose), 于是「点一下官能团名称」就抛
    // TypeError: this.checkMatch is not a function, 整个配对游戏无法进行。
    this.checkMatch();
  }

  onStructureClick(btn) {
    // 与 onNameClick 对称: 先记录结构侧选择, 再由 checkMatch 统一判定
    document.querySelectorAll(".game-structure-btn.selected").forEach((el) => {
      el.classList.remove("selected");
    });

    btn.classList.add("selected");
    this.selectedStructure = btn;

    this.checkMatch();
  }

  // 判定当前选中的一对「名称 ↔ 结构」是否匹配 (由 onNameClick / onStructureClick 共用)
  checkMatch() {
    // 只选中一侧时不判定, 等待另一侧
    if (!this.selectedName || !this.selectedStructure) return;

    const nameBtn = this.selectedName;
    const structureBtn = this.selectedStructure;

    if (nameBtn.dataset.id === structureBtn.dataset.id) {
      // 配对正确
      this.score += 10;
      nameBtn.classList.remove("selected");
      nameBtn.classList.add("correct");
      structureBtn.classList.remove("selected");
      structureBtn.classList.add("correct");

      // 禁用这两个按钮
      nameBtn.disabled = true;
      structureBtn.disabled = true;

      new Notice("✅ 配对正确! +10 分", 1000);

      // 本轮是否全部配对完成 (限定在本游戏区域内查询, 避免与其它视图的同名类互相干扰)
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
      nameBtn.classList.remove("selected");
      nameBtn.classList.add("wrong");
      structureBtn.classList.remove("selected");
      structureBtn.classList.add("wrong");

      new Notice("❌ 配对错误! -2 分", 1000);

      setTimeout(() => {
        document.querySelectorAll(".game-btn.wrong").forEach((el) => {
          el.classList.remove("wrong");
        });
      }, 500);
    }

    this.selectedName = null;
    this.selectedStructure = null;
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

    // 评级
    let rating;
    if (this.score >= 80) rating = "🏆 优秀! 你是化学专家!";
    else if (this.score >= 60) rating = "😊 不错! 继续加油!";
    else if (this.score >= 40) rating = "📖 还需努力，多复习!";
    else rating = "💪 别灰心，再试一次!";

    resultEl.createEl("p", { text: rating, cls: "game-rating" });

    // 再来一局按钮
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
// FUNCTIONAL_GROUPS, MatchingGameModal
