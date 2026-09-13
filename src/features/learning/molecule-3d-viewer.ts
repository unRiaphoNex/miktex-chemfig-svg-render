// ========== 3D 结构可视化 (精简版) ==========
// 集成 3Dmol.js 展示化合物 3D 结构
// 核心功能：SMILES/PDB 加载、样式切换、测量、导出

class Molecule3DViewer {
  constructor(container, options = {}) {
    this.container = container;
    this.options = {
      model: options.model || "stick",
      colorScheme: options.colorScheme || "default",
      performance: options.performance || "auto",
    };
    this.viewer = null;
    this.currentMol = null;
    this.atomCount = 0;
    this.cache = new Map();
    this.maxCacheSize = 20;
    this.measurements = [];
  }

  // ========== 初始化 ==========

  async init() {
    if (typeof $3Dmol === "undefined") {
      throw new Error("3Dmol.js 未加载");
    }

    this.viewer = $3Dmol.createViewer(this.container, {
      backgroundColor: "white",
    });

    // 原子点击事件
    this.viewer.setClickable({}, true, (atom) => {
      if (this.measureMode) return;
      this.onAtomClick?.(this.formatAtomInfo(atom));
    });
  }

  // ========== 加载分子 ==========

  async loadFromSmiles(smiles) {
    // 检查缓存
    if (this.cache.has(smiles)) {
      this.viewer.clear();
      this.viewer.addModel(this.cache.get(smiles), "smi");
      this.applyStyle();
      this.viewer.zoomTo();
      this.viewer.render();
      return;
    }

    this.viewer.clear();
    this.viewer.addModel(smiles, "smi");
    this.applyStyle();
    this.viewer.zoomTo();
    this.viewer.render();

    this.addToCache(smiles);
    this.atomCount = this.viewer.getModel().numAtoms();
    this.autoAdjustDisplay();
  }

  async loadFromPDB(pdbId) {
    const url = `https://files.rcsb.org/view/${pdbId.toUpperCase()}.pdb`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`PDB ID 未找到: ${pdbId}`);

    const pdbText = await response.text();
    this.viewer.clear();
    this.viewer.addModel(pdbText, "pdb");
    this.viewer.setStyle({}, { cartoon: { color: "spectrum" } });
    this.viewer.zoomTo();
    this.viewer.render();

