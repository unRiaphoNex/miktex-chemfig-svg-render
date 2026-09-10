// ========== 反向合成分析模态框 (v15.6.0) ==========
// 从目标分子推导合成路线

class RetrosynthesisModal extends Modal {
  constructor(app) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("retrosynthesis-modal");

    contentEl.createEl("h2", { text: "🔄 反向合成分析" });
    contentEl.createEl("p", {
      text: "输入目标化合物名称或 SMILES，分析可能的合成路线",
      cls: "retro-desc",
    });

    // 输入区域
    const inputContainer = contentEl.createDiv({ cls: "retro-input" });
    this.inputEl = inputContainer.createEl("input", {
      type: "text",
      placeholder: "输入化合物名称或 SMILES...",
      cls: "retro-input-field",
    });

    const analyzeBtn = inputContainer.createEl("button", {
      text: "分析合成路线",
      cls: "retro-analyze-btn",
    });
    analyzeBtn.onclick = () => this.analyze();

    // 预设示例
    const presetBar = contentEl.createDiv({ cls: "retro-preset-bar" });
    presetBar.createEl("span", { text: "示例:", cls: "retro-preset-label" });
    const presets = ["阿司匹林", "对乙酰氨基酚", "布洛芬", "咖啡因"];
    presets.forEach((p) => {
      const btn = presetBar.createEl("button", {
        text: p,
        cls: "retro-preset-btn",
      });
      btn.onclick = () => {
        this.inputEl.value = p;
        this.analyze();
      };
    });

    // 结果显示区域
    this.resultEl = contentEl.createDiv({ cls: "retro-result" });
    this.resultEl.createEl("p", {
      text: "👆 请输入化合物名称开始分析",
      cls: "retro-placeholder",
    });

