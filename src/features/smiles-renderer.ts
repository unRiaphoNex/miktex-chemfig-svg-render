// ========== SMILES 渲染模块 (v11.9.0) ==========
// 使用 OpenChemLib (OCL) 纯前端渲染 SMILES
// 支持: 代码块渲染 + 内联渲染 + 理化性质

/**
 * SMILES 渲染类
 * 依赖: OpenChemLib (OCL) 全局对象
 */
class SMILESRenderer {
  /**
   * 检查 OCL 是否可用
   */
  static isOCLAvailable() {
    return (
      typeof window !== "undefined" &&
      window.OCL &&
      typeof window.OCL.getMolecularFormula === "function"
    );
  }

  /**
   * 获取分子基本信息
   * @param {string} smiles - SMILES 字符串
   * @returns {Object|null} 分子信息
   */
  static getMoleculeInfo(smiles) {
    if (!this.isOCLAvailable()) return null;

    try {
      const OCL = window.OCL;
      const mol = OCL.Molecule.fromSmiles(smiles);

      const info = {
        smiles: smiles,
        formula: OCL.getMolecularFormula(smiles),
        molecularWeight: OCL.getMolecularWeight(smiles),
      };

      // 尝试获取更多性质 (如果 OCL 支持)
      if (typeof OCL.getLogP === "function") {
        info.logP = OCL.getLogP(smiles);
      }
      if (mol && typeof mol.getAtomCount === "function") {
        info.heavyAtomCount = mol.getAtomCount();
      }

      return info;
    } catch (e) {
      console.warn("[Chemfig-SVG] SMILES 解析失败:", e.message);
      return null;
    }
  }

  /**
   * 渲染 SMILES 为 SVG
   * @param {string} smiles - SMILES 字符串
   * @param {Object} options - 渲染选项
   * @returns {string|null} SVG 字符串
   */
  static renderToSVG(smiles, options = {}) {
    if (!this.isOCLAvailable()) return null;

    try {
      const OCL = window.OCL;
      const width = options.width || 300;
      const height = options.height || 200;

      // 使用 OCL 的 SVG 绘制功能
      if (typeof OCL.SVGRenderer === "function") {
        const renderer = new OCL.SVGRenderer(width, height);
        const mol = OCL.Molecule.fromSmiles(smiles);
        return renderer.getSVG(mol);
      }

      // 降级: 如果没有 SVGRenderer, 返回占位符
      return `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#f5f5f5" stroke="#ccc"/>
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#666">
          SMILES: ${smiles}
        </text>
      </svg>`;
    } catch (e) {
      console.warn("[Chemfig-SVG] SMILES 渲染失败:", e.message);
      return null;
    }
  }

  /**
   * 渲染 SMILES 到 DOM 容器
   * @param {HTMLElement} container - 目标容器
   * @param {string} smiles - SMILES 字符串
   * @param {Object} options - 渲染选项
   */
  static renderToContainer(container, smiles, options = {}) {
    container.empty();

    // 显示加载中
    const loading = container.createDiv({ cls: "smiles-loading" });
    loading.textContent = "渲染中...";

    // 异步渲染 (避免阻塞 UI)
    setTimeout(() => {
      const info = this.getMoleculeInfo(smiles);

      if (!info) {
        container.empty();
        container.createEl("div", {
          text: "SMILES 解析失败，请检查输入",
          cls: "smiles-error",
        });
        return;
      }

      container.empty();

      // 结构式预览
      const svg = this.renderToSVG(smiles, options);
      if (svg) {
        const svgContainer = container.createDiv({ cls: "smiles-svg-container" });
        svgContainer.innerHTML = svg;
      }

      // 分子信息面板
      const infoPanel = container.createDiv({ cls: "smiles-info-panel" });
      infoPanel.createEl("div", {
        text: `分子式: ${info.formula || "未知"}`,
        cls: "smiles-info-item",
      });
      if (info.molecularWeight) {
        infoPanel.createEl("div", {
          text: `分子量: ${info.molecularWeight.toFixed(2)}`,
          cls: "smiles-info-item",
        });
      }
      if (info.logP) {
        infoPanel.createEl("div", {
          text: `LogP: ${info.logP.toFixed(2)}`,
          cls: "smiles-info-item",
        });
      }
      if (info.heavyAtomCount) {
        infoPanel.createEl("div", {
          text: `重原子数: ${info.heavyAtomCount}`,
          cls: "smiles-info-item",
        });
      }
      infoPanel.createEl("div", {
        text: `SMILES: ${smiles}`,
        cls: "smiles-info-item smiles-smiles",
      });
    }, 100);
  }

  /**
   * 渲染内联 SMILES 为小图标
   * 语法: $smiles:c1ccccc1$
   */
  static renderInline(el) {
    if (!this.isOCLAvailable()) return;

    // 匹配 $smiles:...$ 语法
    const regex = /\$smiles:([^$]+)\$/g;
    const html = el.innerHTML;

    if (!regex.test(html)) return;

    // 替换所有匹配项
    el.innerHTML = html.replace(regex, (match, smiles) => {
      const svg = this.renderToSVG(smiles, { width: 80, height: 50 });
      if (svg) {
        return `<span class="smiles-inline" title="${smiles}">${svg}</span>`;
      }
      return match;
    });
  }
}

// ========== SMILES 代码块处理器 ==========
/**
 * 在阅读模式下渲染 ```smiles 代码块
 * 用法:
 * ```smiles
 * c1ccccc1
 * ```
 */
function registerSMILESProcessor(plugin) {
  if (!plugin.registerMarkdownCodeBlockProcessor) return;

  plugin.registerMarkdownCodeBlockProcessor(
    "smiles",
    (source, el, ctx) => {
      const smiles = source.trim();
      SMILESRenderer.renderToContainer(el, smiles);
    }
  );

  // ========== v11.9.0: 内联 SMILES 渲染 ==========
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    SMILESRenderer.renderInline(el);
  });

  console.log("[Chemfig-SVG] SMILES 代码块处理器已注册 (代码块 + 内联)");
}

// ========== SMILES CSS ==========
const SMILES_CSS = `
.smiles-loading {
  padding: 20px;
  text-align: center;
  color: var(--text-muted);
  font-size: 14px;
}
.smiles-error {
  padding: 12px;
  color: var(--text-error);
  background: var(--background-modifier-error);
  border-radius: 6px;
  font-size: 14px;
}
.smiles-svg-container {
  display: flex;
  justify-content: center;
  padding: 16px;
  background: var(--background-secondary);
  border-radius: 8px;
  margin-bottom: 12px;
}
.smiles-svg-container svg {
  max-width: 100%;
  height: auto;
}
.smiles-info-panel {
  font-size: 13px;
  color: var(--text-muted);
}
.smiles-info-item {
  margin: 4px 0;
}
.smiles-smiles {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}
.smiles-inline {
  display: inline-block;
  vertical-align: middle;
  margin: 0 4px;
  cursor: help;
  border-bottom: 1px dashed var(--text-muted);
}
.smiles-inline svg {
  display: block;
}
`;

// 导出全局变量
// SMILESRenderer, registerSMILESProcessor, SMILES_CSS
