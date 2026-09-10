// ========== core/compiler.js - 编译逻辑 ==========

// v10.15.12: 编译缓存 (按代码哈希缓存结果, 避免重复编译)
const compileCache = new Map();
const COMPILE_CACHE_MAX = 50; // 最多缓存 50 条

/**
 * 获取缓存键 (代码+模式的哈希)
 */
function getCacheKey(code, mode) {
  return (
    mode +
    ":" +
    code.length +
    ":" +
    code.split("").reduce((a, b) => {
      a = (a << 5) - a + b.charCodeAt(0);
      return a & a;
    }, 0)
  );
}

/**
 * 从缓存获取编译结果
 */
function getCachedResult(key) {
  const entry = compileCache.get(key);
  if (entry) {
    entry.lastAccess = Date.now();
    return entry.result;
  }
  return null;
}

/**
 * 存入编译缓存
 */
function setCachedResult(key, result) {
  // LRU 淘汰
  if (compileCache.size >= COMPILE_CACHE_MAX) {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [k, v] of compileCache) {
      if (v.lastAccess < oldestTime) {
        oldestTime = v.lastAccess;
        oldestKey = k;
      }
    }
    if (oldestKey) compileCache.delete(oldestKey);
  }
  compileCache.set(key, { result, lastAccess: Date.now() });
}

/**
 * 清空编译缓存
 */
function clearCompileCache() {
  compileCache.clear();
}

// V2.0-iter: SVG 输出目录覆盖 (设置项 svgOutputFolder)。空 = 保持旧布局 svg_source/png_out。
let svgOutputFolderGlobal = "";
function setSvgOutputFolder(dir) {
  svgOutputFolderGlobal = String(dir || "").trim();
}

function wrapMiktex(code) {
  if (/\\documentclass/.test(code)) return code;
  let body = code;
  if (/\\arrow/.test(code) && !/\\schemestart/.test(code)) {
    body = "\\schemestart\n" + code + "\n\\schemestop";
  }
  return (
    "\\documentclass[border=4pt]{standalone}\n\\usepackage{chemfig}\n\\usepackage{tikz}\n\\usepackage{amsmath}\n\\begin{document}\n" +
    body +
    "\n\\end{document}"
  );
}

// ========== 常量 ==========

// v10.15.14: 检测代码中是否包含中文字符
function hasChineseChars(code) {
  return /[\u4e00-\u9fa5]/.test(code);
}

// v10.15.14: 将中文字符转换为 LaTeX 兼容格式
// 在 \arrow{->[中文][英文]} 等情况下，中文需要用 \text{} 包裹
function convertChineseToLatex(code) {
  if (!hasChineseChars(code)) return code;

  // 方案: 使用 xeCJK 或 CJKutf8
  // 由于我们使用 latex.exe (PDFLaTeX), 使用 CJKutf8 方案
  // 在 arrow 的上下标中，中文自动用 \text{} 包裹

  // 匹配 \arrow{->[中文][英文]} 中的中文条件
  // 将 [中文] 转换为 [\text{中文}]
  let result = code;

  // 匹配 arrow 语法中的上下标条件
  // \arrow{->[条件1][条件2]}
  result = result.replace(
    /\\arrow\{([^}]*)\[([^\]]*)\]\[([^\]]*)\]/g,
    (match, arrow, upper, lower) => {
      const upperConverted = hasChineseChars(upper) ? `\\text{${upper}}` : upper;
      const lowerConverted = hasChineseChars(lower) ? `\\text{${lower}}` : lower;
      return `\\arrow{${arrow}[${upperConverted}][${lowerConverted}]}`;
    }
  );

  // 处理其他位置的中文字符（如 \chemname{}{中文名称}）
  // 已经在 \text{} 中的不处理
  result = result.replace(/(?<!\\text\{)([\u4e00-\u9fa5]+)(?!\})/g, (match) => {
    return `\\text{${match}}`;
  });

  return result;
}

