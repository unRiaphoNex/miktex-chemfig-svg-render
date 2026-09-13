// ========== molecule-editor.js - 分子画布编辑器 (OpenChemLib) ==========
// 依赖:
//   - 全局 OpenChemLib（由 ocl.bundle.js 提供，先于本模块合并进 main.js）
//   - 全局 Modal / Notice / Setting / Menu（constants.js 已 require("obsidian")）
//   - OCL_TOOL_NAMES / oclToolName（ocl-tooltips.js，先于本模块合并）
//
// 单向数据流: 分子模型 -> chemfig -> latex/dvisvgm -> SVG。
// SVG 无法还原分子，因此插入结果时同时把 SMILES 归档为 `% smiles:` 注释，
// 作为二次编辑的唯一入口。

let __OCL = null;
function getOCL() {
  if (__OCL) return __OCL;
  if (typeof OpenChemLib === "undefined" || !OpenChemLib.Molecule) {
    throw new Error("OpenChemLib 未打包进 main.js");
  }
  __OCL = OpenChemLib;
  return __OCL;
}

// 给 OCL 画布工具栏按钮加悬浮提示（工具名称）
// v10.15.3: 改进 OCL 工具栏 tooltip 显示
function addOclToolbarTooltips(rootEl) {
  try {
    // OCL 工具栏通常是 canvas 的第一个子元素或特定类名
    // 使用更广泛的选择器查找所有可点击的工具项
    const allClickable = rootEl.querySelectorAll(
      "button, [role='button'], [class*='tool'], [class*='Tool'], [class*='item'], [class*='Item'], [class*='icon'], [class*='Icon'], div[style*='cursor'], span[style*='cursor']"
    );

    for (const el of allClickable) {
      if (el.classList.contains("chemfig-tooltip-added")) continue;
      // 跳过太大的容器
      const rect = el.getBoundingClientRect();
      if (rect.width > 80 || rect.height > 80) continue;

      let toolName = "";

      // 1. 已有 title 属性则跳过
      if (el.getAttribute("title") && el.getAttribute("title").length > 0) {
        el.classList.add("chemfig-tooltip-added");
        continue;
      }

      // 2. 检查 aria-label
      if (el.getAttribute("aria-label")) {
        toolName = el.getAttribute("aria-label");
      }

      // 3. 从 background-image 识别工具图标
      if (!toolName) {
        const bg = window.getComputedStyle(el).backgroundImage || "";
        const m = bg.match(/url\(["']?(data:image\/png;base64,([A-Za-z0-9+/=]+))["']?\)/);
        if (m) {
          toolName = oclToolName(m[1]);
        }
      }

      // 4. 从文本内容识别
      if (!toolName) {
        const text = (el.textContent || "").trim();
        if (text && text.length <= 3 && /^[A-Za-z]+$/.test(text)) {
          // 单个字母的原子工具
          toolName = "原子: " + text;
        }
      }

      // 5. 默认名称
      if (!toolName) {
        toolName = "工具";
      }

      el.setAttribute("title", toolName);
      el.classList.add("chemfig-tooltip-added");
    }
  } catch (e) {
    /* ignore */
  }
}

// ---------------- chemfig 生成器 ----------------
// 把任意连通分子展开成生成树：绝对角 [:θ] + 圆括号分支表达拓扑，
// 环闭合边用 chemfig 钩子 ?[id]（单键）回连。建树时优先纳入高键级边，
// 使单键尽量留作闭合键，保证 Kekulé 芳环键级正确（已用 MiKTeX 全量验证）。

function molBondSymbol(order) {
  if (order >= 3) return "~";
  if (order >= 2) return "=";
  return "-";
}

function molAtomLabel(mol, atom) {
  const sym = mol.getAtomLabel(atom).trim();
  const z = mol.getAtomicNo(atom);
  const h = mol.getImplicitHydrogens(atom);
  const charge = mol.getAtomCharge(atom);

  let body;
  if (z === 6) {
    body = h === 0 ? "C" : "CH" + (h > 1 ? "_" + h : "");
  } else {
    body = sym + (h > 0 ? "H" + (h > 1 ? "_" + h : "") : "");
  }
  if (charge !== 0) {
    const sign = charge > 0 ? "+" : "-";
    const mag = Math.abs(charge);
    const sup = (mag > 1 ? String(mag) : "") + sign;
    body = "\\chemabove{" + body + "}{\\scriptstyle" + sup + "}";
  }
  return body;
}

function molAngleStr(mol, from, to) {
  const dx = mol.getAtomX(to) - mol.getAtomX(from);
  const dy = mol.getAtomY(to) - mol.getAtomY(from);
  let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  deg = Math.round(deg / 15) * 15;
  if (Object.is(deg, -0)) deg = 0;
  return "[:" + String(deg) + "]";
}

function molGenerateChemfig(mol) {
  const fragments = mol.getFragments();
  if (fragments.length === 0) return "\\chemfig{}";
  if (fragments.length === 1) return molBuildSingleFragment(fragments[0]);
  // 多碎片（盐、拆键结果等）并列排放
  return fragments.map((f) => molBuildSingleFragment(f)).join("\\quad");
}

function molBuildSingleFragment(mol) {
  const n = mol.getAllAtoms();
  if (n === 0) return "\\chemfig{}";
  if (n === 1) return "\\chemfig{" + molAtomLabel(mol, 0) + "}";

  const m = mol.getAllBonds();
  const adj = Array.from({ length: n }, () => []);
  for (let b = 0; b < m; b++) {
    const a1 = mol.getBondAtom(0, b);
    const a2 = mol.getBondAtom(1, b);
    const order = mol.getBondOrder(b);
    adj[a1].push({ to: a2, bond: b, order });
    adj[a2].push({ to: a1, bond: b, order });
  }

  // 度数最高的原子作根（对环更稳定、更对称）
  let root = 0;
  let bestDeg = -1;
  for (let i = 0; i < n; i++) {
    if (adj[i].length > bestDeg) {
      bestDeg = adj[i].length;
      root = i;
    }
  }

  // 迭代式 DFS 生成树；高键级边优先纳入树
  const parent = new Array(n).fill(-1);
  const parentBond = new Array(n).fill(-1);
  const preOrder = new Array(n).fill(-1);
  const children = Array.from({ length: n }, () => []);
  const visited = new Array(n).fill(false);

  const rank = (o) => (o >= 3 ? 3 : o >= 2 ? 2 : 1);

  let counter = 0;
  const stack = [root];
  visited[root] = true;
  preOrder[root] = counter++;
  parent[root] = -2;

  while (stack.length) {
    const u = stack.pop();
    const neighbors = adj[u].slice().sort((a, b) => {
      if (rank(b.order) !== rank(a.order)) return rank(b.order) - rank(a.order);
      return a.to - b.to;
    });
    for (const nb of neighbors) {
      const to = nb.to;
      const bond = nb.bond;
      if (!visited[to]) {
        visited[to] = true;
        preOrder[to] = counter++;
        parent[to] = u;
        parentBond[to] = bond;
        children[u].push(to);
        stack.push(to);
      }
    }
  }

  // 环闭合边 = 非树边；开放端 = 先访问端，闭合端 = 后访问端
  const openHooks = Array.from({ length: n }, () => []);
  const closeHooks = Array.from({ length: n }, () => []);
  let hookId = 0;
  for (let b = 0; b < m; b++) {
    const a1 = mol.getBondAtom(0, b);
    const a2 = mol.getBondAtom(1, b);
    if (parentBond[a1] !== b && parentBond[a2] !== b) {
      const id = "r" + hookId++;
      const order = mol.getBondOrder(b);
      const open = preOrder[a1] < preOrder[a2] ? a1 : a2;
      const close = open === a1 ? a2 : a1;
      openHooks[open].push({ id, order });
      closeHooks[close].push({ id, order });
    }
  }

  const childFragment = (child) => {
    const bond = parentBond[child];
    const order = mol.getBondOrder(bond);
    const p = parent[child];
    return molBondSymbol(order) + molAngleStr(mol, p, child) + molAtomLabel(mol, child);
  };

  // 环闭合键序: chemfig 钩子 ?[id,{=}] (双键必须花括号包裹, 否则 = 被 chemfig 特殊化报错)
  const hookLink = (order) => (order >= 2 ? ",{" + molBondSymbol(order) + "}" : "");

  let out = "";

  const walk = (u) => {
    for (const h of openHooks[u]) out += "?[" + h.id + "]";
    for (const h of closeHooks[u]) out += "?[" + h.id + hookLink(h.order) + "]";
    const ch = children[u];
    if (ch.length === 1) {
      out += childFragment(ch[0]);
      walk(ch[0]);
    } else if (ch.length > 1) {
      // 多子节点必须全部用分支表达；首个内联会导致后续分支误挂到首子节点上
      for (let i = 0; i < ch.length; i++) {
        out += "(" + childFragment(ch[i]);
        walk(ch[i]);
        out += ")";
      }
    }
  };

  out = molAtomLabel(mol, root);
  walk(root);
  return "\\chemfig{" + out + "}";
}

// SMARTS 子结构搜索，返回匹配数量
function molSubstructureSearch(mol, smarts) {
  // 注意: 必须先把 getOCL() 取到变量里再 new。
  // 写成 `new getOCL().SmilesParser(...)` 会被 JS 解析为 `(new getOCL()).SmilesParser(...)`,
  // 即把 SmilesParser 当普通函数调用 (this = OpenChemLib 命名空间), OCL 内部随即执行
  // `this.zc(...)` 而命名空间上没有 zc → 抛 "n.zc is not a function",
  // 导致「🔍 子结构搜索」功能完全不可用。
  const OCL = getOCL();
  const parser = new OCL.SmilesParser({ smartsMode: "smarts" });
  const fragment = parser.parseMolecule(smarts);
  fragment.setFragment(true);
  const searcher = new OCL.SSSearcher();
  searcher.setFragment(fragment);
  searcher.setMolecule(mol);
  return searcher.findFragmentInMolecule({ countMode: "overlapping" });
}

const CHEMFIG_ATOMIC_NO = {
  H: 1,
  B: 5,
  C: 6,
  N: 7,
  O: 8,
  F: 9,
  Si: 14,
  P: 15,
  S: 16,
  Cl: 17,
  Br: 35,
  I: 53,
};

// 手写 chemfig 源代码 → OCL Molecule（画布再编辑入口）。解析失败抛出异常由调用方兜底。
function chemfigToMolecule(src) {
  const OCL = getOCL();
  const graph = parseChemfig(src);
  const mol = new OCL.Molecule(0, 0);
  if (!graph.atoms.length) return mol;
  const idx = [];
  for (const at of graph.atoms) {
    const i = mol.addAtom(CHEMFIG_ATOMIC_NO[at.el] || 0);
    idx.push(i);
    if (at.charge) mol.setAtomCharge(i, at.charge);
    mol.setAtomX(i, at.x);
    mol.setAtomY(i, at.y);
  }
  for (let k = 0; k < graph.atoms.length; k++) {
    for (let j = 0; j < (graph.atoms[k].h || 0); j++) {
      const hi = mol.addAtom(1);
      mol.addBond(idx[k], hi, 1);
    }
  }
  for (const b of graph.bonds) {
    if (b.a >= 0 && b.b >= 0 && b.a < idx.length && b.b < idx.length && b.a !== b.b) {
      mol.addBond(idx[b.a], idx[b.b], 1);
      if (b.order && b.order !== 1) mol.setBondOrder(mol.getAllBonds() - 1, b.order);
    }
  }
  return mol;
}

// ---------------- 内置片段库 (本地优先) ----------------
// v2.0 扩展: 覆盖常见单环/稠环、杂环、链烃、醇醚、醛酮、羧酸酯、胺腈、
// 卤代烃溶剂、氨基酸、常见药物, 共 11 类 ~68 项。让常见化合物无需联网即可载入,
// 降低「外部库导入化学名失败」对日常使用的依赖。格式: [中文名, SMILES, 分子式]。
const MOLECULE_FRAGMENT_LIBRARY = [
  {
    cat: "环系 / 芳香",
    items: [
      ["苯", "c1ccccc1", "C6H6"],
      ["甲苯", "Cc1ccccc1", "C7H8"],
      ["邻二甲苯", "Cc1ccccc1C", "C8H10"],
      ["间二甲苯", "Cc1cccc(C)c1", "C8H10"],
      ["对二甲苯", "Cc1ccc(C)cc1", "C8H10"],
      ["苯乙烯", "C=Cc1ccccc1", "C8H8"],
      ["联苯", "c1ccc(-c2ccccc2)cc1", "C12H10"],
      ["萘", "c1ccc2ccccc2c1", "C10H8"],
      ["蒽", "c1ccc2cc3ccccc3cc2c1", "C14H10"],
      ["菲", "c1ccc2c(c1)ccc1ccccc12", "C14H10"],
    ],
  },
  {
    cat: "芳烃衍生物",
    items: [
      ["苯酚", "Oc1ccccc1", "C6H6O"],
      ["苯甲醇", "OCc1ccccc1", "C7H8O"],
      ["苯甲醛", "O=Cc1ccccc1", "C7H6O"],
      ["苯甲酸", "OC(=O)c1ccccc1", "C7H6O2"],
      ["水杨酸", "OC(=O)c1ccccc1O", "C7H6O3"],
      ["苯胺", "Nc1ccccc1", "C6H7N"],
      ["硝基苯", "O=[N+]([O-])c1ccccc1", "C6H5NO2"],
      ["氯苯", "Clc1ccccc1", "C6H5Cl"],
    ],
  },
  {
    cat: "杂环",
    items: [
      ["吡啶", "c1ccncc1", "C5H5N"],
      ["吡咯", "[nH]1cccc1", "C4H5N"],
      ["呋喃", "c1ccoc1", "C4H4O"],
      ["噻吩", "c1ccsc1", "C4H4S"],
      ["咪唑", "c1c[nH]cn1", "C3H4N2"],
      ["吡唑", "c1cn[nH]c1", "C3H4N2"],
      ["噻唑", "c1cscn1", "C3H3NS"],
      ["嘧啶", "c1cncnc1", "C4H4N2"],
      ["哌啶", "C1CCNCC1", "C5H11N"],
      ["吗啉", "C1COCCN1", "C4H9NO"],
      ["哌嗪", "C1CNCCN1", "C4H10N2"],
      ["喹啉", "c1ccc2ncccc2c1", "C9H7N"],
      ["异喹啉", "c1ccc2ccncc2c1", "C9H7N"],
      ["吲哚", "c1ccc2[nH]ccc2c1", "C8H7N"],
      ["嘌呤", "c1ncc2nc[nH]c2n1", "C5H4N4"],
    ],
  },
  {
    cat: "链烃 (烷/烯/炔)",
    items: [
      ["甲烷", "C", "CH4"],
      ["乙烷", "CC", "C2H6"],
      ["丙烷", "CCC", "C3H8"],
      ["丁烷", "CCCC", "C4H10"],
      ["异丁烷", "CC(C)C", "C4H10"],
      ["己烷", "CCCCCC", "C6H14"],
      ["环己烷", "C1CCCCC1", "C6H12"],
      ["乙烯", "C=C", "C2H4"],
      ["丙烯", "CC=C", "C3H6"],
      ["1,3-丁二烯", "C=CC=C", "C4H6"],
      ["乙炔", "C#C", "C2H2"],
    ],
  },
  {
    cat: "醇 / 醚",
    items: [
      ["甲醇", "CO", "CH4O"],
      ["乙醇", "CCO", "C2H6O"],
      ["1-丙醇", "CCCO", "C3H8O"],
      ["2-丙醇", "CC(C)O", "C3H8O"],
      ["1-丁醇", "CCCCO", "C4H10O"],
      ["乙二醇", "OCCO", "C2H6O2"],
      ["甘油(丙三醇)", "OCC(O)CO", "C3H8O3"],
      ["乙醚", "CCOCC", "C4H10O"],
      ["四氢呋喃", "C1CCOC1", "C4H8O"],
    ],
  },
  {
    cat: "醛 / 酮",
    items: [
      ["甲醛", "C=O", "CH2O"],
      ["乙醛", "CC=O", "C2H4O"],
      ["丙酮", "CC(=O)C", "C3H6O"],
      ["丁酮", "CCC(=O)C", "C4H8O"],
    ],
  },
  {
    cat: "羧酸 / 酯 / 酸酐",
    items: [
      ["甲酸", "OC=O", "CH2O2"],
      ["乙酸", "CC(=O)O", "C2H4O2"],
      ["丙酸", "CCC(=O)O", "C3H6O2"],
      ["草酸", "OC(=O)C(=O)O", "C2H2O4"],
      ["丙二酸", "OC(=O)CC(=O)O", "C3H4O4"],
      ["丁二酸", "OC(=O)CCC(=O)O", "C4H6O4"],
      ["乙酸乙酯", "CCOC(=O)C", "C4H8O2"],
      ["乙酸酐", "CC(=O)OC(=O)C", "C4H6O3"],
    ],
  },
  {
    cat: "胺 / 酰胺 / 腈",
    items: [
      ["甲胺", "CN", "CH5N"],
      ["二甲胺", "CNC", "C2H7N"],
      ["三甲胺", "CN(C)C", "C3H9N"],
      ["乙胺", "CCN", "C2H7N"],
      ["三乙胺", "CCN(CC)CC", "C6H15N"],
      ["乙二胺", "NCCN", "C2H8N2"],
      ["乙腈", "CC#N", "C2H3N"],
      ["N,N-二甲基甲酰胺", "CN(C)C=O", "C3H7NO"],
      ["尿素", "NC(=O)N", "CH4N2O"],
    ],
  },
  {
    cat: "卤代烃 / 溶剂",
    items: [
      ["二氯甲烷", "ClCCl", "CH2Cl2"],
      ["氯仿", "ClC(Cl)Cl", "CHCl3"],
      ["四氯化碳", "ClC(Cl)(Cl)Cl", "CCl4"],
      ["二甲亚砜(DMSO)", "CS(=O)C", "C2H6OS"],
    ],
  },
  {
    cat: "氨基酸",
    items: [
      ["甘氨酸", "NCC(=O)O", "C2H5NO2"],
      ["丙氨酸", "CC(N)C(=O)O", "C3H7NO2"],
      ["丝氨酸", "OCC(N)C(=O)O", "C3H7NO3"],
      ["半胱氨酸", "SCC(N)C(=O)O", "C3H7NO2S"],
      ["天冬氨酸", "NC(CC(=O)O)C(=O)O", "C4H7NO4"],
      ["谷氨酸", "NC(CCC(=O)O)C(=O)O", "C5H9NO4"],
      ["赖氨酸", "NCCCCC(N)C(=O)O", "C6H14N2O2"],
      ["组氨酸", "NC(Cc1c[nH]cn1)C(=O)O", "C6H9N3O2"],
      ["苯丙氨酸", "NC(Cc1ccccc1)C(=O)O", "C9H11NO2"],
      ["酪氨酸", "NC(Cc1ccc(O)cc1)C(=O)O", "C9H11NO3"],
      ["色氨酸", "NC(Cc1c[nH]c2ccccc12)C(=O)O", "C11H12N2O2"],
    ],
  },
  {
    cat: "药物 / 生物碱",
    items: [
      ["咖啡因", "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", "C8H10N4O2"],
      ["阿司匹林", "CC(=O)Oc1ccccc1C(=O)O", "C9H8O4"],
      ["对乙酰氨基酚", "CC(=O)Nc1ccc(O)cc1", "C8H9NO2"],
      ["布洛芬", "CC(C)Cc1ccc(cc1)C(C)C(=O)O", "C13H18O2"],
      ["萘普生", "COc1ccc2cc(ccc2c1)C(C)C(=O)O", "C14H14O3"],
    ],
  },
  // v10.15.16: 药物相关扩展块
  {
    cat: "药物化学 - 镇痛抗炎",
    items: [
      ["吗啡", "CN1CCC23c4c5ccc(O)c4O[C@H]2[C@@H](O)C=C[C@H]3[C@@H]1C5", "C17H19NO3"],
      ["可待因", "CN1CCC23c4c5ccc(OC)c4O[C@H]2[C@@H](O)C=C[C@H]3[C@@H]1C5", "C18H21NO3"],
      ["芬太尼", "CCC(=O)N(c1ccccc1)C1CCN(CCc2ccccc2)CC1", "C22H28N2O"],
      ["双氯芬酸", "OC(=O)Cc1ccc(NC2=C(Cl)C=CC=C2Cl)cc1", "C14H11Cl2NO2"],
      ["吲哚美辛", "CC1=C(CC(=O)O)C2=CC(OC)=CC=C2N1C(=O)C1=CC=C(Cl)C=C1", "C19H16ClNO4"],
      ["吡罗昔康", "CN1S(=O)(=O)c2ccccc2C(=C1O)C(=O)Nc1ccncc1", "C15H13N3O4S"],
      ["塞来昔布", "Cc1ccc(cc1)c1cc(C(F)(F)F)nn1c1ccc(S(N)(=O)=O)cc1", "C17H14F3N3O2S"],
    ],
  },
  {
    cat: "药物化学 - β-内酰胺类抗生素",
    items: [
      ["青霉素G", "CC1(C(N2C(S1)C(C2=O)NC(=O)Cc3ccccc3)C(=O)O)C", "C16H18N2O4S"],
      ["阿莫西林", "CC1(C(N2C(S1)C(C2=O)NC(=O)C(N)c3ccc(O)cc3)C(=O)O)C", "C16H19N3O5S"],
      ["头孢氨苄", "CC1=C(C(=O)O)N2C(=O)C(NC(=O)C(N)c3ccccc3)C2SC1", "C16H17N3O4S"],
    ],
  },
  {
    cat: "药物化学 - 心血管药物",
    items: [
      ["硝苯地平", "COC(=O)C1=C(C)NC(C)=C(C(=O)OC)C1c2ccccc2[N+](=O)[O-]", "C17H18N2O6"],
      ["卡托普利", "CC(CS)C(=O)N1CCCC1C(=O)O", "C9H15NO3S"],
      ["美托洛尔", "COCC(O)CNC(C)Cc1ccc(OCC)cc1", "C15H25NO3"],
    ],
  },
  {
    cat: "药物化学 - 抗肿瘤药物",
    items: [
      ["甲氨蝶呤", "CN(Cc1cnc2nc(N)nc(N)c2n1)C(=O)c1ccc(NC(CCC(=O)O)C(=O)O)cc1", "C20H22N8O5"],
      ["环磷酰胺", "ClCCN(CCCl)P1(=O)NCCCO1", "C7H15Cl2N2O2P"],
      ["顺铂", "[Pt](Cl)(Cl)(N)(N)", "Cl2H4N2Pt"],
    ],
  },
  {
    cat: "药物合成反应 - 中间体",
    items: [
      ["苯甲醛", "O=Cc1ccccc1", "C7H6O"],
      ["苯乙酮", "CC(=O)c1ccccc1", "C8H8O"],
      ["对硝基苯甲酸", "OC(=O)c1ccc([N+](=O)[O-])cc1", "C7H5NO4"],
      ["对氨基苯甲酸", "OC(=O)c1ccc(N)cc1", "C7H7NO2"],
      ["间苯二酚", "Oc1cccc(O)c1", "C6H6O2"],
      ["邻苯二甲酸酐", "O=C1OC(=O)c2ccccc12", "C8H4O3"],
      ["苯甲酰氯", "O=C(Cl)c1ccccc1", "C7H5ClO"],
    ],
  },
  {
    cat: "药理学 - 神经递质",
    items: [
      ["乙酰胆碱", "CC(=O)OCC[N+](C)(C)C", "C7H16NO2"],
      ["多巴胺", "NCCc1ccc(O)c(O)c1", "C8H11NO2"],
      ["去甲肾上腺素", "NCC(O)c1ccc(O)c(O)c1", "C8H11NO3"],
      ["5-羟色胺", "NCCc1c[nH]c2ccc(O)cc12", "C10H12N2O"],
      ["γ-氨基丁酸", "NCCCC(=O)O", "C4H9NO2"],
      ["谷氨酸", "NC(CCC(=O)O)C(=O)O", "C5H9NO4"],
      ["组胺", "NCCc1c[nH]cn1", "C5H9N3"],
    ],
  },
  {
    cat: "药理学 - 激素",
    items: [
      ["雌二醇", "C[C@]12CC[C@H]3[C@H]([C@@H]1CC[C@@H]2O)CCC4=C3C=CC(O)=C4", "C18H24O2"],
      ["睾酮", "C[C@]12CC[C@H]3[C@H]([C@@H]1CC[C@@H]2O)CCC4=CC(=O)CC[C@]34C", "C19H28O2"],
      ["孕酮", "C[C@]12CC[C@H]3[C@H]([C@@H]1CC[C@@H]2C(=O)C)CCC4=CC(=O)CC[C@]34C", "C21H30O2"],
      ["胰岛素(片段)", "NCC(=O)N[C@@H](CC(=O)O)C(=O)N", "C6H11N3O4"],
    ],
  },
  {
    cat: "生物化学 - 辅酶与核苷酸",
    items: [
      [
        "ATP",
        "Nc1ncnc2n(cnc12)[C@@H]1O[C@H](COP(=O)(O)OP(=O)(O)OP(=O)(O)O)[C@@H](O)[C@H]1O",
        "C10H16N5O13P3",
      ],
    ],
  },
  {
    cat: "制药合成工艺 - 常用试剂",
    items: [
      ["三乙胺", "CCN(CC)CC", "C6H15N"],
      ["吡啶", "c1ccncc1", "C5H5N"],
      ["三氟化硼乙醚", "B(F)(F)F.CCOCC", "C4H10BF3O"],
      ["四氢呋喃", "C1CCOC1", "C4H8O"],
      ["二甲基甲酰胺", "CN(C)C=O", "C3H7NO"],
      ["二甲亚砜", "CS(=O)C", "C2H6OS"],
      ["乙酸乙酯", "CCOC(=O)C", "C4H8O2"],
      ["二氯甲烷", "ClCCl", "CH2Cl2"],
      ["甲醇", "CO", "CH4O"],
      ["乙醇", "CCO", "C2H6O"],
    ],
  },
  // v10.15.16: 更多药物相关扩展
  {
    cat: "药物化学 - 精神类药物",
    items: [
      ["氟西汀", "CNCCC(Oc1ccccc1C(F)(F)F)c1ccccc1", "C17H18F3NO"],
      ["舍曲林", "CNC1CCc2ccccc2C1c1ccc(Cl)c(Cl)c1", "C17H17Cl2N"],
      ["氯丙嗪", "CN(C)CCCN1c2ccccc2Sc3ccc(Cl)cc13", "C17H19ClN2S"],
      ["地西泮", "CN1C(=O)CN=C(c2ccccc2)c3cc(Cl)ccc13", "C16H13ClN2O"],
      ["劳拉西泮", "OC1NC(=O)c2ccc(Cl)cc2C(c2ccccc2Cl)=N1", "C15H10Cl2N2O2"],
      ["唑吡坦", "Cc1ccc(cc1)c1nc2cc(C)ccc2n1CC(=O)N(C)C", "C19H21N3O"],
    ],
  },
  {
    cat: "药物化学 - 抗感染药物",
    items: [
      ["诺氟沙星", "CCN1C=C(C(=O)O)C(=O)c2cc(F)c(N3CCNCC3)cc21", "C16H18FN3O3"],
      ["环丙沙星", "C1CC1N1C=C(C(=O)O)C(=O)c2cc(F)c(N3CCNCC3)cc21", "C17H18FN3O3"],
      ["甲硝唑", "OCCn1c(C)nc(c1)[N+](=O)[O-]", "C6H9N3O3"],
    ],
  },
  {
    cat: "药物化学 - 内分泌药物",
    items: [
      ["二甲双胍", "CN(C)C(=N)NC(=N)N", "C4H11N5"],
      ["甲巯咪唑", "Sc1nccn1C", "C4H6N2S"],
      ["丙硫氧嘧啶", "CCCc1cc(=O)[nH]c(=S)[nH]1", "C7H10N2OS"],
    ],
  },
  {
    cat: "药物化学 - 消化系统药物",
    items: [
      ["西咪替丁", "Cc1[nH]cnc1CSCCN=C(NC#N)NC", "C10H16N6S"],
      ["雷尼替丁", "CN(C)Cc1ccc(o1)CSCCNC(=C[N+](=O)[O-])NC", "C13H22N4O3S"],
      ["奥美拉唑", "COc1ccc2[nH]c(SCc3c(C)nc(OC)c(C)c3O)nc2c1", "C17H19N3O3S"],
    ],
  },
  {
    cat: "药物合成 - 人名反应试剂",
    items: [
      ["格氏试剂(溴化苯基镁)", "c1ccccc1[Mg]Br", "C6H5BrMg"],
      ["LDA(二异丙基氨基锂)", "CC(C)N(C(C)C)[Li]", "C6H14LiN"],
      ["DCC(二环己基碳二亚胺)", "C1CCCCC1N=C=NC2CCCCC2", "C13H22N2"],
      ["EDC(1-乙基-(3-二甲基氨基丙基)碳二亚胺)", "CCN=C=NCCCN(C)C", "C8H17N3"],
      ["TBAF(四丁基氟化铵)", "CCCC[N+](CCCC)(CCCC)CCCC.[F-]", "C16H36FN"],
      ["Pd/C(钯碳)", "[Pd]", "Pd"],
    ],
  },
  {
    cat: "药物合成 - 保护基试剂",
    items: [
      ["Boc酸酐", "CC(C)(C)OC(=O)OC(=O)OC(C)(C)C", "C10H18O5"],
      ["Cbz-Cl(氯甲酸苄酯)", "O=C(Cl)OCc1ccccc1", "C8H7ClO2"],
      ["Fmoc-Cl(氯甲酸-9-芴甲酯)", "O=C(Cl)OCC2c1ccccc1c3ccccc23", "C15H11ClO2"],
      ["TBDMSCl(叔丁基二甲基氯硅烷)", "CC(C)(C)[Si](C)(C)Cl", "C6H15ClSi"],
      ["TFA(三氟乙酸)", "FC(F)(F)C(=O)O", "C2HF3O2"],
      ["乙酰氯", "CC(=O)Cl", "C2H3ClO"],
      ["乙酸酐", "CC(=O)OC(=O)C", "C4H6O3"],
    ],
  },
  {
    cat: "天然产物 - 生物碱",
    items: [
      ["阿托品", "CN1C2CCC1CC(C2)OC(=O)C(CO)c1ccccc1", "C17H23NO3"],
      ["莨菪碱", "CN1C2CCC1CC(C2)OC(=O)C(CO)c1ccccc1", "C17H23NO3"],
      ["麻黄碱", "CC(O)C(NC)c1ccccc1", "C10H15NO"],
      ["伪麻黄碱", "CC(O)C(NC)c1ccccc1", "C10H15NO"],
    ],
  },
  {
    cat: "天然产物 - 萜类与甾体",
    items: [
      ["薄荷醇", "CC1CCC(C(C1)O)C(C)C", "C10H20O"],
      ["樟脑", "CC1(C)C2CCC1(C)C(=O)C2", "C10H16O"],
    ],
  },
  {
    cat: "天然产物 - 黄酮与多酚",
    items: [
      ["槲皮素", "O=c1c(O)c(-c2ccc(O)c(O)c2)oc2cc(O)cc(O)c12", "C15H10O7"],
      ["白藜芦醇", "Oc1ccc(/C=C/c2cc(O)cc(O)c2)cc1", "C14H12O3"],
      ["姜黄素", "COc1ccc(C=CC(=O)CC(=O)C=Cc2ccc(OC)c(O)c2)cc1O", "C21H20O6"],
    ],
  },
  {
    cat: "药物代谢 - Ⅰ相代谢产物",
    items: [
      ["对羟基化代谢物", "Oc1ccc(cc1)C(=O)O", "C7H6O3"],
      ["葡糖醛酸苷", "OC1C(O)C(O)C(O)C(O1)C(=O)O", "C6H10O7"],
      ["硫酸结合物", "OS(=O)(=O)O", "H2O4S"],
      ["N-脱甲基代谢物", "Nc1ccc(O)cc1", "C6H7NO"],
      ["羟基化代谢物", "Oc1ccccc1", "C6H6O"],
      ["酮式代谢物", "CC(=O)c1ccccc1", "C8H8O"],
    ],
  },
  // v16.4.0: 扩展化学知识库到 300+
  {
    cat: "糖类",
    items: [
      ["葡萄糖", "OC[C@H]1OC(O)[C@@H](O)[C@H](O)[C@@H]1O", "C6H12O6"],
      ["果糖", "OC[C@H]1OC(=O)[C@H](O)[C@@H](O)[C@@H]1O", "C6H12O6"],
      ["半乳糖", "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O", "C6H12O6"],
      ["蔗糖", "OC[C@H]1OC(O[C@@H]2O[C@H](CO)[C@@H](O)[C@H](O)[C@H]2O)[C@H](O)[C@@H](O)[C@@H]1O", "C12H22O11"],
      ["麦芽糖", "OC[C@H]1OC(O[C@@H]2O[C@H](CO)[C@@H](O)[C@H](O)[C@H]2O)[C@H](O)[C@@H](O)[C@@H]1O", "C12H22O11"],
      ["淀粉(片段)", "OC[C@H]1OC(O)[C@@H](O)[C@H](O)[C@@H]1O", "(C6H10O5)n"],
      ["纤维素(片段)", "OC[C@H]1OC(O)[C@H](O)[C@@H](O)[C@@H]1O", "(C6H10O5)n"],
      ["核糖", "OC[C@H]1OC(O)[C@H](O)[C@@H]1O", "C5H10O5"],
      ["脱氧核糖", "OC[C@H]1OC(O)[C@H](O)[C@@H]1O", "C5H10O4"],
    ],
  },
  {
    cat: "维生素",
    items: [
      ["维生素C(抗坏血酸)", "OC(=O)C(O)=C(O)[C@H]1OC(CO)[C@@H](O)1", "C6H8O6"],
      ["维生素B1(硫胺素)", "CC1=C(C)C=C(SC[C@H]2O[C@H](CO)[C@@H](O)[C@@H]2O)N=C1N", "C12H17N4OS"],
      ["维生素B2(核黄素)", "C12H4N4O2(OH)4(CH3)2", "C17H20N4O6"],
      ["维生素B6(吡哆醇)", "Cc1c(CO)c(O)cc(CO)n1", "C8H11NO3"],
      ["维生素B12(片段)", "CN1C=NC2=C1C(=O)N(C(=O)N2C)C", "C63H88CoN14O14P"],
      ["维生素A(视黄醇)", "CC1=C(C(CCC1)(C)C)/C=C/C(=C/C=C/C(=C/CO)/C)/C", "C20H30O"],
      ["维生素D2(麦角钙化醇)", "CC(C)=CCCC(C)C(O)C1C(=C)CCC2C1(C)CCCC2(C)C", "C28H44O"],
      ["维生素E(α-生育酚)", "CC(C)=CCC[C@@](C)(O)c1ccc(OC)c2c1OCCC2(C)C", "C29H50O2"],
      ["维生素K1(叶绿醌)", "CC(C)=CCC[C@@](C)(O)c1ccc(OC)c2c1OCCC2(C)C", "C31H46O2"],
      ["烟酸(维生素B3)", "OC(=O)c1cccnc1", "C6H5NO2"],
      ["叶酸", "Nc1ncnc2n(cnc12)[C@@H]1O[C@H](COP(=O)(O)OP(=O)(O)OP(=O)(O)O)[C@@H](O)[C@H]1O", "C19H19N7O6"],
    ],
  },
  {
    cat: "核酸碱基",
    items: [
      ["腺嘌呤", "Nc1ncnc2n(cnc12)", "C5H5N5"],
      ["鸟嘌呤", "Nc1nc2n(cnc2c(=O)[nH]1)", "C5H5N5O"],
      ["胞嘧啶", "Nc1cncc(=O)[nH]1", "C4H5N3O"],
      ["胸腺嘧啶", "Cc1cn(c(=O)[nH]c1=O)", "C5H6N2O2"],
      ["尿嘧啶", "O=c1cc[nH]c(=O)[nH]1", "C4H4N2O2"],
    ],
  },
  {
    cat: "更多杂环化合物",
    items: [
      ["呋喃", "c1ccoc1", "C4H4O"],
      ["吡喃", "C1=CC=COC1", "C5H6O"],
      ["噻吩", "c1ccsc1", "C4H4S"],
      ["吡啶", "c1ccncc1", "C5H5N"],
      ["哒嗪", "c1cccnn1", "C4H4N2"],
      ["嘧啶", "c1cncnc1", "C4H4N2"],
      ["吡嗪", "c1cnccn1", "C4H4N2"],
      ["喹啉", "c1ccc2ncccc2c1", "C9H7N"],
      ["异喹啉", "c1ccc2ccncc2c1", "C9H7N"],
      ["吲哚", "c1ccc2[nH]ccc2c1", "C8H7N"],
      ["苯并呋喃", "c1ccc2occc2c1", "C8H6O"],
      ["苯并噻吩", "c1ccc2sccc2c1", "C8H6S"],
      ["咔唑", "c1ccc2c(c1)[nH]c1ccccc12", "C12H9N"],
      ["吖啶", "c1ccc2cc3ccccc3nc2c1", "C13H9N"],
      ["嘌呤", "c1ncc2nc[nH]c2n1", "C5H4N4"],
    ],
  },
  {
    cat: "更多天然产物",
    items: [
      ["尼古丁", "CN1CCCC1C1=CN=CC=C1", "C10H14N2"],
      ["吗啡", "CN1CCC23c4c5ccc(O)c4O[C@H]2[C@@H](O)C=C[C@H]3[C@@H]1C5", "C17H19NO3"],
      ["海洛因", "CN1CCC23c4c5ccc(OC(=O)C)c4O[C@H]2[C@@H](OC(=O)C)C=C[C@H]3[C@@H]1C5", "C21H23NO5"],
      ["可卡因", "COC(=O)C1CC2CCC1C(C2)OC(=O)Cc1ccccc1", "C17H21NO4"],
      ["奎宁", "COc1ccc2nccc([C@@H](O)[C@@H]3CCN4C5=C3C=CC(OC)=C5C=C4)c2c1", "C20H24N2O2"],
      ["紫杉醇(片段)", "CC1=C(C(=O)O)N2C(=O)C(NC(=O)C(N)c3ccccc3)C2SC1", "C47H51NO14"],
      ["青蒿素", "CC1(C)C2CCC1(C)C(=O)OC(=O)C2", "C15H22O5"],
      ["丹参酮ⅡA", "CC1=C(C)C2=C(C3=C1C(=O)C=C3)C(=O)OC2", "C19H18O3"],
      ["人参皂苷(片段)", "OC[C@H]1OC(O)[C@@H](O)[C@H](O)[C@@H]1O", "C42H72O14"],
      ["小檗碱", "COc1cc2c(cc1OC)C[n+]3CCc4cc(OC)c(OC)cc4C3=C2", "C20H18NO4"],
    ],
  },
  {
    cat: "更多药物 - 中枢神经",
    items: [
      ["阿司匹林", "CC(=O)Oc1ccccc1C(=O)O", "C9H8O4"],
      ["对乙酰氨基酚", "CC(=O)Nc1ccc(O)cc1", "C8H9NO2"],
      ["布洛芬", "CC(C)Cc1ccc(cc1)C(C)C(=O)O", "C13H18O2"],
      ["萘普生", "COc1ccc2cc(ccc2c1)C(C)C(=O)O", "C14H14O3"],
      ["双氯芬酸", "OC(=O)Cc1ccc(NC2=C(Cl)C=CC=C2Cl)cc1", "C14H11Cl2NO2"],
      ["吲哚美辛", "CC1=C(CC(=O)O)C2=CC(OC)=CC=C2N1C(=O)C1=CC=C(Cl)C=C1", "C19H16ClNO4"],
      ["吡罗昔康", "CN1S(=O)(=O)c2ccccc2C(=C1O)C(=O)Nc1ccncc1", "C15H13N3O4S"],
      ["塞来昔布", "Cc1ccc(cc1)c1cc(C(F)(F)F)nn1c1ccc(S(N)(=O)=O)cc1", "C17H14F3N3O2S"],
      ["美洛昔康", "Cc1cc(=O)n2[nH]c(=S)nc2s1", "C14H13N3O4S2"],
      ["酮洛芬", "CC(C(=O)O)c1ccc(-c2ccccc2)cc1", "C16H14O3"],
    ],
  },
  {
    cat: "更多药物 - 心血管",
    items: [
      ["硝苯地平", "COC(=O)C1=C(C)NC(C)=C(C(=O)OC)C1c2ccccc2[N+](=O)[O-]", "C17H18N2O6"],
      ["尼莫地平", "COC(=O)C1=C(C)NC(C)=C(C(=O)OCC=C)C1c2ccccc2[N+](=O)[O-]", "C21H26N2O7"],
      ["氨氯地平", "COC(=O)C1=C(C)NC(C)=C(C(=O)OCCN)C1c2cc(Cl)ccc2OCC", "C20H25ClN2O5"],
      ["卡托普利", "CC(CS)C(=O)N1CCCC1C(=O)O", "C9H15NO3S"],
      ["依那普利", "CC(C)CC(N)C(=O)N1CCCC1C(=O)O", "C20H28N2O5"],
      ["氯沙坦", "CCCc1cn(c2ccccc2)c1cc1ccc(C(=O)O)cc1", "C22H23ClN6O"],
      ["缬沙坦", "CCCc1cn(c2ccccc2)c1cc1ccc(C(=O)N(C)C(C)C(=O)O)cc1", "C24H29N5O3"],
      ["美托洛尔", "COCC(O)CNC(C)Cc1ccc(OCC)cc1", "C15H25NO3"],
      ["阿替洛尔", "CC(=O)Nc1ccc(OCC(O)CNC(C)C)cc1", "C14H22N2O3"],
      ["普萘洛尔", "OC(CNC(C)C)COc1ccccc1", "C16H21NO2"],
    ],
  },
  {
    cat: "更多药物 - 抗感染",
    items: [
      ["阿莫西林", "CC1(C(N2C(S1)C(C2=O)NC(=O)C(N)c3ccc(O)cc3)C(=O)O)C", "C16H19N3O5S"],
      ["头孢氨苄", "CC1=C(C(=O)O)N2C(=O)C(NC(=O)C(N)c3ccccc3)C2SC1", "C16H17N3O4S"],
      ["头孢曲松", "CC1=C(C(=O)O)N2C(=O)C(NC(=O)C(N)c3ccc(O)cc3)C2SC1", "C18H18N8O7S3"],
      ["诺氟沙星", "CCN1C=C(C(=O)O)C(=O)c2cc(F)c(N3CCNCC3)cc21", "C16H18FN3O3"],
      ["环丙沙星", "C1CC1N1C=C(C(=O)O)C(=O)c2cc(F)c(N3CCNCC3)cc21", "C17H18FN3O3"],
      ["左氧氟沙星", "C1CC1N1C=C(C(=O)O)C(=O)c2cc(F)c(N3CCNCC3)cc21", "C18H20FN3O4"],
      ["阿奇霉素", "CC1OC(=O)C(C)C(OC(=O)C(C)C(OC(=O)C(C)C(OC(=O)C(C)C(OC(=O)C(C)C(OC(=O)C(C)C(OC(=O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C(C)C(O)C)C(=O)O", "C38H72N2O12"],
      ["甲硝唑", "OCCn1c(C)nc(c1)[N+](=O)[O-]", "C6H9N3O3"],
      ["克霉唑", "Clc1ccc(C(=C(c2ccccc2)c3ccccc3)n4ccnc4)cc1", "C22H17ClN2"],
      ["氟康唑", "c1nc(nc(n1)c2ccc(cc2)OCC(O)CN3C=CN=C3)c4ccc(cc4)F", "C13H12F2N6O"],
    ],
  },
  {
    cat: "更多药物 - 抗肿瘤",
    items: [
      ["环磷酰胺", "ClCCN(CCCl)P1(=O)NCCCO1", "C7H15Cl2N2O2P"],
      ["异环磷酰胺", "ClCCN(CCCl)P1(=O)NCCCO1", "C7H15Cl2N2O2P"],
      ["顺铂", "[Pt](Cl)(Cl)(N)(N)", "Cl2H4N2Pt"],
      ["卡铂", "[Pt]1(OC(=O)C2CCCCC2C(=O)O1)(N)N", "C6H12N2O4Pt"],
      ["甲氨蝶呤", "CN(Cc1cnc2nc(N)nc(N)c2n1)C(=O)c1ccc(NC(CCC(=O)O)C(=O)O)cc1", "C20H22N8O5"],
      ["氟尿嘧啶", "O=c1cc(F)[nH]c(=O)[nH]1", "C4H3FN2O2"],
      ["阿糖胞苷", "Nc1ncnc2n(cnc12)[C@@H]1O[C@H](CO)[C@@H](O)[C@H]1O", "C9H11N3O5"],
      ["紫杉醇(片段)", "CC1=C(C(=O)O)N2C(=O)C(NC(=O)C(N)c3ccccc3)C2SC1", "C47H51NO14"],
      ["多西他赛(片段)", "CC1=C(C(=O)O)N2C(=O)C(NC(=O)C(N)c3ccccc3)C2SC1", "C43H53NO14"],
      ["吉非替尼", "COc1cc2ncnc(Nc3ccc(F)c(Cl)c3)c2cc1OCCCN1CCOCC1", "C22H24ClFN4O3"],
    ],
  },
  {
    cat: "更多药物 - 精神类",
    items: [
      ["氟西汀", "CNCCC(Oc1ccccc1C(F)(F)F)c1ccccc1", "C17H18F3NO"],
      ["帕罗西汀", "COc1ccc(cc1)C(O)CN2CCC(CC2)Oc3ccccc3", "C19H20FNO3"],
      ["舍曲林", "CNC1CCc2ccccc2C1c1ccc(Cl)c(Cl)c1", "C17H17Cl2N"],
      ["氟伏沙明", "COc1ccc(cc1)C(O)CN2CCC(CC2)C#N", "C15H21F3N2O2"],
      ["西酞普兰", "COc1ccc(cc1)C(O)CN2CCC(CC2)C#N", "C20H21FN2O"],
      ["氯丙嗪", "CN(C)CCCN1c2ccccc2Sc3ccc(Cl)cc13", "C17H19ClN2S"],
      ["异丙嗪", "CN(C)CCN1c2ccccc2Sc3ccccc13", "C17H20N2S"],
      ["地西泮", "CN1C(=O)CN=C(c2ccccc2)c3cc(Cl)ccc13", "C16H13ClN2O"],
      ["劳拉西泮", "OC1NC(=O)c2ccc(Cl)cc2C(c2ccccc2Cl)=N1", "C15H10Cl2N2O2"],
      ["阿普唑仑", "Cc1nn(c2cc(Cl)ccc12)C1=NC=CN=C1", "C17H13ClN4"],
      ["唑吡坦", "Cc1ccc(cc1)c1nc2cc(C)ccc2n1CC(=O)N(C)C", "C19H21N3O"],
      ["利培酮", "CC1=C(C(=O)O)N2C(=O)C(NC(=O)C(N)c3ccccc3)C2SC1", "C23H27FN4O2"],
      ["奥氮平", "CC1=C(C(=O)O)N2C(=O)C(NC(=O)C(N)c3ccccc3)C2SC1", "C17H20N4S"],
      ["喹硫平", "CC1=C(C(=O)O)N2C(=O)C(NC(=O)C(N)c3ccccc3)C2SC1", "C21H25N3O2S"],
      ["阿立哌唑", "CC1=C(C(=O)O)N2C(=O)C(NC(=O)C(N)c3ccccc3)C2SC1", "C23H27Cl2N3O2"],
    ],
  },
  {
    cat: "更多溶剂与试剂",
    items: [
      ["正己烷", "CCCCCC", "C6H14"],
      ["环己烷", "C1CCCCC1", "C6H12"],
      ["苯", "c1ccccc1", "C6H6"],
      ["甲苯", "Cc1ccccc1", "C7H8"],
      ["二甲苯", "Cc1ccccc1C", "C8H10"],
      ["氯苯", "Clc1ccccc1", "C6H5Cl"],
      ["二氯甲烷", "ClCCl", "CH2Cl2"],
      ["氯仿", "ClC(Cl)Cl", "CHCl3"],
      ["四氯化碳", "ClC(Cl)(Cl)Cl", "CCl4"],
      ["乙醚", "CCOCC", "C4H10O"],
      ["异丙醚", "CC(C)OC(C)C", "C6H14O"],
      ["乙酸乙酯", "CCOC(=O)C", "C4H8O2"],
      ["丙酮", "CC(=O)C", "C3H6O"],
      ["丁酮", "CCC(=O)C", "C4H8O"],
      ["甲醇", "CO", "CH4O"],
      ["乙醇", "CCO", "C2H6O"],
      ["异丙醇", "CC(C)O", "C3H8O"],
      ["正丁醇", "CCCCO", "C4H10O"],
      ["DMSO", "CS(=O)C", "C2H6OS"],
      ["DMF", "CN(C)C=O", "C3H7NO"],
      ["乙腈", "CC#N", "C2H3N"],
      ["二氧六环", "C1COCCO1", "C4H8O2"],
      ["THF", "C1CCOC1", "C4H8O"],
      ["吡啶", "c1ccncc1", "C5H5N"],
      ["三乙胺", "CCN(CC)CC", "C6H15N"],
    ],
  },
];

// ---------------- 分子式反推 (结构 → 可读结构式, 如 甲烷 → CH4) ----------------
// Hill 记法: 含碳时 C、H 在前, 其余按字母序; 不含碳时全部按字母序。
// 通过原子序数 + 隐式氢(getImplicitHydrogens)求和; 显式 H 原子已被 getAllAtoms 计入。
const ELEMENT_SYMBOLS = {
  1: "H",
  2: "He",
  3: "Li",
  4: "Be",
  5: "B",
  6: "C",
  7: "N",
  8: "O",
  9: "F",
  10: "Ne",
  11: "Na",
  12: "Mg",
  13: "Al",
  14: "Si",
  15: "P",
  16: "S",
  17: "Cl",
  18: "Ar",
  19: "K",
  20: "Ca",
  21: "Sc",
  22: "Ti",
  23: "V",
  24: "Cr",
  25: "Mn",
  26: "Fe",
  27: "Co",
  28: "Ni",
  29: "Cu",
  30: "Zn",
  31: "Ga",
  32: "Ge",
  33: "As",
  34: "Se",
  35: "Br",
  36: "Kr",
  37: "Rb",
  38: "Sr",
  39: "Y",
  40: "Zr",
  41: "Nb",
  42: "Mo",
  43: "Tc",
  44: "Ru",
  45: "Rh",
  46: "Pd",
  47: "Ag",
  48: "Cd",
  49: "In",
  50: "Sn",
  51: "Sb",
  52: "Te",
  53: "I",
  54: "Xe",
  55: "Cs",
  56: "Ba",
  57: "La",
  58: "Ce",
  59: "Pr",
  60: "Nd",
  61: "Pm",
  62: "Sm",
  63: "Eu",
  64: "Gd",
  65: "Tb",
  66: "Dy",
  67: "Ho",
  68: "Er",
  69: "Tm",
  70: "Yb",
  71: "Lu",
  72: "Hf",
  73: "Ta",
  74: "W",
  75: "Re",
  76: "Os",
  77: "Ir",
  78: "Pt",
  79: "Au",
  80: "Hg",
  81: "Tl",
  82: "Pb",
  83: "Bi",
  84: "Po",
  85: "At",
  86: "Rn",
  87: "Fr",
  88: "Ra",
  89: "Ac",
  90: "Th",
  91: "Pa",
  92: "U",
  93: "Np",
  94: "Pu",
  95: "Am",
  96: "Cm",
  97: "Bk",
  98: "Cf",
  99: "Es",
  100: "Fm",
  101: "Md",
  102: "No",
  103: "Lr",
  104: "Rf",
  105: "Db",
  106: "Sg",
  107: "Bh",
  108: "Hs",
  109: "Mt",
  110: "Ds",
  111: "Rg",
  112: "Cn",
  113: "Nh",
  114: "Fl",
  115: "Mc",
  116: "Lv",
  117: "Ts",
  118: "Og",
};

function molToFormula(mol) {
  if (!mol) return "";
  const counts = {};
  let n = 0;
  try {
    n = mol.getAllAtoms();
  } catch (e) {
    n = 0;
  }
  for (let i = 0; i < n; i++) {
    let z = 0;
    try {
      z = mol.getAtomicNo(i);
    } catch (e) {
      z = 0;
    }
    if (!z) continue; // 0 = 占位/哑原子
    const sym = ELEMENT_SYMBOLS[z] || "#" + z;
    counts[sym] = (counts[sym] || 0) + 1;
    // 隐式氢: OCL 默认不显式存 H, 通过 getImplicitHydrogens 反推
    let h = 0;
    try {
      h = mol.getImplicitHydrogens(i);
    } catch (e) {
      h = 0;
    }
    if (h > 0) counts["H"] = (counts["H"] || 0) + h;
  }
  const symbols = Object.keys(counts);
  symbols.sort((a, b) => {
    if (counts.C !== undefined) {
      if (a === "C") return -1;
      if (b === "C") return 1;
      if (a === "H") return -1;
      if (b === "H") return 1;
    }
    return a < b ? -1 : a > b ? 1 : 0;
  });
  let out = "";
  for (const s of symbols) out += s + (counts[s] > 1 ? String(counts[s]) : "");
  return out;
}

// ---------------- 编辑器模态框 ----------------
class MoleculeEditorModal extends Modal {
  constructor(app, initialSmiles, onSave, initialChemfig, opts) {
    super(app);
    this.initialSmiles = initialSmiles || "";
    this.initialChemfig = initialChemfig || "";
    this.onSave = onSave;
    this.enableTemplateLibrary = !opts || opts.enableTemplateLibrary !== false;
    this.editor = null;
    this.editorContainer = null;
    this.statusEl = null;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("chem-modal-root");
    contentEl.addClass("molecule-editor-modal");

    contentEl.createEl("h2", { text: "分子结构式编辑器" });
    contentEl.createEl("p", {
      cls: "molecule-editor-hint",
      text: "在画布上直接绘制 / 拼键，或从右侧「片段库」与下方「示例」一键载入，完成后生成 chemfig 插入笔记。",
    });

    let OCL;
    try {
      OCL = getOCL();
    } catch (e) {
      contentEl.createEl("p", { text: "OpenChemLib 初始化失败: " + e.message });
      return;
    }

    // ==== v16.4.0: 三栏布局 - 左侧学习栏(可收缩) + 中间画布 + 右侧化学库 ====
    const cols = contentEl.createDiv("chem-modal-columns molecule-editor-columns");

    // 左侧学习栏（可收缩）
    const learningCol = cols.createDiv("chem-modal-sidebar chem-modal-sidebar--left molecule-editor-learning-sidebar");
    learningCol.style.cssText =
      "background:var(--background-primary);border-right:1px solid var(--background-modifier-border);overflow:hidden;display:flex;flex-direction:column;min-height:0;";

    // 中间主区域
    const mainCol = cols.createDiv("chem-modal-canvas molecule-editor-main");

    // 右侧化学库（常驻）
    const sideCol = cols.createDiv("chem-modal-sidebar chem-modal-sidebar--right molecule-editor-sidebar");

    // ==== v16.4.0: 画布上方悬浮工具栏 ====
    const floatingToolbar = mainCol.createDiv("chem-modal-toolbar molecule-editor-floating-toolbar");
    
    // 第一行: 编辑操作 + 主要操作
    const toolbarTop = floatingToolbar.createDiv("chem-modal-toolbar-row molecule-editor-toolbar-top");

    // 左侧: 编辑操作组
    const editGroup = toolbarTop.createDiv("chem-modal-toolbar-group molecule-editor-tool-group");
    editGroup.createEl("button", {
      text: "↩️",
      cls: "chem-modal-tool-btn molecule-editor-tool-btn",
    }).onclick = () => this.undo();
    editGroup.querySelector("button").title = "撤销 (Ctrl+Z)";

    editGroup.createEl("button", {
      text: "↪️",
      cls: "chem-modal-tool-btn molecule-editor-tool-btn",
    }).onclick = () => this.redo();
    editGroup.querySelectorAll("button")[1].title = "重做 (Ctrl+Y)";

    editGroup.createEl("button", {
      text: "🗑️",
      cls: "chem-modal-tool-btn molecule-editor-tool-btn",
    }).onclick = () => {
      this.pushHistory();
      if (this.editor) this.editor.clearAll();
      this.setStatus("画布已清空");
    };
    editGroup.querySelectorAll("button")[2].title = "清空画布";

    editGroup.createEl("button", {
      text: "🔍",
      cls: "chem-modal-tool-btn molecule-editor-tool-btn",
    }).onclick = () => this.resetView();
    editGroup.querySelectorAll("button")[3].title = "重置视图 (Ctrl+0)";

    // 分隔线
    toolbarTop.createDiv("chem-modal-toolbar-divider toolbar-divider");

    // 工具选择组
    const toolGroup = toolbarTop.createDiv("chem-modal-toolbar-group molecule-editor-tool-group");
    
    const selectBtn = toolGroup.createEl("button", {
      text: "👆",
      cls: "chem-modal-tool-btn molecule-editor-tool-btn active",
    });
    selectBtn.title = "选择/移动";
    selectBtn.onclick = () => {
      this._setActiveTool(selectBtn);
      this.setStatus("选择模式：点击原子/键进行编辑");
    };

    const eraseBtn = toolGroup.createEl("button", {
      text: "🗑️",
      cls: "chem-modal-tool-btn molecule-editor-tool-btn",
    });
    eraseBtn.title = "删除工具";
    eraseBtn.onclick = () => {
      this._setActiveTool(eraseBtn);
      this.setStatus("删除模式：点击要删除的原子/键");
    };



    // 分隔线

    // 分隔线
    toolbarTop.createDiv("chem-modal-toolbar-divider toolbar-divider");

    // 化学工具组
    const chemGroup = toolbarTop.createDiv("chem-modal-toolbar-group molecule-editor-tool-group");
    
    const namingBtn = chemGroup.createEl("button", {
      text: "🔤",
      cls: "chem-modal-tool-btn molecule-editor-tool-btn",
    });
    namingBtn.title = "化学命名";
    namingBtn.onclick = () => this.openNamingPanel();

    const formulaBtn = chemGroup.createEl("button", {
      text: "🧮",
      cls: "chem-modal-tool-btn molecule-editor-tool-btn",
    });
    formulaBtn.title = "计算分子式";
    formulaBtn.onclick = () => this.computeFormulaFromToolbar();

    const fgBtn = chemGroup.createEl("button", {
      text: "⚗️",
      cls: "chem-modal-tool-btn molecule-editor-tool-btn",
    });
    fgBtn.title = "官能团分析";
    fgBtn.onclick = () => this.openFunctionalGroupAnalysis();

    const dbBtn = chemGroup.createEl("button", {
      text: "📚",
      cls: "chem-modal-tool-btn molecule-editor-tool-btn",
    });
    dbBtn.title = "化合物数据库";
    dbBtn.onclick = () => this.openCompoundDatabase();

    const viewer3DBtn = chemGroup.createEl("button", {
      text: "🧊",
      cls: "chem-modal-tool-btn molecule-editor-tool-btn",
    });
    viewer3DBtn.title = "3D 查看器";
    viewer3DBtn.onclick = () => this.open3DViewer();

    // 右侧: 主要操作按钮
    const mainActions = toolbarTop.createDiv("chem-modal-toolbar-group molecule-editor-tool-group");

    mainActions.createEl("button", {
      text: "💾 仅保存 SMILES",
      cls: "chem-modal-tool-btn molecule-editor-tool-btn secondary",
    }).onclick = () => {
      const mol = this.getMoleculeSafe();
      if (!mol) return;
      try {
        const smiles = mol.toIsomericSmiles();
        this.onSave({ type: "smiles", value: smiles });
        this.close();
      } catch (e) {
        new Notice("导出失败: " + e.message);
      }
    };

    mainActions.createEl("button", {
      text: "✨ 插入结构式",
      cls: "chem-modal-tool-btn molecule-editor-tool-btn primary",
    }).onclick = () => {
      const mol = this.getMoleculeSafe();
      if (!mol) return;
      try {
        const smiles = mol.toIsomericSmiles();
        const chemfig = molGenerateChemfig(mol);
        this.onSave({ type: "chemfig", code: chemfig, smiles });
        this.close();
      } catch (e) {
        new Notice("导出失败: " + e.message);
      }
    };

    // ==== SMILES 输入栏 ====
    const smilesBar = mainCol.createDiv("molecule-editor-smiles-bar");
    const smilesInputEl = smilesBar.createEl("input", {
      type: "text",
      placeholder: "输入 SMILES 字符串加载分子...",
      cls: "molecule-editor-smiles-input",
    });

    smilesBar.createEl("button", {
      text: "📂 加载",
      cls: "molecule-editor-smiles-btn",
    }).onclick = () => {
      const val = smilesInputEl.value.trim();
      if (!val) return;
      try {
        const mol = getOCL().Molecule.fromSmiles(val);
        this.loadMolecule(mol, "已加载: " + val);
      } catch (e) {
        this.setStatus("SMILES 解析失败: " + e.message);
        new Notice("SMILES 解析失败: " + e.message);
      }
    };

    // ==== 画布 ====
    this.editorContainer = mainCol.createDiv("molecule-editor-canvas");
    this.statusEl = mainCol.createDiv("molecule-editor-status");
    this.setStatus("画布就绪，可直接绘制分子");

    try {
      this.editor = new OCL.CanvasEditor(this.editorContainer, {});
      
      // v16.4.0: 隐藏 OCL 自带的左侧工具栏，使用我们自己的悬浮工具栏
      setTimeout(() => {
        // 隐藏 OCL 自带的工具栏
        const oclToolbar = this.editorContainer.querySelector('.ocl-editor__toolbar, .mol-widget__toolbar, [class*="toolbar"]');
        if (oclToolbar) {
          oclToolbar.style.display = 'none';
        }
        // 也隐藏所有左侧面板
        const oclLeftPanel = this.editorContainer.querySelector('.ocl-editor__left-panel, .mol-widget__left-panel, [class*="left-panel"]');
        if (oclLeftPanel) {
          oclLeftPanel.style.display = 'none';
        }
      }, 200);
      
      // v16.4.0: 实现悬浮工具栏可拖动
      const floatingToolbar = contentEl.querySelector('.molecule-editor-floating-toolbar');
      if (floatingToolbar) {
        this.makeDraggable(floatingToolbar);
      }
      
      setTimeout(() => addOclToolbarTooltips(this.editorContainer), 120);
      this.setupCanvasGestures();
      this.setupKeyboardShortcuts();

      // v17.1.0: 触发画布初始化事件
      try {
        const hooks = (globalThis as any).EventHookManager.getInstance();
        hooks.emitCanvasInit(this.editor);
      } catch (e) {
        console.warn('[MoleculeEditor] Event hooks not available:', e);
      }

      // v10.15.9: 绑定画布结构变化事件，自动记录历史栈
      try {
        if (this.editor && typeof this.editor.onStructureChange === "function") {
          this.editor.onStructureChange(() => {
            // 防抖：避免连续绘制时记录太多历史
            clearTimeout(this._historyDebounce);
            this._historyDebounce = setTimeout(() => this.pushHistory(), 500);
          });
        } else if (this.editor && this.editor.canvas) {
          // 备用：监听画布鼠标松开事件
          const canvas = this.editor.canvas;
          if (canvas) {
            canvas.addEventListener("mouseup", () => {
              clearTimeout(this._historyDebounce);
              this._historyDebounce = setTimeout(() => this.pushHistory(), 500);
            });
          }
        }
      } catch (e) {
        /* ignore */
      }

      if (this.initialChemfig && this.initialChemfig.trim()) {
        const mol = chemfigToMolecule(this.initialChemfig.trim());
        this.loadMolecule(mol, "已从 chemfig 代码解析 " + mol.getAllAtoms() + " 个原子");
      } else if (this.initialSmiles && this.initialSmiles.trim()) {
        const mol = OCL.Molecule.fromSmiles(this.initialSmiles.trim());
        this.loadMolecule(mol, "已加载 SMILES: " + this.initialSmiles.trim());
      }
    } catch (e) {
      this.setStatus("画布初始化失败: " + e.message);
      new Notice("分子画布初始化失败: " + e.message);
    }

    // ==== 更多功能 (折叠式) ====
    const moreFuncWrap = mainCol.createDiv("molecule-editor-more-wrap");
    const moreToggle = moreFuncWrap.createEl("button", {
      text: "🔧 更多功能 ▾",
      cls: "molecule-editor-more-toggle",
    });
    const moreFuncContent = moreFuncWrap.createDiv("molecule-editor-more-content");
    moreFuncContent.style.display = "none";

    let moreOpen = false;
    moreToggle.onclick = () => {
      moreOpen = !moreOpen;
      moreFuncContent.style.display = moreOpen ? "block" : "none";
      moreToggle.textContent = moreOpen ? "🔧 更多功能 ▴" : "🔧 更多功能 ▾";
    };

    // v16.4.0: 功能按钮容器
    const funcBtnRow = moreFuncContent.createDiv("molecule-editor-func-row");
    funcBtnRow.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;margin-top:8px;";

    // 功能按钮配置
    const funcButtons = [
      {
        icon: "🧊",
        name: "3D 查看器",
        tooltip: "在 3D 模式下查看当前分子",
        action: () => {
          const mol = this.getMoleculeSafe();
          if (!mol) {
            new Notice("请先在画布上绘制分子", 2000);
            return;
          }
          try {
            const smiles = mol.toIsomericSmiles();
            if (typeof Molecule3DModal !== "undefined") {
              new Molecule3DModal(this.app, smiles).open();
            }
          } catch (e) {
            new Notice("打开 3D 查看器失败: " + e.message, 3000);
          }
        },
      },
      {
        icon: "⚗️",
        name: "反应条件速查",
        tooltip: "查询常见有机反应的条件和产物",
        action: () => {
          if (typeof ReactionConditionsModal !== "undefined") {
            new ReactionConditionsModal(this.app).open();
          } else {
            new Notice("反应条件速查未加载", 2000);
          }
        },
      },
      {
        icon: "🔬",
        name: "官能团分析",
        tooltip: "分析当前分子的官能团",
        action: () => {
          const mol = this.getMoleculeSafe();
          if (!mol) {
            new Notice("请先在画布上绘制分子", 2000);
            return;
          }
          try {
            const smiles = mol.toIsomericSmiles();
            if (typeof FunctionalGroupAnalysisModal !== "undefined") {
              new FunctionalGroupAnalysisModal(this.app, smiles).open();
            } else {
              new Notice("官能团分析模块未加载", 2000);
            }
          } catch (e) {
            new Notice("分析失败: " + e.message, 3000);
          }
        },
      },
      {
        icon: "📚",
        name: "学习统计",
        tooltip: "打开学习数据统计面板",
        action: () => {
          if (typeof LearningAnalyticsModal !== "undefined") {
            new LearningAnalyticsModal(this.app).open();
          } else {
            new Notice("学习统计面板未加载", 2000);
          }
        },
      },
    ];

    // 创建按钮
    funcButtons.forEach((btn) => {
      const button = funcBtnRow.createEl("button", {
        text: `${btn.icon} ${btn.name}`,
        cls: "molecule-editor-func-btn",
      });
      button.style.cssText = `
        padding: 6px 12px;
        background: var(--background-secondary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
      `;
      button.onmouseover = () => {
        button.style.background = "var(--background-modifier-hover)";
      };
      button.onmouseout = () => {
        button.style.background = "var(--background-secondary)";
      };
      button.title = btn.tooltip;
      button.onclick = btn.action;
    });

    // v16.0.0: 快捷键说明面板
    const helpEl = moreFuncContent.createDiv("molecule-editor-shortcuts");
    helpEl.style.cssText = `
      margin-top: 12px;
      padding: 12px;
      background: var(--background-secondary);
      border-radius: 8px;
      font-size: 11px;
    `;
    
    helpEl.createEl("div", { 
      text: "⌨️ 快捷键说明",
      cls: "molecule-editor-shortcuts-title",
    }).style.cssText = "font-weight: 600; margin-bottom: 8px; font-size: 12px;";

    const shortcuts = [
      { keys: "Ctrl + Z", desc: "撤销上一步操作" },
      { keys: "Ctrl + Y / Ctrl + Shift + Z", desc: "重做" },
      { keys: "Ctrl + 0", desc: "重置视图" },
      { keys: "Delete / Backspace", desc: "删除选中的原子/键" },
      { keys: "滚轮", desc: "以光标为中心缩放画布" },
      { keys: "右键拖动", desc: "平移画布" },
      { keys: "Esc", desc: "取消当前选择/操作" },
    ];

    const shortcutsList = helpEl.createDiv("shortcuts-list");
    shortcuts.forEach(s => {
      const row = shortcutsList.createDiv("shortcut-row");
      row.style.cssText = "display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid var(--background-modifier-border);";
      
      const keysSpan = row.createSpan({ text: s.keys });
      keysSpan.style.cssText = "font-family: monospace; background: var(--background-primary); padding: 1px 6px; border-radius: 4px; font-size: 10px;";
      
      const descSpan = row.createSpan({ text: s.desc });
      descSpan.style.cssText = "color: var(--text-muted);";
    });

    // 操作提示
    const tipsEl = mainCol.createDiv("molecule-editor-help");
    tipsEl.innerHTML =
      "<strong>操作提示:</strong> 顶部悬浮工具栏选原子/键类型绘制 | 选中后 Delete 删除 | " +
      "选键类型后点击两原子间拼键 | 滚轮缩放 | 右键拖动平移";

    // ==== 片段库（画布右侧）====
    if (this.enableTemplateLibrary !== false) {
      this.sideCol = sideCol;
      this.buildFragmentLibrary(sideCol);
    } else {
      sideCol.createEl("div", {
        text: "片段库已在设置中关闭",
        cls: "molecule-editor-section-title",
      });
    }

    // ==== 学习模块（左侧可收缩栏）====
    this.learningCol = learningCol;
    this.buildLearningSidebar(learningCol, cols);
  }

  // 构建右侧片段库（含编辑器模板导入的环结构）- v16.0.0: 新三栏布局
  buildFragmentLibrary(container) {
    try {
      // 侧边栏头部
      const header = container.createDiv("sidebar-header");
      header.createSpan({ text: "🧩 化合物库" });
      const collapseBtn = header.createEl("button", {
        text: "—",
        cls: "chem-modal-tool-btn molecule-editor-tool-btn",
      });
      collapseBtn.style.cssText =
        "padding:2px 8px;border:none;background:transparent;cursor:pointer;font-size:14px;border-radius:4px;";
      collapseBtn.onmouseenter = () => {
        collapseBtn.style.background = "var(--background-modifier-hover)";
      };
      collapseBtn.onmouseleave = () => {
        collapseBtn.style.background = "transparent";
      };
      collapseBtn.onclick = () => {
        const body = container.querySelector(".sidebar-body");
        if (body.style.display === "none") {
          body.style.display = "flex";
          collapseBtn.textContent = "—";
        } else {
          body.style.display = "none";
          collapseBtn.textContent = "+";
        }
      };

      // 搜索区域
      const searchArea = container.createDiv("sidebar-search");
      const searchInput = searchArea.createEl("input", {
        type: "text",
        placeholder: "搜索: 名称 / SMILES / 分子式...",
        cls: "molecule-lib-search",
      });

      // v10.15.13: 搜索自动补全下拉容器
      const autocompleteContainer = container.createDiv("molecule-autocomplete");
      autocompleteContainer.style.cssText =
        "position:absolute;top:100%;left:0;right:0;max-height:200px;overflow-y:auto;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:4px;z-index:1000;display:none;box-shadow:0 4px 12px rgba(0,0,0,0.15);";
      searchInput.parentElement.style.position = "relative";

      // 内容区域
      const body = container.createDiv("sidebar-body");
      
      // 修复 wheel 事件被 Obsidian Modal 拦截
      body.addEventListener("wheel", (e) => {
        e.stopPropagation();
      }, { passive: false });

      // v10.16.0: 学习模块已移至左侧边栏

      let autocompleteTimeout = null;

      // v10.15.13: 显示自动补全建议
      function showAutocompleteSuggestions(query) {
        if (!query || query.trim().length < 1) {
          autocompleteContainer.style.display = "none";
          return;
        }

        query = query.trim().toLowerCase();

        // 收集所有片段名称
        const allNames = [];
        for (const cat of fragments) {
          for (const item of cat.items) {
            const name = item[0] || "";
            const smiles = item[1] || "";
            const formula = item[2] || "";
            if (
              name.toLowerCase().includes(query) ||
              smiles.toLowerCase().includes(query) ||
              formula.toLowerCase().includes(query)
            ) {
              allNames.push({ name, smiles, formula, category: cat.cat });
            }
          }
        }

        // 也从命名索引中搜索
        try {
          const nameIndex = JSON.parse(
            localStorage.getItem("chemfig-structure-name-index") || "{}"
          );
          for (const [smiles, info] of Object.entries(nameIndex)) {
            if (typeof info === "object" && info !== null) {
              const name = info.name || "";
              const formula = info.formula || "";
              if (
                name.toLowerCase().includes(query) ||
                smiles.toLowerCase().includes(query) ||
                formula.toLowerCase().includes(query)
              ) {
                allNames.push({ name, smiles, formula, category: "命名索引" });
              }
            }
          }
        } catch (e) {
          // 忽略索引读取错误
        }

        // 去重并取前 8 条
        const seen = new Set();
        const suggestions = [];
        for (const s of allNames) {
          if (!seen.has(s.name)) {
            seen.add(s.name);
            suggestions.push(s);
            if (suggestions.length >= 8) break;
          }
        }

        if (suggestions.length === 0) {
          autocompleteContainer.style.display = "none";
          return;
        }

        // 渲染建议列表
        autocompleteContainer.innerHTML = "";
        for (const s of suggestions) {
          const item = document.createElement("div");
          item.style.cssText =
            "padding:6px 10px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--background-modifier-border);display:flex;justify-content:space-between;align-items:center;";
          item.innerHTML = `<span>${s.name}</span><span style="font-size:10px;color:var(--text-muted);">${s.category}</span>`;
          item.onmouseenter = () => (item.style.background = "var(--background-modifier-hover)");
          item.onmouseleave = () => (item.style.background = "");
          item.onclick = () => {
            searchInput.value = s.name;
            autocompleteContainer.style.display = "none";
            renderList();
          };
          autocompleteContainer.appendChild(item);
        }

        autocompleteContainer.style.display = "block";
      }

      // 输入事件（节流 200ms）
      searchInput.addEventListener("input", () => {
        clearTimeout(autocompleteTimeout);
        autocompleteTimeout = setTimeout(() => {
          showAutocompleteSuggestions(searchInput.value);
        }, 200);
      });

      // 点击外部关闭下拉
      // 必须保存句柄并在 onClose 中移除: 此前用匿名函数直接挂在 document 上且从不清理,
      // 每打开一次分子编辑器就永久累积一个 document 级 click 监听 (闭包持有 searchInput
      // 与 autocompleteContainer 两个 DOM 节点), 关闭后仍会在每次全局点击时执行。
      const outsideClickHandler = (e) => {
        const parent = searchInput.parentElement;
        // 模态关闭后节点已脱离文档树, parent 可能为 null
        if (parent && !parent.contains(e.target)) {
          autocompleteContainer.style.display = "none";
        }
      };
      document.addEventListener("click", outsideClickHandler);
      this._autocompleteCleanup = () => {
        document.removeEventListener("click", outsideClickHandler);
      };

      // 搜索类型提示
      const searchHint = body.createEl("div");
      searchHint.style.cssText = "font-size:10px;color:var(--text-muted);margin:4px 0 8px 0;flex-shrink:0;";
      searchHint.textContent =
        "搜索: 中文名(苯)/SMILES/分子式；导入支持 SMILES、分子式或英文名(PubChem)";

      // 片段库独立容器
      const fragmentContainer = body.createDiv("fragment-library-container");
      fragmentContainer.style.cssText =
        "flex:1;min-height:0;display:flex;flex-direction:column;overflow:hidden;";

      // 分类筛选卡片
      const categoryCard = fragmentContainer.createDiv("category-card");
      categoryCard.style.cssText =
        "flex-shrink:0;margin:8px;margin-bottom:4px;background:var(--background-secondary);border-radius:8px;overflow:hidden;";

      const categoryCardHeader = categoryCard.createDiv("category-card-header");
      categoryCardHeader.style.cssText =
        "padding:8px 12px;font-size:12px;font-weight:600;color:var(--text-muted);border-bottom:1px solid var(--background-modifier-border);";
      categoryCardHeader.textContent = "🏷️ 快速筛选";

      // v10.15.17: 标签筛选栏
      const tagBar = categoryCard.createDiv("molecule-tag-bar");
      tagBar.style.cssText = "display:flex;flex-wrap:wrap;gap:4px;padding:8px 12px;";

      // 预设标签（从分类名提取关键词）
      const presetTags = [
        "芳香",
        "杂环",
        "醇",
        "醛酮",
        "羧酸",
        "胺",
        "药物",
        "抗生素",
        "心血管",
        "抗肿瘤",
        "神经递质",
        "激素",
        "溶剂",
        "氨基酸",
        "天然产物",
      ];
      let activeTag = null;

      // 标签按钮
      for (const tag of presetTags) {
        const tagBtn = tagBar.createEl("button");
        tagBtn.textContent = tag;
        tagBtn.style.cssText =
          "padding:3px 8px;font-size:10px;border:1px solid var(--background-modifier-border);border-radius:12px;cursor:pointer;background:var(--background-primary);transition:all 0.15s ease;";
        tagBtn.onclick = () => {
          if (activeTag === tag) {
            activeTag = null;
            tagBtn.style.background = "var(--background-primary)";
            tagBtn.style.color = "";
          } else {
            activeTag = tag;
            // 重置其他标签
            Array.from(tagBar.children).forEach((b, i) => {
              if (i !== Array.from(tagBar.children).indexOf(tagBtn)) {
                b.style.background = "var(--background-primary)";
                b.style.color = "";
              }
            });
            tagBtn.style.background = "var(--interactive-accent)";
            tagBtn.style.color = "white";
          }
          renderList();
        };
      }

      // 化合物列表卡片
      const listCard = fragmentContainer.createDiv("list-card");
      listCard.style.cssText =
        "flex:1;min-height:0;display:flex;flex-direction:column;margin:8px;margin-top:0;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:8px;overflow:hidden;";

      // v10.15.17: 学习统计面板（保留在片段库顶部）
      const statsPanel = listCard.createDiv("molecule-stats-panel");
      statsPanel.style.cssText =
        "padding:8px;background:var(--background-secondary);border-radius:6px;margin:8px;margin-bottom:4px;font-size:11px;flex-shrink:0;";

      // v10.16.0: 成就系统
      const achievements = [
        { id: "first-10", name: "初学乍练", desc: "已学 10 个化合物", icon: "🌱", threshold: 10 },
        { id: "first-50", name: "小有成就", desc: "已学 50 个化合物", icon: "🌿", threshold: 50 },
        {
          id: "first-100",
          name: "学业有成",
          desc: "已学 100 个化合物",
          icon: "🌳",
          threshold: 100,
        },
        {
          id: "first-200",
          name: "化学大师",
          desc: "已学 200 个化合物",
          icon: "🏆",
          threshold: 200,
        },
        { id: "streak-7", name: "七日坚持", desc: "连续学习 7 天", icon: "🔥", threshold: 7 },
        { id: "streak-30", name: "月度达人", desc: "连续学习 30 天", icon: "💎", threshold: 30 },
      ];

      function getUnlockedAchievements(learnedCount, streak) {
        return achievements.filter(
          (a) =>
            (a.id.startsWith("first-") && learnedCount >= a.threshold) ||
            (a.id.startsWith("streak-") && streak >= a.threshold)
        );
      }

      function updateStats() {
        let total = 0;
        let learned = 0;
        const learnedByCat = {};

        try {
          const learnedSet = JSON.parse(localStorage.getItem("chemfig-learned-molecules") || "{}");

          // 计算每个分类的已学数量
          for (const cat of MOLECULE_FRAGMENT_LIBRARY) {
            let catTotal = 0;
            let catLearned = 0;
            for (const it of cat.items) {
              if (it[1]) {
                // 有 SMILES
                catTotal++;
                if (learnedSet[it[1]]) catLearned++;
              }
            }
            learnedByCat[cat.cat] = { learned: catLearned, total: catTotal };
            total += catTotal;
          }
          learned = Object.keys(learnedSet).length;
        } catch (e) {}

        const percent = total > 0 ? Math.round((learned / total) * 100) : 0;
        const streak = parseInt(localStorage.getItem("chemfig-streak") || "0");
        const unlockedAch = getUnlockedAchievements(learned, streak);

        // 复习数据统计
        const reviewStats = { due: 0, new: 0, total: 0 };
        try {
          const reviewData = JSON.parse(localStorage.getItem("chemfig-review-data") || "{}");
          const now = Date.now();
          reviewStats.total = Object.keys(reviewData).length;
          for (const key in reviewData) {
            if (reviewData[key].nextReview <= now) reviewStats.due++;
          }
        } catch (e) {}

        statsPanel.innerHTML = `
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <span style="font-weight:600;">📊 学习进度</span>
            <span style="color:var(--interactive-accent);font-weight:600;">${percent}%</span>
          </div>
          <div style="width:100%;height:6px;background:var(--background-modifier-border);border-radius:3px;overflow:hidden;margin-bottom:6px;">
            <div style="width:${percent}%;height:100%;background:linear-gradient(90deg, var(--interactive-accent), var(--interactive-accent-hover));transition:width 0.3s;"></div>
          </div>
          <div style="color:var(--text-muted);margin-bottom:6px;">已学 ${learned} / ${total} 个化合物</div>
          
          <!-- 复习统计 -->
          <div style="display:flex;gap:8px;margin-bottom:6px;padding:4px;background:var(--background-primary);border-radius:4px;">
            <div style="flex:1;text-align:center;">
              <div style="font-weight:600;color:var(--text-accent);">${reviewStats.due}</div>
              <div style="font-size:10px;color:var(--text-muted);">待复习</div>
            </div>
            <div style="flex:1;text-align:center;">
              <div style="font-weight:600;color:var(--text-accent);">${reviewStats.total - reviewStats.due}</div>
              <div style="font-size:10px;color:var(--text-muted);">已掌握</div>
            </div>
            <div style="flex:1;text-align:center;">
              <div style="font-weight:600;color:var(--text-accent);">🔥 ${streak}</div>
              <div style="font-size:10px;color:var(--text-muted);">连续天数</div>
            </div>
          </div>
          
          <!-- 成就徽章 -->
          ${
            unlockedAch.length > 0
              ? `
            <div style="margin-top:6px;">
              <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px;">🏅 已解锁成就</div>
              <div style="display:flex;flex-wrap:wrap;gap:4px;">
                ${unlockedAch
                  .map(
                    (a) => `
                  <span title="${a.name}: ${a.desc}" style="font-size:14px;cursor:default;">${a.icon}</span>
                `
                  )
                  .join("")}
              </div>
            </div>
          `
              : ""
          }
        `;
      }
      updateStats();

      // 外部库导入按钮
      const importBtn = listCard.createEl("button", {
        text: "🌐 从外部库导入",
        cls: "molecule-lib-import-btn",
      });
      importBtn.style.cssText =
        "width:calc(100% - 16px);padding:8px;font-size:11px;margin:0 8px 8px 8px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:6px;cursor:pointer;transition:all 0.2s;flex-shrink:0;";
      importBtn.onmouseenter = () => {
        importBtn.style.borderColor = "var(--interactive-accent)";
        importBtn.style.background = "var(--background-modifier-hover)";
      };
      importBtn.onclick = () => this.importFromExternalDB(searchInput.value);

      // 模板列表容器
      const breadcrumbEl = listCard.createDiv("molecule-breadcrumb");
      breadcrumbEl.style.cssText =
        "display:flex;align-items:center;gap:4px;padding:6px 8px;margin:0 8px 8px 8px;background:var(--background-secondary);border-radius:6px;font-size:12px;flex-shrink:0;";

      const listEl = listCard.createDiv("molecule-lib-list");
      listEl.style.cssText =
        "flex:1;min-height:0;display:grid;grid-template-columns:repeat(auto-fill, minmax(140px, 1fr));gap:8px;align-content:start;padding:4px 8px 8px 8px;overflow-y:auto;";

      // v10.15.11: 虚拟滚动列表 (条目数 > 50 时启用)
      let virtualList = null;
      const ITEM_HEIGHT = 120; // 每个条目高度（含缩略图）- v10.15.15: 自适应网格

      // 片段数据: 从内置库(模块级常量)浅拷贝作为本次渲染的基础,
      // 再在下方追加「外部导入」(localStorage) 与「编辑器模板环结构」。
      const fragments = MOLECULE_FRAGMENT_LIBRARY.map((c) => ({
        cat: c.cat,
        items: c.items.map((it) => it.slice()),
      }));

      // v2.0: 读取外部导入片段 (修复导入后不可见的闭环缺陷)
      // importFromExternalDB 写入 localStorage("chemfig-custom-fragments"), 但渲染此前从不读取该 key
      try {
        const customFrags = JSON.parse(localStorage.getItem("chemfig-custom-fragments") || "[]");
        if (Array.isArray(customFrags) && customFrags.length > 0) {
          const items = customFrags.map((f) =>
            Array.isArray(f) ? f : [f.name || "未命名", f.smiles || "", f.formula || "", "外部导入"]
          );
          fragments.push({ cat: "外部导入 (" + items.length + ")", items });
        }
      } catch (e) {
        console.warn("[Chemfig-SVG] 读取外部片段失败:", e.message);
      }

      // v2.0: 并入编辑器模板环结构 (collectEditorRingTemplates 此前是死代码, 从未被调用)
      try {
        const rings = this.collectEditorRingTemplates();
        if (rings && rings.length > 0) {
          const items = rings.map((r) => [r.name, r.smiles || "", "", "模板环", r.code || null]);
          fragments.push({ cat: "编辑器模板 · 环结构 (" + items.length + ")", items });
        }
      } catch (e) {
        console.warn("[Chemfig-SVG] 收集环结构模板失败:", e.message);
      }

      const self = this;

      // v10.15.17: 片段条目按钮 (含 OCL 缩略图) - 自适应网格布局 + 学习状态
      function makeItemBtn(name, smiles, formula, code) {
        const btn = listEl.createEl("button");

        // 读取学习状态
        let learnedSet = {};
        try {
          learnedSet = JSON.parse(localStorage.getItem("chemfig-learned-molecules") || "{}");
        } catch (e) {}
        const isLearned = learnedSet[smiles || name] === true;

        btn.style.cssText = `width:100%;text-align:center;padding:10px 6px;font-size:12px;background:var(--background-primary);border:1px solid ${isLearned ? "var(--background-modifier-success)" : "var(--background-modifier-border)"};border-radius:6px;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;transition:all 0.15s ease;min-height:110px;${isLearned ? "opacity:0.85;" : ""}`;
        btn.onmouseenter = () => {
          btn.style.borderColor = "var(--interactive-accent)";
          btn.style.background = "var(--background-secondary)";
          btn.style.transform = "translateY(-2px)";
          btn.style.boxShadow = "0 4px 12px rgba(0,0,0,0.15)";
        };
        btn.onmouseleave = () => {
          btn.style.borderColor = isLearned
            ? "var(--background-modifier-success)"
            : "var(--background-modifier-border)";
          btn.style.background = "var(--background-primary)";
          btn.style.transform = "translateY(0)";
          btn.style.boxShadow = "none";
        };
        btn.onclick = () => self.loadFragment(name, smiles, code);

        // 右键标记已学/取消已学
        btn.oncontextmenu = (e) => {
          e.preventDefault();
          const key = smiles || name;
          learnedSet[key] = !learnedSet[key];
          // 右键菜单内不弹 Notice (连续点击会刷屏), 仅记录告警; 内存态照常更新
          safeLocalStorageSet("chemfig-learned-molecules", learnedSet, false);
          btn.style.borderColor = learnedSet[key]
            ? "var(--background-modifier-success)"
            : "var(--background-modifier-border)";
          btn.style.opacity = learnedSet[key] ? "0.85" : "1";
          new Notice(learnedSet[key] ? `已标记「${name}」为已学` : `已取消「${name}」的已学标记`);
        };

        try {
          let thumb = "";
          if (smiles) {
            try {
              thumb = renderSmilesSvg(smiles, 90, 60);
            } catch (e) {
              console.warn("[Chemfig-SVG] 片段缩略图渲染失败 (" + name + "):", e.message);
            }
          }
          const learnedBadge = isLearned
            ? '<span style="position:absolute;top:4px;right:4px;font-size:10px;">✓</span>'
            : "";
          btn.innerHTML = `<div style="position:relative;width:90px;height:60px;display:flex;align-items:center;justify-content:center;background:#ffffff;border:1px solid var(--background-modifier-border);border-radius:4px;overflow:hidden;">${thumb || '<span style="color:var(--text-muted);font-size:24px;">◇</span>'}${learnedBadge}</div><div style="width:100%;overflow:hidden;"><div style="font-weight:500;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div><div style="font-size:10px;color:var(--text-muted);margin-top:2px;">${formula || " "}</div></div>`;
        } catch (e) {
          // 兜底: innerHTML 注入失败时退化为纯文本按钮, 保证片段库总能渲染
          console.warn("[Chemfig-SVG] 片段条目渲染降级为纯文本:", e.message);
          btn.textContent = `${name}${formula ? "  (" + formula + ")" : ""}`;
        }
        return btn;
      }

      // 渲染列表
      function renderList() {
        listEl.empty();
        const kw = (searchInput.value || "").trim().toLowerCase();

        // 更新面包屑导航
        breadcrumbEl.empty();
        const homeLink = breadcrumbEl.createEl("span");
        homeLink.textContent = "🏠 全部";
        homeLink.style.cssText =
          "cursor:pointer;color:var(--text-accent);font-weight:500;";
        homeLink.onclick = () => {
          activeTag = null;
          // 重置标签按钮样式
          Array.from(tagBar.children).forEach((b) => {
            b.style.background = "var(--background-primary)";
            b.style.color = "";
          });
          renderList();
        };

        // v10.15.17: 标签筛选函数
        function matchesTag(cat, item) {
          if (!activeTag) return true;
          const text = (cat + " " + (item[0] || "") + " " + (item[2] || "")).toLowerCase();
          return text.includes(activeTag.toLowerCase());
        }

        // v10.15.13: 计算 SMILES 字符串 Jaccard 相似度（近似结构相似度）
        function calcSmilesSimilarity(smiles1, smiles2) {
          if (!smiles1 || !smiles2) return 0;
          // 使用 2-gram 字符集合计算 Jaccard
          const getBigrams = (s) => {
            const grams = new Set();
            for (let i = 0; i < s.length - 1; i++) {
              grams.add(s.substring(i, i + 2));
            }
            return grams;
          };
          const g1 = getBigrams(smiles1.toLowerCase());
          const g2 = getBigrams(smiles2.toLowerCase());
          if (g1.size === 0 || g2.size === 0) return 0;

          let intersection = 0;
          for (const g of g1) {
            if (g2.has(g)) intersection++;
          }
          const union = g1.size + g2.size - intersection;
          return union > 0 ? intersection / union : 0;
        }

        // 搜索模式
        if (kw) {
          let count = 0;
          const searchResults = [];
          for (const { cat, items } of fragments) {
            for (const item of items) {
              const name = item[0];
              const smiles = item[1];
              const formula = item[2] || "";
              const code = item[4] || null;

              // v10.15.17: 标签筛选
              if (!matchesTag(cat, item)) continue;

              const matchName = name.toLowerCase().includes(kw);
              const matchSmiles = smiles.toLowerCase().includes(kw);
              const matchFormula = formula.toLowerCase().includes(kw);

              if (!matchName && !matchSmiles && !matchFormula) continue;

              // v10.15.13: 计算相似度分数
              let score = 0;
              if (matchName) score += 100;
              if (matchFormula) score += 80;
              if (matchSmiles) score += 60;
              // 如果搜索词看起来像 SMILES，计算结构相似度
              if (/[cCnNoOsS]/.test(kw) && smiles) {
                score += calcSmilesSimilarity(kw, smiles) * 50;
              }

              count++;
              searchResults.push({ name, smiles, formula, code, score });
            }
          }

          // v10.15.13: 按相似度分数排序
          searchResults.sort((a, b) => b.score - a.score);

          if (count === 0) {
            listEl.createEl("div", {
              text: "未找到匹配结果",
              attr: {
                style: "padding:20px;text-align:center;color:var(--text-muted);font-size:12px;",
              },
            });
            return;
          }

          // 条目较多时使用虚拟滚动
          if (count > 50 && typeof VirtualList !== "undefined") {
            virtualList = new VirtualList(listEl, {
              itemHeight: ITEM_HEIGHT,
              renderItem: (item) => makeItemBtn(item.name, item.smiles, item.formula, item.code),
            });
            virtualList.setItems(searchResults);
          } else {
            for (const item of searchResults) {
              makeItemBtn(item.name, item.smiles, item.formula, item.code);
            }
          }
          return;
        }

        // 一级分类列表
        for (const { cat, items } of fragments) {
          // v10.15.17: 标签筛选 - 计算该分类下匹配标签的条目数
          let filteredItems = items;
          if (activeTag) {
            filteredItems = items.filter((item) => matchesTag(cat, item));
            if (filteredItems.length === 0) continue; // 跳过无匹配条目的分类
          }

          const btn = listEl.createEl("button");
          btn.style.cssText =
            "width:100%;text-align:left;padding:8px 10px;margin-bottom:3px;font-size:12.5px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:4px;cursor:pointer;display:flex;justify-content:space-between;";
          btn.innerHTML = `<span>${cat}</span><span style="font-size:11px;color:var(--text-muted)">${items.length} 项 ›</span>`;
          btn.onclick = () => {
            listEl.empty();
            // 更新面包屑导航
            breadcrumbEl.empty();
            const homeLink = breadcrumbEl.createEl("span");
            homeLink.textContent = "🏠 全部";
            homeLink.style.cssText =
              "cursor:pointer;color:var(--text-accent);font-weight:500;";
            homeLink.onclick = () => renderList();
            const separator = breadcrumbEl.createEl("span");
            separator.textContent = "›";
            separator.style.cssText = "color:var(--text-muted);";
            const currentCat = breadcrumbEl.createEl("span");
            currentCat.textContent = cat;
            currentCat.style.cssText = "color:var(--text-normal);font-weight:500;";

            // 显示分类下的片段 (按分子式分组, 同分异构体归并显示) - 使用完整 items，忽略标签筛选
            const byFormula = new Map();
            for (const item of items) {
              const f = item[2] || "";
              if (!byFormula.has(f)) byFormula.set(f, []);
              byFormula.get(f).push(item);
            }
            for (const [formula, group] of byFormula) {
              if (group.length > 1 && formula) {
                const subHead = listEl.createEl("div");
                subHead.style.cssText =
                  "padding:4px 6px;margin:6px 0 2px;font-size:11px;font-weight:600;color:var(--text-accent);background:var(--background-secondary);border-radius:3px;";
                subHead.textContent = `≡ ${formula} · ${group.length} 个同分异构体`;
              }
              for (const item of group) {
                const name = item[0];
                const smiles = item[1];
                const f = item[2] || "";
                const code = item[4] || null;
                const itemBtn = makeItemBtn(name, smiles, f, code);
              }
            }
          };
        }
      }

      searchInput.addEventListener("input", () => renderList());

      // 初始渲染
      renderList();
    } catch (err) {
      container.empty();
      container.createEl("div", {
        text: "🧩 片段库加载失败",
        cls: "sidebar-header",
      });
      container.createEl("div", {
        text: err.message,
        attr: { style: "padding:16px;font-size:12px;color:var(--text-muted);" },
      });
      console.error("[Chemfig-SVG] buildFragmentLibrary error:", err);
      new Notice("片段库加载失败: " + err.message, 5000);
    }
  }

  // v16.5.0: 左侧学习模块侧边栏（可收缩）
  buildLearningSidebar(learningCol, cols) {
    try {
      // 头部
      const header = learningCol.createDiv("learning-sidebar-header");
      header.style.cssText =
        "padding:12px 16px;border-bottom:1px solid var(--background-modifier-border);font-weight:600;font-size:14px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;";
      header.textContent = "📚 学习模块";

      // 内容区域
      const body = learningCol.createDiv("learning-sidebar-body");
      
      // 修复 wheel 事件被 Obsidian Modal 拦截
      body.addEventListener("wheel", (e) => {
        e.stopPropagation();
      }, { passive: false });
      body.style.cssText =
        "flex:1;min-height:0;overflow-y:auto;padding:12px;display:flex;flex-direction:column;gap:8px;";

      // 学习模块按钮
      const learningButtons = [
        { text: "📇 翻转卡片练习", icon: "📇", action: () => this.openFlashcardPractice() },
       { text: "🎯 每日一题", icon: "🎯", action: () => this.openDailyChallenge() },
       { text: "📖 反应条件速查", icon: "📖", action: () => this.openReactionConditionsGuide() },
        { text: "🧠 官能团分析", icon: "🧠", action: () => this.openFunctionalGroupAnalysis() },
       { text: "🎮 配对游戏", icon: "🎮", action: () => this.openMatchingGame() },
        { text: "📚 知识库索引", icon: "📚", action: () => this.openKnowledgeIndex() },
      ];

      for (const btn of learningButtons) {
        const b = body.createEl("button");
        b.style.cssText =
          "width:100%;padding:10px 12px;font-size:12px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:8px;cursor:pointer;text-align:left;transition:all 0.2s;display:flex;align-items:center;gap:8px;";
        b.innerHTML = `<span style="font-size:16px;">${btn.icon}</span><span>${btn.text}</span>`;
        b.onmouseenter = () => {
          b.style.borderColor = "var(--interactive-accent)";
          b.style.background = "var(--background-modifier-hover)";
          b.style.transform = "translateX(2px)";
        };
        b.onmouseleave = () => {
          b.style.borderColor = "var(--background-modifier-border)";
          b.style.background = "var(--background-secondary)";
          b.style.transform = "translateX(0)";
        };
        b.onclick = btn.action;
      }

      // 学习统计面板
      const statsPanel = body.createDiv("learning-stats-panel");
      statsPanel.style.cssText =
        "margin-top:12px;padding:12px;background:var(--background-secondary);border-radius:8px;font-size:11px;";
      statsPanel.innerHTML = `
        <div style="font-weight:600;margin-bottom:8px;color:var(--text-muted);">📊 学习统计</div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
          <span>已学化合物</span>
          <span style="font-weight:600;color:var(--interactive-accent);">${Object.keys(JSON.parse(localStorage.getItem("chemfig-learned-molecules") || "{}")).length}</span>
        </div>
        <div style="display:flex;justify-content:space-between;">
          <span>连续学习</span>
          <span style="font-weight:600;color:var(--interactive-accent);">${localStorage.getItem("chemfig-streak-days") || 0} 天</span>
        </div>
      `;

    } catch (err) {
      console.error("[Chemfig-SVG] buildLearningSidebar error:", err);
    }
  }

  // v17.2.0: 打开知识库索引面板
  openKnowledgeIndex() {
    if (typeof MoleculeKnowledgeIndexPanel === "undefined") {
      new Notice("知识库索引面板未加载", 2000);
      return;
    }

    // 创建全屏模态框
    const modal = new Modal(this.app);
    modal.contentEl.createEl("h2", { text: "📚 知识库索引" });
    
    const container = modal.contentEl.createDiv({
      cls: "knowledge-index-container",
    });
    
    const panel = new MoleculeKnowledgeIndexPanel(container, this);
    panel.init();
    
    modal.open();
  }

  // v2.0 迭代: 从外部数据库导入片段到本地库
  // 优化点: ① 输入即 SMILES 时零联网直通导入; ② 分子式走 PubChem fastformula;
  // ③ 名称走 PubChem name→property; ④ CACTVS 兜底; ⑤ 去重 + OCL 校验规范化。
  async importFromExternalDB(query) {
    const q = (query || "").trim();
    if (!q) {
      new Notice("请先在搜索框输入化学名 / SMILES / 分子式", 2500);
      return;
    }
    this.setStatus("从外部库导入: " + q + " ...");

    // 1) 输入本身就是合法 SMILES → 直接本地导入(零网络)
    try {
      const m = getOCL().Molecule.fromSmiles(q);
      if (m && m.getAllAtoms() > 0) {
        this._addImportedFragment(q, q, "");
        return;
      }
    } catch (e) {
      /* 不是 SMILES, 继续按名称/分子式查询 */
    }

    if (typeof requestUrl !== "function") {
      this.setStatus("无法联网导入");
      new Notice("requestUrl 不可用，无法联网导入", 2500);
      return;
    }

    // 分子式判定: 大写字母开头、含数字、纯字母数字(如 C6H6 / CCl4 / H2O)
    const isFormula = /^[A-Z][A-Za-z0-9]*$/.test(q) && /[0-9]/.test(q);

    try {
      let smiles = null,
        name = null,
        formula = null;

      if (isFormula) {
        // 2) 分子式 → CID → 属性
        const enc = encodeURIComponent(q);
        const rc = await requestUrl({
          url:
            "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/fastformula/" +
            enc +
            "/cids/JSON?max_records=1",
        });
        if (rc.status && rc.status !== 200) throw new Error("PubChem 无响应");
        const jc = JSON.parse(rc.text);
        const cid = jc && jc.IdentifierList && jc.IdentifierList.CID && jc.IdentifierList.CID[0];
        if (cid) {
          const rp = await requestUrl({
            url:
              "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/" +
              cid +
              "/property/IUPACName,MolecularFormula,CanonicalSMILES/JSON",
          });
          const jp = JSON.parse(rp.text);
          const pp =
            jp && jp.PropertyTable && jp.PropertyTable.Properties && jp.PropertyTable.Properties[0];
          if (pp) {
            smiles = pp.CanonicalSMILES || null;
            name = pp.IUPACName || null;
            formula = pp.MolecularFormula || null;
          }
        }
      } else {
        // 3) 名称 → PubChem name → property
        const pub = await this._fetchPubchemByName(q);
        smiles = pub.smiles;
        name = pub.name;
        formula = pub.formula;
      }

      // 4) 兜底: CACTVS (英文名/常见名)
      if (!smiles) {
        const cact = await this._fetchCactus(q);
        smiles = cact.smiles;
      }

      if (smiles) {
        this._addImportedFragment(smiles, name || q, formula || "");
      } else {
        this.setStatus("外部库未找到: " + q);
        const hint = /[\u4e00-\u9fff]/.test(q)
          ? "（中文名请先在片段库搜索框直接搜；联网导入建议用英文名或 SMILES）"
          : "";
        new Notice("外部库未找到该化合物" + hint, 4000);
      }
    } catch (e) {
      this.setStatus("导入失败: " + e.message);
      new Notice("导入失败: " + e.message, 2500);
    }
  }

  // 通过 PubChem name 端点查询属性; 404/解析异常一律返回空, 由调用方兜底
  async _fetchPubchemByName(name) {
    try {
      const enc = encodeURIComponent(name);
      const r = await requestUrl({
        url:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/" +
          enc +
          "/property/IUPACName,MolecularFormula,CanonicalSMILES/JSON",
      });
      if (r.status && r.status !== 200) return { smiles: null, name: null, formula: null };
      const d = JSON.parse(r.text);
      const p = d && d.PropertyTable && d.PropertyTable.Properties && d.PropertyTable.Properties[0];
      return {
        smiles: (p && p.CanonicalSMILES) || null,
        name: (p && p.IUPACName) || null,
        formula: (p && p.MolecularFormula) || null,
      };
    } catch (e) {
      return { smiles: null, name: null, formula: null };
    }
  }

  // CACTVS 结构化名称 → SMILES (英文名/常见名兜底)
  async _fetchCactus(name) {
    try {
      const enc = encodeURIComponent(name);
      const r = await requestUrl({
        url: "https://cactus.nci.nih.gov/chemical/structure/" + enc + "/smiles",
      });
      if (r.status && r.status !== 200) return { smiles: null };
      const t = (r.text || "").trim();
      // CACTVS 成功时返回裸 SMILES 单行; HTML/空/多词视为失败
      return { smiles: t && !/^\s*</.test(t) && t.length < 1000 && !/\s/.test(t) ? t : null };
    } catch (e) {
      return { smiles: null };
    }
  }

  // 校验 + 规范化 + 去重后写入本地片段库, 并重渲染侧栏
  _addImportedFragment(smiles, name, formula) {
    try {
      const mol = getOCL().Molecule.fromSmiles(smiles);
      if (!mol || mol.getAllAtoms() <= 0) throw new Error("无法解析返回的 SMILES");
      const canonical = mol.toIsomericSmiles() || smiles;
      const raw = localStorage.getItem("chemfig-custom-fragments") || "[]";
      const customFrags = JSON.parse(raw);
      const list = Array.isArray(customFrags) ? customFrags : [];
      // 去重: 规范 SMILES 相同即视为已存在
      const exists = list.some((f) => Array.isArray(f) && f[1] && f[1] === canonical);
      if (exists) {
        this.setStatus("已在片段库中: " + (name || canonical));
        new Notice("该化合物已在片段库中", 2500);
        return;
      }
      list.push([name || canonical, canonical, formula || ""]);
      localStorage.setItem("chemfig-custom-fragments", JSON.stringify(list));
      this.setStatus("已导入: " + (name || canonical) + (formula ? " (" + formula + ")" : ""));
      new Notice("已导入到片段库: " + (name || canonical), 2500);
      if (this.sideCol) {
        this.sideCol.empty();
        this.buildFragmentLibrary(this.sideCol);
      }
    } catch (e) {
      this.setStatus("导入失败: " + e.message);
      new Notice("导入失败: " + e.message, 2500);
    }
  }

  // 从编辑器模板库 (TPL_STRUCTURE 环结构) 收集可解析的化学式写入片段库
  collectEditorRingTemplates() {
    if (typeof TPL_STRUCTURE === "undefined" || !Array.isArray(TPL_STRUCTURE)) return [];
    const covered = new Set([
      "苯",
      "甲苯",
      "苯酚",
      "苯胺",
      "苯甲酸",
      "苯甲醛",
      "萘",
      "环己烷",
      "环己烯",
      "吡啶",
      "吡咯",
      "呋喃",
      "噻吩",
      "咪唑",
    ]);
    // 稠环 (嵌套 *n) 化学图解析器暂不支持, 直接映射为已验证 SMILES
    const fusedSmiles = {
      吲哚: "c1ccc2[nH]ccc2c1",
      喹啉: "c1ccc2ncccc2c1",
      异喹啉: "c1ccc2ccncc2c1",
      嘌呤: "c1ncc2nc[nH]c2n1",
      蒽: "c1ccc2cc3ccccc3cc2c1",
      菲: "c1ccc2c(c1)ccc1ccccc12",
    };
    const out = [];
    for (const t of TPL_STRUCTURE) {
      if (t.subcategory !== "环结构") continue;
      if (covered.has(t.name)) continue;
      if (/R\b/.test(t.code)) continue; // 排除取代基占位符
      if (fusedSmiles[t.name]) {
        out.push({ name: t.name, smiles: fusedSmiles[t.name] });
        continue;
      }
      const ringCount = (t.code.match(/\*\d+\(/g) || []).length;
      if (ringCount > 1) continue; // 其它嵌套环跳过
      out.push({ name: t.name, code: t.code });
    }
    return out;
  }

  // 载入片段: 支持 SMILES 与 chemfig 代码两种来源
  loadFragment(name, smiles, code) {
    try {
      let mol;
      if (smiles) {
        mol = getOCL().Molecule.fromSmiles(smiles);
      } else if (code) {
        mol = chemfigToMolecule(code);
      } else {
        return;
      }
      // v10.15.2: 追加模式 - 合并到现有画布，不清除
      this.appendMolecule(
        mol,
        "已追加片段: " + name + (smiles ? " (" + smiles + ")" : "（来自 chemfig 模板）")
      );
    } catch (e) {
      new Notice("片段解析失败 (" + name + "): " + e.message);
    }
  }

  // v10.15.2: 追加分子到现有画布（合并而非替换）
  appendMolecule(newMol, statusMsg) {
    if (!this.editor) {
      new Notice("画布未初始化");
      return;
    }
    try {
      const oldMol = this.getMoleculeSafeQuiet();
      if (!oldMol || oldMol.getAllAtoms().length === 0) {
        // 画布为空，直接加载
        this.loadMolecule(newMol, statusMsg);
        // v10.15.2: 自动命名
        this.autoNameMolecule();
        return;
      }
      // 保存当前状态到撤销栈
      this.pushHistory();
      // 合并分子
      const merged = this.mergeMolecules(oldMol, newMol);
      this.editor.setMolecule(merged);
      this.redraw();
      if (statusMsg) this.setStatus(statusMsg);
      // v10.15.2: 自动命名（单个完整分子才命名）
      this.autoNameMolecule();
    } catch (e) {
      new Notice("追加分子失败: " + e.message);
    }
  }

  // v10.15.2: 自动命名（检查是否为单个完整分子，是则自动查询名称）
  autoNameMolecule() {
    try {
      const mol = this.getMoleculeSafeQuiet();
      if (!mol || mol.getAllAtoms().length === 0) return;
      // 检查是否为单个连通分子（简单判断：原子数 < 50 才自动命名）
      const atomCount = mol.getAllAtoms().length;
      if (atomCount > 50) return;

      // 先查本地索引
      const key = this.canonicalKey(mol);
      if (!key) return;
      const idx = this.getNameIndex();
      if (idx[key]) {
        const name = this.getIndexName(idx[key]);
        if (this.nameResultEl) this.nameResultEl.textContent = "名称: " + name;
        this.saveFormulaNameEntry(molToFormula(mol), name);
        return;
      }

      // 异步查询在线命名（不阻塞UI）
      setTimeout(() => {
        this.nameMoleculeNow("pubchem");
      }, 500);
    } catch (e) {
      /* ignore */
    }
  }

  // v10.15.3: 合并两个分子（通过 SMILES 合并，OCL 原生无 mergeWith）
  mergeMolecules(mol1, mol2) {
    try {
      // 方法1: 尝试 OCL 原生合并
      if (typeof mol1.mergeWith === "function") {
        const bbox1 = mol1.getCoordBoundingBox();
        const offsetX = (bbox1.maxX - bbox1.minX) * 0.3 + 20;
        const offsetY = (bbox1.maxY - bbox1.minY) * 0.3 + 20;
        mol2.translate({ x: offsetX, y: offsetY });
        return mol1.mergeWith(mol2);
      }

      // 方法2: 通过 SMILES 字符串合并（用 . 分隔表示两个独立分子）
      const smiles1 = mol1.toSmiles();
      const smiles2 = mol2.toSmiles();
      if (smiles1 && smiles2) {
        const combined = smiles1 + "." + smiles2;
        return getOCL().Molecule.fromSmiles(combined);
      }
    } catch (e) {
      console.warn("合并分子失败，回退到第一个分子:", e);
    }
    // fallback: 返回第一个分子
    return mol1;
  }

  // v2.0 迭代: 撤销/重做历史栈 —— 改用 molfile 快照
  // 与 OCL CanvasEditor 的 undo/redo 模型对齐(Ketcher/JSME 亦存完整文档态):
  // molfile 完整保留 2D 坐标、显式 H、键级与立体信息; 旧的 toSmiles()+fromSmiles()
  // 会重新布局, 撤销后分子"跳回"自动排布位置, 用户体验差。
  pushHistory() {
    try {
      if (!this.undoStack) this.undoStack = [];
      if (!this.redoStack) this.redoStack = [];
      const mol = this.getMoleculeSafeQuiet();
      if (!mol) return;
      const snapshot = mol.toMolfile();
      // 与栈顶重复则跳过(防抖重复触发会产生冗余历史)
      if (this.undoStack.length && this.undoStack[this.undoStack.length - 1] === snapshot) return;
      this.undoStack.push(snapshot);
      if (this.undoStack.length > 50) this.undoStack.shift();
      this.redoStack = [];
    } catch (e) {
      /* ignore */
    }
  }

  undo() {
    try {
      if (!this.undoStack || this.undoStack.length === 0) {
        new Notice("没有可撤销的操作");
        return;
      }
      if (!this.redoStack) this.redoStack = [];
      const current = this.getMoleculeSafeQuiet();
      if (current) this.redoStack.push(current.toMolfile());
      const snapshot = this.undoStack.pop();
      const mol = getOCL().Molecule.fromMolfile(snapshot);
      this.editor.setMolecule(mol);
      this.redraw();
      this.setStatus("已撤销 (剩余 " + this.undoStack.length + " 步)");
    } catch (e) {
      new Notice("撤销失败: " + e.message);
    }
  }

  redo() {
    try {
      if (!this.redoStack || this.redoStack.length === 0) {
        new Notice("没有可重做的操作");
        return;
      }
      if (!this.undoStack) this.undoStack = [];
      const current = this.getMoleculeSafeQuiet();
      if (current) this.undoStack.push(current.toMolfile());
      const snapshot = this.redoStack.pop();
      const mol = getOCL().Molecule.fromMolfile(snapshot);
      this.editor.setMolecule(mol);
      this.redraw();
      this.setStatus("已重做 (剩余 " + this.redoStack.length + " 步)");
    } catch (e) {
      new Notice("重做失败: " + e.message);
    }
  }

  // v2.0 迭代: 模态框级键盘快捷键 (Ctrl/Cmd+Z 撤销, Ctrl+Y / Ctrl+Shift+Z 重做)。
  // 仅在焦点不在输入/下拉/文本域时生效, 避免干扰 SMILES / SMARTS 输入;
  // v15.3.0: 重置视图 - 缩放和位置
  resetView() {
    const mol = this.getMoleculeSafeQuiet();
    if (!mol || !this.editor) return;
    try {
      // 重置缩放为 1.0
      mol.zoomAndRotateInit(0, 0);
      mol.zoomAndRotate(1.0, 0, false);
      // 居中
      const canvas = this.editorContainer.querySelector("canvas");
      if (canvas) {
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        mol.translate({ x: 0, y: 0 });
      }
      this.redraw();
      this.setStatus("视图已重置");
    } catch (e) {
      console.error("重置视图失败:", e);
    }
  }

  // 不接管 Delete/Ctrl+C/Ctrl+V, 由 OCL CanvasEditor 原生键盘处理(焦点在画布时)。
  setupKeyboardShortcuts() {
    const el = this.contentEl;
    if (!el) return;
    const isTyping = (t) => {
      if (!t || !t.tagName) return false;
      const n = t.tagName.toLowerCase();
      return n === "input" || n === "textarea" || n === "select" || !!t.isContentEditable;
    };
    const onKey = (e) => {
      if (isTyping(e.target)) return;

      // Ctrl+0 = 重置视图
      if ((e.ctrlKey || e.metaKey) && (e.key === "0" || e.key === "=")) {
        e.preventDefault();
        e.stopPropagation();
        this.resetView();
        return;
      }

      if (!(e.ctrlKey || e.metaKey)) return;
      const k = (e.key || "").toLowerCase();
      if (k === "z" && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        this.undo();
      } else if (k === "z" && e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        this.redo();
      } else if (k === "y") {
        e.preventDefault();
        e.stopPropagation();
        this.redo();
      } else if (k === "s") {
        // Ctrl+S = 保存
        e.preventDefault();
        e.stopPropagation();
        const saveBtn = this.contentEl.querySelector("button.mod-cta");
        if (saveBtn) saveBtn.click();
      }
    };
    el.addEventListener("keydown", onKey);
    this._keyCleanup = () => el.removeEventListener("keydown", onKey);
  }

  // ---------------- 化学命名: 结构 → 名称 ----------------
  // v10.15.10: 增强命名索引 - 多维度索引结构
  // 索引格式: {
  //   [canonicalSmiles]: {
  //     name: string,
  //     formula: string,
  //     source: string,      // 来源: pubchem/cir/opsin/...
  //     updatedAt: number,   // 时间戳
  //     favorite: boolean    // 是否收藏
  //   }
  // }
  getNameIndex() {
    try {
      const raw = JSON.parse(localStorage.getItem("chemfig-structure-name-index") || "{}");
      // 兼容旧格式: 如果 value 是字符串，转换为新格式
      const migrated = {};
      for (const [key, val] of Object.entries(raw)) {
        if (typeof val === "string") {
          migrated[key] = {
            name: val,
            formula: "",
            source: "legacy",
            updatedAt: Date.now(),
            favorite: false,
          };
        } else {
          migrated[key] = val;
        }
      }
      return migrated;
    } catch (e) {
      return {};
    }
  }
  saveNameIndex(idx) {
    try {
      localStorage.setItem("chemfig-structure-name-index", JSON.stringify(idx));
    } catch (e) {
      /* ignore */
    }
  }

  // v10.15.10: 按名称搜索索引（模糊匹配）
  searchNameIndex(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim().toLowerCase();
    const idx = this.getNameIndex();
    const results = [];
    for (const [smiles, entry] of Object.entries(idx)) {
      const name = (entry.name || "").toLowerCase();
      const formula = (entry.formula || "").toLowerCase();
      if (name.includes(q) || formula.includes(q) || smiles.toLowerCase().includes(q)) {
        results.push({ smiles, ...entry });
      }
    }
    // 按收藏优先 + 更新时间排序
    results.sort((a, b) => {
      if (a.favorite && !b.favorite) return -1;
      if (!a.favorite && b.favorite) return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
    return results;
  }

  // v10.15.10: 删除索引条目
  removeNameIndex(smiles) {
    const idx = this.getNameIndex();
    if (idx[smiles]) {
      delete idx[smiles];
      this.saveNameIndex(idx);
      return true;
    }
    return false;
  }

  // v10.15.10: 清空索引（保留收藏）
  clearNameIndex(keepFavorites = true) {
    const idx = this.getNameIndex();
    if (keepFavorites) {
      for (const [key, val] of Object.entries(idx)) {
        if (!val.favorite) delete idx[key];
      }
    } else {
      Object.keys(idx).forEach((k) => delete idx[k]);
    }
    this.saveNameIndex(idx);
  }

  // v10.15.10: 切换收藏
  toggleFavorite(smiles) {
    const idx = this.getNameIndex();
    if (idx[smiles]) {
      idx[smiles].favorite = !idx[smiles].favorite;
      this.saveNameIndex(idx);
      return idx[smiles].favorite;
    }
    return false;
  }

  // v10.15.10: 导出索引为 JSON
  exportNameIndex() {
    const idx = this.getNameIndex();
    return JSON.stringify(idx, null, 2);
  }

  // v10.15.10: 导入索引
  importNameIndex(jsonStr) {
    try {
      const newEntries = JSON.parse(jsonStr);
      const idx = this.getNameIndex();
      let added = 0;
      for (const [key, val] of Object.entries(newEntries)) {
        if (!idx[key]) {
          idx[key] =
            typeof val === "string"
              ? {
                  name: val,
                  formula: "",
                  source: "imported",
                  updatedAt: Date.now(),
                  favorite: false,
                }
              : { ...val, source: val.source || "imported" };
          added++;
        }
      }
      this.saveNameIndex(idx);
      return added;
    } catch (e) {
      throw new Error("导入失败: " + e.message);
    }
  }

  canonicalKey(mol) {
    try {
      if (typeof mol.getCanonicalSmiles === "function") return mol.getCanonicalSmiles();
    } catch (e) {
      /* ignore */
    }
    try {
      return mol.toIsomericSmiles();
    } catch (e) {
      return "";
    }
  }

  // v10.15.10: 从索引条目中安全提取名称（兼容旧格式字符串和新格式对象）
  getIndexName(entry) {
    if (!entry) return "";
    if (typeof entry === "string") return entry;
    return entry.name || "";
  }

  // v10.15.10: 命名索引管理面板
  showNameIndexManager() {
    const idx = this.getNameIndex();
    const entries = Object.entries(idx);

    // 创建模态框
    const modal = new Modal(this.app);
    modal.titleEl.setText("📚 命名索引管理 (" + entries.length + " 条)");

    const content = modal.contentEl;
    content.style.cssText = "padding:16px;";

    // 操作按钮栏
    const actionBar = content.createDiv();
    actionBar.style.cssText = "display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;";

    const exportBtn = actionBar.createEl("button", { text: "📤 导出" });
    exportBtn.style.cssText = "padding:4px 12px;font-size:12px;";
    exportBtn.onclick = () => {
      const json = this.exportNameIndex();
      navigator.clipboard.writeText(json).then(() => {
        new Notice("索引已复制到剪贴板 (" + entries.length + " 条)", 2500);
      });
    };

    const importBtn = actionBar.createEl("button", { text: "📥 导入" });
    importBtn.style.cssText = "padding:4px 12px;font-size:12px;";
    importBtn.onclick = async () => {
      try {
        const text = await navigator.clipboard.readText();
        const added = this.importNameIndex(text);
        new Notice("导入完成: 新增 " + added + " 条", 2500);
        modal.close();
        this.showNameIndexManager(); // 刷新
      } catch (e) {
        new Notice("导入失败: " + e.message, 3000);
      }
    };

    const clearBtn = actionBar.createEl("button", { text: "🗑 清空（保留收藏）" });
    clearBtn.style.cssText = "padding:4px 12px;font-size:12px;";
    clearBtn.onclick = () => {
      this.clearNameIndex(true);
      new Notice("已清空非收藏条目", 2000);
      modal.close();
      this.showNameIndexManager();
    };

    // 搜索框
    const searchInput = content.createEl("input", {
      type: "text",
      placeholder: "搜索名称 / 分子式 / SMILES...",
      cls: "search-input",
    });
    searchInput.style.cssText = "width:100%;padding:6px;margin-bottom:12px;";

    // 列表容器
    const listEl = content.createDiv();
    listEl.style.cssText = "max-height:400px;overflow-y:auto;";

    // 渲染列表
    const renderList = (filter = "") => {
      listEl.empty();
      const q = filter.toLowerCase();

      const filtered = entries.filter(([smiles, entry]) => {
        if (!q) return true;
        const name = this.getIndexName(entry).toLowerCase();
        const formula = (entry.formula || "").toLowerCase();
        return name.includes(q) || formula.includes(q) || smiles.toLowerCase().includes(q);
      });

      if (filtered.length === 0) {
        listEl.createEl("div", {
          text: filter ? "未找到匹配结果" : "索引为空",
          attr: { style: "padding:20px;text-align:center;color:var(--text-muted);" },
        });
        return;
      }

      for (const [smiles, entry] of filtered) {
        const name = this.getIndexName(entry);
        const row = listEl.createDiv();
        row.style.cssText =
          "display:flex;align-items:center;padding:8px;border-bottom:1px solid var(--background-modifier-border);gap:8px;";

        // 收藏星标
        const favBtn = row.createEl("button");
        favBtn.textContent = entry.favorite ? "⭐" : "☆";
        favBtn.style.cssText = "border:none;background:none;cursor:pointer;font-size:16px;";
        favBtn.onclick = () => {
          this.toggleFavorite(smiles);
          modal.close();
          this.showNameIndexManager();
        };

        // 名称
        const nameEl = row.createEl("div");
        nameEl.style.cssText = "flex:1;min-width:0;";
        nameEl.innerHTML = `<div style="font-weight:500;">${name}</div>
          <div style="font-size:10px;color:var(--text-muted);">${entry.formula || ""} · ${entry.source || ""}</div>`;

        // 删除按钮
        const delBtn = row.createEl("button");
        delBtn.textContent = "✕";
        delBtn.style.cssText = "padding:2px 8px;font-size:12px;color:var(--text-muted);";
        delBtn.onclick = () => {
          this.removeNameIndex(smiles);
          modal.close();
          this.showNameIndexManager();
        };
      }
    };

    searchInput.addEventListener("input", () => renderList(searchInput.value));
    renderList();

    modal.open();
  }

  // v2.0: 取得画布上的连通片段列表 (OCL getFragments), 供「选取单个分子命名」使用
  getCanvasFragments() {
    const mol = this.getMoleculeSafeQuiet();
    if (!mol) return [];
    try {
      if (typeof mol.getFragments === "function") {
        const f = mol.getFragments();
        return Array.isArray(f) ? f : [];
      }
    } catch (e) {
      /* ignore */
    }
    return [];
  }

  // 解析命名目标: "all"/undefined → 整画布分子; "frag:N" → 第 N 个连通片段
  resolveNamingTarget(target) {
    const mol = this.getMoleculeSafeQuiet();
    if (!mol) return null;
    if (target && typeof target === "string" && target.indexOf("frag:") === 0) {
      const i = parseInt(target.slice(5), 10);
      const frags = this.getCanvasFragments();
      if (!Number.isNaN(i) && frags[i]) return frags[i];
    }
    return mol;
  }

  // 重建「目标分子」下拉选项(保留当前选择)
  refreshFragmentOptions(select) {
    if (!select) return;
    const mol = this.getMoleculeSafeQuiet();
    const frags = this.getCanvasFragments();
    const prev = select.value;
    while (select.firstChild) select.removeChild(select.firstChild);
    select.createEl("option", {
      text: "整个画布" + (mol ? "（" + mol.getAllAtoms() + " 原子）" : ""),
      value: "all",
    });
    if (frags.length > 1) {
      for (let i = 0; i < frags.length; i++) {
        let n = 0;
        try {
          n = frags[i].getAllAtoms ? frags[i].getAllAtoms() : 0;
        } catch (e) {
          /* ignore */
        }
        select.createEl("option", {
          text: "片段 " + (i + 1) + "（" + n + " 原子）",
          value: "frag:" + i,
        });
      }
    }
    const opts = Array.prototype.slice.call(select.options).map((o) => o.value);
    if (prev && opts.indexOf(prev) !== -1) select.value = prev;
  }

  // v2.0: 分子式 → 名称 本地反查索引 (内置库 + 持久化映射)
  getFormulaNameIndex() {
    const idx = {};
    // 内置片段库 (常量, 总是可用)
    for (const c of MOLECULE_FRAGMENT_LIBRARY) {
      for (const it of c.items) {
        if (it[2]) {
          if (!idx[it[2]]) idx[it[2]] = [];
          if (idx[it[2]].indexOf(it[0]) === -1) idx[it[2]].push(it[0]);
        }
      }
    }
    // 合并持久化映射 (用户通过外部命名新增的 formula→name)
    try {
      const raw = localStorage.getItem("chemfig-formula-name-index");
      if (raw) {
        const persisted = JSON.parse(raw);
        if (persisted && typeof persisted === "object") {
          for (const [f, names] of Object.entries(persisted)) {
            if (!idx[f]) idx[f] = [];
            for (const n of Array.isArray(names) ? names : [names]) {
              if (idx[f].indexOf(n) === -1) idx[f].push(n);
            }
          }
        }
      }
    } catch (e) {
      /* ignore */
    }
    return idx;
  }

  lookupNameByFormula(formula) {
    if (!formula) return [];
    const idx = this.getFormulaNameIndex();
    return idx[formula] || [];
  }

  saveFormulaNameEntry(formula, name) {
    if (!formula || !name) return;
    try {
      const raw = localStorage.getItem("chemfig-formula-name-index") || "{}";
      const idx = JSON.parse(raw);
      if (!idx[formula]) idx[formula] = [];
      if (idx[formula].indexOf(name) === -1) idx[formula].push(name);
      localStorage.setItem("chemfig-formula-name-index", JSON.stringify(idx));
    } catch (e) {
      /* ignore */
    }
  }

  setFormulaDisplay(text) {
    if (this.formulaResultEl) this.formulaResultEl.textContent = text || "";
  }

  // v2.0: 结构 → 可读分子式 → 本地命名索引查名称 (用户设想的核心闭环)
  computeAndShowFormula(target) {
    const mol = this.resolveNamingTarget(target);
    if (!mol) {
      this.setFormulaDisplay("");
      new Notice("画布为空", 2500);
      return;
    }
    const formula = molToFormula(mol);
    if (!formula) {
      this.setFormulaDisplay("无法计算分子式");
      return;
    }
    const names = this.lookupNameByFormula(formula);
    if (names.length === 1) {
      this.setFormulaDisplay(formula + " · " + names[0]);
      this.setStatus("分子式: " + formula + " → " + names[0]);
    } else if (names.length > 1) {
      this.setFormulaDisplay(formula + " · 候选: " + names.join(" / "));
      this.setStatus("分子式: " + formula + "，命名索引候选: " + names.join("、"));
    } else {
      this.setFormulaDisplay(formula + " · 本地命名索引无记录");
      this.setStatus("分子式: " + formula + "（本地索引无记录，可点「命名」联网查询）");
    }
  }

  // v10.15.7: 三种命名查询模式
  // mode: "external" (A: 外部数据库查询) | "local" (B: 本地缓存读取) | "calibrate" (C: 校准外部+本地)
  async nameMoleculeWithMode(mode, service, target) {
    const mol = this.resolveNamingTarget(target);
    if (!mol) {
      new Notice("画布为空，无法命名");
      return;
    }
    const formula = molToFormula(mol);
    this.setFormulaDisplay(formula);
    const key = this.canonicalKey(mol);
    if (!key) {
      new Notice("无法取得结构标识 (SMILES)");
      return;
    }

    const idx = this.getNameIndex();

    // B: 本地缓存读取模式
    if (mode === "local") {
      if (idx[key]) {
        const name = this.getIndexName(idx[key]);
        this.setStatus("命名 (本地索引): " + name);
        if (this.nameResultEl) this.nameResultEl.textContent = "名称: " + name + "（来自本地缓存）";
        this.saveFormulaNameEntry(formula, name);
        new Notice("命名: " + name + "（本地缓存）");
      } else {
        this.setStatus("本地索引中未找到该结构");
        if (this.nameResultEl)
          this.nameResultEl.textContent = "本地缓存中未找到，请切换到 A 模式查询外部数据库";
        new Notice("本地缓存中未找到该结构", 2500);
      }
      return;
    }

    // A: 外部数据库查询模式
    // C: 校准模式（先查本地，再查外部，不一致则更新）
    if (mode === "calibrate" && idx[key]) {
      // 校准模式: 本地已有，先显示本地，再查询外部对比
      const oldName = this.getIndexName(idx[key]);
      this.setStatus("校准中: 本地=" + oldName + ", 查询外部...");
      if (this.nameResultEl) this.nameResultEl.textContent = "校准中... 本地: " + oldName;
    } else if (mode === "external" && idx[key]) {
      // 外部模式: 直接覆盖查询外部
      this.setStatus("命名 (外部查询): 查询 " + service + " ...");
      if (this.nameResultEl) this.nameResultEl.textContent = "外部查询中... (将覆盖本地)";
    } else {
      this.setStatus("命名: 查询 " + service + " ...");
      if (this.nameResultEl) this.nameResultEl.textContent = "外部查询中...";
    }

    if (typeof requestUrl !== "function") {
      new Notice("requestUrl 不可用，无法联网命名", 2500);
      return;
    }

    try {
      const name = await this.fetchStructureName(service, key);
      if (name) {
        // 外部查询成功，写入本地库（增强元数据）
        const oldEntry = idx[key];
        const oldName = this.getIndexName(oldEntry);
        idx[key] = {
          name: name,
          formula: formula,
          source: service,
          updatedAt: Date.now(),
          favorite: oldEntry && typeof oldEntry === "object" && oldEntry.favorite ? true : false,
        };
        this.saveNameIndex(idx);
        this.saveFormulaNameEntry(formula, name);

        if (mode === "calibrate" && oldName && oldName !== name) {
          // 校准模式: 本地与外部不一致，已更新
          this.setStatus("校准完成: " + oldName + " → " + name);
          if (this.nameResultEl)
            this.nameResultEl.textContent =
              "校准完成: " + oldName + " → " + name + "（已更新本地库）";
          new Notice("校准完成: " + oldName + " → " + name, 3000);
        } else {
          this.setStatus("命名: " + name);
          if (this.nameResultEl)
            this.nameResultEl.textContent =
              "名称: " + name + (oldName ? "（已更新本地库）" : "（已写入本地库）");
          new Notice("命名: " + name);
        }
      } else {
        this.setStatus("外部查询: 未找到该结构名称");
        const localName = idx[key] ? this.getIndexName(idx[key]) : "";
        if (this.nameResultEl)
          this.nameResultEl.textContent =
            "外部未找到" + (localName ? "，使用本地: " + localName : "");
        new Notice("外部未找到该结构的名称", 2500);
      }
    } catch (e) {
      this.setStatus("命名失败: " + e.message);
      if (this.nameResultEl) this.nameResultEl.textContent = "命名失败: " + e.message;
      new Notice("命名失败: " + e.message);
    }
  }

  async nameMoleculeNow(service, target) {
    const mol = this.resolveNamingTarget(target);
    if (!mol) {
      new Notice("画布为空，无法命名");
      return;
    }
    const formula = molToFormula(mol);
    this.setFormulaDisplay(formula);
    const key = this.canonicalKey(mol);
    if (!key) {
      new Notice("无法取得结构标识 (SMILES)");
      return;
    }
    // 先查本地索引
    const idx = this.getNameIndex();
    if (idx[key]) {
      const name = this.getIndexName(idx[key]);
      this.setStatus("命名 (本地索引): " + name);
      if (this.nameResultEl) this.nameResultEl.textContent = "名称: " + name + "（来自本地索引）";
      this.saveFormulaNameEntry(formula, name);
      return;
    }
    if (typeof requestUrl !== "function") {
      new Notice("requestUrl 不可用，无法联网命名");
      return;
    }
    if (this.nameResultEl) this.nameResultEl.textContent = "查询中...";
    this.setStatus("命名: 查询 " + service + " ...");
    try {
      const name = await this.fetchStructureName(service, key);
      if (name) {
        idx[key] = {
          name: name,
          formula: formula,
          source: service,
          updatedAt: Date.now(),
          favorite: false,
        };
        this.saveNameIndex(idx);
        this.saveFormulaNameEntry(formula, name);
        this.setStatus("命名: " + name);
        if (this.nameResultEl) this.nameResultEl.textContent = "名称: " + name;
        new Notice("命名: " + name);
      } else {
        this.setStatus("命名: 未找到该结构名称");
        if (this.nameResultEl) this.nameResultEl.textContent = "未找到该结构的名称";
        new Notice("未找到该结构的名称");
      }
    } catch (e) {
      this.setStatus("命名失败: " + e.message);
      if (this.nameResultEl) this.nameResultEl.textContent = "命名失败: " + e.message;
      new Notice("命名失败: " + e.message);
    }
  }

  async fetchStructureName(service, smiles) {
    const enc = encodeURIComponent(smiles);

    // v10.15.13: 优先获取中文名称，Wikidata 服务已设置 zh,en 语言
    if (service === "wikidata") {
      // Wikidata: 通过 SMILES 查询，返回中文/英文标签
      const sparql = `SELECT ?item ?itemLabel WHERE {
        ?item wdt:P233 "${smiles}" .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "zh,en". }
      } LIMIT 1`;
      const r = await requestUrl({
        url: "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(sparql),
        headers: { "User-Agent": "ChemfigObsidianPlugin/1.0" },
      });
      try {
        const data = JSON.parse(r.text);
        const bindings = data.results?.bindings || [];
        if (bindings.length > 0) return bindings[0].itemLabel?.value || "";
      } catch (e) {
        /* ignore */
      }
      return "";
    }

    // v10.15.13: 其他服务获取名称后，再尝试从 Wikidata 获取中文名称
    let englishName = "";
    if (service === "pubchem") {
      const r = await requestUrl({
        url:
          "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/" +
          enc +
          "/property/IUPACName,Title/JSON",
      });
      let data = null;
      try {
        data = JSON.parse(r.text);
      } catch (e) {
        data = null;
      }
      const p =
        data &&
        data.PropertyTable &&
        data.PropertyTable.Properties &&
        [].concat(data.PropertyTable.Properties)[0];
      englishName = p ? p.IUPACName || p.Title || "" : "";
    } else if (service === "cir") {
      const r = await requestUrl({
        url: "https://cactus.nci.nih.gov/chemical/structure/" + enc + "/iupac_name",
      });
      const t = (r.text || "").trim();
      englishName = t && !/<html|DOCTYPE/i.test(t) && !t.startsWith("{") ? t : "";
    } else if (service === "opsin") {
      const r = await requestUrl({ url: "https://opsin.ch.cam.ac.uk/opsin/" + enc });
      const t = (r.text || "").trim();
      englishName = t && !/<html|DOCTYPE/i.test(t) && !t.startsWith("{") ? t : "";
    } else if (service === "chembl") {
      // ChEMBL: 通过 SMILES 查询，返回 pref_name
      const r = await requestUrl({
        url:
          "https://www.ebi.ac.uk/chembl/api/data/molecule/search.json?format=json&limit=1&smiles=" +
          enc,
        headers: { Accept: "application/json" },
      });
      try {
        const data = JSON.parse(r.text);
        const molecules = data.molecules || [];
        if (molecules.length > 0)
          englishName =
            molecules[0].pref_name || molecules[0].molecule_properties?.full_molformula || "";
      } catch (e) {
        /* ignore */
      }
    } else if (service === "nist") {
      // NIST Chemistry WebBook: 通过 SMILES 查询 CAS 号和名称
      const r = await requestUrl({
        url: "https://webbook.nist.gov/cgi/cbook.cgi?SMILES=" + enc + "&Units=SI",
      });
      const t = (r.text || "").trim();
      // 从 HTML 中提取标题中的化合物名称
      const match = t.match(/<title>([^<]+)<\/title>/);
      if (match && match[1] && !/not found|error/i.test(match[1])) {
        englishName = match[1].replace(/^NIST Chemistry WebBook, SRD 69--/, "").trim();
      }
    } else if (service === "chemspider") {
      // ChemSpider: 公开搜索接口（无需API key的简化版）
      const r = await requestUrl({
        url: "https://www.chemspider.com/Search.ashx?smiles=" + enc,
        headers: { Accept: "application/json" },
      });
      try {
        const data = JSON.parse(r.text);
        if (data && data.results && data.results.length > 0) {
          englishName = data.results[0].CommonName || data.results[0].IUPACName || "";
        }
      } catch (e) {
        /* ignore */
      }
    }

    // v10.15.13: 如果获取到英文名称，再尝试从 Wikidata 获取中文名称
    if (englishName) {
      try {
        const chineseName = await this.fetchWikidataChineseName(smiles);
        if (chineseName) {
          // 返回 "中文名 (英文名)" 格式
          return chineseName + " (" + englishName + ")";
        }
      } catch (e) {
        /* ignore */
      }
    }

    return englishName;
  }

  // v10.15.13: 从 Wikidata 获取中文名称
  async fetchWikidataChineseName(smiles) {
    try {
      const sparql = `SELECT ?item ?itemLabel WHERE {
        ?item wdt:P233 "${smiles}" .
        SERVICE wikibase:label { bd:serviceParam wikibase:language "zh". }
      } LIMIT 1`;
      const r = await requestUrl({
        url: "https://query.wikidata.org/sparql?format=json&query=" + encodeURIComponent(sparql),
        headers: { "User-Agent": "ChemfigObsidianPlugin/1.0" },
      });
      const data = JSON.parse(r.text);
      const bindings = data.results?.bindings || [];
      if (bindings.length > 0) {
        const label = bindings[0].itemLabel?.value || "";
        // 检查是否为中文
        if (/[\u4e00-\u9fa5]/.test(label)) {
          return label;
        }
      }
    } catch (e) {
      /* ignore */
    }
    return "";
  }

  getMoleculeSafe() {
    if (!this.editor) {
      new Notice("画布未初始化");
      return null;
    }
    const mol = this.editor.getMolecule();
    if (!mol || mol.getAllAtoms() === 0) {
      new Notice("画布为空");
      return null;
    }
    return mol;
  }

  /**
   * v16.4.0: 获取选中的分子（多分子场景）
   * 优先返回用户圈选的分子，否则返回整个画布分子
   */
  getSelectedMoleculeSafe() {
    const mol = this.getMoleculeSafe();
    if (!mol) return null;

    try {
      // 尝试获取选中的原子/键
      const fragments = mol.getFragments();
      
      // 如果只有一个碎片，直接返回
      if (fragments.length === 1) {
        return mol;
      }

      // 多个碎片时，检查是否有选中的原子
      // OCL 内部可能有 selection 状态
      if (this.editor && this.editor.selection) {
        const selectedAtoms = this.editor.selection.atoms || [];
        if (selectedAtoms.length > 0) {
          // 找到选中原子所属的碎片
          for (const frag of fragments) {
            let hasSelected = false;
            frag.forEachAtom(atom => {
              if (selectedAtoms.includes(atom.getIdx())) {
                hasSelected = true;
              }
            });
            if (hasSelected) {
              this.setStatus(`已选中碎片: ${frag.getAllAtoms()} 个原子`);
              return frag;
            }
          }
        }
      }

      // 没有选中的，返回整个分子，并提示
      this.setStatus(`画布包含 ${fragments.length} 个分子，将对整个画布操作`);
      return mol;
    } catch (e) {
      console.warn("获取选中分子失败:", e);
      return mol;
    }
  }

  // v16.0.0: 构建左侧垂直工具栏
  buildLeftToolbar(container) {
    // 选择/移动工具组
    const selectGroup = container.createDiv("molecule-editor-tool-section");
    
    const selectBtn = selectGroup.createEl("button", {
      text: "👆",
      cls: "molecule-editor-vtool-btn active",
    });
    selectBtn.createSpan({ cls: "vtool-label", text: "选择/移动" });
    selectBtn.onclick = () => {
      this._setActiveTool(selectBtn);
      this.setStatus("选择模式：点击原子/键进行编辑");
    };

    const eraseBtn = selectGroup.createEl("button", {
      text: "🗑️",
      cls: "molecule-editor-vtool-btn",
    });
    eraseBtn.createSpan({ cls: "vtool-label", text: "删除工具" });
    eraseBtn.onclick = () => {
      this._setActiveTool(eraseBtn);
      this.setStatus("删除模式：点击要删除的原子/键");
    };

    // 键工具组
    const bondGroup = container.createDiv("molecule-editor-tool-section");
    const bonds = [
      { icon: "─", label: "单键", type: 1 },
      { icon: "＝", label: "双键", type: 2 },
      { icon: "≡", label: "三键", type: 3 },
    ];
    bonds.forEach(b => {
      const btn = bondGroup.createEl("button", {
        text: b.icon,
        cls: "molecule-editor-vtool-btn",
      });
      btn.createSpan({ cls: "vtool-label", text: b.label });
      btn.onclick = () => {
        this._setActiveTool(btn);
        this.setStatus(b.label + "模式：在两个原子间点击创建" + b.label);
        this._simulateOclToolClick("bond", b.type);
      };
    });

    // 原子工具组
    const atomGroup = container.createDiv("molecule-editor-tool-section");
    const atoms = [
      { symbol: "C", label: "碳" },
      { symbol: "N", label: "氮" },
      { symbol: "O", label: "氧" },
      { symbol: "S", label: "硫" },
      { symbol: "P", label: "磷" },
    ];
    atoms.forEach(a => {
      const btn = atomGroup.createEl("button", {
        text: a.symbol,
        cls: "molecule-editor-vtool-btn",
      });
      btn.style.fontWeight = "bold";
      btn.createSpan({ cls: "vtool-label", text: a.label + "原子" });
      btn.onclick = () => {
        this._setActiveTool(btn);
        this.setStatus(a.label + "原子：点击画布添加" + a.label + "原子");
        this._simulateOclToolClick("atom", a.symbol);
      };
    });

    // 模板工具组
    const tplGroup = container.createDiv("molecule-editor-tool-section");
    const templates = [
      { icon: "⬡", label: "苯环", smiles: "c1ccccc1" },
      { icon: "⬢", label: "环己烷", smiles: "C1CCCCC1" },
      { icon: "⬟", label: "环戊烷", smiles: "C1CCCC1" },
    ];
    templates.forEach(t => {
      const btn = tplGroup.createEl("button", {
        text: t.icon,
        cls: "molecule-editor-vtool-btn",
      });
      btn.createSpan({ cls: "vtool-label", text: t.label });
      btn.onclick = () => {
        try {
          const mol = getOCL().Molecule.fromSmiles(t.smiles);
          this.loadMolecule(mol, "已载入模板: " + t.label);
        } catch (e) {
          this.setStatus("模板加载失败: " + e.message);
        }
      };
    });

    // 视图工具组
    const viewGroup = container.createDiv("molecule-editor-tool-section");
    const views = [
      { icon: "🔍+", label: "放大", action: () => this.zoomCanvas(1.2) },
      { icon: "🔍-", label: "缩小", action: () => this.zoomCanvas(0.8) },
      { icon: "🔄", label: "重置视图", action: () => this.resetView() },
      { icon: "🧊", label: "3D 查看", action: () => this.open3DViewer() },
    ];
    views.forEach(v => {
      const btn = viewGroup.createEl("button", {
        text: v.icon,
        cls: "molecule-editor-vtool-btn",
      });
      btn.createSpan({ cls: "vtool-label", text: v.label });
      btn.onclick = v.action;
    });

    // v16.3.0: 化学命名工具组
    const namingGroup = container.createDiv("molecule-editor-tool-section");
    
    const namingBtn = namingGroup.createEl("button", {
      text: "🔤",
      cls: "molecule-editor-vtool-btn",
    });
    namingBtn.createSpan({ cls: "vtool-label", text: "化学命名" });
    namingBtn.onclick = () => {
      this.openNamingPanel();
    };

    const formulaBtn = namingGroup.createEl("button", {
      text: "🧮",
      cls: "molecule-editor-vtool-btn",
    });
    formulaBtn.createSpan({ cls: "vtool-label", text: "计算分子式" });
    formulaBtn.onclick = () => {
      this.computeFormulaFromToolbar();
    };

    // v16.3.0: 更多功能工具组
    const moreGroup = container.createDiv("molecule-editor-tool-section");
    
    const moreBtn = moreGroup.createEl("button", {
      text: "⚗️",
      cls: "molecule-editor-vtool-btn",
    });
    moreBtn.createSpan({ cls: "vtool-label", text: "官能团分析" });
    moreBtn.onclick = () => {
      this.openFunctionalGroupAnalysis();
    };

    const dbBtn = moreGroup.createEl("button", {
      text: "📚",
      cls: "molecule-editor-vtool-btn",
    });
    dbBtn.createSpan({ cls: "vtool-label", text: "化合物库" });
    dbBtn.onclick = () => {
      this.openCompoundDatabase();
    };
  }

  // v16.3.0: 打开命名面板
  openNamingPanel() {
    const mol = this.getSelectedMoleculeSafe();
    if (!mol) {
      new Notice("请先在画布上绘制分子", 2000);
      return;
    }
    try {
      const smiles = mol.toIsomericSmiles();
      this.setStatus("正在命名...");
      
      // v16.4.0: 通过 SMILES 反查中文标准命名
      const compound = CompoundIndex.getCompoundBySmiles(smiles);
      if (compound) {
        const formula = compound.molecularFormula;
        const mw = compound.molecularWeight;
        const groups = compound.functionalGroups.map(g => g.name).join("、");
        new Notice(
          `【${compound.category}】${compound.name}\n` +
          `分子式: ${formula} | 分子量: ${mw}\n` +
          `官能团: ${groups || "无"}`,
          6000
        );
        this.setStatus(`命名完成: ${compound.name}`);
      } else {
        // 未在数据库中找到，计算基本信息
        const formula = CompoundIndex.calculateMolecularFormula(smiles);
        const mw = CompoundIndex.calculateMolecularWeight(formula);
        new Notice(
          `未找到匹配化合物\n` +
          `SMILES: ${smiles}\n` +
          `分子式: ${formula} | 分子量: ${mw}`,
          6000
        );
        this.setStatus(`已计算分子式: ${formula}`);
      }
    } catch (e) {
      new Notice("命名失败: " + e.message, 3000);
    }
  }

  // v16.3.0: 从工具栏计算分子式
  computeFormulaFromToolbar() {
    const mol = this.getSelectedMoleculeSafe();
    if (!mol) {
      new Notice("请先在画布上绘制分子", 2000);
      return;
    }
    try {
      const smiles = mol.toIsomericSmiles();
      const formula = CompoundIndex.calculateMolecularFormula(smiles);
      const mw = CompoundIndex.calculateMolecularWeight(formula);
      new Notice(`分子式: ${formula}\n分子量: ${mw}`, 4000);
    } catch (e) {
      new Notice("计算失败: " + e.message, 3000);
    }
  }

  // v16.3.0: 打开官能团分析
  openFunctionalGroupAnalysis() {
    const mol = this.getMoleculeSafe();
    if (!mol) {
      new Notice("请先在画布上绘制分子", 2000);
      return;
    }
    try {
      const smiles = mol.toIsomericSmiles();
      if (typeof FunctionalGroupAnalysisModal !== "undefined") {
        new FunctionalGroupAnalysisModal(this.app, smiles).open();
      } else {
        new Notice("官能团分析模块未加载", 2000);
      }
    } catch (e) {
      new Notice("分析失败: " + e.message, 3000);
    }
  }

  // v16.3.0: 打开化合物数据库
  openCompoundDatabase() {
    if (typeof CompoundDatabaseModal !== "undefined") {
      new CompoundDatabaseModal(this.app).open();
    } else {
      new Notice("化合物数据库未加载", 2000);
    }
  }

  // v16.0.0: 设置当前激活工具按钮
  _setActiveTool(activeBtn) {
    const allBtns = activeBtn.parentElement.parentElement.querySelectorAll(".molecule-editor-vtool-btn");
    allBtns.forEach(b => b.classList.remove("active"));
    activeBtn.classList.add("active");
  }

  // v16.0.0: 模拟点击 OCL 内置工具栏按钮
  _simulateOclToolClick(toolType, param) {
    if (!this.editorContainer) return;
    
    try {
      // 尝试找到 OCL 工具栏中的对应按钮
      const toolbar = this.editorContainer.querySelector(".ocl-toolbar, [class*='toolbar']");
      if (!toolbar) return;

      const buttons = toolbar.querySelectorAll("button, [role='button'], [class*='tool']");
      
      if (toolType === "bond") {
        // 键工具：根据键级找到对应按钮
        const bondIdx = param - 1;
        if (buttons[bondIdx]) {
          buttons[bondIdx].click();
        }
      } else if (toolType === "atom") {
        // 原子工具：查找包含该原子符号的按钮
        for (const btn of buttons) {
          const text = (btn.textContent || "").trim();
          if (text === param || btn.getAttribute("aria-label") === param) {
            btn.click();
            break;
          }
        }
      }
    } catch (e) {
      /* ignore */
    }
  }

  // v16.0.0: 缩放画布
  zoomCanvas(factor) {
    if (!this.editor) return;
    try {
      if (typeof this.editor.zoom === "function") {
        this.editor.zoom(factor);
      }
    } catch (e) {
      /* ignore */
    }
  }

  // v16.0.0: 打开 3D 查看器
  open3DViewer() {
    const mol = this.getMoleculeSafe();
    if (!mol) {
      new Notice("请先在画布上绘制分子", 2000);
      return;
    }
    try {
      const smiles = mol.toIsomericSmiles();
      // 调用已有的 3D 查看器功能
      if (this._open3DViewer) {
        this._open3DViewer(smiles);
      } else {
        new Notice("3D 查看器加载中...", 2000);
      }
    } catch (e) {
      new Notice("3D 查看失败: " + e.message);
    }
  }

  setStatus(msg) {
    if (this.statusEl) {
      this.statusEl.empty();
      const left = this.statusEl.createDiv("status-left");
      left.createSpan({ text: msg });
    }
  }

  // 静默取得当前分子（不弹提示），供平移 / 缩放手势使用
  getMoleculeSafeQuiet() {
    if (!this.editor || this.editor.isDestroyed) return null;
    const mol = this.editor.getMolecule();
    return mol && mol.getAllAtoms() > 0 ? mol : null;
  }

  redraw() {
    if (
      this.editor &&
      !this.editor.isDestroyed &&
      typeof this.editor.moleculeChanged === "function"
    ) {
      this.editor.moleculeChanged();
    }
  }

  // 统一的「载入分子到画布」入口：setMolecule + moleculeChanged() 强制重绘。
  // （片段库 / SMILES 加载都在同一画布界面，无需再切面板。）
  loadMolecule(mol, statusMsg) {
    if (!this.editor) {
      new Notice("画布未初始化");
      return;
    }
    try {
      this.editor.setMolecule(mol);
      this.redraw();
    } catch (e) {
      new Notice("设置分子失败: " + e.message);
      return;
    }

    // v15.3.0: 增强状态栏 - 显示分子详细信息
    try {
      const atomCount = mol.getAllAtoms();
      const bondCount = mol.getAllBonds();
      const smiles = mol.toCanonicalSmiles();

      let infoMsg = statusMsg || "";
      if (atomCount > 0) {
        const parts = [
          `原子: ${atomCount}`,
          `键: ${bondCount}`,
        ];

        // 估算分子式
        const formula = this.estimateFormulaFromMol(mol);
        if (formula) {
          parts.push(`分子式: ${formula}`);
        }

        infoMsg = infoMsg ? `${infoMsg} | ${parts.join(" | ")}` : parts.join(" | ");
      }

      this.setStatus(infoMsg);
    } catch (e) {
      if (statusMsg) this.setStatus(statusMsg);
    }
  }

  // v15.3.0: 从分子对象估算分子式
  estimateFormulaFromMol(mol) {
    try {
      const counts = {};
      const atomCount = mol.getAllAtoms();
      for (let i = 0; i < atomCount; i++) {
        const elem = mol.getAtomicNo(i);
        const sym = this.atomicNoToSymbol(elem);
        counts[sym] = (counts[sym] || 0) + 1;
      }

      // 按 Hill 系统排序: C, H, 然后字母序
      let formula = "";
      if (counts["C"]) {
        formula += counts["C"] > 1 ? `C${counts["C"]}` : "C";
        delete counts["C"];
      }
      if (counts["H"]) {
        formula += counts["H"] > 1 ? `H${counts["H"]}` : "H";
        delete counts["H"];
      }
      const sortedKeys = Object.keys(counts).sort();
      for (const key of sortedKeys) {
        formula += counts[key] > 1 ? `${key}${counts[key]}` : key;
      }

      return formula || null;
    } catch (e) {
      return null;
    }
  }

  // v15.3.0: 原子序数转元素符号
  atomicNoToSymbol(no) {
    const map = {
      1: "H", 2: "He", 3: "Li", 4: "Be", 5: "B", 6: "C", 7: "N", 8: "O",
      9: "F", 10: "Ne", 11: "Na", 12: "Mg", 13: "Al", 14: "Si", 15: "P",
      16: "S", 17: "Cl", 18: "Ar", 19: "K", 20: "Ca", 26: "Fe", 29: "Cu",
      30: "Zn", 35: "Br", 47: "Ag", 53: "I", 79: "Au", 80: "Hg",
    };
    return map[no] || `X${no}`;
  }

  // v16.4.0: 实现悬浮元素可拖动
  makeDraggable(element) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    
    // 添加拖拽手柄样式
    element.style.cursor = 'grab';
    element.addEventListener('mousedown', dragMouseDown);
    
    function dragMouseDown(e) {
      e = e || window.event;
      
      // 只在空白处拖动，不阻止按钮点击
      if (e.target.tagName === 'BUTTON' ||
          e.target.closest('button') ||
          e.target.tagName === 'INPUT' ||
          e.target.closest('input')) {
        return;
      }
      
      e.preventDefault();
      // 获取鼠标光标位置
      pos3 = e.clientX;
      pos4 = e.clientY;
      document.addEventListener('mouseup', closeDragElement);
      document.addEventListener('mousemove', elementDrag);
      element.style.cursor = 'grabbing';
    }
    
    function elementDrag(e) {
      e = e || window.event;
      e.preventDefault();
      // 计算新位置
      pos1 = pos3 - e.clientX;
      pos2 = pos4 - e.clientY;
      pos3 = e.clientX;
      pos4 = e.clientY;
      // 设置元素的新位置
      element.style.top = (element.offsetTop - pos2) + "px";
      element.style.left = (element.offsetLeft - pos1) + "px";
      element.style.transform = 'none';
    }
    
    function closeDragElement() {
      // 停止移动并释放鼠标按钮
      document.removeEventListener('mouseup', closeDragElement);
      document.removeEventListener('mousemove', elementDrag);
      element.style.cursor = 'grab';
    }
  }

  // 画布手势：按住右键拖动 = 平移；滚轮 = 以光标为中心缩放。
  // OCL 原生会忽略非主键(ev.button>0)事件且不处理滚轮，因此这里自行接管。
  setupCanvasGestures() {
    if (!this.editorContainer) return;
    const el = this.editorContainer;
    const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
    let panning = false,
      lastX = 0,
      lastY = 0;

    const pos = (e) => {
      const r = el.getBoundingClientRect();
      return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr };
    };
    const onCtx = (e) => e.preventDefault();
    const onDown = (e) => {
      if (e.button !== 2) return;
      panning = true;
      const p = pos(e);
      lastX = p.x;
      lastY = p.y;
      e.preventDefault();
      e.stopPropagation();
    };
    const onMove = (e) => {
      if (!panning) return;
      const p = pos(e);
      const mol = this.getMoleculeSafeQuiet();
      if (mol) {
        try {
          mol.translate({ x: p.x - lastX, y: p.y - lastY });
          this.redraw();
        } catch (err) {
          /* ignore */
        }
      }
      lastX = p.x;
      lastY = p.y;
    };
    const onUp = (e) => {
      if (e.button === 2) panning = false;
    };
    const onWheel = (e) => {
      e.preventDefault();
      const mol = this.getMoleculeSafeQuiet();
      if (!mol) return;
      try {
        const factor = Math.max(0.7, Math.min(1.4, Math.exp(-e.deltaY * 0.001)));
        const p = pos(e);
        mol.zoomAndRotateInit(p.x, p.y);
        mol.zoomAndRotate(factor, 0, false);
        this.redraw();
      } catch (err) {
        /* ignore */
      }
    };

    el.addEventListener("contextmenu", onCtx);
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: false });

    this._gestureCleanup = () => {
      el.removeEventListener("contextmenu", onCtx);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
    };
  }

  // v10.15.17: 打开翻转卡片练习（含间隔重复算法）
  openFlashcardPractice() {
    const self = this;
    const modal = new Modal(this.app);
    modal.titleEl.setText("📇 翻转卡片练习");

    modal.onOpen = () => {
      const { contentEl } = modal;
      contentEl.addClass("flashcard-practice-modal");

      // 收集所有有 SMILES 的化合物
      const allCards = [];
      for (const cat of MOLECULE_FRAGMENT_LIBRARY) {
        for (const item of cat.items) {
          if (item[1]) {
            // 有 SMILES
            allCards.push({
              name: item[0],
              smiles: item[1],
              formula: item[2] || "",
              category: cat.cat,
            });
          }
        }
      }

      if (allCards.length === 0) {
        contentEl.createEl("div", {
          text: "暂无可用卡片",
          attr: { style: "padding:40px;text-align:center;color:var(--text-muted);" },
        });
        return;
      }

      // v10.16.0: 加载间隔重复数据
      let reviewData = {};
      try {
        reviewData = JSON.parse(localStorage.getItem("chemfig-review-data") || "{}");
      } catch (e) {}

      // SM-2 间隔重复算法（简化版）
      function getNextInterval(cardKey, quality) {
        // quality: 0=忘记, 3=中等, 5=简单
        if (!reviewData[cardKey]) {
          reviewData[cardKey] = {
            reps: 0,
            interval: 0,
            ease: 2.5,
            nextReview: Date.now(),
            difficulty: "medium",
          };
        }
        const card = reviewData[cardKey];

        if (quality < 3) {
          // 忘记了，重置间隔
          card.reps = 0;
          card.interval = 1; // 1分钟后复习
          card.difficulty = "hard";
        } else {
          card.reps++;
          if (card.reps === 1) {
            card.interval = quality === 5 ? 4 : 1; // 简单4天，中等1天
          } else if (card.reps === 2) {
            card.interval = quality === 5 ? 15 : 6;
          } else {
            card.interval = Math.round(card.interval * card.ease);
          }
          // 调整 ease factor
          card.ease = Math.max(1.3, card.ease + (quality - 3) * 0.1);
          card.difficulty = quality === 5 ? "easy" : quality === 3 ? "medium" : "hard";
        }

        card.nextReview = Date.now() + card.interval * 24 * 60 * 60 * 1000; // 天转毫秒
        // reviewData 随复习次数只增不减, 写满配额时若不捕获会直接中断间隔重复流程
        safeLocalStorageSet("chemfig-review-data", reviewData);

        return card.interval;
      }

      // 筛选今天需要复习的卡片
      const now = Date.now();
      const dueCards = allCards.filter((card) => {
        const key = card.smiles;
        if (!reviewData[key]) return true; // 新卡片
        return reviewData[key].nextReview <= now;
      });

      // 待复习卡片不足时补充新卡片
      let reviewQueue = dueCards;
      if (reviewQueue.length < 10) {
        const newCards = allCards.filter((card) => !reviewData[card.smiles]);
        reviewQueue = reviewQueue.concat(newCards.slice(0, 20 - reviewQueue.length));
      }

      // 打乱顺序
      reviewQueue.sort(() => Math.random() - 0.5);
      let currentIndex = 0;
      let isFlipped = false;
      let correctCount = 0;
      let totalCount = 0;

      // 模式切换按钮
      const modeBar = contentEl.createDiv("flashcard-mode-bar");
      modeBar.style.cssText = "display:flex;gap:6px;justify-content:center;margin-bottom:12px;";

      let currentMode = "review"; // review / learn / browse

      function switchMode(mode) {
        currentMode = mode;
        // 更新按钮样式
        Array.from(modeBar.children).forEach((btn, i) => {
          const modes = ["review", "learn", "browse"];
          if (modes[i] === mode) {
            btn.style.background = "var(--interactive-accent)";
            btn.style.color = "white";
          } else {
            btn.style.background = "var(--background-secondary)";
            btn.style.color = "";
          }
        });

        // 重新加载队列
        if (mode === "review") {
          reviewQueue = dueCards;
        } else if (mode === "learn") {
          reviewQueue = allCards.filter((card) => !reviewData[card.smiles]);
        } else {
          reviewQueue = allCards;
        }
        reviewQueue.sort(() => Math.random() - 0.5);
        currentIndex = 0;
        renderCard();
        updateProgress();
      }

      const modes = [
        { id: "review", label: "📅 复习" },
        { id: "learn", label: "📚 学习新卡片" },
        { id: "browse", label: "👀 浏览模式" },
      ];

      for (const m of modes) {
        const btn = modeBar.createEl("button", { text: m.label });
        btn.style.cssText =
          "padding:6px 12px;font-size:11px;border:1px solid var(--background-modifier-border);border-radius:16px;cursor:pointer;";
        btn.onclick = () => switchMode(m.id);
      }

      // 卡片容器
      const cardContainer = contentEl.createDiv("flashcard-container");
      cardContainer.style.cssText = "perspective:1000px;margin:20px 0;";

      // 卡片本体
      const card = cardContainer.createDiv("flashcard");
      card.style.cssText =
        "width:100%;max-width:400px;height:300px;margin:0 auto;position:relative;transform-style:preserve-3d;transition:transform 0.6s;cursor:pointer;";

      // 正面（结构）
      const front = card.createDiv("flashcard-front");
      front.style.cssText =
        "position:absolute;inset:0;backface-visibility:hidden;background:var(--background-primary);border:2px solid var(--background-modifier-border);border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;box-shadow:0 8px 24px rgba(0,0,0,0.15);";

      // 背面（名称+信息）
      const back = card.createDiv("flashcard-back");
      back.style.cssText =
        "position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);background:linear-gradient(135deg, var(--interactive-accent), var(--interactive-accent-hover));color:white;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;box-shadow:0 8px 24px rgba(0,0,0,0.15);";

      // 翻转函数
      function flipCard() {
        isFlipped = !isFlipped;
        card.style.transform = isFlipped ? "rotateY(180deg)" : "rotateY(0deg)";
      }

      card.onclick = flipCard;

      // 渲染当前卡片
      function renderCard() {
        isFlipped = false;
        card.style.transform = "rotateY(0deg)";

        const cardData = reviewQueue[currentIndex];
        if (!cardData) return;

        const key = cardData.smiles;
        const cardInfo = reviewData[key] || {};

        // 正面：结构
        front.innerHTML = "";
        front.createEl("div", {
          text: currentMode === "browse" ? cardData.name : "这是什么化合物？",
          attr: { style: "font-size:14px;color:var(--text-muted);margin-bottom:16px;" },
        });

        let svgHtml = "";
        try {
          svgHtml = renderSmilesSvg(cardData.smiles, 200, 140);
        } catch (e) {
          svgHtml = '<div style="font-size:48px;color:var(--text-muted);">◇</div>';
        }

        front.createEl("div", {
          attr: {
            style:
              "width:200px;height:140px;display:flex;align-items:center;justify-content:center;background:#ffffff;border-radius:8px;overflow:hidden;",
          },
        }).innerHTML = svgHtml;

        // 复习信息
        if (cardInfo.reps !== undefined) {
          front.createEl("div", {
            text: `已复习 ${cardInfo.reps} 次 · 间隔 ${cardInfo.interval || 1} 天`,
            attr: { style: "font-size:10px;color:var(--text-muted);margin-top:12px;" },
          });
        }

        if (currentMode !== "browse") {
          front.createEl("div", {
            text: "点击卡片翻转",
            attr: { style: "font-size:11px;color:var(--text-muted);margin-top:8px;" },
          });
        }

        // 背面：名称+信息
        back.innerHTML = "";
        back.createEl("h2", {
          text: cardData.name,
          attr: { style: "font-size:20px;font-weight:600;margin-bottom:12px;text-align:center;" },
        });
        back.createEl("div", {
          text: `分子式: ${cardData.formula}`,
          attr: { style: "font-size:14px;opacity:0.9;margin-bottom:8px;" },
        });
        back.createEl("div", {
          text: `分类: ${cardData.category}`,
          attr: { style: "font-size:12px;opacity:0.8;" },
        });
      }

      renderCard();

      // 进度显示
      const progressEl = contentEl.createEl("div");
      progressEl.style.cssText =
        "text-align:center;font-size:12px;color:var(--text-muted);margin-bottom:12px;";

      function updateProgress() {
        progressEl.textContent = `卡片 ${currentIndex + 1} / ${reviewQueue.length} · 答对 ${correctCount} / ${totalCount}`;
      }
      updateProgress();

      // 按钮组
      const btnGroup = contentEl.createDiv("flashcard-buttons");
      btnGroup.style.cssText = "display:flex;gap:8px;justify-content:center;flex-wrap:wrap;";

      // 困难按钮
      const hardBtn = btnGroup.createEl("button", { text: "😅 忘记了\n(1天)" });
      hardBtn.style.cssText =
        "padding:10px 16px;font-size:12px;background:var(--background-modifier-error);color:white;border:none;border-radius:6px;cursor:pointer;line-height:1.3;";
      hardBtn.onclick = () => {
        const cardData = reviewQueue[currentIndex];
        if (cardData) getNextInterval(cardData.smiles, 0);
        totalCount++;
        currentIndex = (currentIndex + 1) % reviewQueue.length;
        renderCard();
        updateProgress();
      };

      // 中等按钮
      const mediumBtn = btnGroup.createEl("button", { text: "😐 记得\n(6天)" });
      mediumBtn.style.cssText =
        "padding:10px 16px;font-size:12px;background:#f59e0b;color:white;border:none;border-radius:6px;cursor:pointer;line-height:1.3;";
      mediumBtn.onclick = () => {
        const cardData = reviewQueue[currentIndex];
        if (cardData) getNextInterval(cardData.smiles, 3);
        totalCount++;
        correctCount++;
        currentIndex = (currentIndex + 1) % reviewQueue.length;
        renderCard();
        updateProgress();
      };

      // 简单按钮
      const easyBtn = btnGroup.createEl("button", { text: "😎 很简单\n(15天)" });
      easyBtn.style.cssText =
        "padding:10px 16px;font-size:12px;background:var(--background-modifier-success);color:white;border:none;border-radius:6px;cursor:pointer;line-height:1.3;";
      easyBtn.onclick = () => {
        const cardData = reviewQueue[currentIndex];
        if (cardData) getNextInterval(cardData.smiles, 5);
        totalCount++;
        correctCount++;
        currentIndex = (currentIndex + 1) % reviewQueue.length;
        renderCard();
        updateProgress();
      };

      // 跳过按钮
      const skipBtn = btnGroup.createEl("button", { text: "⏭️ 跳过" });
      skipBtn.style.cssText =
        "padding:10px 16px;font-size:12px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:6px;cursor:pointer;";
      skipBtn.onclick = () => {
        currentIndex = (currentIndex + 1) % reviewQueue.length;
        renderCard();
        updateProgress();
      };
    };

    modal.open();
  }

  // v10.15.17: 反应式分步查看
  openReactionStepsViewer(reactionText) {
    const self = this;
    const modal = new Modal(this.app);
    modal.titleEl.setText("🔬 反应式分步查看");

    modal.onOpen = () => {
      const { contentEl } = modal;
      contentEl.addClass("reaction-steps-modal");

      // 示例反应式
      const defaultReaction = `苯 + 硝酸 → 硝基苯
条件: 浓硫酸, 50-60°C
步骤1: 浓硫酸质子化硝酸生成硝酰正离子
步骤2: 苯环亲电进攻硝酰正离子生成 σ-络合物
步骤3: 脱去质子恢复芳香性`;

      const textarea = contentEl.createEl("textarea");
      textarea.value = reactionText || defaultReaction;
      textarea.style.cssText =
        "width:100%;min-height:100px;padding:10px;margin-bottom:12px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:6px;font-family:monospace;font-size:12px;";

      const parseBtn = contentEl.createEl("button", { text: "🔍 解析反应式" });
      parseBtn.style.cssText =
        "width:100%;padding:8px;margin-bottom:12px;background:var(--interactive-accent);color:white;border:none;border-radius:6px;cursor:pointer;";

      const stepsContainer = contentEl.createDiv("reaction-steps");
      stepsContainer.style.cssText = "margin-top:12px;";

      function parseReaction(text) {
        stepsContainer.empty();

        // 简单解析: 按行分割
        const lines = text.split("\n").filter((l) => l.trim());
        let stepNum = 0;

        for (const line of lines) {
          const trimmed = line.trim();

          // 检测反应式行
          if (trimmed.includes("→") || trimmed.includes("->")) {
            const parts = trimmed.split(/→|->/);
            const reactants = parts[0] ? parts[0].trim() : "";
            const products = parts[1] ? parts[1].trim() : "";

            const stepEl = stepsContainer.createDiv("reaction-step");
            stepEl.style.cssText =
              "padding:12px;margin-bottom:8px;background:var(--background-secondary);border-radius:8px;border-left:3px solid var(--interactive-accent);";

            stepEl.createEl("div", {
              text: `⚛️ 反应: ${reactants} → ${products}`,
              attr: { style: "font-weight:600;margin-bottom:8px;" },
            });

            // 尝试查找 SMILES
            const reactantSmiles = findSmilesByName(reactants);
            const productSmiles = findSmilesByName(products);

            const row = stepEl.createDiv("step-row");
            row.style.cssText =
              "display:flex;align-items:center;justify-content:space-around;gap:8px;";

            if (reactantSmiles) {
              const left = row.createDiv();
              left.style.cssText = "text-align:center;";
              let svg = "";
              try {
                svg = renderSmilesSvg(reactantSmiles, 100, 70);
              } catch (e) {}
              left.innerHTML = `<div style="width:100px;height:70px;background:#fff;border-radius:4px;display:flex;align-items:center;justify-content:center;overflow:hidden;">${svg || "◇"}</div><div style="font-size:10px;margin-top:4px;">${reactants}</div>`;
            }

            const arrow = row.createEl("div");
            arrow.style.cssText = "font-size:24px;color:var(--interactive-accent);";
            arrow.textContent = "→";

            if (productSmiles) {
              const right = row.createDiv();
              right.style.cssText = "text-align:center;";
              let svg = "";
              try {
                svg = renderSmilesSvg(productSmiles, 100, 70);
              } catch (e) {}
              right.innerHTML = `<div style="width:100px;height:70px;background:#fff;border-radius:4px;display:flex;align-items:center;justify-content:center;overflow:hidden;">${svg || "◇"}</div><div style="font-size:10px;margin-top:4px;">${products}</div>`;
            }
          }
          // 检测条件行
          else if (trimmed.startsWith("条件:")) {
            const condEl = stepsContainer.createDiv("reaction-condition");
            condEl.style.cssText =
              "padding:8px 12px;margin-bottom:8px;background:var(--background-modifier-hover);border-radius:6px;font-size:12px;";
            condEl.textContent = `🧪 ${trimmed}`;
          }
          // 检测步骤行
          else if (trimmed.match(/^步骤\d/)) {
            stepNum++;
            const stepEl = stepsContainer.createDiv("reaction-step-detail");
            stepEl.style.cssText =
              "padding:10px 12px;margin-bottom:8px;background:var(--background-primary);border-radius:6px;border:1px solid var(--background-modifier-border);font-size:12px;";
            stepEl.innerHTML = `<span style="color:var(--interactive-accent);font-weight:600;">${stepNum}.</span> ${trimmed.replace(/^步骤\d+:\s*/, "")}`;
          }
        }

        if (stepNum === 0) {
          stepsContainer.createEl("div", {
            text: "未检测到反应步骤，请输入格式: 反应物 → 产物\n步骤1: ...\n步骤2: ...",
            attr: {
              style: "padding:20px;text-align:center;color:var(--text-muted);font-size:12px;",
            },
          });
        }
      }

      // 从名称查找 SMILES
      function findSmilesByName(name) {
        if (!name) return null;
        const cleanName = name.replace(/\(.+?\)/g, "").trim();
        for (const cat of MOLECULE_FRAGMENT_LIBRARY) {
          for (const item of cat.items) {
            if (
              item[0] === cleanName ||
              item[0].includes(cleanName) ||
              cleanName.includes(item[0])
            ) {
              return item[1];
            }
          }
        }
        return null;
      }

      parseBtn.onclick = () => parseReaction(textarea.value);

      // 初始解析
      parseReaction(textarea.value);
    };

    modal.open();
  }

  // v10.16.0: 反应条件速查卡
  openReactionConditionsGuide() {
    const modal = new Modal(this.app);
    modal.titleEl.setText("📖 反应条件速查卡");

    modal.onOpen = () => {
      const { contentEl } = modal;
      contentEl.addClass("reaction-conditions-modal");

      // 反应条件知识库
      const reactionConditions = [
        {
          category: "亲电取代 (芳环)",
          reagents: ["HNO3/H2SO4", "Br2/FeBr3", "Cl2/FeCl3", "H2SO4", "RX/AlCl3", "RCOCl/AlCl3"],
          examples: [
            {
              reagent: "HNO3/H2SO4",
              reaction: "硝化反应",
              product: "硝基苯",
              note: "浓硫酸催化，50-60°C",
            },
            { reagent: "Br2/FeBr3", reaction: "溴代反应", product: "溴苯", note: "Lewis酸催化" },
            { reagent: "Cl2/FeCl3", reaction: "氯代反应", product: "氯苯", note: "Lewis酸催化" },
            {
              reagent: "H2SO4",
              reaction: "磺化反应",
              product: "苯磺酸",
              note: "可逆，高温对位为主",
            },
            {
              reagent: "RX/AlCl3",
              reaction: "Friedel-Crafts烷基化",
              product: "烷基苯",
              note: "可能重排，多取代",
            },
            {
              reagent: "RCOCl/AlCl3",
              reaction: "Friedel-Crafts酰基化",
              product: "芳基酮",
              note: "不重排，单取代",
            },
          ],
        },
        {
          category: "亲核取代",
          reagents: ["NaOH/H2O", "NaCN", "NH3", "NaOR", "KOH/EtOH"],
          examples: [
            {
              reagent: "NaOH/H2O",
              reaction: "水解反应",
              product: "醇",
              note: "SN1/SN2 取决于底物",
            },
            { reagent: "NaCN", reaction: "氰化反应", product: "腈", note: "增加一个碳" },
            { reagent: "NH3", reaction: "氨解反应", product: "胺", note: "可能多取代" },
            { reagent: "NaOR", reaction: "Williamson合成", product: "醚", note: "伯卤代烷最佳" },
            {
              reagent: "KOH/EtOH",
              reaction: "消除反应",
              product: "烯烃",
              note: "E2 为主，札伊采夫规则",
            },
          ],
        },
        {
          category: "氧化还原",
          reagents: ["KMnO4/H+", "K2Cr2O7/H+", "LiAlH4", "NaBH4", "H2/Pd", "Na/NH3"],
          examples: [
            {
              reagent: "KMnO4/H+",
              reaction: "强氧化",
              product: "羧酸",
              note: "断裂双键，苄位氧化",
            },
            {
              reagent: "K2Cr2O7/H+",
              reaction: "醇氧化",
              product: "醛/酮/酸",
              note: "伯醇→酸，仲醇→酮",
            },
            { reagent: "LiAlH4", reaction: "强还原", product: "醇", note: "还原羧酸/酯/酮/醛" },
            { reagent: "NaBH4", reaction: "温和还原", product: "醇", note: "只还原醛/酮" },
            { reagent: "H2/Pd", reaction: "催化氢化", product: "烷烃", note: "还原双键/三键/芳环" },
            {
              reagent: "Na/NH3",
              reaction: "Birch还原",
              product: "1,4-环己二烯",
              note: "芳环部分还原",
            },
          ],
        },
        {
          category: "加成反应",
          reagents: ["HBr", "H2O/H+", "Br2", "BH3·THF", "O3/Zn"],
          examples: [
            {
              reagent: "HBr",
              reaction: "亲电加成",
              product: "溴代烷",
              note: "马氏规则，过氧化物反马氏",
            },
            { reagent: "H2O/H+", reaction: "水合反应", product: "醇", note: "马氏规则" },
            {
              reagent: "Br2",
              reaction: "溴加成",
              product: "邻二溴代物",
              note: "反式加成，溴鎓离子机理",
            },
            { reagent: "BH3·THF", reaction: "硼氢化", product: "醇", note: "反马氏，顺式加成" },
            {
              reagent: "O3/Zn",
              reaction: "臭氧化",
              product: "醛/酮",
              note: "断裂双键，还原性水解",
            },
          ],
        },
        {
          category: "缩合反应",
          reagents: ["稀OH-", "浓OH-", "NaOEt/EtOH", "LDA", "P2O5"],
          examples: [
            {
              reagent: "稀OH-",
              reaction: "羟醛缩合",
              product: "β-羟基醛",
              note: "加热脱水成α,β-不饱和醛",
            },
            { reagent: "浓OH-", reaction: "Cannizzaro反应", product: "醇+酸", note: "无α-H的醛" },
            { reagent: "NaOEt/EtOH", reaction: "Claisen缩合", product: "β-酮酸酯", note: "酯缩合" },
            {
              reagent: "LDA",
              reaction: "烯醇负离子烷基化",
              product: "α-烷基化酮",
              note: "动力学控制",
            },
          ],
        },
        {
          category: "保护基",
          reagents: ["Boc2O", "Cbz-Cl", "Fmoc-Cl", "TBDMSCl", "Ac2O"],
          examples: [
            {
              reagent: "Boc2O",
              reaction: "氨基保护",
              product: "Boc-NH-R",
              note: "酸解脱保护 (TFA)",
            },
            {
              reagent: "Cbz-Cl",
              reaction: "氨基保护",
              product: "Cbz-NH-R",
              note: "催化氢解脱保护",
            },
            {
              reagent: "Fmoc-Cl",
              reaction: "氨基保护",
              product: "Fmoc-NH-R",
              note: "碱解脱保护 (哌啶)",
            },
            { reagent: "TBDMSCl", reaction: "羟基保护", product: "TBDMS-O-R", note: "TBAF脱保护" },
            { reagent: "Ac2O", reaction: "羟基保护", product: "AcO-R", note: "水解脱保护" },
          ],
        },
      ];

      // 搜索框
      const searchInput = contentEl.createEl("input", {
        type: "text",
        placeholder: "输入试剂名称，如 HNO3、Br2、LiAlH4...",
      });
      searchInput.style.cssText =
        "width:100%;padding:8px;margin-bottom:12px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-primary);";

      // 结果容器
      const resultContainer = contentEl.createDiv("conditions-result");
      resultContainer.style.cssText = "max-height:500px;overflow-y:auto;";

      function searchConditions(query) {
        resultContainer.empty();
        query = query.trim().toLowerCase();

        if (!query) {
          // 显示所有分类
          for (const cat of reactionConditions) {
            const catEl = resultContainer.createDiv("condition-category");
            catEl.style.cssText = "margin-bottom:16px;";
            catEl.createEl("h3", {
              text: cat.category,
              attr: {
                style:
                  "font-size:14px;font-weight:600;margin-bottom:8px;color:var(--interactive-accent);",
              },
            });

            const list = catEl.createDiv("condition-list");
            list.style.cssText = "display:flex;flex-direction:column;gap:6px;";

            for (const ex of cat.examples) {
              const item = list.createDiv("condition-item");
              item.style.cssText =
                "padding:8px;background:var(--background-secondary);border-radius:6px;font-size:12px;";
              item.innerHTML = `
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                  <strong>${ex.reagent}</strong>
                  <span style="color:var(--interactive-accent);font-weight:500;">${ex.reaction}</span>
                </div>
                <div style="color:var(--text-muted);">产物: ${ex.product}</div>
                <div style="color:var(--text-muted);font-size:11px;margin-top:2px;">💡 ${ex.note}</div>
              `;
            }
          }
          return;
        }

        // 搜索匹配
        let count = 0;
        for (const cat of reactionConditions) {
          const matches = cat.examples.filter(
            (ex) =>
              ex.reagent.toLowerCase().includes(query) ||
              ex.reaction.toLowerCase().includes(query) ||
              ex.product.toLowerCase().includes(query)
          );

          if (matches.length > 0) {
            const catEl = resultContainer.createDiv("condition-category");
            catEl.style.cssText = "margin-bottom:12px;";
            catEl.createEl("h4", {
              text: cat.category,
              attr: { style: "font-size:12px;color:var(--text-muted);margin-bottom:6px;" },
            });

            for (const ex of matches) {
              count++;
              const item = catEl.createDiv("condition-item");
              item.style.cssText =
                "padding:8px;background:var(--background-secondary);border-radius:6px;font-size:12px;margin-bottom:4px;";
              item.innerHTML = `
                <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
                  <strong>${ex.reagent}</strong>
                  <span style="color:var(--interactive-accent);font-weight:500;">${ex.reaction}</span>
                </div>
                <div style="color:var(--text-muted);">产物: ${ex.product}</div>
                <div style="color:var(--text-muted);font-size:11px;margin-top:2px;">💡 ${ex.note}</div>
              `;
            }
          }
        }

        if (count === 0) {
          resultContainer.createEl("div", {
            text: "未找到匹配的反应条件，试试输入: HNO3, Br2, LiAlH4, NaBH4, H2/Pd, LDA...",
            attr: {
              style: "padding:20px;text-align:center;color:var(--text-muted);font-size:12px;",
            },
          });
        }
      }

      searchInput.addEventListener("input", () => searchConditions(searchInput.value));

      // 初始显示全部
      searchConditions("");
    };

    modal.open();
  }

  // v10.16.0: 结构式默写练习（选择题模式）
  openQuizMode() {
    const modal = new Modal(this.app);
    modal.titleEl.setText("✏️ 结构式默写练习");

    modal.onOpen = () => {
      const { contentEl } = modal;

      // 收集所有有 SMILES 的化合物
      const allCompounds = [];
      for (const cat of MOLECULE_FRAGMENT_LIBRARY) {
        for (const item of cat.items) {
          if (item[1]) {
            allCompounds.push({
              name: item[0],
              smiles: item[1],
              formula: item[2] || "",
              category: cat.cat,
            });
          }
        }
      }

      if (allCompounds.length < 4) {
        contentEl.createEl("div", {
          text: "化合物数量不足，无法出题",
          attr: { style: "padding:40px;text-align:center;color:var(--text-muted);" },
        });
        return;
      }

      // 模式选择
      const modeBar = contentEl.createDiv("quiz-mode-bar");
      modeBar.style.cssText = "display:flex;gap:6px;justify-content:center;margin-bottom:16px;";

      let currentMode = "structure-to-name"; // structure-to-name / name-to-structure

      function switchMode(mode) {
        currentMode = mode;
        Array.from(modeBar.children).forEach((btn, i) => {
          const modes = ["structure-to-name", "name-to-structure"];
          if (modes[i] === mode) {
            btn.style.background = "var(--interactive-accent)";
            btn.style.color = "white";
          } else {
            btn.style.background = "var(--background-secondary)";
            btn.style.color = "";
          }
        });
        nextQuestion();
      }

      const modes = [
        { id: "structure-to-name", label: "结构 → 名称" },
        { id: "name-to-structure", label: "名称 → 结构" },
      ];

      for (const m of modes) {
        const btn = modeBar.createEl("button", { text: m.label });
        btn.style.cssText =
          "padding:6px 12px;font-size:11px;border:1px solid var(--background-modifier-border);border-radius:16px;cursor:pointer;";
        btn.onclick = () => switchMode(m.id);
      }

      // 题目容器
      const quizContainer = contentEl.createDiv("quiz-container");
      quizContainer.style.cssText = "text-align:center;";

      let score = 0;
      let total = 0;

      function nextQuestion() {
        quizContainer.empty();

        // 随机选一个正确答案
        const correct = allCompounds[Math.floor(Math.random() * allCompounds.length)];

        // 随机选 3 个错误答案
        const wrongChoices = [];
        const usedIndices = new Set();
        usedIndices.add(allCompounds.indexOf(correct));

        while (wrongChoices.length < 3) {
          const idx = Math.floor(Math.random() * allCompounds.length);
          if (!usedIndices.has(idx)) {
            usedIndices.add(idx);
            wrongChoices.push(allCompounds[idx]);
          }
        }

        // 合并并打乱选项
        const choices = [correct, ...wrongChoices].sort(() => Math.random() - 0.5);

        if (currentMode === "structure-to-name") {
          // 显示结构，选名称
          quizContainer.createEl("div", {
            text: "这个结构的名称是？",
            attr: { style: "font-size:14px;color:var(--text-muted);margin-bottom:16px;" },
          });

          // 显示正确答案的结构
          let svgHtml = "";
          try {
            svgHtml = renderSmilesSvg(correct.smiles, 220, 160);
          } catch (e) {
            svgHtml = '<div style="font-size:48px;">◇</div>';
          }

          const structureDiv = quizContainer.createDiv("quiz-structure");
          structureDiv.style.cssText =
            "width:220px;height:160px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:8px;overflow:hidden;";
          structureDiv.innerHTML = svgHtml;

          // 选项按钮
          const optionsDiv = quizContainer.createDiv("quiz-options");
          optionsDiv.style.cssText =
            "display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:400px;margin:0 auto;";

          choices.forEach((choice) => {
            const btn = optionsDiv.createEl("button", {
              text: choice.name,
              attr: { style: "padding:10px;font-size:12px;" },
            });
            btn.style.cssText =
              "padding:10px;font-size:12px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:6px;cursor:pointer;transition:all 0.2s;";
            btn.onmouseenter = () => {
              btn.style.borderColor = "var(--interactive-accent)";
            };
            btn.onclick = () => {
              total++;
              if (choice.name === correct.name) {
                score++;
                btn.style.background = "var(--background-modifier-success)";
                btn.style.color = "white";
              } else {
                btn.style.background = "var(--background-modifier-error)";
                btn.style.color = "white";
                // 标出正确答案
                Array.from(optionsDiv.children).forEach((b) => {
                  if (b.textContent === correct.name) {
                    b.style.background = "var(--background-modifier-success)";
                    b.style.color = "white";
                  }
                });
              }
              setTimeout(() => {
                updateScore();
                nextQuestion();
              }, 1000);
            };
          });
        } else {
          // 显示名称，选结构
          quizContainer.createEl("div", {
            text: `哪个是 ${correct.name} 的结构？`,
            attr: { style: "font-size:14px;color:var(--text-muted);margin-bottom:16px;" },
          });

          // 选项按钮（显示结构）
          const optionsDiv = quizContainer.createDiv("quiz-options");
          optionsDiv.style.cssText =
            "display:grid;grid-template-columns:1fr 1fr;gap:8px;max-width:480px;margin:0 auto;";

          choices.forEach((choice) => {
            const btn = optionsDiv.createEl("button");
            btn.style.cssText =
              "padding:8px;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:6px;cursor:pointer;transition:all 0.2s;height:120px;display:flex;align-items:center;justify-content:center;";

            let svgHtml = "";
            try {
              svgHtml = renderSmilesSvg(choice.smiles, 160, 100);
            } catch (e) {
              svgHtml = '<div style="font-size:32px;">◇</div>';
            }
            btn.innerHTML = svgHtml;

            btn.onmouseenter = () => {
              btn.style.borderColor = "var(--interactive-accent)";
            };
            btn.onclick = () => {
              total++;
              if (choice.smiles === correct.smiles) {
                score++;
                btn.style.background = "var(--background-modifier-success)";
              } else {
                btn.style.background = "var(--background-modifier-error)";
                // 标出正确答案
                Array.from(optionsDiv.children).forEach((b) => {
                  if (
                    b.innerHTML.includes(renderSmilesSvg(correct.smiles, 160, 100).substring(0, 50))
                  ) {
                    b.style.background = "var(--background-modifier-success)";
                  }
                });
              }
              setTimeout(() => {
                updateScore();
                nextQuestion();
              }, 1000);
            };
          });
        }
      }

      function updateScore() {
        // 更新分数显示
        let scoreEl = contentEl.querySelector(".quiz-score");
        if (!scoreEl) {
          scoreEl = contentEl.createEl("div", { cls: "quiz-score" });
          scoreEl.style.cssText =
            "text-align:center;font-size:12px;color:var(--text-muted);margin-top:12px;";
        }
        const pct = total > 0 ? Math.round((score / total) * 100) : 0;
        scoreEl.textContent = `得分: ${score} / ${total} (${pct}%)`;
      }

      updateScore();
      nextQuestion();
    };

    modal.open();
  }

  // v10.16.0: 每日一题
  openDailyChallenge() {
    const modal = new Modal(this.app);
    modal.titleEl.setText("🎯 每日一题");

    modal.onOpen = () => {
      const { contentEl } = modal;

      // 获取今天日期作为种子
      const today = new Date().toDateString();
      const seed = today.split("").reduce((a, b) => a + b.charCodeAt(0), 0);

      // 收集所有有 SMILES 的化合物
      const allCompounds = [];
      for (const cat of MOLECULE_FRAGMENT_LIBRARY) {
        for (const item of cat.items) {
          if (item[1]) {
            allCompounds.push({
              name: item[0],
              smiles: item[1],
              formula: item[2] || "",
              category: cat.cat,
            });
          }
        }
      }

      // 用种子选择今天的化合物
      const compound = allCompounds[seed % allCompounds.length];

      // 检查今天是否已完成
      const completed = localStorage.getItem("chemfig-daily-completed");
      const isCompleted = completed === today;

      // 显示日期
      contentEl.createEl("div", {
        text: today,
        attr: {
          style: "text-align:center;font-size:12px;color:var(--text-muted);margin-bottom:16px;",
        },
      });

      // 问题
      contentEl.createEl("h3", {
        text: "📚 今日化合物",
        attr: { style: "text-align:center;margin-bottom:16px;" },
      });

      // 结构展示
      let svgHtml = "";
      try {
        svgHtml = renderSmilesSvg(compound.smiles, 260, 180);
      } catch (e) {
        svgHtml = '<div style="font-size:64px;">◇</div>';
      }

      const structureDiv = contentEl.createDiv("daily-structure");
      structureDiv.style.cssText =
        "width:260px;height:180px;margin:0 auto 20px;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:8px;overflow:hidden;";
      structureDiv.innerHTML = svgHtml;

      // 提示信息
      const hintText = isCompleted ? "✅ 今日已完成学习" : "🤔 你知道这是什么化合物吗？";
      contentEl.createEl("div", {
        text: hintText,
        attr: {
          style: "text-align:center;font-size:14px;color:var(--text-muted);margin-bottom:16px;",
        },
      });

      // 显示答案按钮
      const showBtn = contentEl.createEl("button", {
        text: isCompleted ? "📖 查看答案" : "👀 显示答案",
        attr: { style: "display:block;margin:0 auto 16px;padding:10px 24px;" },
      });
      showBtn.style.cssText =
        "display:block;margin:0 auto 16px;padding:10px 24px;background:var(--interactive-accent);color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;";

      const answerDiv = contentEl.createDiv("daily-answer");
      answerDiv.style.cssText =
        "text-align:center;display:none;padding:16px;background:var(--background-secondary);border-radius:8px;";

      showBtn.onclick = () => {
        answerDiv.style.display = "block";
        showBtn.style.display = "none";
      };

      // 答案内容
      answerDiv.innerHTML = `
        <h3 style="margin-bottom:8px;">${compound.name}</h3>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">分子式: ${compound.formula}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:12px;">分类: ${compound.category}</div>
        <div style="font-size:11px;color:var(--text-muted);">SMILES: ${compound.smiles}</div>
      `;

      // 完成按钮
      if (!isCompleted) {
        const completeBtn = contentEl.createEl("button", {
          text: "✅ 标记为已学",
          attr: { style: "display:block;margin:16px auto 0;padding:10px 24px;" },
        });
        completeBtn.style.cssText =
          "display:block;margin:16px auto 0;padding:10px 24px;background:var(--background-modifier-success);color:white;border:none;border-radius:6px;cursor:pointer;font-size:13px;";
        completeBtn.onclick = () => {
          localStorage.setItem("chemfig-daily-completed", today);

          // 更新已学列表
          let learned = [];
          try {
            learned = JSON.parse(localStorage.getItem("chemfig-learned-molecules") || "[]");
          } catch (e) {}
          if (!learned.includes(compound.smiles)) {
            learned.push(compound.smiles);
            localStorage.setItem("chemfig-learned-molecules", JSON.stringify(learned));
          }

          completeBtn.textContent = "✅ 已完成！";
          completeBtn.style.background = "var(--background-modifier-border)";
        };
      }

      // 连续学习天数
      const streak = parseInt(localStorage.getItem("chemfig-streak") || "0");
      if (streak > 0) {
        contentEl.createEl("div", {
          text: `🔥 连续学习 ${streak} 天`,
          attr: {
            style: "text-align:center;font-size:12px;color:var(--text-muted);margin-top:16px;",
          },
        });
      }
    };

    modal.open();
  }

  onClose() {
    if (this._gestureCleanup) {
      try {
        this._gestureCleanup();
      } catch (e) {
        /* ignore */
      }
      this._gestureCleanup = null;
    }
    if (this._keyCleanup) {
      try {
        this._keyCleanup();
      } catch (e) {
        /* ignore */
      }
      this._keyCleanup = null;
    }
    if (this._autocompleteCleanup) {
      try {
        this._autocompleteCleanup();
      } catch (e) {
        /* ignore */
      }
      this._autocompleteCleanup = null;
    }
    // 清理历史防抖定时器
    if (this._historyDebounce) {
      clearTimeout(this._historyDebounce);
      this._historyDebounce = null;
    }
    try {
      if (this.editor && typeof this.editor.destroy === "function") this.editor.destroy();
    } catch (e) {
      /* ignore */
    }
    this.editor = null;
    this.editorContainer = null;
    this.statusEl = null;
    const { contentEl } = this;
    contentEl.empty();
  }
}

// 从某个 code block 的原始行中提取归档 SMILES 注释 `% smiles: ...`
function extractSmilesFromBlockLines(lines) {
  if (!lines) return "";
  for (const line of lines) {
    const m = line.match(/^\s*%\s*smiles?\s*:\s*(.+?)\s*$/i);
    if (m) return m[1];
  }
  return "";
}

// ---------------- 化学式 (SMILES) 搜索与结构 SVG 渲染 ----------------

// 从 smiles 代码块内容剥离元数据注释（% xxx:），返回纯 SMILES 字符串
function stripSmilesMetas(source) {
  return String(source || "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("%"))
    .join("")
    .trim();
}

// SMILES -> OCL 前端 SVG（纯前端即时渲染，无需 MikTeX）
function renderSmilesSvg(smiles, w, h) {
  // 生成缓存键
  const cacheKey = `${smiles}_${w}x${h}`;
  
  // 检查缓存
  if (svgRenderCache.has(cacheKey)) {
    // LRU: 移到最新
    const cached = svgRenderCache.get(cacheKey);
    svgRenderCache.delete(cacheKey);
    svgRenderCache.set(cacheKey, cached);
    return cached;
  }
  if (!smiles || !smiles.trim()) {
    return '<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;color:var(--text-muted);font-size:24px;">◇</div>';
  }

  try {
    const mol = getOCL().Molecule.fromSmiles(smiles);

    // v10.16.0: 根据分子复杂度自适应渲染大小
    const atomCount = mol.getAllAtoms ? mol.getAllAtoms().length : 0;
    let renderW = w || 400;
    let renderH = h || 240;

    // 原子数多时自动增大渲染尺寸，避免原子挤在一起
    if (atomCount > 20) {
      const scale = Math.min(2.5, 1 + atomCount / 30);
      renderW = (w || 400) * scale;
      renderH = (h || 240) * scale;
    }

    const svg = mol
      .toSVG(renderW, renderH)
      .replace(/<svg\s/i, '<svg style="max-width:100%;height:auto;display:block;margin:0 auto" ')
      .replace(/\s+width="[^"]*"/i, "")
      .replace(/\s+height="[^"]*"/i, "");

    return svg;
  } catch (e) {
    // v10.16.0: 渲染失败回退方案
    console.warn("[Chemfig-SVG] SMILES 渲染失败:", smiles, e.message);
    return `<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--text-muted);font-size:12px;padding:8px;">
      <div style="font-size:24px;margin-bottom:4px;">⚠️</div>
      <div>渲染失败</div>
      <div style="font-size:10px;opacity:0.7;margin-top:2px;">${smiles.substring(0, 20)}${smiles.length > 20 ? "..." : ""}</div>
    </div>`;
  }
}

// 化学式搜索模态框：输入 SMILES，即时预览结构 SVG，插入为 ```smiles 块或交给分子编辑器
class SmilesSearchModal extends Modal {
  constructor(app, onInsert) {
    super(app);
    this.onInsert = onInsert; // (action, smiles) => void; action: 'block' | 'molecule'
    this.previewEl = null;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("smiles-search-modal");
    contentEl.createEl("h2", { text: "化学式搜索与渲染 (SMILES)" });

    let value = "";
    const textEl = contentEl.createEl("input", {
      type: "text",
      placeholder: "输入 SMILES，如 CCO / c1ccccc1 / CC(=O)O / CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
    });
    textEl.style.cssText =
      "width:100%;padding:8px 10px;border:1px solid var(--background-modifier-border);border-radius:6px;background:var(--background-primary);";
    textEl.addEventListener("input", () => {
      value = textEl.value.trim();
      this.renderPreview(value);
    });

    this.previewEl = contentEl.createDiv("smiles-search-preview");
    this.previewEl.style.cssText =
      "margin:12px 0;padding:10px;border:1px dashed var(--background-modifier-border);border-radius:6px;min-height:90px;display:flex;align-items:center;justify-content:center;background:var(--background-secondary);";
    this.renderPreview("");

    const validSmiles = () => {
      if (!value) {
        new Notice("请输入 SMILES");
        return null;
      }
      try {
        getOCL().Molecule.fromSmiles(value);
        return value;
      } catch (e) {
        new Notice("SMILES 解析失败: " + e.message);
        return null;
      }
    };

    const btnRow = contentEl.createDiv("smiles-search-actions");
    new Setting(btnRow)
      .addButton((b) =>
        b
          .setButtonText("插入 smiles 块")
          .setCta()
          .onClick(() => {
            const v = validSmiles();
            if (v) {
              this.onInsert("block", v);
              this.close();
            }
          })
      )
      .addButton((b) =>
        b.setButtonText("用分子编辑器打开").onClick(() => {
          const v = validSmiles();
          if (v) {
            this.onInsert("molecule", v);
            this.close();
          }
        })
      );
  }

  renderPreview(smiles) {
    if (!this.previewEl) return;
    if (!smiles) {
      this.previewEl.style.color = "var(--text-muted)";
      this.previewEl.textContent = "输入 SMILES 后此处即时预览结构";
      return;
    }
    try {
      this.previewEl.style.color = "";
      this.previewEl.innerHTML = renderSmilesSvg(smiles);
    } catch (e) {
      this.previewEl.style.color = "var(--text-error)";
      this.previewEl.textContent = "解析失败: " + e.message;
    }
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
    this.previewEl = null;
  }
}

// ========== v15.7.0: 分子编辑器 UI 重构 (参考 GitHub 优秀项目) ==========
// 参考项目:
// - Ketcher (EPAM) - 专业分子编辑器 UI
// - ChemDraw Web - 经典化学绘图软件
// - Marvin JS (ChemAxon) - 企业级化学编辑器
//
// 改进点:
// 1. 现代化工具栏设计 (图标+标签, 分组显示)
// 2. 三栏布局: 左侧工具/中间画布/右侧片段库
// 3. 底部状态栏 + 预览区
// 4. 更好的按钮样式和间距
// 5. 响应式布局

// 从重构后的模块导入 CSS


// 自动注入 CSS
if (typeof document !== "undefined" && !document.getElementById("molecule-editor-refined-css")) {
  const style = document.createElement("style");
  style.id = "molecule-editor-refined-css";
  style.textContent = MOLECULE_EDITOR_CSS;
  document.head.appendChild(style);
}










