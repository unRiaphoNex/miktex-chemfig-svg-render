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

// 导出全局变量
// Molecule3DViewer, Molecule3DModal, PRESET_MOLECULES, MOL3D_CSS