function buildTex(mode, body) {
  // 多包支持: 提取 % PACKAGES: xxx,yyy
  const pkgMatch = body.match(/^%\s*PACKAGES\s*:\s*(.+)$/m);
  const extraPkgs = pkgMatch
    ? pkgMatch[1]
        .split(",")
        .map((s) => s.trim().toLowerCase())
        .filter((s) => s)
    : [];
  const PKG_MAP = {
    circuitikz: "\\usepackage{circuitikz}",
    pgfplots: "\\usepackage{pgfplots}",
    "tikz-cd": "\\usepackage{tikz-cd}",
    amssymb: "\\usepackage{amssymb}",
    array: "\\usepackage{array}",
    chemformula: "\\usepackage{chemformula}",
    siunitx: "\\usepackage{siunitx}",
  };
  let pkgLines = "";
  for (const p of extraPkgs) {
    if (p !== "mhchem" && PKG_MAP[p]) pkgLines += PKG_MAP[p] + "\n";
  }
  // 移除 PACKAGES 声明行
  const bodyNoPkg = body.replace(/^%\s*PACKAGES\s*:.+$\n?/m, "");

  if (mode === "miktex") {
    // miktex 模式: 直接使用用户代码 (必须是完整文档)
    // 但如果不是完整文档, 自动补全
    if (!/\\documentclass/.test(body) || !/\\begin\s*\{\s*document\s*\}/.test(body)) {
      const clean = cleanBody(body);
      const hasChemfig = /\\chemfig|\\arrow|\\\+|\\chemname/.test(clean);
      const hasTikzpicture = /\\begin\s*\{\s*tikzpicture\s*\}/.test(clean);
      let inner = clean;
      if (hasChemfig && !hasTikzpicture && !/\\schemestart/.test(clean)) {
        inner = "\\schemestart\n" + clean + "\n\\schemestop";
      }
      return `\\documentclass[border=4pt]{standalone}
\\usepackage{chemfig}
\\usepackage{tikz}
\\usepackage{amsmath}
\\usepackage{mhchem}
${pkgLines}\\pagestyle{empty}
\\begin{document}
${inner}
\\end{document}
`;
    }
    return body;
  }
  const clean = fixArrowSubscripts(cleanBody(bodyNoPkg));

  // v10.15.14: 处理中文字符，添加 CJK 支持
  const hasChinese = hasChineseChars(clean);
  const cleanWithChinese = hasChinese ? convertChineseToLatex(clean) : clean;

  // v10.15.14: 如果有中文字符，添加 CJKutf8 包
  const cjkPackage = hasChinese ? "\\usepackage{CJKutf8}\n" : "";

  const preamble = `\\documentclass[border=4pt]{standalone}
\\usepackage{chemfig}
\\usepackage{tikz}
\\usepackage{amsmath}
\\usepackage{textcomp}
\\usepackage{mhchem}
${cjkPackage}${pkgLines}\\pagestyle{empty}
\\begin{document}`;
  const hasSchemaStart = /^\s*\\schemestart\s*$/m.test(clean) || /\\schemestart/.test(clean);
  const hasSchemaStop = /\\schemestop/.test(clean);
  const hasChem = /\\chemfig|\\arrow|\\\+|\\chemname/.test(clean);
  const hasCe = /\\ce\{/.test(clean); // 无机化学式 \ce{}
  const hasTikzpicture = /\\begin\s*\{\s*tikzpicture\s*\}/.test(clean);

  if (mode === "ce") {
    // ce 模式: mhchem 化学反应式
    // 如果代码中同时包含 chemfig 和 \ce{}, 使用 schemestart 包裹 (chemfig 环境)
    // 如果只有 \ce{}, 使用 center 环境
    if (hasChem && hasCe) {
      // 混合模式: chemfig + ce, 用 schemestart 包裹
      return `${preamble}
\\schemestart
${cleanWithChinese}
\\schemestop
\\end{document}
`;
    }
    if (hasChem && !hasCe) {
      // ce 模式下写了 chemfig 代码, 自动用 schemestart 包裹
      return `${preamble}
\\schemestart
${cleanWithChinese}
\\schemestop
\\end{document}
`;
    }
    // 纯 \ce{} 或文本, 用 center 环境, 多个 \ce{} 自动换行
    return `${preamble}
\\begin{center}
${cleanWithChinese}
\\end{center}
\\end{document}
`;
  }

  if (mode === "chem") {
    // chem 模式: 自动包裹 schemestart
    // 如果已有完整的 schemestart/schemestop, 不重复
    if (hasSchemaStart && hasSchemaStop) {
      return `${preamble}\n${cleanWithChinese}\n\\end{document}\n`;
    }
    // 如果只有 schemestart 没有 schemestop, 添加 schemestop
    if (hasSchemaStart && !hasSchemaStop) {
      return `${preamble}\n${cleanWithChinese}\n\\schemestop\n\\end{document}\n`;
    }
    // 如果只有 schemestop 没有 schemestart, 添加 schemestart
    if (!hasSchemaStart && hasSchemaStop) {
      return `${preamble}\n\\schemestart\n${cleanWithChinese}\n\\end{document}\n`;
    }
    // 都没有, 且含 chemfig 命令, 包裹
    if (hasChem && !hasTikzpicture && !hasCe) {
      return `${preamble}
\\schemestart
${cleanWithChinese}
\\schemestop
\\end{document}
`;
    }
    // 纯无机化学式 \ce{} 或纯文本, 不包裹 schemestart
    if (hasCe && !hasChem) {
      return `${preamble}\n${cleanWithChinese}\n\\end{document}\n`;
    }
    // 混合 chemfig 和 ce, 包裹 schemestart
    if (hasChem && hasCe) {
      return `${preamble}
\\schemestart
${cleanWithChinese}
\\schemestop
\\end{document}
`;
    }
    // 纯文本或 tikzpicture, 不包裹
    return `${preamble}\n${cleanWithChinese}\n\\end{document}\n`;
  }

  // tikz 模式: 用户应手动写 schemestart, 但缺了则自动补
  if (hasChem && !hasTikzpicture) {
    if (!hasSchemaStart && !hasSchemaStop) {
      return `${preamble}
\\schemestart
${cleanWithChinese}
\\schemestop
\\end{document}
`;
    }
    if (hasSchemaStart && !hasSchemaStop) {
      return `${preamble}\n${cleanWithChinese}\n\\schemestop\n\\end{document}\n`;
    }
    if (!hasSchemaStart && hasSchemaStop) {
      return `${preamble}\n\\schemestart\n${cleanWithChinese}\n\\end{document}\n`;
    }
  }
  return `${preamble}
${cleanWithChinese}
\\end{document}
`;
}

// ========== 模式切换: 代码自适应转换 ==========

async function svgToPng(svgString, scale = 1.5) {
  return new Promise((resolve, reject) => {
    const MAX_WIDTH = 600; // PNG 最大宽度, 压缩体积
    const MAX_HEIGHT = 600; // PNG 最大高度
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      // 使用 img 加载后的实际尺寸, 避免 viewBox 解析导致的变形
      let w = img.naturalWidth || img.width || 600;
      let h = img.naturalHeight || img.height || 400;
      // 按比例缩放
      w = w * scale;
      h = h * scale;
      // 限制最大宽高, 保持原始长宽比 (压缩体积)
      if (w > MAX_WIDTH) {
        const ratio = MAX_WIDTH / w;
        w = MAX_WIDTH;
        h = h * ratio;
      }
      if (h > MAX_HEIGHT) {
        const ratio = MAX_HEIGHT / h;
        h = MAX_HEIGHT;
        w = w * ratio;
      }
      const width = Math.round(w);
      const height = Math.round(h);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      // 白色背景
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, width, height);
      // 平滑绘制
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((pngBlob) => {
        URL.revokeObjectURL(url);
        if (pngBlob) {
          const reader = new FileReader();
          reader.onload = () => resolve(Buffer.from(reader.result));
          reader.onerror = () => reject(new Error("PNG 读取失败"));
          reader.readAsArrayBuffer(pngBlob);
        } else {
          reject(new Error("canvas.toBlob 返回空"));
        }
      }, "image/png");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("SVG 加载失败, 可能包含外部引用"));
    };
    img.src = url;
  });
}

