// ========== core/converter.js - 模式转换与代码清理 ==========

function wrapGroupCode(code) {
  // 先清理代码: 移除元数据注释和导言区命令
  let result = cleanBody(code);
  // 箭头单独存在时, 前后补空结构式以保持正常箭头长度
  if (/\\arrow/.test(result) && !/\\chemfig/.test(result)) {
    result = `\\chemfig{}\n${result}\n\\chemfig{}`;
  }
  // 自动修复箭头条件中的下划线 (NH_3 -> NH$_3$)
  result = fixArrowSubscripts(result);
  // schemestart 由 buildTex 统一包裹, 这里不重复处理
  return result;
}

// 修复箭头条件中的下标格式: 将文本模式中的 _数字 转为 $_数字$
// 例如: \arrow{->[Na, liq. NH_3][EtOH]} -> \arrow{->[Na, liq. NH$_3$][EtOH]}

function fixArrowSubscripts(code) {
  // 匹配 \arrow{...} 中的内容
  return code.replace(/(\\arrow\s*\{[^}]*)(\})/g, (match, arrowContent, closingBrace) => {
    // 在箭头条件中修复下划线: 字母_数字 -> 字母$_数字$
    // 但跳过已经在 $...$ 中的内容
    const fixed = arrowContent.replace(/([A-Za-z\)])_(\d+)/g, (m, prefix, num) => {
      return prefix + "$_" + num + "$";
    });
    return fixed + closingBrace;
  });
}

// 清理代码: 移除元数据注释行 (% NAME/GROUP/LAYOUT/BG/PACKAGES, %% name), 以及只能在导言区使用的命令

