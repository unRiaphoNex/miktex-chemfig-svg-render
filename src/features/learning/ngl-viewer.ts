// ========== NGL Viewer 集成 (v17.5.0) ==========
// 大分子可视化：蛋白质/核酸专用
// 支持：PDB 文件加载、多种表示、大模型优化

class NGLViewerWrapper {
  constructor(container) {
    this.container = container;
    this.stage = null;
    this.proxy = null;
    this.isLoaded = false;
  }

  /**
   * 初始化 NGL Viewer
   */
  async init() {
    // 动态加载 NGL 库
    if (typeof NGL === "undefined") {
      await this.loadNGLLibrary();
    }

    // 创建 stage
    this.stage = new NGL.Stage(this.container, {
      backgroundColor: "white",
    });

    this.isLoaded = true;
    return this;
  }

  /**
   * 动态加载 NGL 库
   */
  loadNGLLibrary() {
    return new Promise((resolve, reject) => {
      if (typeof NGL !== "undefined") {
        resolve();
        return;
      }

      const script = document.createElement("script");
      script.src = "https://ngl.flexiblebiology.org/2.0.0/ngl.js";
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("NGL 库加载失败"));
      document.head.appendChild(script);
    });
  }

  /**
   * 从 PDB 文件加载
   */
  async loadPDB(text) {
    if (!this.isLoaded) await this.init();

    // 移除已有结构
    if (this.proxy) {
      this.stage.removeComponent(this.proxy);
    }

    // 加载结构
    this.proxy = await this.stage.loadStructure(
      new File([text], "structure.pdb"),
      { ext: "pdb" }
    );

    // 默认显示：卡通模型
    this.showCartoon();
    this.autoZoom();
  }

  /**
   * 从 RCSB PDB 加载
   */
  async loadFromRCSB(pdbId) {
    if (!this.isLoaded) await this.init();

    if (this.proxy) {
      this.stage.removeComponent(this.proxy);
    }

    this.proxy = await this.stage.loadFile(
      `https://files.rcsb.org/view/${pdbId}.pdb`
    );

    this.showCartoon();
    this.autoZoom();
  }

  /**
   * 卡通表示（蛋白质二级结构）
   */
  showCartoon() {
    if (!this.proxy) return;

    this.proxy.removeAllRepresentations();
    this.proxy.addRepresentation("cartoon", {
      colorScheme: "residueindex",
      scale: 1.5,
    });
  }

  /**
   * 球棍模型
   */
  showBallAndStick() {
    if (!this.proxy) return;

    this.proxy.removeAllRepresentations();
    this.proxy.addRepresentation("ball+stick", {
      colorScheme: "element",
    });
  }

  /**
   * 表面模型
   */
  showSurface() {
    if (!this.proxy) return;

    this.proxy.removeAllRepresentations();
    this.proxy.addRepresentation("surface", {
      colorScheme: "hydrophobicity",
      opacity: 0.8,
    });
  }

  /**
   * 按链着色
   */
  colorByChain() {
    if (!this.proxy) return;

    this.proxy.removeAllRepresentations();
    this.proxy.addRepresentation("cartoon", {
      colorScheme: "chainid",
    });
  }

  /**
   * 自动缩放
   */
  autoZoom() {
    if (this.stage) {
      this.stage.autoView();
    }
  }

  /**
   * 导出图片
   */
  exportImage() {
    if (!this.stage) return null;
    return this.stage.downloadImage({
      factor: 2,
      antialias: true,
      transparent: false,
    });
  }

  /**
   * 设置背景色
   */
  setBackground(color) {
    if (this.stage) {
      this.stage.setParameters({ backgroundColor: color });
    }
  }

  /**
   * 旋转动画
   */
  spin() {
    if (this.stage) {
      this.stage.setSpin(true);
    }
  }

  /**
   * 停止旋转
   */
  stopSpin() {
    if (this.stage) {
      this.stage.setSpin(false);
    }
  }

  /**
   * 销毁
   */
  destroy() {
    if (this.stage) {
      this.stage.dispose();
      this.stage = null;
    }
    this.isLoaded = false;
  }
}

// NGL Viewer 模态框
class NGLViewerModal {
  constructor(app, pdbId = "") {
    this.app = app;
    this.pdbId = pdbId;
    this.viewer = null;
  }

  async open() {
    const { Modal } = require("obsidian");
    this.modal = new Modal(this.app);
    this.modal.setTitle("🧬 NGL 大分子查看器");

    const { contentEl } = this.modal;
    contentEl.empty();

    // 顶部工具栏
    const toolbar = contentEl.createDiv({ cls: "ngl-toolbar" });

    // PDB ID 输入
    const inputGroup = toolbar.createDiv({ cls: "input-group" });
    inputGroup.createEl("label", { text: "PDB ID:" });
    this.pdbInput = inputGroup.createEl("input", {
      type: "text",
      placeholder: "如: 1AKE",
      value: this.pdbId,
    });

    // 加载按钮
    const loadBtn = toolbar.createEl("button", { text: "📥 加载" });
    loadBtn.onclick = async () => {
      const pdbId = this.pdbInput.value.trim();
      if (pdbId) {
        await this.viewer.loadFromRCSB(pdbId);
        new Notice(`已加载 PDB: ${pdbId}`, 2000);
      }
    };

    // 表示切换
    const repSelect = toolbar.createEl("select");
    repSelect.createEl("option", { text: "卡通模型", value: "cartoon" });
    repSelect.createEl("option", { text: "球棍模型", value: "ballstick" });
    repSelect.createEl("option", { text: "表面模型", value: "surface" });
    repSelect.createEl("option", { text: "按链着色", value: "chain" });

    repSelect.onchange = () => {
      switch (repSelect.value) {
        case "cartoon": this.viewer.showCartoon(); break;
        case "ballstick": this.viewer.showBallAndStick(); break;
        case "surface": this.viewer.showSurface(); break;
        case "chain": this.viewer.colorByChain(); break;
      }
    };

    // 旋转按钮
    const spinBtn = toolbar.createEl("button", { text: "🔄 旋转" });
    spinBtn.onclick = () => {
      this.viewer.spin();
      setTimeout(() => this.viewer.stopSpin(), 2000);
    };

    // 导出按钮
    const exportBtn = toolbar.createEl("button", { text: "📷 导出" });
    exportBtn.onclick = () => {
      this.viewer.exportImage();
    };

    // 3D 容器
    this.viewerContainer = contentEl.createDiv({
      cls: "ngl-viewer-container",
    });
    this.viewerContainer.style.height = "600px";

    // 初始化 viewer
    this.viewer = new NGLViewerWrapper(this.viewerContainer);
    await this.viewer.init();

    // 如果有 PDB ID，自动加载
    if (this.pdbId) {
      await this.viewer.loadFromRCSB(this.pdbId);
    }

    this.modal.open();
  }

  close() {
    if (this.modal) {
      this.modal.close();
    }
    if (this.viewer) {
      this.viewer.destroy();
      this.viewer = null;
    }
  }
}

// 导出全局变量
window.NGLViewerWrapper = NGLViewerWrapper;
window.NGLViewerModal = NGLViewerModal;
