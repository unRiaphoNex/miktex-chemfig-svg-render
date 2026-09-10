// ========== 3D 分子可视化模块 (v12.0.0) ==========
// 基于 3Dmol.js 的 3D 分子查看器
// 支持: SMILES → 3D 模型、旋转缩放、原子点击、2D/3D 切换

/**
 * 3D 分子查看器类
 */
class Molecule3DViewer {
  /**
   * 检查 3Dmol 是否可用
   */
  static is3DMolAvailable() {
    return typeof window !== "undefined" && window.$3Dmol;
  }

  /**
   * 动态加载 3Dmol.js
   */
  static async load3DMol() {
    if (this.is3DMolAvailable()) return true;

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://3Dmol.org/build/3Dmol-min.js";
      script.onload = () => {
        console.log("[Chemfig-SVG] 3Dmol.js 加载成功");
        resolve(true);
      };
      script.onerror = () => {
        console.warn("[Chemfig-SVG] 3Dmol.js 加载失败");
        reject(new Error("3Dmol.js 加载失败"));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * 在容器中渲染 3D 分子
   * @param {HTMLElement} container - 目标容器
   * @param {string} smiles - SMILES 字符串
   * @param {Object} options - 渲染选项
   */
  static async render3D(container, smiles, options = {}) {
    container.empty();

    // 显示加载中
    const loading = container.createDiv({ cls: "mol3d-loading" });
    loading.textContent = "正在加载 3D 模型...";

    try {
      // 加载 3Dmol.js
      await this.load3DMol();

      container.empty();

      // 创建 3D 查看器
      const viewer = window.$3Dmol.createViewer(container, {
        backgroundColor: options.backgroundColor || "white",
      });

      // 添加分子 - 使用 SMILES 字符串 (3Dmol 会自动通过 Cactus 服务器生成 3D 坐标)
      try {
        // 先尝试直接从 SMILES 加载
        viewer.addModel(smiles, "smi");
      } catch (smilesError) {
        console.warn("[Chemfig-SVG] 直接 SMILES 加载失败, 尝试通过 PubChem 获取:", smilesError);
        // 备用方案: 通过 PubChem API 获取
        loading.textContent = "正在从 PubChem 获取 3D 结构...";
        try {
          await this.loadFromPubChem(viewer, smiles);
        } catch (pubchemError) {
          throw new Error("SMILES 和 PubChem 都加载失败: " + smilesError.message);
        }
      }

      // 设置样式
      const style = options.style || "stick"; // stick / sphere / line
      if (style === "stick") {
        viewer.setStyle({}, { stick: {}, sphere: { scale: 0.3 } });
      } else if (style === "sphere") {
        viewer.setStyle({}, { sphere: { scale: 0.8 } });
      } else if (style === "line") {
        viewer.setStyle({}, { line: {} });
      }

      // 自动缩放
      viewer.zoomTo();
      viewer.render();

      // 点击原子显示信息
      viewer.setClickable({}, true, (atom) => {
        this.showAtomInfo(atom, container);
      });

      return viewer;
    } catch (e) {
      container.empty();
      const errorDiv = container.createEl("div", {
        cls: "mol3d-error",
      });
      errorDiv.innerHTML = `
        <strong>❌ 3D 模型加载失败</strong><br><br>
        <strong>错误信息:</strong> ${e.message}<br><br>
        <strong>可能原因:</strong><br>
        1. 网络问题 - 无法连接到 3Dmol.js CDN 或 Cactus 服务器<br>
        2. SMILES 格式不标准<br>
        3. 浏览器安全策略限制<br><br>
        <strong>建议:</strong><br>
        - 检查网络连接<br>
        - 尝试简化 SMILES 结构<br>
        - 使用标准 SMILES 格式
      `;
      return null;
    }
  }

  /**
   * 通过 PubChem API 获取 3D 结构
   */
  static async loadFromPubChem(viewer, smiles) {
    // 先通过 SMILES 获取 CID, 再获取 SDF
    const encodeSmiles = encodeURIComponent(smiles);
    const cidUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeSmiles}/cids/JSON`;

    const cidResponse = await fetch(cidUrl);
    if (!cidResponse.ok) throw new Error("PubChem CID 查询失败");

    const cidData = await cidResponse.json();
    if (!cidData.IdentifierList || !cidData.IdentifierList.CID || cidData.IdentifierList.CID.length === 0) {
      throw new Error("PubChem 未找到该化合物");
    }

    const cid = cidData.IdentifierList.CID[0];
    const sdfUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`;

    const sdfResponse = await fetch(sdfUrl);
    if (!sdfResponse.ok) throw new Error("PubChem 3D SDF 获取失败");

    const sdfText = await sdfResponse.text();
    viewer.addModel(sdfText, "sdf");
  }

  /**
   * 显示原子信息
   */
  static showAtomInfo(atom, container) {
    let infoEl = container.querySelector(".mol3d-atom-info");
    if (!infoEl) {
      infoEl = container.createDiv({ cls: "mol3d-atom-info" });
    }

    infoEl.innerHTML = `
      <div class="atom-info-content">
        <strong>${atom.elem}</strong> (${atom.serial})
        <br>坐标: (${atom.x?.toFixed(2) || "?"}, ${atom.y?.toFixed(2) || "?"}, ${atom.z?.toFixed(2) || "?"})
      </div>
    `;
  }
}

// ========== 3D 查看器模态框 ==========
class Molecule3DModal extends Modal {
  constructor(app, smiles, options = {}) {
    super(app);
    this.smiles = smiles;
    this.options = options;
    this.viewer = null;
    this.currentStyle = "stick";
    this.autoRotate = false;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("chemfig-mol3d-modal");

    // 标题
    contentEl.createEl("h2", { text: "🧪 3D 分子查看器" });

    // SMILES 显示
    const smilesBar = contentEl.createDiv({ cls: "mol3d-smiles-bar" });
    smilesBar.createEl("code", { text: this.smiles });

    // 工具栏
    const toolbar = contentEl.createDiv({ cls: "mol3d-toolbar" });

    // 样式切换按钮
    const styles = [
      { id: "stick", name: "球棍模型" },
      { id: "sphere", name: "空间填充" },
      { id: "line", name: "线框" },
    ];

    styles.forEach((s) => {
      const btn = toolbar.createEl("button", {
        text: s.name,
        cls: "mol3d-tool-btn" + (s.id === this.currentStyle ? " active" : ""),
      });
      btn.dataset.style = s.id;
      btn.onclick = () => {
        this.currentStyle = s.id;
        toolbar.querySelectorAll(".mol3d-tool-btn").forEach((b) => {
          b.classList.remove("active");
        });
        btn.classList.add("active");
        this.reRender();
      };
    });

    // 导出按钮
    const exportBtn = toolbar.createEl("button", {
      text: "导出 PNG",
      cls: "mol3d-tool-btn",
    });
    exportBtn.onclick = () => this.exportPNG();

    // v15.3.0: 新增自动旋转按钮
    const rotateBtn = toolbar.createEl("button", {
      text: "🔄 自动旋转",
      cls: "mol3d-tool-btn",
    });
    rotateBtn.onclick = () => {
      this.autoRotate = !this.autoRotate;
      rotateBtn.classList.toggle("active", this.autoRotate);
      if (this.viewer) {
        this.viewer.spin(this.autoRotate, 0.5);
      }
    };

    // v15.3.0: 重置视图按钮
    const resetBtn = toolbar.createEl("button", {
      text: "📐 重置视图",
      cls: "mol3d-tool-btn",
    });
    resetBtn.onclick = () => {
      if (this.viewer) {
        this.viewer.zoomTo();
        this.viewer.render();
      }
    };

    // 3D 画布
    const canvas = contentEl.createDiv({ cls: "mol3d-canvas" });
    canvas.style.height = "500px";

    // 渲染
    this.viewer = await Molecule3DViewer.render3D(canvas, this.smiles, {
      style: this.currentStyle,
    });

    // 提示
    const hint = contentEl.createDiv({ cls: "mol3d-hint" });
    hint.textContent = "🖱️ 拖拽旋转 | 滚轮缩放 | 点击原子查看详情";
  }