    this.currentMol = pdbText;
    this.atomCount = this.viewer.getModel().numAtoms();
  }

  loadFromText(text, format = "mol") {
    this.viewer.clear();
    this.viewer.addModel(text, format);
    this.applyStyle();
    this.viewer.zoomTo();
    this.viewer.render();
    this.atomCount = this.viewer.getModel().numAtoms();
    this.autoAdjustDisplay();
  }

  // ========== 样式控制 ==========

  applyStyle() {
    const style = this.options.model;
    const cs = this.options.colorScheme;

    const styles = {
      stick: () => this.viewer.setStyle({}, { stick: { radius: 0.15, colorscheme: cs }, sphere: { scale: 0.25 } }),
      sphere: () => this.viewer.setStyle({}, { sphere: { scale: 0.3, colorscheme: cs } }),
      line: () => this.viewer.setStyle({}, { line: {} }),
      cartoon: () => this.viewer.setStyle({}, { cartoon: { color: "spectrum" } }),
      ribbon: () => this.viewer.setStyle({}, { cartoon: { color: "spectrum", arrows: true } }),
      chain: () => this.viewer.setStyle({}, { cartoon: { color: "chain" } }),
      residue: () => this.viewer.setStyle({}, { cartoon: { color: "residue" } }),
      "b-factor": () => this.viewer.setStyle({}, { cartoon: { color: "b-factor" } }),
      surface: () => {
        this.viewer.setStyle({}, { stick: { radius: 0.1 } });
        this.viewer.addSurface($3Dmol.SurfaceType.VDW, { opacity: 0.7, colorscheme: cs });
      },
    };

    (styles[style] || styles.stick)();
    this.viewer.render();
  }

  setModel(model) {
    this.options.model = model;
    this.applyStyle();
  }

  setColorScheme(scheme) {
    this.options.colorScheme = scheme;
    this.applyStyle();
  }

  setBackgroundColor(color) {
    this.viewer?.setBackgroundColor(color);
    this.viewer?.render();
  }

  // ========== 视图控制 ==========

  spin(on = true) {
    this.viewer?.spin(on);
  }

  setSpinSpeed(speed) {
    this.viewer?.spin({ speed });
  }

  resetView() {
    this.viewer?.zoomTo();
    this.viewer?.render();
  }

  showAxes(show = true) {
    if (show) this.viewer?.addAxis({});
    else this.applyStyle();
    this.viewer?.render();
  }

  showGrid(show = true) {
    if (show) this.viewer?.addGrid({});
    else this.applyStyle();
    this.viewer?.render();
  }

  // ========== 性能优化 ==========

  autoAdjustDisplay() {
    if (!this.currentMol) return;
    const count = this.atomCount;

    if (count > 10000) {
      this.viewer.setStyle({}, { cartoon: { color: "spectrum", opacity: 0.8 } });
      new Notice(`超大分子 (${count} 原子)：性能模式`, 2500);
    } else if (count > 5000) {
      this.viewer.setStyle({}, { cartoon: { color: "spectrum" } });
      new Notice(`大分子 (${count} 原子)：卡通模型`, 2000);
    } else if (count > 1000) {
      this.viewer.setStyle({}, { stick: { radius: 0.1 } });
    }
  }

  // ========== 导出功能 ==========

  exportImage(width, height) {
    if (!this.viewer) return;
    const uri = width && height ? this.viewer.pngURI(width, height) : this.viewer.pngURI();
    const link = document.createElement("a");
    link.download = "molecule-3d.png";
    link.href = uri;
    link.click();
  }

  exportMolecule(format = "pdb") {
    if (!this.viewer) return;
    const model = this.viewer.getModel();
    const content = model[format] || model.pdb;
    const blob = new Blob([content], { type: `chemical/x-${format}` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `molecule.${format}`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  exportMeasurements() {
    if (!this.measurements.length) {
      new Notice("没有测量结果", 2000);
      return;
    }
    let csv = "类型,原子编号,数值,单位\n";
    this.measurements.forEach(m => {
      csv += `${m.type},"${m.atoms.join("-")}",${m.value},${m.unit}\n`;
    });
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = "measurements.csv";
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  copyMeasurementsToClipboard() {
    if (!this.measurements.length) return;
    let text = "类型\t原子编号\t数值\t单位\n";
    this.measurements.forEach(m => {
      text += `${m.type}\t${m.atoms.join("-")}\t${m.value}\t${m.unit}\n`;
    });
    navigator.clipboard.writeText(text).then(() => {
      new Notice("已复制到剪贴板", 2000);
    });
  }

  // ========== 测量工具 ==========

  enableMeasurement(type = "distance") {
    this.measureMode = true;
    this.measureType = type;
    this.measurePoints = [];
    this.labels = [];

    this.viewer.setClickable({}, true, (atom) => {
      if (!this.measureMode) return;

      this.measurePoints.push(atom);
      this.viewer.setStyle({ atomindex: atom.index }, {
        stick: { radius: 0.15 },
        sphere: { scale: 0.5, color: "yellow" },
      });
      this.viewer.render();

      const need = { distance: 2, angle: 3, dihedral: 4 };
      if (this.measurePoints.length === need[this.measureType]) {
        this.calculateAndDraw(...this.measurePoints);
        this.measurePoints = [];
      }
    });
  }

  disableMeasurement() {
    this.measureMode = false;
    this.measurePoints = [];
    this.labels.forEach(l => l.remove());
    this.labels = [];
    this.viewer.setClickable({}, false);
    this.viewer.render();
  }

  setMeasureType(type) {
    this.measureType = type;
    this.measurePoints = [];
  }

  calculateAndDraw(...atoms) {
    if (this.measureType === "distance" && atoms.length === 2) {
      const [a1, a2] = atoms;
      const dist = this.calcDistance(a1, a2);
      this.addLabel(`${dist.toFixed(2)} Å`, this.midpoint(a1, a2), "red");
      this.addLine(a1, a2, "red");
      this.measurements.push({ type: "距离", atoms: [a1.index, a2.index], value: dist.toFixed(2), unit: "Å" });
    } else if (this.measureType === "angle" && atoms.length === 3) {
      const [a1, a2, a3] = atoms;
      const angle = this.calcAngle(a1, a2, a3);
      this.addLabel(`${angle.toFixed(1)}°`, a2, "blue");
      this.addLine(a1, a2, "blue");
      this.addLine(a2, a3, "blue");
      this.measurements.push({ type: "角度", atoms: [a1.index, a2.index, a3.index], value: angle.toFixed(1), unit: "°" });
    } else if (this.measureType === "dihedral" && atoms.length === 4) {
      const [a1, a2, a3, a4] = atoms;
      const dihedral = this.calcDihedral(a1, a2, a3, a4);
      const mid = this.midpoint(a2, a3);
      this.addLabel(`${dihedral.toFixed(1)}°`, mid, "green");
      this.addLine(a1, a2, "green");
      this.addLine(a2, a3, "green", 3);
      this.addLine(a3, a4, "green");
      this.measurements.push({ type: "二面角", atoms: [a1.index, a2.index, a3.index, a4.index], value: dihedral.toFixed(1), unit: "°" });
    }
    this.applyStyle();
  }

  // ========== 计算工具 ==========

  calcDistance(a1, a2) {
    return Math.sqrt((a1.x-a2.x)**2 + (a1.y-a2.y)**2 + (a1.z-a2.z)**2);
  }

  calcAngle(a1, a2, a3) {
    const v1 = { x: a1.x-a2.x, y: a1.y-a2.y, z: a1.z-a2.z };
    const v2 = { x: a3.x-a2.x, y: a3.y-a2.y, z: a3.z-a2.z };
    const dot = v1.x*v2.x + v1.y*v2.y + v1.z*v2.z;
    const m1 = Math.sqrt(v1.x**2 + v1.y**2 + v1.z**2);
    const m2 = Math.sqrt(v2.x**2 + v2.y**2 + v2.z**2);
    return Math.acos(Math.max(-1, Math.min(1, dot/(m1*m2)))) * 180 / Math.PI;
  }

  calcDihedral(a1, a2, a3, a4) {
    const b1 = { x: a2.x-a1.x, y: a2.y-a1.y, z: a2.z-a1.z };
    const b2 = { x: a3.x-a2.x, y: a3.y-a2.y, z: a3.z-a2.z };
    const b3 = { x: a4.x-a3.x, y: a4.y-a3.y, z: a4.z-a3.z };
    const n1 = this.cross(b1, b2);
    const n2 = this.cross(b2, b3);
    const m1 = this.cross(n1, this.normalize(b2));
    const x = this.dot(n1, n2);
    const y = this.dot(m1, n2);
    let angle = Math.atan2(y, x) * 180 / Math.PI;
    return angle < 0 ? angle + 360 : angle;
  }

  cross(a, b) {
    return { x: a.y*b.z-a.z*b.y, y: a.z*b.x-a.x*b.z, z: a.x*b.y-a.y*b.x };
  }

  dot(a, b) {
    return a.x*b.x + a.y*b.y + a.z*b.z;
  }

  normalize(v) {
    const m = Math.sqrt(v.x**2 + v.y**2 + v.z**2);
    return { x: v.x/m, y: v.y/m, z: v.z/m };
  }

  midpoint(a1, a2) {
    return { x: (a1.x+a2.x)/2, y: (a1.y+a2.y)/2, z: (a1.z+a2.z)/2 };
  }

  addLabel(text, pos, color) {
    const label = this.viewer.addLabel(text, {
      position: pos,
      fontSize: 14,
      fontColor: color,
      backgroundColor: "white",
      backgroundOpacity: 0.8,
    });
    this.labels.push(label);
  }

  addLine(a1, a2, color, width = 2) {
    this.viewer.addLine({
      start: { x: a1.x, y: a1.y, z: a1.z },
      end: { x: a2.x, y: a2.y, z: a2.z },
      color,
      linewidth: width,
    });
  }

  formatAtomInfo(atom) {
    return {
      index: atom.index,
      element: atom.elem,
      x: atom.x.toFixed(3),
      y: atom.y.toFixed(3),
      z: atom.z.toFixed(3),
      residue: atom.resn || "-",
      chain: atom.chain || "-",
    };
  }

  // ========== 缓存 ==========

  addToCache(key, data) {
    if (this.cache.size >= this.maxCacheSize) {
      this.cache.delete(this.cache.keys().next().value);
    }
    this.cache.set(key, data || key);
  }

  clearCache() {
    this.cache.clear();
  }

  // ========== 销毁 ==========

  destroy() {
    this.viewer?.clear();
    this.viewer = null;
  }
}

// ========== 3D 查看模态框 ==========

class Molecule3DModal extends Modal {
  constructor(app, smiles = "") {
    super(app);
    this.smiles = smiles;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("molecule-3d-modal");

    // 标题栏
    const header = contentEl.createDiv({ cls: "3d-header" });
    header.createEl("h3", { text: "🧪 3D 分子查看器" });

    // 工具栏
    const toolbar = contentEl.createDiv({ cls: "3d-toolbar" });

    // SMILES 输入
    this.smilesInput = toolbar.createEl("input", {
      type: "text",
      placeholder: "输入 SMILES...",
      value: this.smiles,
    });
    this.loadBtn = toolbar.createEl("button", { text: "加载" });

    // PDB 输入
    this.pdbInput = toolbar.createEl("input", {
      type: "text",
      placeholder: "PDB ID",
    });
    this.pdbLoadBtn = toolbar.createEl("button", { text: "PDB" });

    // 模型切换
    this.modelSelect = toolbar.createEl("select");
    ["stick", "sphere", "line", "cartoon", "surface"].forEach(m => {
      this.modelSelect.createEl("option", { text: m, value: m });
    });

    // 背景切换
    this.bgSelect = toolbar.createEl("select");
    [["white", "白"], ["black", "黑"], ["transparent", "透明"]].forEach(([v, t]) => {
      this.bgSelect.createEl("option", { text: t, value: v });
    });

    // 功能按钮
    this.spinBtn = toolbar.createEl("button", { text: "旋转" });
    this.resetBtn = toolbar.createEl("button", { text: "重置" });
    this.measureBtn = toolbar.createEl("button", { text: "测量" });
    this.exportBtn = toolbar.createEl("button", { text: "导出" });

    // 原子信息面板
    this.infoPanel = contentEl.createDiv({ cls: "3d-info-panel" });
    this.infoPanel.hide();

    // 3D 容器
    this.viewerContainer = contentEl.createDiv({ cls: "3d-viewer-container" });

    // 状态栏
    this.statusBar = contentEl.createDiv({ cls: "3d-status-bar" });
    this.statusBar.innerHTML = `
      <span>原子: <b class="atom-count">-</b></span>
      <span>模式: <b class="mode-name">-</b></span>
    `;

    // 初始化 viewer
    this.viewer = new Molecule3DViewer(this.viewerContainer);
    await this.viewer.init();

    // 原子点击回调
    this.viewer.onAtomClick = (info) => {
      this.infoPanel.show();
      this.infoPanel.innerHTML = `
        <b>原子 ${info.index}</b><br>
        元素: ${info.element}<br>
        坐标: (${info.x}, ${info.y}, ${info.z})
      `;
    };

    // 自动加载
    if (this.smiles) {
      await this.viewer.loadFromSmiles(this.smiles);
      this.updateStatus();
    }

    // 事件绑定
    this.bindEvents();
  }

  bindEvents() {
    this.loadBtn.onclick = async () => {
      const s = this.smilesInput.value.trim();
      if (!s) return;
      await this.viewer.loadFromSmiles(s);
      this.updateStatus();
    };

    this.pdbLoadBtn.onclick = async () => {
      const id = this.pdbInput.value.trim();
      if (!id) return;
      await this.viewer.loadFromPDB(id);
      this.updateStatus();
    };

    this.modelSelect.onchange = () => {
      this.viewer.setModel(this.modelSelect.value);
      this.updateStatus();
    };

    this.bgSelect.onchange = () => {
      this.viewer.setBackgroundColor(this.bgSelect.value);
    };

    this.spinBtn.onclick = () => this.viewer.spin();
    this.resetBtn.onclick = () => this.viewer.resetView();

    this.measureBtn.onclick = () => {
      if (this.measureEnabled) {
        this.viewer.disableMeasurement();
        this.measureBtn.removeClass("active");
      } else {
        this.viewer.enableMeasurement("distance");
        this.measureBtn.addClass("active");
      }
      this.measureEnabled = !this.measureEnabled;
    };

    this.exportBtn.onclick = () => {
      this.viewer.exportImage();
    };
  }

  updateStatus() {
    this.statusBar.querySelector(".atom-count").textContent = this.viewer.atomCount;
    this.statusBar.querySelector(".mode-name").textContent = this.viewer.options.model;
  }

  onClose() {
    this.viewer?.destroy();
    this.contentEl.empty();
  }
}

// 导出全局变量
window.Molecule3DViewer = Molecule3DViewer;
window.Molecule3DModal = Molecule3DModal;
