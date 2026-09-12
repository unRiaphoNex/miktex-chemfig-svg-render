// ========== 3D 分子可视化模块 (v17.1.0) ==========
// 基于 3Dmol.js 的 3D 分子查看器
// 支持: SMILES → 3D 模型、旋转缩放、原子点击、2D/3D 切换
// v17.1.0: 添加加载进度条优化

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
  static async load3DMol(onProgress?: (progress: number, message: string) => void) {
    if (this.is3DMolAvailable()) {
      if (onProgress) onProgress(100, "3Dmol.js 已加载");
      return true;
    }

    if (onProgress) onProgress(20, "正在加载 3Dmol.js...");

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://3Dmol.org/build/3Dmol-min.js";
      script.onload = () => {
        console.log("[Chemfig-SVG] 3Dmol.js 加载成功");
        if (onProgress) onProgress(50, "3Dmol.js 加载完成");
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
   * 创建加载进度条 UI
   */
  static createLoadingUI(container) {
    container.empty();
    
    const loadingEl = container.createDiv({ cls: "mol3d-loading-container" });
    
    // 加载图标
    const spinnerEl = loadingEl.createDiv({ cls: "mol3d-loading-spinner" });
    spinnerEl.createEl("div", { cls: "spinner-ring" });
    
    // 加载文字
    const textEl = loadingEl.createDiv({ cls: "mol3d-loading-text" });
    textEl.textContent = "正在初始化...";
    
    // 进度条容器
    const progressBarEl = loadingEl.createDiv({ cls: "mol3d-progress-bar-container" });
    const progressFillEl = progressBarEl.createDiv({ cls: "mol3d-progress-bar-fill" });
    
    // 进度百分比
    const progressPercentEl = loadingEl.createDiv({ cls: "mol3d-progress-percent" });
    progressPercentEl.textContent = "0%";
    
    return {
      update: (progress: number, message: string) => {
        progressFillEl.style.width = `${progress}%`;
        textEl.textContent = message;
        progressPercentEl.textContent = `${Math.round(progress)}%`;
      },
      finish: () => {
        loadingEl.remove();
      }
    };
  }

  /**
   * 在容器中渲染 3D 分子
   * @param {HTMLElement} container - 目标容器
   * @param {string} smiles - SMILES 字符串
   * @param {Object} options - 渲染选项
   */
  static async render3D(container, smiles, options = {}) {
    container.empty();

    // 创建加载 UI
    const loadingUI = this.createLoadingUI(container);

    try {
      // 阶段 1: 加载 3Dmol.js
      await this.load3DMol((progress, message) => {
        // 将 20-50% 映射到总进度的 20-40%
        loadingUI.update(20 + (progress - 20) * 0.4, message);
      });

      loadingUI.update(50, "正在解析分子结构...");

      // 创建 3D 查看器
      const viewer = window.$3Dmol.createViewer(container, {
        backgroundColor: options.backgroundColor || "white",
      });

      loadingUI.update(60, "正在生成 3D 模型...");

      // 添加分子 - 使用 SMILES 字符串 (3Dmol 会自动通过 Cactus 服务器生成 3D 坐标)
      try {
        // 先尝试直接从 SMILES 加载
        viewer.addModel(smiles, "smi");
        loadingUI.update(80, "正在渲染分子结构...");
      } catch (smilesError) {
        console.warn("[Chemfig-SVG] 直接 SMILES 加载失败, 尝试通过 PubChem 获取:", smilesError);
        // 备用方案: 通过 PubChem API 获取
        loadingUI.update(65, "正在从 PubChem 获取 3D 结构...");
        try {
          await this.loadFromPubChem(viewer, smiles, (progress) => {
            // 将 PubChem 进度映射到 65-75%
            loadingUI.update(65 + progress * 0.1, "正在下载 3D 结构数据...");
          });
        } catch (pubchemError) {
          throw new Error("SMILES 和 PubChem 都加载失败: " + smilesError.message);
        }
      }

      // 设置样式
      loadingUI.update(85, "正在设置分子样式...");
      const style = options.style || "stick"; // stick / sphere / line
      if (style === "stick") {
        viewer.setStyle({}, { stick: {}, sphere: { scale: 0.3 } });
      } else if (style === "sphere") {
        viewer.setStyle({}, { sphere: { scale: 0.8 } });
      } else if (style === "line") {
        viewer.setStyle({}, { line: {} });
      }

      // 自动缩放
      loadingUI.update(95, "正在调整视图...");
      viewer.zoomTo();
      viewer.render();

      loadingUI.update(100, "加载完成!");
      
      // 短暂延迟后隐藏加载 UI
      setTimeout(() => {
        loadingUI.finish();
      }, 300);

      // 点击原子显示信息
      viewer.setClickable({}, true, (atom) => {
        this.showAtomInfo(atom, container);
      });

      return viewer;
    } catch (e) {
      loadingUI.finish();
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
  static async loadFromPubChem(viewer, smiles, onProgress?: (progress: number) => void) {
    if (onProgress) onProgress(20);
    
    // 先通过 SMILES 获取 CID, 再获取 SDF
    const encodeSmiles = encodeURIComponent(smiles);
    const cidUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeSmiles}/cids/JSON`;

    if (onProgress) onProgress(40);
    
    const cidResponse = await fetch(cidUrl);
    if (!cidResponse.ok) throw new Error("PubChem CID 查询失败");

    const cidData = await cidResponse.json();
    if (!cidData.IdentifierList || !cidData.IdentifierList.CID || cidData.IdentifierList.CID.length === 0) {
      throw new Error("PubChem 未找到该化合物");
    }

    const cid = cidData.IdentifierList.CID[0];
    
    if (onProgress) onProgress(60);
    
    const sdfUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/SDF?record_type=3d`;

    const sdfResponse = await fetch(sdfUrl);
    if (!sdfResponse.ok) throw new Error("PubChem 3D SDF 获取失败");

    const sdfText = await sdfResponse.text();
    
    if (onProgress) onProgress(90);
    
    viewer.addModel(sdfText, "sdf");
    
    if (onProgress) onProgress(100);
  }

  /**
   * 显示原子信息
   */
  static showAtomInfo(atom, container) {
    let infoEl = container.querySelector(".mol3d-atom-info");
    if (!infoEl) {
      infoEl = container.createDiv({ cls: "mol3d-atom-info" });
    }

    const elementNames = {
      H: "氢", C: "碳", N: "氮", O: "氧", F: "氟", P: "磷", S: "硫",
      Cl: "氯", Br: "溴", I: "碘",
    };

    const element = atom.elem || "未知";
    const name = elementNames[element] || element;

    infoEl.empty();
    infoEl.createEl("div", {
      text: `原子: ${element} (${name})`,
      cls: "atom-info-title"
    });
    infoEl.createEl("div", {
      text: `位置: (${atom.x?.toFixed(2)}, ${atom.y?.toFixed(2)}, ${atom.z?.toFixed(2)})`,
      cls: "atom-info-coords"
    });

    // 自动隐藏
    clearTimeout(this._atomInfoTimeout);
    this._atomInfoTimeout = setTimeout(() => {
      if (infoEl) infoEl.empty();
    }, 3000);
  }

  /**
   * 切换分子样式
   */
  static switchStyle(viewer, style) {
    if (!viewer) return;
    
    if (style === "stick") {
      viewer.setStyle({}, { stick: {}, sphere: { scale: 0.3 } });
    } else if (style === "sphere") {
      viewer.setStyle({}, { sphere: { scale: 0.8 } });
    } else if (style === "line") {
      viewer.setStyle({}, { line: {} });
    }
    
    viewer.render();
  }

  /**
   * 导出当前视图为 PNG
   */
  static exportPNG(viewer, filename = "molecule-3d.png") {
    if (!viewer) return;
    
    try {
      const dataURL = viewer.pngURI();
      const link = document.createElement("a");
      link.download = filename;
      link.href = dataURL;
      link.click();
    } catch (e) {
      console.error("[Chemfig-SVG] PNG 导出失败:", e);
    }
  }
}

// 导出全局变量
// Molecule3DViewer
