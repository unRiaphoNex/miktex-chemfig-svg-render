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

    // 文件上传按钮
    const fileInput = controlBar.createEl("input", {
      type: "file",
      cls: "file-input",
    });
    fileInput.style.display = "none";
    fileInput.accept = ".mol,.sdf,.pdb,.xyz,.cif";

    const uploadBtn = controlBar.createEl("button", {
      text: "📁 上传文件",
      cls: "upload-btn",
    });

    // 模型切换
    const modelSelect = controlBar.createEl("select", { cls: "model-select" });
    modelSelect.createEl("option", { text: "球棍模型", value: "stick" });
    modelSelect.createEl("option", { text: "空间填充", value: "sphere" });
    modelSelect.createEl("option", { text: "卡通模型", value: "cartoon" });
    modelSelect.createEl("option", { text: "表面模型", value: "surface" });
    modelSelect.createEl("option", { text: "细棍模型", value: "licorice" });
    modelSelect.createEl("option", { text: "超球棍", value: "hyperball" });

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

    // 导出按钮
    const exportBtn = controlBar.createEl("button", {
      text: "📷 导出",
      cls: "export-btn",
    });

    // 原子信息面板
    this.infoPanel = contentEl.createDiv({ cls: "atom-info-panel" });
    this.infoPanel.hide();

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
        else if (ext === "xyz") format = "xyz";
        else if (ext === "sdf") format = "sdf";
        else if (ext === "cif") format = "cif";

        // 加载分子
        this.viewer.loadFromText(text, format);
        new Notice(`已加载: ${file.name}`, 2000);
      } catch (err) {
        new Notice(`文件加载失败: ${err.message}`, 3000);
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

    exportBtn.onclick = () => {
      this.viewer.exportImage();
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