  async reRender() {
    if (!this.viewer) return;

    const canvas = this.contentEl.querySelector(".mol3d-canvas");
    if (!canvas) return;

    this.viewer = await Molecule3DViewer.render3D(canvas, this.smiles, {
      style: this.currentStyle,
    });
  }

  exportPNG() {
    if (!this.viewer) return;

    try {
      const dataURL = this.viewer.pngURI();
      const link = document.createElement("a");
      link.download = `molecule-3d-${Date.now()}.png`;
      link.href = dataURL;
      link.click();
    } catch (e) {
      new Notice("导出失败: " + e.message, 3000);
    }
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// ========== 预设化合物库 ==========
const PRESET_MOLECULES = [
  { name: "苯", smiles: "c1ccccc1" },
  { name: "乙醇", smiles: "CCO" },
  { name: "阿司匹林", smiles: "CC(=O)Oc1ccccc1C(=O)O" },
  { name: "咖啡因", smiles: "CN1C=NC2=C1C(=O)N(C)C(=O)N2C" },
  { name: "葡萄糖", smiles: "OC[C@H]1OC(O)[C@@H](O)[C@H](O)[C@H]1O" },
  { name: "布洛芬", smiles: "CC(C)Cc1ccc(cc1)C(C)C(=O)O" },
  { name: "尼古丁", smiles: "CN1CCCC1c1cccnc1" },
  { name: "胆固醇", smiles: "C[C@H](CCCC(C)C)[C@H]1CC[C@@]2C3=CC[C@H]4C[C@@H](O)CC[C@]4(C)C3CC[C@]12C" },
];

// ========== 3D CSS ==========
const MOL3D_CSS = `
.mol3d-loading {
  padding: 60px;
  text-align: center;
  color: var(--text-muted);
  font-size: 16px;
}
.mol3d-error {
  padding: 20px;
  color: var(--text-error);
  background: var(--background-modifier-error);
  border-radius: 8px;
}
.mol3d-smiles-bar {
  padding: 8px 12px;
  background: var(--background-secondary);
  border-radius: 6px;
  margin-bottom: 12px;
  font-family: monospace;
  font-size: 13px;
  overflow-x: auto;
}
.mol3d-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.mol3d-tool-btn {
  padding: 6px 12px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-primary);
  color: var(--text-normal);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s ease;
}
.mol3d-tool-btn:hover {
  border-color: var(--interactive-accent);
}
.mol3d-tool-btn.active {
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border-color: var(--interactive-accent);
}
.mol3d-canvas {
  border: 1px solid var(--background-modifier-border);
  border-radius: 8px;
  overflow: hidden;
  background: white;
}
.mol3d-atom-info {
  position: absolute;
  bottom: 20px;
  left: 20px;
  background: var(--background-primary);
  padding: 10px 14px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  font-size: 13px;
  z-index: 100;
}
.mol3d-hint {
  margin-top: 12px;
  text-align: center;
  font-size: 13px;
  color: var(--text-muted);
}
.chemfig-mol3d-modal {
  max-width: 900px;
}
`;

// ========== v15.7.0: 3Dmol 性能优化 ==========

/**
 * 3D 模型缓存管理器
 * 避免重复加载相同分子的 3D 模型
 */
class Molecule3DCache {
  static instance = null;

  constructor() {
    this.cache = new Map(); // key: smiles, value: { model, timestamp }
    this.maxCacheSize = 20; // 最多缓存 20 个模型
    this.cacheTimeout = 30 * 60 * 1000; // 30 分钟超时
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new Molecule3DCache();
    }
    return this.instance;
  }

  /**
   * 获取缓存的模型
   */
  get(smiles) {
    const key = smiles.trim();
    const entry = this.cache.get(key);
    if (!entry) return null;

    // 检查是否过期
    if (Date.now() - entry.timestamp > this.cacheTimeout) {
      this.cache.delete(key);
      return null;
    }

    // 更新时间戳
    entry.timestamp = Date.now();
    return entry.model;
  }

  /**
   * 缓存模型
   */
  set(smiles, model) {
    const key = smiles.trim();

    // 如果缓存已满，删除最旧的
    if (this.cache.size >= this.maxCacheSize) {
      let oldestKey = null;
      let oldestTime = Infinity;
      for (const [k, v] of this.cache.entries()) {
        if (v.timestamp < oldestTime) {
          oldestTime = v.timestamp;
          oldestKey = k;
        }
      }
      if (oldestKey) this.cache.delete(oldestKey);
    }

    this.cache.set(key, {
      model: model,
      timestamp: Date.now(),
    });
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
  }

  /**
   * 获取缓存统计
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      keys: Array.from(this.cache.keys()),
    };
  }
}

/**
 * WebGL 上下文管理器
 * 管理活跃的 viewer 实例，及时释放不需要的 WebGL 上下文
 */
class WebGLContextManager {
  static instance = null;

  constructor() {
    this.activeViewers = new Set(); // 活跃的 viewer 实例
    this.maxConcurrentViewers = 3; // 最多同时 3 个 3D 查看器
  }

  static getInstance() {
    if (!this.instance) {
      this.instance = new WebGLContextManager();
    }
    return this.instance;
  }

  /**
   * 注册新的 viewer
   */
  register(viewer) {
    // 如果超过最大数量，释放最旧的
    if (this.activeViewers.size >= this.maxConcurrentViewers) {
      const oldestViewer = this.activeViewers.values().next().value;
      this.release(oldestViewer);
    }

    this.activeViewers.add(viewer);
  }

  /**
   * 释放 viewer
   */
  release(viewer) {
    if (!viewer) return;

    try {
      // 停止旋转
      if (viewer.spin) {
        viewer.spin(false);
      }

      // 清除所有模型
      if (viewer.clear) {
        viewer.clear();
      }

      // 销毁 viewer
      if (viewer.dispose) {
        viewer.dispose();
      }
    } catch (e) {
      console.warn("[3Dmol] 释放 viewer 失败:", e);
    }

    this.activeViewers.delete(viewer);
  }

  /**
   * 释放所有 viewer
   */
  releaseAll() {
    for (const viewer of this.activeViewers) {
      this.release(viewer);
    }
    this.activeViewers.clear();
  }

  /**
   * 获取活跃 viewer 数量
   */
  getActiveCount() {
    return this.activeViewers.size;
  }
}

/**
 * 防抖重渲染工具
 * 避免频繁重渲染导致性能问题
 */
class DebouncedRenderer {
  constructor(delay = 100) {
    this.delay = delay;
    this.timer = null;
  }

  /**
   * 防抖渲染
   */
  render(viewer, callback) {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(() => {
      if (viewer && viewer.render) {
        viewer.render();
      }
      if (callback) callback();
      this.timer = null;
    }, this.delay);
  }

  /**
   * 立即渲染
   */
  renderNow(viewer, callback) {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (viewer && viewer.render) {
      viewer.render();
    }
    if (callback) callback();
  }
}

/**
 * 性能优化的 3D 渲染器
 * 集成缓存、上下文管理、防抖
 */
class OptimizedMolecule3DRenderer {
  /**
   * 渲染 3D 分子（带缓存）
   */
  static async renderWithCache(container, smiles, options = {}) {
    const cache = Molecule3DCache.getInstance();
    const contextManager = WebGLContextManager.getInstance();

    // 先检查缓存
    const cachedModel = cache.get(smiles);
    if (cachedModel && !options.forceReload) {
      console.log("[3Dmol] 使用缓存模型:", smiles);

      // 从缓存恢复
      container.empty();
      const viewer = window.$3Dmol.createViewer(container, {
        backgroundColor: options.backgroundColor || "white",
      });

      // 重新添加模型数据
      viewer.addModel(cachedModel.sdf, "sdf");

      // 设置样式
      this.applyStyle(viewer, options.style || "stick");

      viewer.zoomTo();
      viewer.render();

      // 注册到上下文管理器
      contextManager.register(viewer);

      return viewer;
    }

    // 没有缓存，重新加载
    const viewer = await Molecule3DViewer.render3D(container, smiles, options);

    if (viewer) {
      // 缓存模型
      try {
        const modelData = viewer.getModel(0);
        if (modelData) {
          const sdf = modelData.sdf();
          cache.set(smiles, { sdf: sdf });
        }
      } catch (e) {
        console.warn("[3Dmol] 缓存模型失败:", e);
      }

      // 注册到上下文管理器
      contextManager.register(viewer);
    }

    return viewer;
  }

  /**
   * 应用样式
   */
  static applyStyle(viewer, style) {
    if (!viewer) return;

    if (style === "stick") {
      viewer.setStyle({}, { stick: {}, sphere: { scale: 0.3 } });
    } else if (style === "sphere") {
      viewer.setStyle({}, { sphere: { scale: 0.8 } });
    } else if (style === "line") {
      viewer.setStyle({}, { line: {} });
    }
  }

  /**
   * 清理资源
   */
  static cleanup() {
    WebGLContextManager.getInstance().releaseAll();
    Molecule3DCache.getInstance().clear();
    console.log("[3Dmol] 所有资源已清理");
  }

  /**
   * 获取性能统计
   */
  static getPerformanceStats() {
    return {
      activeViewers: WebGLContextManager.getInstance().getActiveCount(),
      cachedModels: Molecule3DCache.getInstance().getStats(),
    };
  }
}

// 导出全局变量
// Molecule3DViewer, Molecule3DModal, PRESET_MOLECULES, MOL3D_CSS
// Molecule3DCache, WebGLContextManager, DebouncedRenderer, OptimizedMolecule3DRenderer
