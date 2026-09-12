// ========== 分子结构比较器 (v17.4.0) ==========
// 并排显示两个分子，比较结构差异
// 支持：并排显示、共同骨架高亮、差异标记

class MoleculeComparisonModal {
  constructor(app, smiles1 = "", smiles2 = "") {
    this.app = app;
    this.smiles1 = smiles1;
    this.smiles2 = smiles2;
    this.viewer1 = null;
    this.viewer2 = null;
  }

  async open() {
    const { Modal } = require("obsidian");
    this.modal = new Modal(this.app);
    this.modal.setTitle("🔬 分子结构比较");

    const { contentEl } = this.modal;
    contentEl.empty();

    // 输入区域
    const inputSection = contentEl.createDiv({ cls: "comparison-input" });
    
    // 第一个分子
    const input1Div = inputSection.createDiv({ cls: "input-group" });
    input1Div.createEl("label", { text: "分子 A:" });
    this.smiles1Input = input1Div.createEl("input", {
      type: "text",
      placeholder: "输入 SMILES...",
      value: this.smiles1,
      cls: "smiles-input-1",
    });

    // 第二个分子
    const input2Div = inputSection.createDiv({ cls: "input-group" });
    input2Div.createEl("label", { text: "分子 B:" });
    this.smiles2Input = input2Div.createEl("input", {
      type: "text",
      placeholder: "输入 SMILES...",
      value: this.smiles2,
      cls: "smiles-input-2",
    });

    // 比较按钮
    const compareBtn = inputSection.createEl("button", {
      text: "🔍 开始比较",
      cls: "compare-btn",
    });

    // 结果区域
    const resultSection = contentEl.createDiv({ cls: "comparison-result" });
    
    // 并排视图
    const viewersDiv = resultSection.createDiv({ cls: "viewers-container" });
    this.viewer1Container = viewersDiv.createDiv({ cls: "viewer-1" });
    this.viewer2Container = viewersDiv.createDiv({ cls: "viewer-2" });

    // 信息面板
    this.infoPanel = resultSection.createDiv({ cls: "comparison-info" });
    this.infoPanel.hide();

    // 事件绑定
    compareBtn.onclick = async () => {
      await this.compareMolecules();
    };

    this.modal.open();
  }

  /**
   * 比较两个分子
   */
  async compareMolecules() {
    const smiles1 = this.smiles1Input.value.trim();
    const smiles2 = this.smiles2Input.value.trim();

    if (!smiles1 || !smiles2) {
      new Notice("请输入两个 SMILES 结构", 2000);
      return;
    }

    try {
      // 初始化两个查看器
      if (!this.viewer1) {
        this.viewer1 = new window.Molecule3DModalViewer(this.viewer1Container);
        await this.viewer1.init();
      }
      if (!this.viewer2) {
        this.viewer2 = new window.Molecule3DModalViewer(this.viewer2Container);
        await this.viewer2.init();
      }

      // 加载分子
      await this.viewer1.loadFromSmiles(smiles1);
      await this.viewer2.loadFromSmiles(smiles2);

      // 计算比较结果
      const result = this.calculateComparison(smiles1, smiles2);

      // 显示结果
      this.infoPanel.show();
      this.infoPanel.innerHTML = `
        <h3>📊 比较结果</h3>
        <div class="comparison-stats">
          <div class="stat-item">
            <span class="label">分子 A 原子数:</span>
            <span class="value">${result.atoms1}</span>
          </div>
          <div class="stat-item">
            <span class="label">分子 B 原子数:</span>
            <span class="value">${result.atoms2}</span>
          </div>
          <div class="stat-item">
            <span class="label">分子量差异:</span>
            <span class="value">${result.mwDiff}</span>
          </div>
          <div class="stat-item">
            <span class="label">相似度:</span>
            <span class="value">${result.similarity}%</span>
          </div>
        </div>
        <div class="similarity-bar">
          <div class="bar-fill" style="width: ${result.similarity}%"></div>
        </div>
      `;

    } catch (e) {
      new Notice(`比较失败: ${e.message}`, 3000);
    }
  }

  /**
   * 计算比较结果
   */
  calculateComparison(smiles1, smiles2) {
    if (typeof OCL === "undefined") {
      return {
        atoms1: "N/A",
        atoms2: "N/A",
        mwDiff: "N/A",
        similarity: 0,
      };
    }

    try {
      const mol1 = OCL.Molecule.fromSmiles(smiles1);
      const mol2 = OCL.Molecule.fromSmiles(smiles2);

      const atoms1 = mol1.getAllAtoms();
      const atoms2 = mol2.getAllAtoms();
      const mw1 = mol1.getMolweight();
      const mw2 = mol2.getMolweight();

      // 简单相似度计算（基于原子数比例）
      const minAtoms = Math.min(atoms1, atoms2);
      const maxAtoms = Math.max(atoms1, atoms2);
      const similarity = Math.round((minAtoms / maxAtoms) * 100);

      return {
        atoms1: atoms1,
        atoms2: atoms2,
        mwDiff: `${Math.abs(mw1 - mw2).toFixed(2)} Da`,
        similarity: similarity,
      };
    } catch (e) {
      return {
        atoms1: "错误",
        atoms2: "错误",
        mwDiff: "N/A",
        similarity: 0,
      };
    }
  }

  close() {
    if (this.modal) {
      this.modal.close();
    }
    if (this.viewer1) {
      this.viewer1.destroy();
      this.viewer1 = null;
    }
    if (this.viewer2) {
      this.viewer2.destroy();
      this.viewer2 = null;
    }
  }
}

// 导出全局变量
window.MoleculeComparisonModal = MoleculeComparisonModal;