    this.addCSS();
  }

  analyze() {
    const query = this.inputEl.value.trim();
    if (!query) {
      new Notice("请输入化合物名称", 2000);
      return;
    }

    this.resultEl.empty();
    this.resultEl.createEl("p", {
      text: `正在分析 ${query} 的合成路线...`,
      cls: "retro-loading",
    });

    // 模拟分析过程
    setTimeout(() => {
      this.showAnalysisResult(query);
    }, 500);
  }

  showAnalysisResult(query) {
    const result = this.resultEl;
    result.empty();

    // 查找预设的合成路线
    const routes = this.getPresetRoutes(query);

    if (!routes) {
      result.createEl("p", {
        text: `暂无 ${query} 的预设合成路线，以下是通用合成策略:`,
        cls: "retro-no-result",
      });
      this.showGeneralStrategies(result);
      return;
    }

    // 显示目标分子
    result.createEl("h3", { text: `🎯 目标分子: ${routes.name}` });
    if (routes.formula) {
      result.createEl("p", { text: `分子式: ${routes.formula}`, cls: "retro-formula" });
    }

    // 显示合成路线
    result.createEl("h4", { text: "📝 合成路线" });
    routes.steps.forEach((step, i) => {
      const stepDiv = result.createDiv({ cls: "retro-step" });
      stepDiv.createEl("div", { text: `步骤 ${i + 1}:`, cls: "retro-step-num" });
      stepDiv.createEl("div", { text: step.reaction, cls: "retro-step-reaction" });
      if (step.reagents) {
        stepDiv.createEl("div", { text: `试剂: ${step.reagents}`, cls: "retro-step-reagents" });
      }
      if (step.note) {
        stepDiv.createEl("div", { text: `💡 ${step.note}`, cls: "retro-step-note" });
      }
    });

    // 原料
    result.createEl("h4", { text: "🧪 起始原料" });
    const rawMaterials = result.createDiv({ cls: "retro-raw-materials" });
    routes.rawMaterials.forEach((m) => {
      rawMaterials.createEl("span", { text: m, cls: "retro-raw-tag" });
    });

    // 关键要点
    if (routes.keyPoints) {
      result.createEl("h4", { text: "🔑 关键要点" });
      const keyDiv = result.createDiv({ cls: "retro-key-points" });
      routes.keyPoints.forEach((point) => {
        keyDiv.createEl("li", { text: point });
      });
    }
  }

  getPresetRoutes(query) {
    const routes = {
      "阿司匹林": {
        name: "阿司匹林 (乙酰水杨酸)",
        formula: "C9H8O4",
        steps: [
          {
            reaction: "水杨酸 + 乙酸酐 → 乙酰水杨酸",
            reagents: "浓 H2SO4 催化",
            note: "酚羟基乙酰化，羧基不变",
          },
        ],
        rawMaterials: ["水杨酸", "乙酸酐", "浓硫酸"],
        keyPoints: [
          "经典的酚羟基乙酰化反应",
          "浓硫酸作催化剂",
          "低温控制反应",
        ],
      },
      "对乙酰氨基酚": {
        name: "对乙酰氨基酚 (扑热息痛)",
        formula: "C8H9NO2",
        steps: [
          {
            reaction: "对氨基酚 + 乙酸酐 → 对乙酰氨基酚",
            reagents: "水作溶剂",
            note: "氨基乙酰化",
          },
        ],
        rawMaterials: ["对氨基酚", "乙酸酐"],
        keyPoints: [
          "选择性氨基乙酰化",
          "酚羟基不反应",
          "水作绿色溶剂",
        ],
      },
      "布洛芬": {
        name: "布洛芬",
        formula: "C13H18O2",
        steps: [
          {
            reaction: "异丁基苯 → 对异丁基苯乙酮",
            reagents: "乙酰氯, AlCl3",
            note: "Friedel-Crafts 酰基化",
          },
          {
            reaction: "对异丁基苯乙酮 → 布洛芬",
            reagents: "1. H2/Ni  2. 氧化",
            note: "还原 + 氧化",
          },
        ],
        rawMaterials: ["异丁基苯", "乙酰氯", "AlCl3", "H2/Ni"],
        keyPoints: [
          "Friedel-Crafts 酰基化",
          "催化加氢",
          "氧化反应",
        ],
      },
      "咖啡因": {
        name: "咖啡因",
        formula: "C8H10N4O2",
        steps: [
          {
            reaction: "黄嘌呤 → 咖啡因",
            reagents: "甲基化试剂",
            note: "三次甲基化",
          },
        ],
        rawMaterials: ["黄嘌呤", "甲基化试剂"],
        keyPoints: [
          "黄嘌呤骨架",
          "三次甲基化",
          "天然产物提取/全合成",
        ],
      },
    };

    return routes[query] || null;
  }

  showGeneralStrategies(container) {
    const strategies = container.createDiv({ cls: "retro-strategies" });

    const categories = [
      {
        title: "🔵 碳骨架构建",
        items: [
          "Grignard 反应 - 形成 C-C 键",
          "Aldol 缩合 - 碳链增长",
          "Friedel-Crafts - 芳环取代",
          "Wittig 反应 - 形成烯烃",
        ],
      },
      {
        title: "🟢 官能团转化",
        items: [
          "醇 → 醛/酮/羧酸 (氧化)",
          "醛/酮 → 醇 (还原)",
          "羧酸 → 酯/酰胺",
          "卤代烷 → 腈/胺 (取代)",
        ],
      },
      {
        title: "🟡 保护基策略",
        items: [
          "羟基保护: 硅醚/酯",
          "氨基保护: 酰胺/Boc",
          "羰基保护: 缩醛",
          "羧基保护: 酯",
        ],
      },
    ];

    categories.forEach((cat) => {
      strategies.createEl("h4", { text: cat.title });
      const list = strategies.createEl("ul");
      cat.items.forEach((item) => {
        list.createEl("li", { text: item });
      });
    });
  }

  addCSS() {
    if (document.getElementById("retrosynthesis-css")) return;
    const style = document.createElement("style");
    style.id = "retrosynthesis-css";
    style.textContent = `
      .retrosynthesis-modal h2 {
        text-align: center;
      }
      .retrosynthesis-modal .retro-desc {
        color: var(--text-muted);
        text-align: center;
        margin-bottom: 15px;
      }
      .retrosynthesis-modal .retro-input {
        display: flex;
        gap: 10px;
        margin-bottom: 15px;
      }
      .retrosynthesis-modal .retro-input-field {
        flex: 1;
        padding: 8px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        background: var(--background-primary);
        color: var(--text-normal);
      }
      .retrosynthesis-modal .retro-analyze-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 6px;
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        cursor: pointer;
      }
      .retrosynthesis-modal .retro-preset-bar {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        align-items: center;
        margin-bottom: 20px;
      }
      .retrosynthesis-modal .retro-preset-label {
        color: var(--text-muted);
        font-size: 13px;
      }
      .retrosynthesis-modal .retro-preset-btn {
        padding: 4px 10px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 15px;
        background: var(--background-primary);
        color: var(--text-muted);
        cursor: pointer;
        font-size: 12px;
      }
      .retrosynthesis-modal .retro-preset-btn:hover {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
      }
      .retrosynthesis-modal .retro-placeholder,
      .retrosynthesis-modal .retro-loading {
        text-align: center;
        color: var(--text-muted);
        padding: 40px 20px;
      }
      .retrosynthesis-modal .retro-no-result {
        color: var(--text-muted);
        margin-bottom: 15px;
      }
      .retrosynthesis-modal .retro-step {
        padding: 12px;
        margin: 8px 0;
        background: var(--background-secondary);
        border-radius: 6px;
      }
      .retrosynthesis-modal .retro-step-num {
        font-weight: bold;
        color: var(--interactive-accent);
        margin-bottom: 4px;
      }
      .retrosynthesis-modal .retro-step-reaction {
        font-size: 14px;
        margin: 4px 0;
      }
      .retrosynthesis-modal .retro-step-reagents {
        color: var(--text-muted);
        font-size: 13px;
        margin: 4px 0;
      }
      .retrosynthesis-modal .retro-step-note {
        color: var(--text-muted);
        font-size: 12px;
        margin: 4px 0;
      }
      .retrosynthesis-modal .retro-raw-materials {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin: 10px 0;
      }
      .retrosynthesis-modal .retro-raw-tag {
        padding: 4px 10px;
        background: var(--background-secondary);
        border-radius: 12px;
        font-size: 12px;
      }
    `;
    document.head.appendChild(style);
  }
}

// 导出
// RetrosynthesisModal