// 统一保存: SVG 源文件 + PNG 显示文件

async function saveSvgAndPng(svgString, name, noteDir) {
  // V2.0-iter: 若配置了 svgOutputFolder, SVG 输出到该目录; 否则保持旧布局
  const svgDir = svgOutputFolderGlobal
    ? path.resolve(svgOutputFolderGlobal)
    : path.join(noteDir, "svg_source");
  const pngDir = path.join(noteDir, "png_out");
  if (!fs.existsSync(svgDir)) fs.mkdirSync(svgDir, { recursive: true });
  if (!fs.existsSync(pngDir)) fs.mkdirSync(pngDir, { recursive: true });
  const svgPath = path.join(svgDir, `${name}.svg`);
  const pngPath = path.join(pngDir, `${name}.png`);
  fs.writeFileSync(svgPath, svgString, "utf8");
  const pngBuffer = await svgToPng(svgString, 2);
  fs.writeFileSync(pngPath, pngBuffer);
  return { svgPath, pngPath };
}

// 将箭头条件文字转为可独立渲染的 chemfig 文本

function checkCommandExists(cmd) {
  return new Promise((resolve) => {
    const checker = process.platform === "win32" ? "where" : "which";
    execFile(checker, [cmd], { timeout: 5000 }, (err) => resolve(!err));
  });
}

// ========== 主插件类 ==========
