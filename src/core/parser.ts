// ========== core/parser.js - 代码解析 ==========

function extractName(body) {
  const m1 = body.match(NAME_REG_STRICT);
  if (m1 && m1[1]) return m1[1];
  const m2 = body.match(NAME_REG_LEGACY);
  if (m2 && m2[1]) {
    const n = sanitizeFileName(m2[1]);
    if (n) return n;
  }
  return null;
}

// ========== 工具函数 ==========

function sanitizeFileName(name) {
  return name
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function getHash(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex").slice(0, 16);
}

function getBlockName(body) {
  const name = extractName(body);
  if (name) return name;
  return getHash(body);
}

// 组分编译包装: 含 \arrow 但无 \chemfig 时, 添加前后空结构式保持箭头长度

function parseGroups(body) {
  const lines = body.split("\n");
  let nameLine = "";

  // 有手动 % GROUP: 标记时按标记拆分
  if (/%\s*GROUP:/.test(body)) {
    const groups = [];
    let current = null;
    // LaTeX 文档结构命令, 跳过不作为组分
    const latexStructure =
      /^\s*\\(documentclass|usepackage|pagestyle|begin\{document\}|end\{document\}|begin\{tikzpicture\}|end\{tikzpicture\})/;
    for (const line of lines) {
      if (line.trim().startsWith("% NAME:")) {
        nameLine = line;
        continue;
      }
      const gm = line.match(/^%\s*GROUP:\s*(.+)$/);
      if (gm) {
        if (current) groups.push(current);
        current = { name: gm[1].trim(), lines: [] };
        continue;
      }
      // 跳过元数据注释和环境标记
      if (line.trim().startsWith("%")) continue;
      if (/^\s*\\schemestart\s*$/.test(line) || /^\s*\\schemestop\s*$/.test(line)) continue;
      // 跳过 LaTeX 文档结构命令
      if (latexStructure.test(line)) continue;
      // 跳过 documentclass 的参数行
      if (/^\s*\{(standalone|article|report|book|minimal)\}\s*$/.test(line)) continue;
      if (current) current.lines.push(line);
    }
    if (current) groups.push(current);
    // 过滤掉空代码的组分
    const validGroups = groups.filter((g) => g.lines.join("\n").trim());
    // 如果有效组分少于2个, 说明 % GROUP: 标记格式错误 (标记后无代码), 回退到自动识别模式
    if (validGroups.length >= 2) {
      return {
        nameLine,
        groups: validGroups.map((g) => ({
          name: g.name,
          code: g.lines.join("\n").trim(),
          type: "custom",
          offsetY: 0,
        })),
      };
    }
    console.warn("[Chemfig-SVG] % GROUP: 标记后无代码或组分不足, 回退到自动识别模式");
  }

  // 自动识别: 逐行解析 chemfig 命令
  const groups = [];
  // LaTeX 文档结构命令, 跳过不作为组分
  const latexStructure =
    /^\s*\\(documentclass|usepackage|pagestyle|begin\{document\}|end\{document\}|begin\{tikzpicture\}|end\{tikzpicture\})/;
  for (const line of lines) {
    if (line.trim().startsWith("% NAME:")) {
      nameLine = line;
      continue;
    }
    if (line.trim().startsWith("%") || !line.trim()) continue;
    // 跳过 schemestart/schemestop 标记, 不作为独立组分
    if (/^\s*\\schemestart\s*$/.test(line) || /^\s*\\schemestop\s*$/.test(line)) continue;
    // 跳过 LaTeX 文档结构命令 (miktex 模式的 \documentclass 等)
    if (latexStructure.test(line)) continue;

    // 分步渲染: 按出现顺序提取所有 \chemfig{} / \arrow{} / \+ 命令
    const cmdRegex = /\\(chemfig\{[^}]*\}|arrow\{[^}]*\}|\\\+)/g;
    let m;
    let found = false;
    while ((m = cmdRegex.exec(line)) !== null) {
      found = true;
      const cmd = m[0];
      if (cmd.startsWith("\\chemfig")) {
        groups.push({
          name: "结构式" + (groups.filter((g) => g.type === "molecule").length + 1),
          code: cmd,
          type: "molecule",
          offsetY: 0,
        });
      } else if (cmd.startsWith("\\arrow")) {
        // 箭头作为整体组分 (含上下条件), 分步渲染保持原始比例
        groups.push({ name: "箭头", code: cmd, type: "arrow", offsetY: 0 });
      } else if (cmd === "\\+") {
        groups.push({ name: "加号", code: "\\+", type: "plus", offsetY: 0 });
      }
    }
    // 未匹配到已知命令的非空行作为整体组分
    if (!found && line.trim()) {
      groups.push({
        name: "组分" + (groups.length + 1),
        code: line.trim(),
        type: "other",
        offsetY: 0,
      });
    }
  }
  return { nameLine, groups };
}

// ========== SVG 合并: 将多个组分 SVG 按布局合并为一个 SVG ==========

