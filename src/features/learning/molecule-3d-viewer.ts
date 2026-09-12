// ========== 3D 结构可视化 (v17.2.0) ==========
// 集成 3Dmol.js 展示化合物 3D 结构
// 支持球棍模型、卡通模型、表面模型等

class Molecule3DModalViewer {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      width: options.width || 600,
      height: options.height || 400,
      model: options.model || "stick", // stick, sphere, cartoon, surface
      colorScheme: options.colorScheme || "default",
    };
    this.viewer = null;
    this.currentMol = null;
  }

  /**
   * 初始化 3Dmol.js
   */
  async init() {
    if (typeof $3Dmol === "undefined") {
      // 动态加载 3Dmol.js
      await this.load3Dmol();
    }

    // 创建 viewer
    this.viewer = $3Dmol.createViewer(this.container, {
      backgroundColor: "white",
    });
  }

  /**
   * 动态加载 3Dmol.js
   */
  load3Dmol() {
    return new Promise((resolve, reject) => {
      if (typeof $3Dmol !== "undefined") {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://3Dmol.org/build/3Dmol-min.js";
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  /**
   * 从 SMILES 加载分子
   */
  async loadFromSmiles(smiles) {
    if (typeof OCL === "undefined") {
      throw new Error("OCL 未加载");
    }

    // 使用 OCL 生成 3D 坐标
    const mol = OCL.Molecule.fromSmiles(smiles);
    mol.add3DCoordinates();
    const molFile = mol.toMolfile();

    this.loadFromMolFile(molFile);
  }

  /**
   * 从 MOL 文件加载分子
   */
  loadFromMolFile(molFile) {
    if (!this.viewer) {
      throw new Error("Viewer 未初始化");
    }

    this.viewer.clear();
    
    // 加载分子
    this.viewer.addModel(molFile, "mol");
    
    // 设置显示样式
    this.applyStyle();
    
    // 自动缩放
    this.viewer.zoomTo();
    this.viewer.render();

    this.currentMol = molFile;
  }

  /**
   * 应用显示样式
   */
  applyStyle() {
    if (!this.viewer) return;

    const style = this.options.model;

    switch (style) {
      case "stick":
        this.viewer.setStyle({}, {
          stick: { radius: 0.15, colorscheme: this.options.colorScheme },
          sphere: { scale: 0.3 },
        });
        break;
      
      case "sphere":
        this.viewer.setStyle({}, {
          sphere: { scale: 0.8, colorscheme: this.options.colorScheme },
        });
        break;
      
      case "cartoon":
        this.viewer.setStyle({}, {
          cartoon: { color: "spectrum" },
        });
        break;
      
      case "surface":
        this.viewer.setStyle({}, {
          stick: { radius: 0.1 },
        });
        this.viewer.addSurface($3Dmol.SurfaceType.VDW, {
          opacity: 0.7,
          colorscheme: this.options.colorScheme,
        });
        break;
    }

    this.viewer.render();
  }

  /**
   * 切换显示模式
   */
  setModel(model) {
    this.options.model = model;
    this.applyStyle();
  }

  /**
   * 切换配色方案
   */
  setColorScheme(scheme) {
    this.options.colorScheme = scheme;
    this.applyStyle();
  }

  /**
   * 旋转动画
   */
  spin(on = true) {
    if (this.viewer) {
      this.viewer.spin(on);
    }
  }

  /**
   * 重置视图
   */
  resetView() {
    if (this.viewer) {
      this.viewer.zoomTo();
      this.viewer.render();
    }
  }

  /**
   * 导出为图片
   */
  exportImage() {
    if (this.viewer) {
      const dataURI = this.viewer.pngURI();
      const link = document.createElement("a");
      link.download = "molecule-3d.png";
      link.href = dataURI;
      link.click();
    }
  }

  /**
   * 销毁 viewer
   */
  destroy() {
    if (this.viewer) {
      this.viewer.clear();
      this.viewer = null;
    }
  }
}

/**
 * 3D 结构查看模态框
 */
class Molecule3DModal extends Modal {
  constructor(app, smiles = "") {
    super(app);
    this.smiles = smiles;
    this.viewer = null;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("molecule-3d-modal");

    // 标题
    contentEl.createEl("h2", { text: "🧪 3D 分子查看器" });

    // 控制栏
    const controlBar = contentEl.createDiv({ cls: "3d-control-bar" });

    // SMILES 输入
    const smilesInput = controlBar.createEl("input", {
      type: "text",
      placeholder: "输入 SMILES...",
      value: this.smiles,
      cls: "smiles-input",
    });

    const loadBtn = controlBar.createEl("button", {
      text: "加载",
      cls: "load-btn",
    });

    // 模型切换
    const modelSelect = controlBar.createEl("select", { cls: "model-select" });
    modelSelect.createEl("option", { text: "球棍模型", value: "stick" });
    modelSelect.createEl("option", { text: "空间填充", value: "sphere" });
    modelSelect.createEl("option", { text: "卡通模型", value: "cartoon" });
    modelSelect.createEl("option", { text: "表面模型", value: "surface" });

    // 旋转按钮
    const spinBtn = controlBar.createEl("button", {
      text: "🔄 旋转",
      cls: "spin-btn",
    });

    // 重置按钮
    const resetBtn = controlBar.createEl("button", {
      text: "🔍 重置",
      cls: "reset-btn",
    });

    // 导出按钮
    const exportBtn = controlBar.createEl("button", {
      text: "📷 导出",
      cls: "export-btn",
    });

    // 3D 容器
    this.viewerContainer = contentEl.createDiv({ cls: "3d-viewer-container" });

    // 初始化 viewer
    this.viewer = new Molecule3DViewer(this.viewerContainer);
    await this.viewer.init();

    // 如果有 SMILES，自动加载
    if (this.smiles) {
      try {
        await this.viewer.loadFromSmiles(this.smiles);
      } catch (e) {
        new Notice(`加载失败: ${e.message}`, 3000);
      }
    }

    // 事件绑定
    loadBtn.onclick = async () => {
      const smiles = smilesInput.value.trim();
      if (!smiles) return;

      try {
        await this.viewer.loadFromSmiles(smiles);
      } catch (e) {
        new Notice(`加载失败: ${e.message}`, 3000);
      }
    };

    modelSelect.onchange = () => {
      this.viewer.setModel(modelSelect.value);
    };

    spinBtn.onclick = () => {
      this.viewer.spin();
    };

    resetBtn.onclick = () => {
      this.viewer.resetView();
    };

    exportBtn.onclick = () => {
      this.viewer.exportImage();
    };
  }

  async onClose() {
    if (this.viewer) {
      this.viewer.destroy();
    }
    this.contentEl.empty();
  }
}

// 导出全局变量
// Molecule3DViewer, Molecule3DModal
