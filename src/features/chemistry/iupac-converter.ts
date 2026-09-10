// ========== IUPAC 名称转 SMILES (v13.0.0) ==========
// 内置常见化合物名称映射 + 官能团识别
// 完整功能需要 OPSIN 库, 此处先实现内置映射

// ========== 官能团识别规则 ==========
const FUNCTIONAL_GROUP_PATTERNS = [
  { pattern: /-OH|O[H1]/g, name: "羟基 (Hydroxyl)", type: "含氧" },
  { pattern: /C\(=O\)O|COOH/g, name: "羧基 (Carboxyl)", type: "含氧" },
  { pattern: /C\(=O\)/g, name: "羰基 (Carbonyl)", type: "含氧" },
  { pattern: /C\(=O\)OC/g, name: "酯基 (Ester)", type: "含氧" },
  { pattern: /C-O-C/g, name: "醚键 (Ether)", type: "含氧" },
  { pattern: /-NH2|N[H2]/g, name: "氨基 (Amino)", type: "含氮" },
  { pattern: /-N<|N\(/g, name: "取代胺 (Amine)", type: "含氮" },
  { pattern: /C#N|CN/g, name: "氰基 (Nitrile)", type: "含氮" },
  { pattern: /NO2|N\(=O\)=O/g, name: "硝基 (Nitro)", type: "含氮" },
  { pattern: /Cl|Br|I|F/g, name: "卤素 (Halogen)", type: "卤族" },
  { pattern: /C=C/g, name: "双键 (Alkene)", type: "不饱和" },
  { pattern: /C#C/g, name: "三键 (Alkyne)", type: "不饱和" },
  { pattern: /c1ccccc1|c1ccc.*cc1/g, name: "芳香环 (Aromatic)", type: "芳香" },
];

/**
 * 从 SMILES 识别官能团
 * @param {string} smiles - SMILES 字符串
 * @returns {Array} 官能团列表
 */
function identifyFunctionalGroups(smiles) {
  if (!smiles) return [];

  const groups = [];
  FUNCTIONAL_GROUP_PATTERNS.forEach(({ pattern, name, type }) => {
    if (pattern.test(smiles)) {
      groups.push({ name, type });
    }
  });

  return groups;
}

// ========== 常见化合物名称 → SMILES 映射 ==========
const NAME_TO_SMILES = {
  // 烷烃
  "甲烷": "C",
  "乙烷": "CC",
  "丙烷": "CCC",
  "丁烷": "CCCC",
  "戊烷": "CCCCC",
  "己烷": "CCCCCC",
  "庚烷": "CCCCCCC",
  "辛烷": "CCCCCCCC",
  "壬烷": "CCCCCCCCC",
  "癸烷": "CCCCCCCCCC",

  // 烯烃
  "乙烯": "C=C",
  "丙烯": "C=CC",
  "丁烯": "C=CCC",
  "异丁烯": "C=C(C)C",
  "1,3-丁二烯": "C=CC=C",
  "2-甲基丙烯": "C=C(C)C",

  // 炔烃
  "乙炔": "C#C",
  "丙炔": "C#CC",
  "丁炔": "C#CCC",

  // 芳烃
  "苯": "c1ccccc1",
  "甲苯": "Cc1ccccc1",
  "二甲苯": "Cc1ccccc1C",
  "乙苯": "CCc1ccccc1",
  "苯乙烯": "C=Cc1ccccc1",
  "苯酚": "Oc1ccccc1",
  "苯胺": "Nc1ccccc1",
  "硝基苯": "O=[N+]([O-])c1ccccc1",
  "氯苯": "Clc1ccccc1",
  "溴苯": "Brc1ccccc1",
  "萘": "c1ccc2ccccc2c1",
  "蒽": "c1ccc2cc3ccccc3cc2c1",
  "菲": "c1ccc2c(c1)ccc1ccccc12",

  // 醇
  "甲醇": "CO",
  "乙醇": "CCO",
  "丙醇": "CCCO",
  "异丙醇": "CC(O)C",
  "丁醇": "CCCCO",
  "叔丁醇": "CC(C)(C)O",
  "乙二醇": "OCCO",
  "甘油": "OCC(O)CO",
  "苯甲醇": "OCc1ccccc1",
  "苯酚": "Oc1ccccc1",

  // 醛酮
  "甲醛": "C=O",
  "乙醛": "CC=O",
  "丙醛": "CCC=O",
  "丙酮": "CC(=O)C",
  "丁酮": "CCC(=O)C",
  "苯甲醛": "O=Cc1ccccc1",
  "苯乙酮": "CC(=O)c1ccccc1",

  // 羧酸
  "甲酸": "O=CO",
  "乙酸": "CC(=O)O",
  "丙酸": "CCC(=O)O",
  "丁酸": "CCCC(=O)O",
  "苯甲酸": "O=C(O)c1ccccc1",
  "邻苯二甲酸": "O=C(O)c1ccccc1C(=O)O",
  "水杨酸": "O=C(O)c1ccccc1O",
  "柠檬酸": "O=C(O)CC(O)(C(=O)O)CC(=O)O",

  // 酯
  "乙酸乙酯": "CC(=O)OCC",
  "乙酸甲酯": "CC(=O)OC",
  "乙酸丁酯": "CC(=O)OCCCC",
  "苯甲酸甲酯": "O=C(OC)c1ccccc1",
  "阿司匹林": "CC(=O)Oc1ccccc1C(=O)O",

  // 醚
  "乙醚": "CCOCC",
  "甲醚": "COC",
  "甲基叔丁基醚": "COC(C)(C)C",
  "四氢呋喃": "C1CCOC1",
  "二氧六环": "C1COCCO1",

  // 胺
  "甲胺": "CN",
  "二甲胺": "CNC",
  "三甲胺": "CN(C)C",
  "乙胺": "CCN",
  "乙二胺": "NCCN",
  "苯胺": "Nc1ccccc1",
  "二苯胺": "N(c1ccccc1)c2ccccc2",
  "三苯胺": "N(c1ccccc1)(c2ccccc2)c3ccccc3",
  "吡啶": "c1ccncc1",
  "吡咯": "c1cc[nH]c1",
  "咪唑": "c1c[nH]cn1",

  // 卤代烃
  "氯甲烷": "CCl",
  "二氯甲烷": "ClCCl",
  "氯仿": "ClC(Cl)Cl",
  "四氯化碳": "ClC(Cl)(Cl)Cl",
  "溴乙烷": "CCBr",
  "氯乙烯": "C=CCl",
  "氯苯": "Clc1ccccc1",

  // 常见药物
  "布洛芬": "CC(C)Cc1ccc(cc1)C(C)C(=O)O",
  "对乙酰氨基酚": "CC(=O)Nc1ccc(O)cc1",
  "阿司匹林": "CC(=O)Oc1ccccc1C(=O)O",
  "咖啡因": "CN1C=NC2=C1C(=O)N(C)C(=O)N2C",
  "尼古丁": "CN1CCCC1c1cccnc1",
  "扑热息痛": "CC(=O)Nc1ccc(O)cc1",

  // 糖类
  "葡萄糖": "OC[C@H]1OC(O)[C@@H](O)[C@H](O)[C@H]1O",
  "果糖": "OC[C@H]1O[C@](O)(CO)[C@@H](O)[C@H]1O",
  "蔗糖": "OC[C@H]1O[C@@](O)(CO)[C@H](O)[C@@H]1O[C@H]1O[C@H](CO)[C@@H](O)[C@H](O)[C@H]1O",
};

/**
 * IUPAC 名称转 SMILES 类
 */
class IUPACToSMILES {
  /**
   * 将名称转换为 SMILES
   * @param {string} name - 化合物名称 (中文或英文)
   * @returns {string|null} SMILES 字符串
   */
  static convert(name) {
    if (!name) return null;

    const trimmed = name.trim();

    // 直接匹配
    if (NAME_TO_SMILES[trimmed]) {
      return NAME_TO_SMILES[trimmed];
    }

    // 大小写不敏感匹配
    const lower = trimmed.toLowerCase();
    for (const [key, value] of Object.entries(NAME_TO_SMILES)) {
      if (key.toLowerCase() === lower) {
        return value;
      }
    }

    // 模糊匹配 (包含)
    for (const [key, value] of Object.entries(NAME_TO_SMILES)) {
      if (trimmed.includes(key) || key.includes(trimmed)) {
        return value;
      }
    }

    return null;
  }

  /**
   * 从 SMILES 识别官能团
   * @param {string} smiles - SMILES 字符串
   * @returns {Array} 官能团列表
   */
  static analyzeFunctionalGroups(smiles) {
    return identifyFunctionalGroups(smiles);
  }

  /**
   * 获取所有支持的名称列表
   */
  static getAllNames() {
    return Object.keys(NAME_TO_SMILES);
  }
}

// ========== IUPAC 转换命令 ==========
function registerIUPACCommands(plugin) {
  // 命令: IUPAC 名称转 SMILES
  plugin.addCommand({
    id: "iupac-to-smiles",
    name: "IUPAC 名称转 SMILES",
    callback: async () => {
      // 弹出输入框
      const { value: name } = await plugin.app.vault.manager?.prompt({
        prompt: "输入化合物名称:",
        placeholder: "如: 苯, 乙醇, 阿司匹林",
      }) || {};

      if (!name) return;

      const smiles = IUPACToSMILES.convert(name);
      if (smiles) {
        new Notice(`SMILES: ${smiles}`, 5000);
        // 复制到剪贴板
        navigator.clipboard.writeText(smiles);
      } else {
        new Notice(`未找到 "${name}" 的 SMILES 映射`, 3000);
      }
    },
  });

  console.log("[Chemfig-SVG] IUPAC 转换命令已注册 (支持 " + Object.keys(NAME_TO_SMILES).length + " 种化合物)");
}

// 导出
// NAME_TO_SMILES, IUPACToSMILES, registerIUPACCommands
