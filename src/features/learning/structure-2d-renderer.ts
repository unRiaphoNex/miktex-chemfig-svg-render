// ========== 2D 结构绘制器 (v17.5.0) ==========
// 基于 SVG 的 2D 化学结构绘制
// 支持：从 SMILES 生成 2D SVG、导出图片、插入笔记

class Structure2DRenderer {
  /**
   * 从 SMILES 生成 2D SVG
   */
  static async renderFromSmiles(smiles, options = {}) {
    if (typeof OCL === "undefined") {
      throw new Error("OCL 未加载");
    }

    try {
      const mol = OCL.Molecule.fromSmiles(smiles);
      return this.renderFromMolecule(mol, options);
    } catch (e) {
      throw new Error(`SMILES 解析失败: ${e.message}`);
    }
  }

  /**
   * 从 OCL Molecule 生成 2D SVG
   */
  static renderFromMolecule(mol, options = {}) {
    const width = options.width || 400;
    const height = options.height || 300;
    const background = options.background || "white";

    // 使用 OCL 生成 SVG
    const svg = mol.toSVG(width, height);

    // 添加背景
    const styledSvg = svg.replace(
      "<svg ",
      `<svg style="background-color: ${background}; width: 100%; height: auto;" `
    );

    return {
      svg: styledSvg,
      width: width,
      height: height,
    };
  }

  /**
   * 生成 2D 结构 HTML 元素
   */
  static createSVGElement(smiles, options = {}) {
    const container = document.createElement("div");
    container.className = "molecule-2d-container";
    
    try {
      const result = this.renderFromSmiles(smiles, options);
      container.innerHTML = result.svg;
      container.dataset.smiles = smiles;
    } catch (e) {
      container.innerHTML = `<div class="render-error">渲染失败: ${e.message}</div>`;
    }

    return container;
  }

  /**
   * 导出为 PNG
   */
  static async exportToPNG(smiles, options = {}) {
    const result = this.renderFromSmiles(smiles, options);
    
    // 创建 canvas
    const canvas = document.createElement("canvas");
    const scale = options.scale || 2; // 2x 分辨率
    canvas.width = result.width * scale;
    canvas.height = result.height * scale;
    
    const ctx = canvas.getContext("2d");
    
    // 绘制背景
    ctx.fillStyle = options.background || "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 加载 SVG 到 Image
    const img = new Image();
    const svgBlob = new Blob([result.svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(svgBlob);
    
    return new Promise((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        
        canvas.toBlob((blob) => {
          resolve(blob);
        }, "image/png");
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  /**
   * 插入到笔记中
   */
  static async insertToNote(editor, smiles, options = {}) {
    try {
      const result = this.renderFromSmiles(smiles, options);
      
      // 创建 markdown 代码块
      const markdown = `\`\`\`chem
${smiles}
\`\`\``;
      
      // 插入到编辑器
      const cursor = editor.getCursor();
      editor.replaceRange(markdown, cursor);
      
      return true;
    } catch (e) {
      console.error("插入失败:", e);
      return false;
    }
  }
}

// 导出全局变量
window.Structure2DRenderer = Structure2DRenderer;