function cleanBody(body) {
  return (
    body
      .split("\n")
      .filter((l) => !/^\s*%%?\s*(NAME|name|GROUP|LAYOUT|BG|PACKAGES)\s*:/.test(l))
      // 移除导言区命令 (防止组分编译时出现 "Can be used only in preamble" 错误)
      .filter(
        (l) =>
          !/^\s*\\(documentclass|usepackage|pagestyle|begin\{document\}|end\{document\})/.test(l)
      )
      // 移除 documentclass 的参数行 (如 {standalone}, 可能被分成两行)
      .filter((l) => !/^\s*\{(standalone|article|report|book|minimal)\}\s*$/.test(l))
      // 移除 tikzpicture 环境
      .filter((l) => !/^\s*\\(begin|end)\{tikzpicture\}/.test(l))
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

// ===== 反应信息提取 (v10.8.0 架构改进) =====
// 从代码块中提取结构化反应信息, 存储为简洁的文本格式
// 格式: 序号|类型|标签|代码
// 类型: reactant(反应物), arrow(箭头/条件), product(产物), plus(加号), other(其他)

function convertCode(body, fromMode, toMode) {
  if (fromMode === toMode) return body;
  // 分离元数据注释 (支持 % NAME: / %% name: / % GROUP: / % LAYOUT:)
  const lines = body.split("\n");
  const metaLines = [];
  const codeLines = [];
  for (const l of lines) {
    if (/^\s*%%?\s*(name|NAME|GROUP|LAYOUT)\s*:/.test(l)) metaLines.push(l);
    else codeLines.push(l);
  }
  let code = codeLines.join("\n").trim();
  if (!code) return body; // 空代码不转换

  // 第一步: 统一为"正文"形式
  if (fromMode === "miktex") {
    // 提取 \begin{document}...\end{document} 之间的内容
    const m = code.match(/\\begin\s*\{\s*document\s*\}([\s\S]*?)\\end\s*\{\s*document\s*\}/);
    if (m) {
      code = m[1].trim();
    } else {
      // 没有 document 环境, 尝试去掉 \documentclass 和 \usepackage
      code = code
        .replace(/\\documentclass[^\n]*\n?/g, "")
        .replace(/\\usepackage[^\n]*\n?/g, "")
        .replace(/\\pagestyle[^\n]*\n?/g, "")
        .trim();
    }
    // 去掉 schemestart/schemestop 和 center 环境
    code = code
      .replace(/^\s*\\schemestart\s*/m, "")
      .replace(/\s*\\schemestop\s*$/m, "")
      .trim();
    code = code
      .replace(/\\begin\s*\{\s*center\s*\}\s*/g, "")
      .replace(/\s*\\end\s*\{\s*center\s*\}/g, "")
      .trim();
  } else if (fromMode === "tikz") {
    // tikz 模式可能有 schemestart, 去掉
    code = code
      .replace(/^\s*\\schemestart\s*/m, "")
      .replace(/\s*\\schemestop\s*$/m, "")
      .trim();
  } else if (fromMode === "ce") {
    // ce 模式可能有 center 环境, 去掉
    code = code
      .replace(/\\begin\s*\{\s*center\s*\}\s*/g, "")
      .replace(/\s*\\end\s*\{\s*center\s*\}/g, "")
      .trim();
  }
  // fromMode === chem: code 已经是无 schemestart 的正文

  // 第二步: 按目标模式包装
  const hasChemfig = /\\chemfig|\\arrow|\\\+|\\chemname/.test(code);
  const hasTikzpicture = /\\begin\s*\{\s*tikzpicture\s*\}/.test(code);
  const hasCe = /\\ce\{/.test(code);

  if (toMode === "chem") {
    // chem: 纯正文, 无 schemestart (buildTex 会自动包裹)
    // 如果是从 ce 转换, 保留 \ce{} 命令
  } else if (toMode === "ce") {
    // ce: mhchem 反应式
    if (hasChemfig && !hasCe) {
      // chemfig 结构式无法自动转换为 \ce{} 格式, 保留原代码并添加提示注释
      code =
        "% 注意: 以下 chemfig 代码无法自动转换为 ce 格式\n" +
        "% ce 模式适用于简单的无机化学反应式 (如 \\ce{H2 + O2 -> H2O})\n" +
        "% 复杂有机结构式请使用 chem/tikz/miktex 模式\n" +
        code;
    }
    // 如果只有 \ce{} 或文本, 不需要特殊包装 (buildTex 会用 center 环境)
  } else if (toMode === "tikz") {
    // tikz: 如果含 chemfig 且无 tikzpicture, 则添加 schemestart 包裹
    if (hasChemfig && !hasTikzpicture && !/\\schemestart/.test(code)) {
      code = "\\schemestart\n" + code + "\n\\schemestop";
    }
  } else if (toMode === "miktex") {
    // miktex: 完整文档
    let inner = code;
    // 如果含 chemfig 且无 tikzpicture 且无 schemestart, 则添加 schemestart
    if (hasChemfig && !hasTikzpicture && !/\\schemestart/.test(code)) {
      inner = "\\schemestart\n" + code + "\n\\schemestop";
    }
    code = `\\documentclass[border=4pt]{standalone}
\\usepackage{chemfig}
\\usepackage{tikz}
\\usepackage{amsmath}
\\usepackage{mhchem}
\\pagestyle{empty}
\\begin{document}
${inner}
\\end{document}`;
  }

  // 合并: 元数据注释在前, 然后代码
  const result = [...metaLines, code].filter(Boolean).join("\n") + "\n";
  return result;
}

// 正则转义

function escapeReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// 编译前校验: 检测明显的语法错误

function validateCode(mode, code) {
  const errors = [];
  const warnings = [];

  // 通用检查
  if (!code || code.trim().length < 3) {
    errors.push("代码为空");
    return { errors, warnings };
  }

  // 检查未闭合的花括号
  const openBraces = (code.match(/\{/g) || []).length;
  const closeBraces = (code.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(`花括号不匹配: 开 ${openBraces} 个, 闭 ${closeBraces} 个`);
  }

  // chem/tikz 模式检查
  if (mode === "chem" || mode === "tikz") {
    // 检查 \chemfig 或 \ce 命令
    const chemfigCount = (code.match(/\\chemfig/g) || []).length;
    const ceCount = (code.match(/\\ce\{/g) || []).length;
    if (chemfigCount === 0 && ceCount === 0 && !/\\begin\s*\{\s*tikzpicture\s*\}/.test(code)) {
      warnings.push("未检测到 \\chemfig 或 \\ce 命令, 可能无法渲染化学式");
    }
    // 检查 schemestart/schemestop (tikz 模式必须有)
    if (mode === "tikz") {
      const hasStart = /\\schemestart/.test(code);
      const hasStop = /\\schemestop/.test(code);
      if (hasStart && !hasStop) warnings.push("有 \\schemestart 但无 \\schemestop, 将自动补全");
      if (!hasStart && hasStop) warnings.push("有 \\schemestop 但无 \\schemestart, 将自动补全");
    }
    // 检查 \ce{} 花括号匹配
    if (ceCount > 0) {
      const ceOpen = (code.match(/\\ce\{/g) || []).length;
      // \ce{ 后面的 } 计数
      let ceClose = 0;
      const ceMatches = code.match(/\\ce\{[^}]*\}/g) || [];
      ceClose = ceMatches.length;
      if (ceOpen !== ceClose) {
        errors.push(`\\ce{} 花括号不匹配: 开 ${ceOpen} 个, 闭 ${ceClose} 个`);
      }
    }
  }

  // ce 模式检查
  if (mode === "ce") {
    const ceCount = (code.match(/\\ce\{/g) || []).length;
    if (ceCount === 0) {
      warnings.push("未检测到 \\ce{} 命令, ce 模式应使用 \\ce{} 渲染化学反应式");
    }
    // 检查 \ce{} 花括号匹配
    if (ceCount > 0) {
      const ceMatches = code.match(/\\ce\{[^}]*\}/g) || [];
      if (ceCount !== ceMatches.length) {
        errors.push(`\\ce{} 花括号不匹配: 开 ${ceCount} 个, 闭 ${ceMatches.length} 个`);
      }
    }
  }

  // miktex 模式检查
  if (mode === "miktex") {
    if (!/\\documentclass/.test(code))
      warnings.push("缺少 \\documentclass, 将自动补全为 standalone");
    if (!/\\begin\s*\{\s*document\s*\}/.test(code))
      warnings.push("缺少 \\begin{document}, 将自动补全");
    if (!/\\end\s*\{\s*document\s*\}/.test(code)) warnings.push("缺少 \\end{document}, 将自动补全");
    if (!/\\usepackage\{chemfig\}/.test(code))
      warnings.push("缺少 \\usepackage{chemfig}, 结构式可能无法渲染");
  }

  // 检查常见错误: \arrow 嵌套
  if (/\\arrow\{[^}]*\\arrow/.test(code)) {
    errors.push("检测到 \\arrow 嵌套, 请检查箭头条件是否正确");
  }

  return { errors, warnings };
}

// SVG 转 PNG (使用 Canvas API, 无需外部依赖)

function conditionToChemfig(text) {
  // $_3$ -> \textsubscript{3}, $^+$ -> \textsuperscript{+}
  const t = text
    .replace(/\$_([^$]+)\$/g, "\\textsubscript{$1}")
    .replace(/\$\^([^$]+)\$/g, "\\textsuperscript{$1}")
    .replace(/\$/g, "");
  return `\\chemfig{\\text{${t}}}`;
}

// ========== 组分解析: 基于编译代码自动识别 ==========