function extractReactionInfo(code, mode, name) {
  const info = {
    name: name || "未命名反应",
    mode: mode || "chem",
    components: [],
  };

  const clean = cleanBody(code);
  let idx = 1;

  if (mode === "ce") {
    // ce 模式: 解析 \ce{A ->[条件] B} 格式
    const ceMatch = clean.match(/\\ce\{([^}]*)\}/);
    if (ceMatch) {
      const ceContent = ceMatch[1];
      // 按 -> 分割
      const parts = ceContent.split(/->/);
      for (let i = 0; i < parts.length; i++) {
        let part = parts[i].trim();
        // 提取条件 [条件]
        let condition = "";
        const condMatch = part.match(/^\[([^\]]*)\]\s*(.*)$/);
        if (condMatch) {
          condition = condMatch[1];
          part = condMatch[2].trim();
        }
        if (i === 0) {
          // 反应物
          info.components.push({
            index: idx++,
            type: "reactant",
            label: part || "反应物",
            code: "\\ce{" + part + "}",
          });
        } else if (i === parts.length - 1) {
          // 产物
          info.components.push({
            index: idx++,
            type: "product",
            label: part || "产物",
            code: "\\ce{" + part + "}",
          });
        } else {
          // 中间产物
          info.components.push({
            index: idx++,
            type: "product",
            label: part || "中间产物",
            code: "\\ce{" + part + "}",
          });
        }
        // 添加箭头/条件
        if (i < parts.length - 1) {
          info.components.push({
            index: idx++,
            type: "arrow",
            label: condition || "反应条件",
            code: "\\arrow{->[" + condition + "][]}",
          });
        }
      }
    }
  } else {
    // chem/tikz/miktex 模式: 按出现顺序提取 \chemfig{}, \arrow{}, \+
    // 使用全局正则匹配, 保持原始顺序
    const regex = /\\(chemfig\*?\{[^}]*\}|arrow\{[^}]*\}|\\\+)/g;
    let match;
    let reactantCount = 0;
    let hasArrow = false;

    while ((match = regex.exec(clean)) !== null) {
      const fullMatch = match[0];
      if (fullMatch.startsWith("\\chemfig") || fullMatch.startsWith("\\chemfig*")) {
        const type = hasArrow ? "product" : "reactant";
        const label =
          type === "reactant"
            ? "反应物" + ++reactantCount
            : "产物" + (info.components.filter((c) => c.type === "product").length + 1);
        info.components.push({
          index: idx++,
          type: type,
          label: label,
          code: fullMatch,
        });
      } else if (fullMatch.startsWith("\\arrow")) {
        hasArrow = true;
        // 提取箭头条件作为标签
        let label = "反应箭头";
        const condMatch = fullMatch.match(/->\[([^\]]*)\]/);
        if (condMatch && condMatch[1]) {
          label = condMatch[1].replace(/\$_\d+\$/g, (m) => m.replace(/\$|_/g, "")).substring(0, 20);
        }
        info.components.push({
          index: idx++,
          type: "arrow",
          label: label,
          code: fullMatch,
        });
      } else if (fullMatch === "\\+") {
        info.components.push({
          index: idx++,
          type: "plus",
          label: "+",
          code: "\\+",
        });
      }
    }
  }

  return info;
}

// 将反应信息转换为简洁的文本格式 (用于存储到文件, v10.9.4 加入布局信息)

function reactionInfoToText(info, layout) {
  let text = "# " + info.name + "\n";
  text += "# mode: " + info.mode + "\n";
  text += "# 格式: 序号|类型|标签|代码\n";
  for (const comp of info.components) {
    text += comp.index + "|" + comp.type + "|" + comp.label + "|" + comp.code + "\n";
  }
  // 布局信息 (如果有)
  if (layout && layout.length > 0) {
    text += "# 布局格式: LAYOUT|标签|x|y|scaleX|scaleY|locked\n";
    for (let i = 0; i < layout.length && i < info.components.length; i++) {
      const p = layout[i];
      const label = info.components[i]?.label || "组分" + (i + 1);
      text +=
        "LAYOUT|" +
        label +
        "|" +
        Math.round(p.x) +
        "|" +
        Math.round(p.y) +
        "|" +
        (p.scaleX || p.scale || 1).toFixed(2) +
        "|" +
        (p.scaleY || p.scale || 1).toFixed(2) +
        "|" +
        (p.locked ? "1" : "0") +
        "\n";
    }
  }
  return text;
}

// 从文本格式解析反应信息 (v10.9.4 解析布局信息)

function parseReactionInfo(text) {
  const lines = text.split("\n");
  const info = {
    name: "未命名反应",
    mode: "chem",
    components: [],
    layout: [],
  };

  for (const line of lines) {
    if (line.startsWith("# ")) {
      info.name = line.substring(2).trim();
    } else if (line.startsWith("# mode:")) {
      info.mode = line.substring(7).trim();
    } else if (line.startsWith("#")) {
      continue; // 注释行
    } else if (line.trim()) {
      const parts = line.split("|");
      if (parts[0] === "LAYOUT" && parts.length >= 7) {
        // 布局信息
        info.layout.push({
          label: parts[1],
          x: parseInt(parts[2]) || 0,
          y: parseInt(parts[3]) || 0,
          scaleX: parseFloat(parts[4]) || 1,
          scaleY: parseFloat(parts[5]) || 1,
          locked: parts[6] === "1",
        });
      } else if (parts.length >= 4) {
        info.components.push({
          index: parseInt(parts[0]) || info.components.length + 1,
          type: parts[1] || "other",
          label: parts[2] || "",
          code: parts.slice(3).join("|"), // 代码中可能包含 |
        });
      }
    }
  }
  return info;
}

// 从反应信息生成组分列表 (用于组分调整)

function reactionInfoToGroups(info) {
  const groups = [];
  for (const comp of info.components) {
    groups.push({
      name: comp.label,
      code: comp.code,
      type: comp.type,
      offsetY: comp.type === "arrow" ? 0 : 0,
    });
  }
  return groups;
}

// 根据模式构建完整 tex 文档
