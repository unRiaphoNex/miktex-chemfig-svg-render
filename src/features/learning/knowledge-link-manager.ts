// ========== 知识关联系统 (v17.5.0) ==========
// 笔记中化合物名自动高亮 + 点击查看结构
// 支持：SMILES/分子式/中文名称自动识别

class KnowledgeLinkManager {
  constructor(app) {
    this.app = app;
    this.highlights = new Map();
    this.knownCompounds = new Map(); // 化合物名 → SMILES
    this.loadKnownCompounds();
  }

  /**
   * 加载已知化合物列表
   */
  loadKnownCompounds() {
    // 常见药物和化合物
    const compounds = [
      // 解热镇痛药
      { name: "阿司匹林", smiles: "CC(=O)Oc1ccccc1C(=O)O", formula: "C9H8O4" },
      { name: "布洛芬", smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O", formula: "C13H18O2" },
      { name: "对乙酰氨基酚", smiles: "CC(=O)Nc1ccc(O)cc1", formula: "C8H9NO2" },
      { name: "萘普生", smiles: "CC(C(=O)O)c1ccc2c(c1)ccc1cc2ccc1OC", formula: "C14H14O3" },
      
      // 心血管药物
      { name: "硝苯地平", smiles: "COC(=O)C1=C(C)NC(C)=C(C(=O)OC)C1c1ccc(cc1)[N+](=O)[O-]", formula: "C17H18N2O6" },
      { name: "阿托伐他汀", smiles: "O=C(O)CCC(c1ccccc1)c1cc(Nc2ccccc2C(=O)O)ccc1", formula: "C33H35FN2O5" },
      
      // 抗生素
      { name: "青霉素", smiles: "CC1(C(N2C(S1)C2C(=O)NC3=CC=CC=C3)C(=O)O)C", formula: "C16H18N2O4S" },
      { name: "阿莫西林", smiles: "CC1(C(N2C(S1)C2C(=O)NC(C(=O)O)c1ccc(O)cc1)C(=O)O)C", formula: "C16H19N3O5S" },
      { name: "头孢曲松", smiles: "O=C(O)C1N2C(=O)C(NC(=O)C(N)c3sccc3)C2SC(C)=C1C(=O)O", formula: "C18H18N8O7S3" },
      
      // 中枢神经系统
      { name: "地西泮", smiles: "Clc1ccc2c(c1)C(=O)CN=C2c1ccc(Cl)cc1", formula: "C16H13ClN2O" },
      { name: "氯丙嗪", smiles: "CN(C)CCCN1c2ccccc2Sc2ccc(Cl)cc21", formula: "C19H24ClN3S" },
      
      // 抗肿瘤药
      { name: "环磷酰胺", smiles: "ClCCN1P(=O)(N(CCOC)Cl)OCC1", formula: "C7H15Cl2N2O2P" },
      { name: "顺铂", smiles: "N[Pt](N)(Cl)Cl", formula: "Pt(NH3)2Cl2" },
      
      // 常见小分子
      { name: "苯", smiles: "c1ccccc1", formula: "C6H6" },
      { name: "甲苯", smiles: "Cc1ccccc1", formula: "C7H8" },
      { name: "苯酚", smiles: "Oc1ccccc1", formula: "C6H6O" },
      { name: "甲醛", smiles: "C=O", formula: "CH2O" },
      { name: "乙醇", smiles: "CCO", formula: "C2H6O" },
      { name: "乙酸", smiles: "CC(=O)O", formula: "C2H4O2" },
      { name: "葡萄糖", smiles: "OC[C@H]1OC(O)[C@@H](O)[C@@H](O)[C@@H]1O", formula: "C6H12O6" },
    ];

    compounds.forEach(c => {
      this.knownCompounds.set(c.name, c);
    });
  }

  /**
   * 高亮笔记中的化合物名称
   */
  highlightCompounds(container) {
    // 清除旧的高亮
    this.clearHighlights(container);

    // 获取所有文本节点
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_TEXT,
      null
    );

    const textNodes = [];
    while (walker.nextNode()) {
      textNodes.push(walker.currentNode);
    }

    // 遍历所有化合物名称
    this.knownCompounds.forEach((compound, name) => {
      textNodes.forEach(textNode => {
        if (textNode.nodeValue.includes(name)) {
          this.highlightTextNode(textNode, name, compound);
        }
      });
    });
  }

