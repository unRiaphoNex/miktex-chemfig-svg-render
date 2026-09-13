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
      performance: options.performance || "auto", // low/medium/high/auto
    };
    this.viewer = null;
    this.currentMol = null;
    this.atomCount = 0;
    this.loadingIndicator = null;
    this.cache = new Map(); // 分子缓存
    this.maxCacheSize = 20; // 最大缓存数量
    this.measurements = []; // 测量结果存储
  }

  /**
   * 显示加载进度条
   */
  showLoadingIndicator(text = "加载分子结构中...") {
    // 移除已有进度条
    this.hideLoadingIndicator();

    // 创建进度条容器
    this.loadingIndicator = document.createElement("div");
    this.loadingIndicator.className = "chem-3d-loading";
    this.loadingIndicator.innerHTML = `
      <div class="loading-spinner"></div>
      <div class="loading-text">${text}</div>
      <div class="loading-progress">
        <div class="progress-bar"></div>
      </div>
    `;

    // 样式
    this.loadingIndicator.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.95);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      border-radius: 8px;
    `;

    this.container.style.position = "relative";
    this.container.appendChild(this.loadingIndicator);

    // 添加 CSS 动画
    this.injectLoadingStyles();
  }

  /**
   * 隐藏加载进度条
   */
  hideLoadingIndicator() {
    if (this.loadingIndicator) {
      this.loadingIndicator.remove();
      this.loadingIndicator = null;
    }
  }

  /**
   * 注入加载样式
   */
  injectLoadingStyles() {
    if (document.getElementById("chem-3d-loading-styles")) return;

    const style = document.createElement("style");
    style.id = "chem-3d-loading-styles";
    style.textContent = `
      .chem-3d-loading .loading-spinner {
        width: 48px;
        height: 48px;
        border: 4px solid var(--background-modifier-border);
        border-top-color: var(--interactive-accent);
        border-radius: 50%;
        animation: chem-spin 0.8s linear infinite;
        margin-bottom: 16px;
      }

      .chem-3d-loading .loading-text {
        font-size: 14px;
        color: var(--text-muted);
        margin-bottom: 12px;
      }

      .chem-3d-loading .loading-progress {
        width: 200px;
        height: 4px;
        background: var(--background-modifier-border);
        border-radius: 2px;
        overflow: hidden;
      }

      .chem-3d-loading .progress-bar {
        height: 100%;
        background: linear-gradient(90deg, var(--interactive-accent), var(--interactive-accent-hover));
        border-radius: 2px;
        animation: chem-progress 1.5s ease-in-out infinite;
      }

      @keyframes chem-spin {
        to { transform: rotate(360deg); }
      }

      @keyframes chem-progress {
        0% { width: 0%; margin-left: 0; }
        50% { width: 60%; margin-left: 20%; }
        100% { width: 0%; margin-left: 100%; }
      }

      /* 拖拽加载样式 */
      .3d-viewer-container.drag-over {
        outline: 3px dashed var(--interactive-accent);
        outline-offset: -10px;
        background: var(--background-modifier-hover);
      }

      /* 性能状态栏 */
      .3d-status-bar {
        display: flex;
        gap: 20px;
        padding: 8px 16px;
        background: var(--background-secondary);
        border-top: 1px solid var(--background-modifier-border);
        font-size: 12px;
        color: var(--text-muted);
      }

      .status-item {
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .status-item span {
        font-weight: 600;
        color: var(--text-normal);
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * 初始化 3Dmol.js
   */
  async init() {
    if (typeof $3Dmol === "undefined") {
      // 动态加载 3Dmol.js
      await this.load3Dmol();
    }

    // 创建 viewer - 根据性能模式调整
    const viewerConfig = {
      backgroundColor: "white",
    };

    // 性能优化：低性能模式使用 WebGL 简化设置
    if (this.options.performance === "low") {
      viewerConfig.defaultcolorscheme = "default";
    }

    this.viewer = $3Dmol.createViewer(this.container, viewerConfig);
  }

  /**
   * 设置性能模式
   */
  setPerformanceMode(mode) {
    this.options.performance = mode;
    
    // 根据原子数自动判断
    if (mode === "auto") {
      if (this.atomCount > 5000) {
        mode = "low";
      } else if (this.atomCount > 1000) {
        mode = "medium";
      } else {
        mode = "high";
      }
    }

    // 应用性能优化
    this.applyPerformanceOptimizations(mode);
  }

  /**
   * 应用性能优化
   */
  applyPerformanceOptimizations(mode) {
    if (!this.viewer) return;

    switch (mode) {
      case "low":
        // 低性能：关闭抗锯齿、降低线宽
        this.viewer.setRenderSettings({
          antialias: false,
          lineWidth: 1,
        });
        break;

      case "medium":
        // 中等性能：平衡质量和性能
        this.viewer.setRenderSettings({
          antialias: true,
          lineWidth: 1.5,
        });
        break;

      case "high":
        // 高性能：最佳质量
        this.viewer.setRenderSettings({
          antialias: true,
          lineWidth: 2,
        });
        break;
    }

    this.viewer.render();
  }

  /**
   * 根据分子大小自动调整显示样式和性能设置
   */
  autoAdjustDisplay() {
    if (!this.currentMol) return;

    const atomCount = this.currentMol.numAtoms();
    this.atomCount = atomCount;

    // 性能分级
    if (atomCount > 10000) {
      // 超大分子：最低性能模式
      this.viewer.setStyle({}, {
        cartoon: { color: "spectrum", opacity: 0.8 },
      });
      // 关闭阴影，提升性能
      this.viewer.setNoZoom(false);
      new Notice(`超大分子 (${atomCount} 原子)：已切换为性能模式`, 2500);
    } else if (atomCount > 5000) {
      // 大分子：使用卡通模型
      this.viewer.setStyle({}, {
        cartoon: { color: "spectrum" },
      });
      new Notice(`大分子 (${atomCount} 原子)：已切换为卡通模型`, 2000);
    } else if (atomCount > 1000) {
      // 中等分子：使用细棍模型
      this.viewer.setStyle({}, {
        stick: { radius: 0.1 },
      });
    }
    // 小分子：保持默认球棍模型
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

      // 3Dmol.js 已内置在 main.js 中，不依赖网络
      // 如果未加载，可能是合并顺序问题
      reject(new Error("3Dmol.js 未正确加载"));
    });
  }

  /**
   * 从 SMILES 加载分子（异步包装）
   */
  async loadFromSmiles(smiles) {
    this.showLoadingIndicator("生成 3D 结构中...");

    try {
      // 确保 viewer 已初始化
      if (!this.viewer) {
        await this.initViewer();
      }

      // 直接从 SMILES 加载到 3Dmol.js
      this.renderSmiles(smiles);
    } finally {
      this.hideLoadingIndicator();
    }
  }

  /**
   * 渲染 SMILES 分子（带缓存）
   */
  renderSmiles(smiles) {
    if (!this.viewer) {
      throw new Error("Viewer 未初始化");
    }

    // 检查缓存
    if (this.cache.has(smiles)) {
      this.viewer.clear();
      this.viewer.addModel(this.cache.get(smiles), "smi");
      this.setDisplayStyle(this.options.model);
      this.viewer.zoomTo();
      this.viewer.render();
      return;
    }

    this.viewer.clear();
    
    // 3Dmol.js 支持直接从 SMILES 加载分子
    this.viewer.addModel(smiles, "smi");
    this.setDisplayStyle(this.options.model);
    this.viewer.zoomTo();
    this.viewer.render();

    // 存入缓存
    this.addToCache(smiles);
  }

  /**
   * 添加到缓存
   */
  addToCache(key, data) {
    // 缓存满了，删除最旧的
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, data || key);
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * 设置显示样式
   */
  setDisplayStyle(model) {
    if (!this.viewer) return;

    this.options.model = model;

    switch (model) {
      case "stick":
        this.viewer.setStyle({}, { stick: { radius: 0.15 }, sphere: { scale: 0.25 } });
        break;
      case "sphere":
        this.viewer.setStyle({}, { sphere: { scale: 0.3 } });
        break;
      case "line":
        this.viewer.setStyle({}, { line: {} });
        break;
      case "cartoon":
        this.viewer.setStyle({}, { cartoon: { color: "spectrum" } });
        break;
      case "surface":
        this.viewer.setStyle({}, { stick: { radius: 0.1 } });
        this.viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.5 });
        break;
      default:
        this.viewer.setStyle({}, { stick: { radius: 0.15 }, sphere: { scale: 0.25 } });
    }

    this.viewer.render();
  }

  /**
   * 自动旋转
   */
  setAutoRotate(enabled) {
    if (!this.viewer) return;

    if (enabled) {
      this.viewer.spin("y", 1);
    } else {
      this.viewer.spin(false);
    }
  }

  /**
   * 重置视角
   */
  resetView() {
    if (!this.viewer) return;
    this.viewer.zoomTo();
    this.viewer.render();
  }

  /**
   * 截图
   */
  screenshot() {
    if (!this.viewer) return null;
    return this.viewer.pngImage();
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
   * 从文本内容加载分子（支持多种格式）
   */
  loadFromText(text, format = "mol") {
    if (!this.viewer) {
      throw new Error("Viewer 未初始化");
    }

    this.viewer.clear();
    
    // 根据格式加载
    this.viewer.addModel(text, format);
    
    // 设置显示样式
    this.applyStyle();
    
    // 自动缩放
    this.viewer.zoomTo();
    this.viewer.render();

    this.currentMol = text;

    // 性能优化：自动调整显示
    this.autoAdjustDisplay();
  }

  /**
   * 从 PDB ID 加载蛋白质结构
   */
  async loadFromPDB(pdbId) {
    if (!this.viewer) {
      throw new Error("Viewer 未初始化");
    }

    this.showLoadingIndicator("从 PDB 数据库加载中...");

    try {
      // 从 RCSB PDB 下载结构
      const url = `https://files.rcsb.org/view/${pdbId.toUpperCase()}.pdb`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`PDB ID 未找到: ${pdbId}`);
      }

      const pdbText = await response.text();
      
      this.viewer.clear();
      this.viewer.addModel(pdbText, "pdb");
      
      // 蛋白质默认使用卡通模型
      this.viewer.setStyle({}, {
        cartoon: { color: "spectrum" },
      });
      
      this.viewer.zoomTo();
      this.viewer.render();

      this.currentMol = pdbText;
      this.options.model = "cartoon";

      new Notice(`已加载 PDB: ${pdbId.toUpperCase()}`, 2000);
    } finally {
      this.hideLoadingIndicator();
    }
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

      // 新增样式
      case "licorice":
        this.viewer.setStyle({}, {
          stick: { radius: 0.1, colorscheme: this.options.colorScheme },
        });
        break;

      case "hyperball":
        this.viewer.setStyle({}, {
          stick: { radius: 0.2, colorscheme: this.options.colorScheme },
          sphere: { scale: 0.5 },
        });
        break;

      // 蛋白质专用样式
      case "ribbon":
        // 丝带模型 - 显示蛋白质二级结构
        this.viewer.setStyle({}, {
          cartoon: { color: "spectrum", arrows: true },
        });
        break;

      case "chain":
        // 按链着色 - 不同链用不同颜色
        this.viewer.setStyle({}, {
          cartoon: { color: "chain" },
        });
        break;

      case "residue":
        // 按残基类型着色
        this.viewer.setStyle({}, {
          cartoon: { color: "residue" },
        });
        break;

      case "b-factor":
        // 按 B-factor 着色（蛋白质热图）
        this.viewer.setStyle({}, {
          cartoon: { color: "b-factor" },
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
   * 设置背景颜色
   */
  setBackgroundColor(color) {
    if (this.viewer) {
      this.viewer.setBackgroundColor(color);
      this.viewer.render();
    }
  }

  /**
   * 设置背景透明度
   * @param opacity 0-1
   */
  setBackgroundOpacity(opacity) {
    if (this.container) {
      // 通过 CSS 控制背景透明度
      this.container.style.background = `rgba(255, 255, 255, ${opacity})`;
    }
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
   * 设置旋转速度
   */
  setSpinSpeed(speed) {
    if (this.viewer) {
      this.viewer.spin({"speed": speed});
    }
  }

  /**
   * 显示/隐藏坐标轴
   */
  showAxes(show = true) {
    if (this.viewer) {
      if (show) {
        this.viewer.addAxis({});
      } else {
        // 清除并重新渲染以移除坐标轴
        this.applyStyle();
      }
      this.viewer.render();
    }
  }

  /**
   * 显示/隐藏网格
   */
  showGrid(show = true) {
    if (this.viewer) {
      if (show) {
        this.viewer.addGrid({});
      } else {
        this.applyStyle();
      }
      this.viewer.render();
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
   * 设置预设视角
   */
  setPresetView(view) {
    if (!this.viewer) return;

    // 视角预设：前/后/左/右/上/下
    const views = {
      front: { x: 0, y: 0, z: 1 },
      back: { x: 0, y: 0, z: -1 },
      left: { x: -1, y: 0, z: 0 },
      right: { x: 1, y: 0, z: 0 },
      top: { x: 0, y: 1, z: 0 },
      bottom: { x: 0, y: -1, z: 0 },
    };

    const direction = views[view];
    if (direction) {
      // 旋转到指定视角
      this.viewer.setView(direction);
      this.viewer.zoomTo();
      this.viewer.render();
    }
  }

  /**
   * 导出为图片
   * @param width 自定义宽度（可选）
   * @param height 自定义高度（可选）
   */
  exportImage(width, height) {
    if (this.viewer) {
      let dataURI;

      // 如果指定了尺寸，使用自定义尺寸
      if (width && height) {
        dataURI = this.viewer.pngURI(width, height);
      } else {
        dataURI = this.viewer.pngURI();
      }

      const link = document.createElement("a");
      link.download = "molecule-3d.png";
      link.href = dataURI;
      link.click();
    }
  }

  /**
   * 导出分子文件（PDB/SDF/MOL）
   */
  exportMolecule(format = "pdb") {
    if (!this.viewer || !this.currentMol) {
      new Notice("没有可导出的分子", 2000);
      return;
    }

    try {
      let content = "";
      let filename = "";
      let mimeType = "";

      switch (format) {
        case "pdb":
          content = this.viewer.getModel().pdb;
          filename = "molecule.pdb";
          mimeType = "chemical/x-pdb";
          break;
        case "sdf":
          content = this.viewer.getModel().sdf;
          filename = "molecule.sdf";
          mimeType = "chemical/x-mdl-sdfile";
          break;
        case "mol":
          content = this.viewer.getModel().mol;
          filename = "molecule.mol";
          mimeType = "chemical/x-mdl-molfile";
          break;
        default:
          content = this.viewer.getModel().pdb;
          filename = "molecule.pdb";
      }

      // 创建下载
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = filename;
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      new Notice(`已导出: ${filename}`, 2000);
    } catch (e) {
      new Notice(`导出失败: ${e.message}`, 3000);
    }
  }

  /**
   * 导出测量结果（CSV）
   */
  exportMeasurements() {
    if (!this.measurements || this.measurements.length === 0) {
      new Notice("没有测量结果可导出", 2000);
      return;
    }

    try {
      // 生成 CSV 内容
      let csv = "类型,原子编号,数值,单位\n";
      this.measurements.forEach((m, i) => {
        csv += `${m.type},"${m.atoms.join("-")}",${m.value},${m.unit}\n`;
      });

      // 创建下载
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = "measurements.csv";
      link.href = url;
      link.click();
      URL.revokeObjectURL(url);

      new Notice(`已导出 ${this.measurements.length} 条测量结果`, 2000);
    } catch (e) {
      new Notice(`导出失败: ${e.message}`, 3000);
    }
  }

  /**
   * 启用距离测量模式
   * 点击两个原子显示距离
   */
  enableDistanceMeasurement() {
    if (!this.viewer) return;
    
    this.measureMode = true;
    this.measureType = "distance"; // distance / angle / dihedral
    this.firstAtom = null;
    this.secondAtom = null;
    this.measurePoints = [];
    this.distanceLabels = [];

    // 绑定点击事件
    this.viewer.setClickable({}, true, (atom) => {
      if (!this.measureMode) return;

      this.measurePoints.push(atom);

      // 高亮当前选中的原子
      this.viewer.setStyle({ atomindex: atom.index }, {
        stick: { radius: 0.15 },
        sphere: { scale: 0.5, color: "yellow" },
      });
      this.viewer.render();

      // 根据测量类型检查是否完成
      if (this.measureType === "distance" && this.measurePoints.length === 2) {
        this.calculateAndDrawDistance(this.measurePoints[0], this.measurePoints[1]);
        this.measurePoints = [];
      } else if (this.measureType === "angle" && this.measurePoints.length === 3) {
        this.calculateAndDrawAngle(this.measurePoints[0], this.measurePoints[1], this.measurePoints[2]);
        this.measurePoints = [];
      } else if (this.measureType === "dihedral" && this.measurePoints.length === 4) {
        this.calculateAndDrawDihedral(this.measurePoints[0], this.measurePoints[1], this.measurePoints[2], this.measurePoints[3]);
        this.measurePoints = [];
      }
    });
  }

  /**
   * 禁用距离测量模式
   */
  disableDistanceMeasurement() {
    if (!this.viewer) return;

    this.measureMode = false;
    this.measurePoints = [];

    // 移除所有距离标签
    this.distanceLabels.forEach(label => label.remove());
    this.distanceLabels = [];

    // 清除点击事件
    this.viewer.setClickable({}, false);

    // 重置样式
    this.viewer.render();
  }

  /**
   * 设置测量类型
   */
  setMeasureType(type) {
    this.measureType = type;
    this.measurePoints = [];
  }

  /**
   * 计算并绘制距离
   */
  calculateAndDrawDistance(atom1, atom2) {
    const distance = this.calculateDistance(atom1, atom2);
    
    // 创建距离标签
    const label = this.viewer.addLabel(`${distance.toFixed(2)} Å`, {
      position: { x: (atom1.x + atom2.x) / 2, y: (atom1.y + atom2.y) / 2, z: (atom1.z + atom2.z) / 2 },
      fontSize: 14,
      fontColor: "red",
      backgroundColor: "white",
      backgroundOpacity: 0.8,
    });
    this.distanceLabels.push(label);

    // 保存测量结果
    this.measurements.push({
      type: "距离",
      atoms: [atom1.index, atom2.index],
      value: distance.toFixed(2),
      unit: "Å",
    });

    // 绘制距离线
    this.viewer.addLine({
      start: { x: atom1.x, y: atom1.y, z: atom1.z },
      end: { x: atom2.x, y: atom2.y, z: atom2.z },
      color: "red",
      linewidth: 2,
    });

    this.applyStyle(); // 恢复原始样式
  }

  /**
   * 计算并绘制角度
   */
  calculateAndDrawAngle(atom1, atom2, atom3) {
    const angle = this.calculateAngle(atom1, atom2, atom3);

    // 保存测量结果
    this.measurements.push({
      type: "角度",
      atoms: [atom1.index, atom2.index, atom3.index],
      value: angle.toFixed(1),
      unit: "°",
    });

    // 在中间原子处显示角度标签
    const label = this.viewer.addLabel(`${angle.toFixed(1)}°`, {
      position: { x: atom2.x, y: atom2.y, z: atom2.z },
      fontSize: 14,
      fontColor: "blue",
      backgroundColor: "white",
      backgroundOpacity: 0.8,
    });
    this.distanceLabels.push(label);

    // 绘制角度线
    this.viewer.addLine({
      start: { x: atom1.x, y: atom1.y, z: atom1.z },
      end: { x: atom2.x, y: atom2.y, z: atom2.z },
      color: "blue",
      linewidth: 2,
    });
    this.viewer.addLine({
      start: { x: atom2.x, y: atom2.y, z: atom2.z },
      end: { x: atom3.x, y: atom3.y, z: atom3.z },
      color: "blue",
      linewidth: 2,
    });

    this.applyStyle(); // 恢复原始样式
  }

  /**
   * 计算并绘制二面角
   */
  calculateAndDrawDihedral(atom1, atom2, atom3, atom4) {
    const dihedral = this.calculateDihedral(atom1, atom2, atom3, atom4);

    // 保存测量结果
    this.measurements.push({
      type: "二面角",
      atoms: [atom1.index, atom2.index, atom3.index, atom4.index],
      value: dihedral.toFixed(1),
      unit: "°",
    });

    // 在中间位置显示二面角标签
    const midX = (atom2.x + atom3.x) / 2;
    const midY = (atom2.y + atom3.y) / 2;
    const midZ = (atom2.z + atom3.z) / 2;
    
    const label = this.viewer.addLabel(`${dihedral.toFixed(1)}°`, {
      position: { x: midX, y: midY, z: midZ },
      fontSize: 14,
      fontColor: "green",
      backgroundColor: "white",
      backgroundOpacity: 0.8,
    });
    this.distanceLabels.push(label);

    // 绘制二面角线
    this.viewer.addLine({
      start: { x: atom1.x, y: atom1.y, z: atom1.z },
      end: { x: atom2.x, y: atom2.y, z: atom2.z },
      color: "green",
      linewidth: 2,
    });
    this.viewer.addLine({
      start: { x: atom2.x, y: atom2.y, z: atom2.z },
      end: { x: atom3.x, y: atom3.y, z: atom3.z },
      color: "green",
      linewidth: 3,
    });
    this.viewer.addLine({
      start: { x: atom3.x, y: atom3.y, z: atom3.z },
      end: { x: atom4.x, y: atom4.y, z: atom4.z },
      color: "green",
      linewidth: 2,
    });

    this.applyStyle(); // 恢复原始样式
  }

  /**
   * 计算两个原子之间的距离
   */
  calculateDistance(atom1, atom2) {
    const dx = atom1.x - atom2.x;
    const dy = atom1.y - atom2.y;
    const dz = atom1.z - atom2.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  /**
   * 计算三个原子之间的角度
   */
  calculateAngle(atom1, atom2, atom3) {
    // 向量 atom2->atom1 和 atom2->atom3
    const v1 = {
      x: atom1.x - atom2.x,
      y: atom1.y - atom2.y,
      z: atom1.z - atom2.z,
    };
    const v2 = {
      x: atom3.x - atom2.x,
      y: atom3.y - atom2.y,
      z: atom3.z - atom2.z,
    };

    // 计算点积
    const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    
    // 计算模长
    const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
    const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);

    // 计算角度（弧度转角度）
    const cosAngle = dot / (mag1 * mag2);
    const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle))) * 180 / Math.PI;
    
    return angle;
  }

  /**
   * 计算四个原子之间的二面角
   */
  calculateDihedral(atom1, atom2, atom3, atom4) {
    // 计算三个向量
    const b1 = {
      x: atom2.x - atom1.x,
      y: atom2.y - atom1.y,
      z: atom2.z - atom1.z,
    };
    const b2 = {
      x: atom3.x - atom2.x,
      y: atom3.y - atom2.y,
      z: atom3.z - atom2.z,
    };
    const b3 = {
      x: atom4.x - atom3.x,
      y: atom4.y - atom3.y,
      z: atom4.z - atom3.z,
    };

    // 计算法向量
    const n1 = this.crossProduct(b1, b2);
    const n2 = this.crossProduct(b2, b3);

    // 计算二面角
    const m1 = this.crossProduct(n1, this.normalize(b2));
    const x = this.dotProduct(n1, n2);
    const y = this.dotProduct(m1, n2);

    let angle = Math.atan2(y, x) * 180 / Math.PI;
    if (angle < 0) angle += 360;

    return angle;
  }

  /**
   * 计算叉积
   */
  crossProduct(a, b) {
    return {
      x: a.y * b.z - a.z * b.y,
      y: a.z * b.x - a.x * b.z,
      z: a.x * b.y - a.y * b.x,
    };
  }

  /**
   * 计算点积
   */
  dotProduct(a, b) {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  /**
   * 归一化向量
   */
  normalize(v) {
    const mag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    return { x: v.x / mag, y: v.y / mag, z: v.z / mag };
  }

  /**
   * 启用原子信息显示
   * 点击原子显示详细信息
   */
  enableAtomInfo(onClick) {
    if (!this.viewer) return;

    this.viewer.setClickable({}, true, (atom) => {
      const info = {
        element: atom.elem,
        index: atom.index,
        x: atom.x.toFixed(3),
        y: atom.y.toFixed(3),
        z: atom.z.toFixed(3),
        residue: atom.resn || "N/A",
        chain: atom.chain || "N/A",
      };
      if (onClick) onClick(info);
    });
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

    // PDB ID 输入
    const pdbInput = controlBar.createEl("input", {
      type: "text",
      placeholder: "PDB ID (如 1AKE)...",
      cls: "pdb-input",
    });

    const pdbLoadBtn = controlBar.createEl("button", {
      text: "🔬 PDB",
      cls: "pdb-load-btn",
    });

    // 文件上传按钮
    const fileInput = controlBar.createEl("input", {
      type: "file",
      cls: "file-input",
    });
    fileInput.style.display = "none";
    fileInput.accept = ".mol,.sdf,.pdb,.xyz,.cif,.xtc,.dcd";

    const uploadBtn = controlBar.createEl("button", {
      text: "📁 上传文件",
      cls: "upload-btn",
    });

    // 轨迹播放按钮
    const trajectoryBtn = controlBar.createEl("button", {
      text: "🎬 轨迹",
      cls: "trajectory-btn",
    });

    // 模型切换
    const modelSelect = controlBar.createEl("select", { cls: "model-select" });
    modelSelect.createEl("option", { text: "球棍模型", value: "stick" });
    modelSelect.createEl("option", { text: "空间填充", value: "sphere" });
    modelSelect.createEl("option", { text: "卡通模型", value: "cartoon" });
    modelSelect.createEl("option", { text: "表面模型", value: "surface" });
    modelSelect.createEl("option", { text: "细棍模型", value: "licorice" });
    modelSelect.createEl("option", { text: "超球棍", value: "hyperball" });
    // 蛋白质专用
    modelSelect.createEl("option", { text: "--- 蛋白质 ---", value: "" });
    modelSelect.createEl("option", { text: "🎗️ 丝带模型", value: "ribbon" });
    modelSelect.createEl("option", { text: "🔗 按链着色", value: "chain" });
    modelSelect.createEl("option", { text: "🧬 按残基着色", value: "residue" });

    // 背景颜色
    const bgSelect = controlBar.createEl("select", { cls: "bg-select" });
    bgSelect.createEl("option", { text: "⚪ 白色", value: "white" });
    bgSelect.createEl("option", { text: "⚫ 黑色", value: "black" });
    bgSelect.createEl("option", { text: "⬜ 透明", value: "transparent" });

    // 配色方案
    const colorSchemeSelect = controlBar.createEl("select", { cls: "color-scheme-select" });
    colorSchemeSelect.createEl("option", { text: "🌈 经典", value: "default" });
    colorSchemeSelect.createEl("option", { text: "🎨 CPK", value: "cpk" });
    colorSchemeSelect.createEl("option", { text: "🔥 温暖", value: "warm" });
    colorSchemeSelect.createEl("option", { text: "❄️ 冷色", value: "cool" });
    colorSchemeSelect.createEl("option", { text: "🌊 光谱", value: "spectrum" });

    // 旋转速度
    const speedSelect = controlBar.createEl("select", { cls: "speed-select" });
    speedSelect.createEl("option", { text: "🐢 慢速", value: "1" });
    speedSelect.createEl("option", { text: "🐇 中速", value: "5" });
    speedSelect.createEl("option", { text: "🚀 快速", value: "15" });

    // 测量工具
    const measureBtn = controlBar.createEl("button", {
      text: "📏 测量",
      cls: "measure-btn",
    });

    // 测量类型选择
    const measureTypeSelect = controlBar.createEl("select", { cls: "measure-type-select" });
    measureTypeSelect.createEl("option", { text: "距离", value: "distance" });
    measureTypeSelect.createEl("option", { text: "角度", value: "angle" });
    measureTypeSelect.createEl("option", { text: "二面角", value: "dihedral" });

    // 性质按钮
    const propsBtn = controlBar.createEl("button", {
      text: "📊 性质",
      cls: "props-btn",
    });

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

    // 视角预设
    const viewSelect = controlBar.createEl("select", { cls: "view-select" });
    viewSelect.createEl("option", { text: "🎯 视角", value: "" });
    viewSelect.createEl("option", { text: "⬆️ 前", value: "front" });
    viewSelect.createEl("option", { text: "⬇️ 后", value: "back" });
    viewSelect.createEl("option", { text: "⬅️ 左", value: "left" });
    viewSelect.createEl("option", { text: "➡️ 右", value: "right" });
    viewSelect.createEl("option", { text: "⬆️ 上", value: "top" });
    viewSelect.createEl("option", { text: "⬇️ 下", value: "bottom" });

    // 导出按钮
    const exportBtn = controlBar.createEl("button", {
      text: "📷 导出",
      cls: "export-btn",
    });

    // 全屏按钮
    const fullscreenBtn = controlBar.createEl("button", {
      text: "⛶ 全屏",
      cls: "fullscreen-btn",
    });

    // 收藏按钮
    const favoriteBtn = controlBar.createEl("button", {
      text: "⭐ 收藏",
      cls: "favorite-btn",
    });

    // 收藏列表按钮
    const favoritesListBtn = controlBar.createEl("button", {
      text: "📋 列表",
      cls: "favorites-list-btn",
    });

    // 原子信息面板
    this.infoPanel = contentEl.createDiv({ cls: "atom-info-panel" });
    this.infoPanel.hide();

    // 3D 容器
    this.viewerContainer = contentEl.createDiv({ cls: "3d-viewer-container" });

    // 性能状态栏
    this.statusBar = contentEl.createDiv({ cls: "3d-status-bar" });
    this.statusBar.innerHTML = `
      <span class="status-item">原子: <span class="atom-count">-</span></span>
      <span class="status-item">FPS: <span class="fps-count">-</span></span>
      <span class="status-item">模式: <span class="current-mode">-</span></span>
    `;

    // 初始化 viewer - 使用新版 Molecule3DModalViewer
    this.viewer = new Molecule3DModalViewer(this.viewerContainer);
    await this.viewer.init();

    // 文件拖拽加载支持
    this.setupDragAndDrop(this.viewerContainer);

    // 初始化轨迹播放器
    this.trajectoryPlayer = new window.TrajectoryPlayer(this.viewer);

    // 轨迹控制栏
    this.trajectoryControls = contentEl.createDiv({ cls: "trajectory-controls" });
    this.trajectoryControls.hide();
    this.createTrajectoryControls(this.trajectoryControls);

    // 如果有 SMILES，自动加载
    if (this.smiles) {
      try {
        await this.viewer.loadFromSmiles(this.smiles);
        this.updateStatusBar();
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
        this.updateStatusBar();
      } catch (e) {
        new Notice(`加载失败: ${e.message}`, 3000);
      }
    };

    // PDB 加载
    pdbLoadBtn.onclick = async () => {
      const pdbId = pdbInput.value.trim();
      if (!pdbId) {
        new Notice("请输入 PDB ID", 2000);
        return;
      }

      try {
        await this.viewer.loadFromPDB(pdbId);
        this.updateStatusBar();
      } catch (e) {
        new Notice(`PDB 加载失败: ${e.message}`, 3000);
      }
    };

    // 文件上传
    uploadBtn.onclick = () => {
      fileInput.click();
    };

    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const ext = file.name.split(".").pop().toLowerCase();
        
        // 根据文件类型确定格式
        let format = "mol";
        if (ext === "pdb") format = "pdb";
        else if (ext === "xyz") {
          // 检查是否是轨迹文件（多帧）
          const frameCount = this.trajectoryPlayer.loadFromXYZ(text);
          if (frameCount > 1) {
            new Notice(`已加载轨迹: ${file.name} (${frameCount} 帧)`, 2000);
            this.showTrajectoryControls();
            return;
          } else {
            format = "xyz";
          }
        }
        else if (ext === "sdf") format = "sdf";
        else if (ext === "cif") format = "cif";

        // 加载分子
        this.viewer.loadFromText(text, format);
        new Notice(`已加载: ${file.name}`, 2000);
      } catch (err) {
        new Notice(`文件加载失败: ${err.message}`, 3000);
      }
    };

    trajectoryBtn.onclick = () => {
      if (this.trajectoryControls) {
        this.trajectoryControls.toggle(!this.trajectoryControls.isShown);
      }
    };

    modelSelect.onchange = () => {
      this.viewer.setModel(modelSelect.value);
    };

    bgSelect.onchange = () => {
      this.viewer.setBackgroundColor(bgSelect.value);
    };

    colorSchemeSelect.onchange = () => {
      this.viewer.setColorScheme(colorSchemeSelect.value);
    };

    speedSelect.onchange = () => {
      this.viewer.setSpinSpeed(parseInt(speedSelect.value));
    };

    measureBtn.onclick = () => {
      if (this.measureEnabled) {
        this.viewer.disableDistanceMeasurement();
        this.measureBtn.removeClass("active");
        this.measureEnabled = false;
      } else {
        this.viewer.enableDistanceMeasurement();
        this.viewer.setMeasureType(measureTypeSelect.value);
        this.measureBtn.addClass("active");
        this.measureEnabled = true;
        
        const typeText = measureTypeSelect.options[measureTypeSelect.selectedIndex].text;
        new Notice(`测量模式：${typeText}，点击原子开始`, 2000);
      }
    };

    measureTypeSelect.onchange = () => {
      if (this.measureEnabled) {
        this.viewer.setMeasureType(measureTypeSelect.value);
        const typeText = measureTypeSelect.options[measureTypeSelect.selectedIndex].text;
        new Notice(`已切换到：${typeText}测量`, 1500);
      }
    };

    propsBtn.onclick = async () => {
      const smiles = smilesInput.value.trim();
      if (!smiles) {
        new Notice("请先输入 SMILES 结构", 2000);
        return;
      }

      try {
        // 计算分子性质
        const properties = await MolecularPropertiesCalculator.calculateFromSmiles(smiles);
        
        // 显示性质报告
        if (!this.propsPanel) {
          this.propsPanel = contentEl.createDiv({ cls: "mol-properties-panel" });
        }
        this.propsPanel.innerHTML = MolecularPropertiesCalculator.generateReportHTML(properties);
        this.propsPanel.toggle(!this.propsPanel.isShown);
        
        propsBtn.toggleClass("active", this.propsPanel.isShown);
      } catch (e) {
        new Notice(`性质计算失败: ${e.message}`, 3000);
      }
    };

    spinBtn.onclick = () => {
      this.viewer.spin();
    };

    resetBtn.onclick = () => {
      this.viewer.resetView();
    };

    viewSelect.onchange = () => {
      if (viewSelect.value) {
        this.viewer.setPresetView(viewSelect.value);
      }
    };

    exportBtn.onclick = () => {
      this.viewer.exportImage();
    };

    fullscreenBtn.onclick = () => {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        this.viewerContainer.requestFullscreen();
      }
    };

    favoriteBtn.onclick = () => {
      const smiles = smilesInput.value.trim();
      if (!smiles) {
        new Notice("请先输入 SMILES 结构", 2000);
        return;
      }

      // 从 localStorage 读取收藏列表
      const favorites = JSON.parse(localStorage.getItem("molecule3d_favorites") || "[]");
      
      // 检查是否已收藏
      if (favorites.find(f => f.smiles === smiles)) {
        new Notice("该分子已在收藏列表中", 2000);
        return;
      }

      // 添加到收藏
      favorites.push({
        smiles: smiles,
        timestamp: Date.now(),
        name: `分子 ${favorites.length + 1}`,
      });
      
      localStorage.setItem("molecule3d_favorites", JSON.stringify(favorites));
      new Notice(`已收藏: ${smiles}`, 2000);
      favoriteBtn.addClass("active");
    };

    favoritesListBtn.onclick = () => {
      this.showFavoritesList(smilesInput);
    };

    // 启用原子信息显示
    this.viewer.enableAtomInfo((info) => {
      this.infoPanel.show();
      this.infoPanel.innerHTML = `
        <strong>原子信息</strong><br>
        元素: ${info.element}<br>
        索引: ${info.index}<br>
        坐标: (${info.x}, ${info.y}, ${info.z})<br>
        残基: ${info.residue}<br>
        链: ${info.chain}
      `;
    });

    // 快捷键支持
    this.registerShortcuts(smilesInput, loadBtn, spinBtn, resetBtn, exportBtn, measureBtn, propsBtn);
  }

  /**
   * 设置文件拖拽加载
   */
  setupDragAndDrop(container) {
    // 拖拽进入
    container.addEventListener("dragenter", (e) => {
      e.preventDefault();
      e.stopPropagation();
      container.addClass("drag-over");
    });

    // 拖拽经过
    container.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.stopPropagation();
    });

    // 拖拽离开
    container.addEventListener("dragleave", (e) => {
      e.preventDefault();
      e.stopPropagation();
      container.removeClass("drag-over");
    });

    // 拖拽释放
    container.addEventListener("drop", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      container.removeClass("drag-over");

      const files = e.dataTransfer.files;
      if (files.length === 0) return;

      const file = files[0];
      const text = await file.text();
      const ext = file.name.split(".").pop().toLowerCase();

      // 根据文件类型确定格式
      let format = "mol";
      if (ext === "pdb") format = "pdb";
      else if (ext === "xyz") format = "xyz";
      else if (ext === "sdf") format = "sdf";
      else if (ext === "cif") format = "cif";

      try {
        this.viewer.loadFromText(text, format);
        new Notice(`已加载: ${file.name}`, 2000);
      } catch (err) {
        new Notice(`文件加载失败: ${err.message}`, 3000);
      }
    });
  }

  /**
   * 注册快捷键
   */
  registerShortcuts(smilesInput, loadBtn, spinBtn, resetBtn, exportBtn, measureBtn, propsBtn) {
    const handleKeydown = (e) => {
      // Ctrl+O: 打开文件
      if (e.ctrlKey && e.key === "o") {
        e.preventDefault();
        this.contentEl.querySelector(".file-input").click();
      }
      // Ctrl+E: 导出图片
      else if (e.ctrlKey && e.key === "e") {
        e.preventDefault();
        this.viewer.exportImage();
      }
      // Space: 切换旋转
      else if (e.code === "Space" && e.target.tagName !== "INPUT") {
        e.preventDefault();
        spinBtn.click();
      }
      // R: 重置视图
      else if (e.key === "r" && e.target.tagName !== "INPUT") {
        resetBtn.click();
      }
      // M: 测量模式
      else if (e.key === "m" && e.target.tagName !== "INPUT") {
        measureBtn.click();
      }
      // P: 性质面板
      else if (e.key === "p" && e.target.tagName !== "INPUT") {
        propsBtn.click();
      }
    };

    this.scope = this.contentEl;
    this.scope.addEventListener("keydown", handleKeydown);
  }

  /**
   * 更新状态栏
   */
  updateStatusBar() {
    if (!this.statusBar || !this.viewer) return;

    // 更新原子数
    const atomCount = this.viewer.atomCount || 0;
    this.statusBar.querySelector(".atom-count").textContent = atomCount;

    // 更新当前模式
    const mode = this.viewer.options?.model || "stick";
    this.statusBar.querySelector(".current-mode").textContent = mode;

    // FPS 监控（每秒更新一次）
    if (!this.fpsStartTime) {
      this.fpsStartTime = performance.now();
      this.fpsFrameCount = 0;
    }

    this.fpsFrameCount++;
    const elapsed = performance.now() - this.fpsStartTime;

    if (elapsed >= 1000) {
      const fps = Math.round((this.fpsFrameCount * 1000) / elapsed);
      this.statusBar.querySelector(".fps-count").textContent = fps;
      this.fpsStartTime = performance.now();
      this.fpsFrameCount = 0;
    }
  }

  /**
   * 创建轨迹控制栏
   */
  createTrajectoryControls(container) {
    // 播放/暂停按钮
    this.playBtn = container.createEl("button", { text: "▶️ 播放", cls: "play-btn" });
    this.playBtn.onclick = () => {
      if (this.trajectoryPlayer.isPlaying) {
        this.trajectoryPlayer.pause();
        this.playBtn.textContent = "▶️ 播放";
      } else {
        this.trajectoryPlayer.play();
        this.playBtn.textContent = "⏸️ 暂停";
      }
    };

    // 停止按钮
    const stopBtn = container.createEl("button", { text: "⏹️ 停止", cls: "stop-btn" });
    stopBtn.onclick = () => {
      this.trajectoryPlayer.stop();
      this.playBtn.textContent = "▶️ 播放";
      this.updateFrameInfo();
    };

    // 上一帧
    const prevBtn = container.createEl("button", { text: "⏮️", cls: "prev-btn" });
    prevBtn.onclick = () => {
      this.trajectoryPlayer.prevFrame();
      this.updateFrameInfo();
    };

    // 下一帧
    const nextBtn = container.createEl("button", { text: "⏭️", cls: "next-btn" });
    nextBtn.onclick = () => {
      this.trajectoryPlayer.nextFrame();
      this.updateFrameInfo();
    };

    // 帧信息
    this.frameInfo = container.createSpan({ cls: "frame-info" });
    this.frameInfo.textContent = "帧: 0 / 0";

    // 速度控制
    const speedLabel = container.createSpan({ text: "速度:" });
    const speedSlider = container.createEl("input", {
      type: "range",
      cls: "speed-slider",
    });
    speedSlider.min = "0.5";
    speedSlider.max = "5";
    speedSlider.step = "0.5";
    speedSlider.value = "1";
    speedSlider.oninput = () => {
      this.trajectoryPlayer.setSpeed(parseFloat(speedSlider.value));
    };
  }

  /**
   * 更新帧信息显示
   */
  updateFrameInfo() {
    if (this.frameInfo && this.trajectoryPlayer) {
      const current = this.trajectoryPlayer.getCurrentFrame() + 1;
      const total = this.trajectoryPlayer.getFrameCount();
      this.frameInfo.textContent = `帧: ${current} / ${total}`;
    }
  }

  /**
   * 显示轨迹控制栏
   */
  showTrajectoryControls() {
    if (this.trajectoryControls) {
      this.trajectoryControls.show();
      this.updateFrameInfo();
    }
  }

  /**
   * 显示收藏列表
   */
  showFavoritesList(smilesInput) {    // 读取收藏列表
    const favorites = JSON.parse(localStorage.getItem("molecule3d_favorites") || "[]");
    
    if (favorites.length === 0) {
      new Notice("收藏列表为空", 2000);
      return;
    }

    // 创建模态框显示收藏列表
    const { Modal } = require("obsidian");
    const listModal = new Modal(this.app);
    listModal.setTitle("⭐ 收藏的分子");
    
    const content = listModal.contentEl;
    content.empty();

    // 创建列表
    const listEl = content.createDiv({ cls: "favorites-list" });
    
    favorites.forEach((fav, index) => {
      const item = listEl.createDiv({ cls: "favorite-item" });
      
      // SMILES 文本
      const smilesText = item.createSpan({ cls: "favorite-smiles" });
      smilesText.textContent = fav.smiles;
      smilesText.title = fav.smiles;
      
      // 加载按钮
      const loadBtn = item.createEl("button", { text: "加载", cls: "load-fav-btn" });
      loadBtn.onclick = () => {
        smilesInput.value = fav.smiles;
        // 触发加载
        smilesInput.dispatchEvent(new Event("change"));
        listModal.close();
      };

      // 删除按钮
      const deleteBtn = item.createEl("button", { text: "删除", cls: "delete-fav-btn" });
      deleteBtn.onclick = () => {
        favorites.splice(index, 1);
        localStorage.setItem("molecule3d_favorites", JSON.stringify(favorites));
        item.remove();
        new Notice("已删除", 1500);
      };
    });

    // 清空按钮
    const clearBtn = content.createEl("button", { text: "🗑️ 清空所有", cls: "clear-all-btn" });
    clearBtn.style.marginTop = "12px";
    clearBtn.onclick = () => {
      localStorage.removeItem("molecule3d_favorites");
      listModal.close();
      new Notice("已清空收藏列表", 2000);
    };

    listModal.open();
  }

  async onClose() {
    if (this.viewer) {
      this.viewer.destroy();
    }
    this.contentEl.empty();
  }
}

// 导出全局变量
window.Molecule3DModalViewer = Molecule3DModalViewer;
window.Molecule3DModal = Molecule3DModal;