  /**
   * 高亮文本节点中的化合物名称
   */
  highlightTextNode(textNode, name, compound) {
    const text = textNode.nodeValue;
    const parent = textNode.parentNode;

    // 跳过已经高亮的
    if (parent.classList.contains("chem-highlighted")) return;

    const index = text.indexOf(name);
    if (index === -1) return;

    // 分割文本节点
    const before = text.substring(0, index);
    const match = text.substring(index, index + name.length);
    const after = text.substring(index + name.length);

    // 创建高亮元素
    const highlight = document.createElement("span");
    highlight.className = "chem-compound-highlight";
    highlight.textContent = match;
    highlight.style.cursor = "pointer";
    highlight.style.borderBottom = "1px dashed var(--interactive-accent)";
    highlight.dataset.smiles = compound.smiles;
    highlight.dataset.name = compound.name;

    // 点击显示结构预览
    highlight.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showStructurePopup(highlight, compound);
    };

    // 替换文本节点
    const fragment = document.createDocumentFragment();
    if (before) fragment.appendChild(document.createTextNode(before));
    fragment.appendChild(highlight);
    if (after) fragment.appendChild(document.createTextNode(after));
    parent.replaceChild(fragment, textNode);
  }

  /**
   * 显示结构弹窗
   */
  showStructurePopup(element, compound) {
    // 移除旧弹窗
    const oldPopup = document.querySelector(".chem-structure-popup");
    if (oldPopup) oldPopup.remove();

    // 创建弹窗
    const popup = document.createElement("div");
    popup.className = "chem-structure-popup";
    popup.innerHTML = `
      <div class="popup-header">
        <strong>${compound.name}</strong>
        <button class="close-btn">×</button>
      </div>
      <div class="popup-content">
        <div class="structure-2d"></div>
        <div class="compound-info">
          <div><small>SMILES:</small> <code>${compound.smiles}</code></div>
          <div><small>分子式:</small> ${compound.formula}</div>
        </div>
        <div class="popup-actions">
          <button class="view-3d-btn">🧊 3D 查看</button>
          <button class="copy-smiles-btn">📋 复制 SMILES</button>
        </div>
      </div>
    `;

    // 样式
    popup.style.cssText = `
      position: absolute;
      background: var(--background-primary);
      border: 1px solid var(--background-modifier-border);
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 12px;
      z-index: 1000;
      min-width: 250px;
    `;

    // 定位
    const rect = element.getBoundingClientRect();
    popup.style.left = `${rect.left}px`;
    popup.style.top = `${rect.bottom + 8}px`;

    // 关闭按钮
    popup.querySelector(".close-btn").onclick = () => popup.remove();

    // 3D 查看按钮
    popup.querySelector(".view-3d-btn").onclick = () => {
      popup.remove();
      if (typeof window.Molecule3DModal !== "undefined") {
        new window.Molecule3DModal(this.app, compound.smiles).open();
      }
    };

    // 复制 SMILES
    popup.querySelector(".copy-smiles-btn").onclick = () => {
      navigator.clipboard.writeText(compound.smiles);
      new Notice("SMILES 已复制", 1500);
    };

    // 渲染 2D 结构
    document.body.appendChild(popup);
    const structureContainer = popup.querySelector(".structure-2d");
    if (window.Structure2DRenderer) {
      try {
        const result = window.Structure2DRenderer.renderFromSmiles(compound.smiles, { width: 200, height: 150 });
        structureContainer.innerHTML = result.svg;
      } catch (e) {
        structureContainer.innerHTML = "<small>结构渲染失败</small>";
      }
    }

    // 点击外部关闭
    setTimeout(() => {
      const closeOnClick = (e) => {
        if (!popup.contains(e.target)) {
          popup.remove();
          document.removeEventListener("click", closeOnClick);
        }
      };
      document.addEventListener("click", closeOnClick);
    }, 100);
  }

  /**
   * 清除高亮
   */
  clearHighlights(container) {
    const highlighted = container.querySelectorAll(".chem-compound-highlight");
    highlighted.forEach(el => {
      const parent = el.parentNode;
      parent.replaceChild(document.createTextNode(el.textContent), el);
      parent.normalize();
    });
  }

  /**
   * 添加自定义化合物
   */
  addCompound(name, smiles, formula = "") {
    this.knownCompounds.set(name, { name, smiles, formula });
  }

  /**
   * 获取所有已知化合物
   */
  getKnownCompounds() {
    return Array.from(this.knownCompounds.values());
  }
}

// 导出全局变量
window.KnowledgeLinkManager = KnowledgeLinkManager;
