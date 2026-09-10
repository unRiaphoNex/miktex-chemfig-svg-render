// ========== IUPAC 名称转 SMILES (v13.0.0) ==========
// 内置常见化合物名称映射 + 官能团识别
// 完整功能需要 OPSIN 库, 此处先实现内置映射

// ========== 官能团识别规则 (v15.3.0 扩展) ==========
const FUNCTIONAL_GROUP_PATTERNS = [
  // 含氧官能团
  { pattern: /(?<![cC])O[H1](?![a-zA-Z])/g, name: "醇羟基 (Alcohol)", type: "含氧" },
  { pattern: /O[cC]/g, name: "酚羟基 (Phenol)", type: "含氧" },
  { pattern: /C\(=O\)O|COOH/g, name: "羧基 (Carboxyl)", type: "含氧" },
  { pattern: /C\(=O\)OC|C(=O)O/g, name: "酯基 (Ester)", type: "含氧" },
  { pattern: /C\(=O\)H|O=CH/g, name: "醛基 (Aldehyde)", type: "含氧" },
  { pattern: /C\(=O\)(?![OH])/g, name: "酮羰基 (Ketone)", type: "含氧" },
  { pattern: /C-O-C|COC/g, name: "醚键 (Ether)", type: "含氧" },
  { pattern: /S=O|S\(=O\)/g, name: "亚砜/砜 (Sulfoxide/Sulfone)", type: "含硫" },
  { pattern: /SH|S[H1]/g, name: "巯基 (Thiol)", type: "含硫" },

  // 含氮官能团
  { pattern: /(?<![cC])N[H2](?![a-zA-Z])/g, name: "伯胺 (Primary Amine)", type: "含氮" },
  { pattern: /N[H1](?![a-zA-Z])/g, name: "仲胺 (Secondary Amine)", type: "含氮" },
  { pattern: /N(?![a-zA-Z])(?![H1])/g, name: "叔胺 (Tertiary Amine)", type: "含氮" },
  { pattern: /C#N/g, name: "氰基 (Nitrile)", type: "含氮" },
  { pattern: /NO2|N\(=O\)=O|\[N\+\]\(=O\)/g, name: "硝基 (Nitro)", type: "含氮" },
  { pattern: /N\(=O\)/g, name: "亚硝基 (Nitroso)", type: "含氮" },
  { pattern: /N=C|C=N/g, name: "亚胺 (Imine)", type: "含氮" },
  { pattern: /N\(C=O\)|C(=O)N/g, name: "酰胺 (Amide)", type: "含氮" },
  { pattern: /N#C/g, name: "异氰酸酯 (Isocyanate)", type: "含氮" },

  // 卤族
  { pattern: /Cl/g, name: "氯 (Chloro)", type: "卤族" },
  { pattern: /Br/g, name: "溴 (Bromo)", type: "卤族" },
  { pattern: /I/g, name: "碘 (Iodo)", type: "卤族" },
  { pattern: /F/g, name: "氟 (Fluoro)", type: "卤族" },

  // 不饱和键
  { pattern: /C=C/g, name: "碳碳双键 (Alkene)", type: "不饱和" },
  { pattern: /C#C/g, name: "碳碳三键 (Alkyne)", type: "不饱和" },

  // 芳香环
  { pattern: /c1ccccc1|c1ccc.*cc1/g, name: "苯环 (Benzene Ring)", type: "芳香" },
  { pattern: /c1ccncc1|n1ccccc1/g, name: "含氮杂环 (N-Heterocycle)", type: "杂环" },
  { pattern: /c1ccoc1|c1ccsc1/g, name: "含氧/硫杂环 (O/S-Heterocycle)", type: "杂环" },

  // 其他
  { pattern: /P=O|P\(=O\)/g, name: "磷酸酯 (Phosphate)", type: "含磷" },
  { pattern: /N=N/g, name: "偶氮基 (Azo)", type: "含氮" },
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
  "麦芽糖": "OC[C@H]1O[C@@H](O[C@H]2O[C@H](CO)[C@@H](O)[C@H](O)[C@H]2O)[C@H](O)[C@@H](O)[C@H]1O",
  "淀粉": "OC[C@H]1O[C@@H](O[C@H]2O[C@H](CO)[C@@H](O)[C@H](O)[C@H]2O)[C@H](O)[C@@H](O)[C@H]1O",

  // ========== 更多药物 (v15.2.0) ==========
  // 解热镇痛
  "布洛芬": "CC(C)Cc1ccc(cc1)C(C)C(=O)O",
  "萘普生": "COc1ccc2c(c1)ccc(C(=O)O)c2C",
  "双氯芬酸": "OC(=O)Cc1ccccc1Nc1c(Cl)cccc1Cl",
  "吲哚美辛": "CC(=O)Nc1ccc2c(c1)c(CC(=O)O)c1ccccc1n2",

  // 抗生素
  "阿莫西林": "CC1(C(N2C(S1)C(C2=O)NC(=O)C(Nc1ccc(O)cc1)C(=O)O)C(=O)O)",
  "青霉素": "CC1(C(N2C(S1)C(C2=O)NC(=O)C(C)c1ccccc1)C(=O)O)",
  "头孢菌素": "CC1=C(N2[C@@H]([C@@H](C2=O)NC(=O)C(=N)O)SC1)C(=O)O",

  // 心血管药物
  "阿司匹林": "CC(=O)Oc1ccccc1C(=O)O",
  "华法林": "CC(=O)C(c1ccccc1)C(=O)c1ccccc1",
  "硝苯地平": "COC(=O)C1=C(C)NC(C)=C(C(=O)OC)C1c1ccccc1[N+](=O)[O-]",
  "硝酸甘油": "O=[N+]([O-])OCC(CO[N+](=O)[O-])O[N+](=O)[O-]",

  // 中枢神经
  "咖啡因": "CN1C=NC2=C1C(=O)N(C)C(=O)N2C",
  "尼古丁": "CN1CCCC1c1cccnc1",
  "安定": "Clc1cc2c(n(c(=O)c3ccccc32)C)c1Cl",
  "苯巴比妥": "CCC(CC1=O)c2ccccc2C(=O)NC1=O",

  // 抗癌药物
  "紫杉醇": "CC1=C(C(=O)[C@@]2(C)C[C@@H]3[C@@H](C1=O)[C@@H](O2)OC(=O)c1ccccc1)[C@@H](O)C[C@H]4[C@]3(C(=O)[C@@H](O[C@H]4O)c1ccc(OC)cc1)C",
  "顺铂": "[NH3][Pt]([NH3])(Cl)Cl",

  // 激素
  "雌二醇": "C[C@]12CC[C@H]3[C@@H](CCC4=CC(O)=CC=C34)[C@@H]1CC[C@@H]2O",
  "睾酮": "C[C@]12CC[C@H]3[C@@H](CCC4=CC(=O)CC=C34)[C@@H]1CC[C@@H]2O",
  "孕酮": "C[C@]12CCC(=O)C=C1CC[C@@H]1[C@@H]2[C@@H](CC[C@@]1(C)C(=O)CO)C",

  // 氨基酸
  "甘氨酸": "NCC(=O)O",
  "丙氨酸": "CC(N)C(=O)O",
  "缬氨酸": "CC(C)C(N)C(=O)O",
  "亮氨酸": "CC(C)CC(N)C(=O)O",
  "异亮氨酸": "CCC(C)C(N)C(=O)O",
  "苯丙氨酸": "N[C@@H](Cc1ccccc1)C(=O)O",
  "酪氨酸": "N[C@@H](Cc1ccc(O)cc1)C(=O)O",
  "色氨酸": "N[C@@H](Cc1c[nH]c2ccccc12)C(=O)O",
  "丝氨酸": "N[C@@H](CO)C(=O)O",
  "苏氨酸": "N[C@@H](C(O)C)C(=O)O",
  "半胱氨酸": "N[C@@H](CS)C(=O)O",
  "甲硫氨酸": "N[C@@H](CCSC)C(=O)O",
  "天冬氨酸": "N[C@@H](CC(=O)O)C(=O)O",
  "谷氨酸": "N[C@@H](CCC(=O)O)C(=O)O",
  "赖氨酸": "N[C@@H](CCCCN)C(=O)O",
  "精氨酸": "N[C@@H](CCCNC(=N)N)C(=O)O",
  "组氨酸": "N[C@@H](Cc1c[nH]cn1)C(=O)O",

  // 核酸碱基
  "腺嘌呤": "Nc1ncnc2[nH]cnc12",
  "鸟嘌呤": "Oc1ncnc2[nH]cnc12",
  "胞嘧啶": "Nc1ccnc(=O)[nH]1",
  "胸腺嘧啶": "Cc1cc(=O)[nH]c(=O)[nH]1",
  "尿嘧啶": "O=c1cc[nH]c(=O)[nH]1",

  // 维生素
  "维生素C": "OCC(O)C1OC(O)C(O)=C1O",
  "维生素A": "CC1=C(C(CCC1)(C)C)/C=C/C(=C/C=C/C(=C/CO)/C)/C",
  "维生素D": "CC1(C)CCCC2(C)C1CCC1=C[C@@H]3C[C@@H](O)CCC3(C)C12",
  "维生素E": "CC(C)=CCC/C(C)=C/CC/C(C)=C/CC[C@@](C)(O)c1ccc(O)c(C(C)C)c1",
  "维生素B1": "CC1=C(C=C(C)=C(C)N1)C2=NC(C)=C(N(C)C2=O)C",
  "维生素B2": "C(C1C(C(C(C(O1)CO)O)O)O)N2C=CC(=O)NC2=O",
  "维生素B6": "Cc1ncc(CO)c(CO)c1O",

  // 天然产物
  "薄荷醇": "CC1CCC(C(C(C1)O)C)C(C)C",
  "樟脑": "CC1(C)C2CCC1(C)C(=O)C2",
  "尼古丁": "CN1CCCC1c1cccnc1",
  "吗啡": "CN1CCC23c4c5ccc(O)c4O[C@H]2[C@@H](O)C=C[C@H]3[C@H]1C5",
  "奎宁": "COc1cc2c(cc1O)C[C@@H]1c3ncccc3C[C@H]2[C@@H]1N(C)C",

  // 聚合物单体
  "乙烯": "C=C",
  "丙烯": "C=CC",
  "氯乙烯": "C=CCl",
  "苯乙烯": "C=Cc1ccccc1",
  "对苯二甲酸": "O=C(O)c1ccc(C(=O)O)cc1",
  "乙二醇": "OCCO",
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

// ========== 官能团分析模态框 (v15.2.0) ==========
class FunctionalGroupAnalysisModal extends Modal {
  constructor(app, smiles) {
    super(app);
    this.smiles = smiles;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("functional-group-analysis-modal");

    contentEl.createEl("h2", { text: "🔬 官能团分析" });

    // SMILES 显示
    const smilesBar = contentEl.createDiv({ cls: "fg-smiles-bar" });
    smilesBar.createEl("span", { text: "SMILES: " });
    smilesBar.createEl("code", { text: this.smiles });

    // 分析结果
    const resultsDiv = contentEl.createDiv({ cls: "fg-results" });

    const groups = IUPACToSMILES.analyzeFunctionalGroups(this.smiles);

    if (groups.length === 0) {
      resultsDiv.createEl("div", {
        text: "未识别到明显的官能团 (可能为简单烷烃)",
        cls: "fg-empty",
      });
    } else {
      resultsDiv.createEl("h3", { text: `识别到 ${groups.length} 种官能团:` });

      const groupList = resultsDiv.createDiv({ cls: "fg-group-list" });
      groups.forEach((group) => {
        const groupItem = groupList.createDiv({ cls: "fg-group-item" });
        groupItem.innerHTML = `
          <span class="fg-group-type fg-type-${group.type}">${group.type}</span>
          <span class="fg-group-name">${group.name}</span>
        `;
      });
    }

    // 分子式估算
    const formula = this.estimateFormula(this.smiles);
    const mw = this.estimateMolecularWeight(this.smiles);
    const unsat = this.estimateUnsaturation(this.smiles);

    if (formula || mw) {
      const formulaDiv = contentEl.createDiv({ cls: "fg-formula" });
      formulaDiv.createEl("h3", { text: "📊 分子信息" });

      if (formula) {
        formulaDiv.createEl("p", { text: `分子式: ${formula}` });
      }
      if (mw) {
        formulaDiv.createEl("p", { text: `分子量: ${mw}` });
      }
      if (unsat > 0) {
        formulaDiv.createEl("p", { text: `不饱和度: ${unsat}` });
      }
    }

    // 常见反应提示
    const reactionsDiv = contentEl.createDiv({ cls: "fg-reactions" });
    reactionsDiv.createEl("h3", { text: "⚗️ 常见反应" });

    const reactions = this.getCommonReactions(groups);
    if (reactions.length > 0) {
      const reactionList = reactionsDiv.createDiv({ cls: "fg-reaction-list" });
      reactions.forEach((reaction) => {
        reactionList.createEl("div", { text: "• " + reaction, cls: "fg-reaction-item" });
      });
    } else {
      reactionsDiv.createEl("p", { text: "暂无常见反应提示", cls: "fg-empty" });
    }

    // 关闭按钮
    const closeBtn = contentEl.createEl("button", {
      text: "关闭",
      cls: "mod-cta",
    });
    closeBtn.onclick = () => this.close();

    // 添加 CSS
    this.addCSS();
  }

  estimateFormula(smiles) {
    // 简单的分子式估算 (基于 SMILES 中的元素计数)
    const counts = { C: 0, H: 0, O: 0, N: 0, S: 0, Cl: 0, Br: 0, F: 0, I: 0, P: 0 };

    // 粗略统计元素
    const elements = smiles.match(/[A-Z][a-z]?/g) || [];
    elements.forEach((el) => {
      if (counts[el] !== undefined) counts[el]++;
    });

    // 估算氢原子 (粗略)
    if (counts.C > 0) {
      // 假设每个碳有足够的氢
      const unsaturation = this.estimateUnsaturation(smiles);
      counts.H = Math.max(0, 2 * counts.C + 2 - 2 * unsaturation - counts.N);
    }

    // 生成分子式字符串
    let formula = "";
    if (counts.C > 0) formula += counts.C > 1 ? `C${counts.C}` : "C";
    if (counts.H > 0) formula += counts.H > 1 ? `H${counts.H}` : "H";
    if (counts.O > 0) formula += counts.O > 1 ? `O${counts.O}` : "O";
    if (counts.N > 0) formula += counts.N > 1 ? `N${counts.N}` : "N";
    if (counts.S > 0) formula += `S${counts.S}`;
    if (counts.Cl > 0) formula += `Cl${counts.Cl}`;
    if (counts.Br > 0) formula += `Br${counts.Br}`;
    if (counts.F > 0) formula += `F${counts.F}`;

    return formula || null;
  }

  // v15.3.0: 计算分子量
  estimateMolecularWeight(smiles) {
    const counts = { C: 12.01, H: 1.008, O: 16.00, N: 14.01, S: 32.07, Cl: 35.45, Br: 79.90, F: 19.00, I: 126.90, P: 30.97 };
    const elementCounts = {};

    const elements = smiles.match(/[A-Z][a-z]?/g) || [];
    elements.forEach((el) => {
      elementCounts[el] = (elementCounts[el] || 0) + 1;
    });

    let total = 0;
    for (const [el, count] of Object.entries(elementCounts)) {
      if (counts[el]) {
        total += counts[el] * count;
      }
    }

    return total > 0 ? total.toFixed(2) + " g/mol" : null;
  }

  estimateUnsaturation(smiles) {
    // 粗略估算不饱和度
    let unsaturation = 0;
    // 双键
    unsaturation += (smiles.match(/=/g) || []).length;
    // 三键
    unsaturation += (smiles.match(/#/g) || []).length * 2;
    // 环
    unsaturation += (smiles.match(/[1-9]/g) || []).length;
    return unsaturation;
  }

  getCommonReactions(groups) {
    const reactions = [];
    const groupNames = groups.map((g) => g.name);

    if (groupNames.includes("醇羟基") || groupNames.includes("酚羟基")) {
      reactions.push("与羧酸发生酯化反应生成酯");
      reactions.push("可被氧化为醛/酮/羧酸");
    }
    if (groupNames.includes("醛基")) {
      reactions.push("可被还原为伯醇");
      reactions.push("可被氧化为羧酸");
    }
    if (groupNames.includes("酮羰基")) {
      reactions.push("可被还原为仲醇");
    }
    if (groupNames.includes("羧基")) {
      reactions.push("与醇发生酯化反应");
      reactions.push("可被还原为伯醇");
    }
    if (groupNames.includes("酯基")) {
      reactions.push("酸性/碱性水解生成羧酸和醇");
    }
    if (groupNames.includes("氨基")) {
      reactions.push("与酰氯/酸酐发生酰化反应");
      reactions.push("可发生重氮化反应");
    }
    if (groupNames.includes("芳环")) {
      reactions.push("可发生亲电取代反应 (卤代/硝化/磺化)");
    }

    return reactions.slice(0, 5); // 最多显示 5 条
  }

  addCSS() {
    if (document.getElementById("fg-analysis-css")) return;
    const style = document.createElement("style");
    style.id = "fg-analysis-css";
    style.textContent = `
      .functional-group-analysis-modal .fg-smiles-bar {
        padding: 10px;
        background: var(--background-secondary);
        border-radius: 6px;
        margin-bottom: 15px;
      }
      .functional-group-analysis-modal .fg-group-list {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 10px 0;
      }
      .functional-group-analysis-modal .fg-group-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 12px;
        background: var(--background-secondary);
        border-radius: 6px;
        border: 1px solid var(--background-modifier-border);
      }
      .functional-group-analysis-modal .fg-group-type {
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: bold;
      }
      .functional-group-analysis-modal .fg-type-含氧 {
        background: #e3f2fd;
        color: #1976d2;
      }
      .functional-group-analysis-modal .fg-type-含氮 {
        background: #fff3e0;
        color: #f57c00;
      }
      .functional-group-analysis-modal .fg-type-芳香 {
        background: #f3e5f5;
        color: #7b1fa2;
      }
      .functional-group-analysis-modal .fg-type-烃类 {
        background: #e8f5e9;
        color: #388e3c;
      }
      .functional-group-analysis-modal .fg-reaction-list {
        margin: 8px 0;
        padding-left: 20px;
      }
      .functional-group-analysis-modal .fg-reaction-item {
        margin: 4px 0;
        color: var(--text-normal);
      }
      .functional-group-analysis-modal .fg-empty {
        color: var(--text-muted);
        font-style: italic;
      }
    `;
    document.head.appendChild(style);
  }
}

// 导出
// NAME_TO_SMILES, IUPACToSMILES, registerIUPACCommands

// ========== 化合物数据库查询模态框 (v15.3.0) ==========
class CompoundDatabaseModal extends Modal {
  constructor(app) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("compound-db-modal");

    contentEl.createEl("h2", { text: "📚 化合物数据库查询" });
    contentEl.createEl("p", {
      text: `内置 ${Object.keys(NAME_TO_SMILES).length} 种常用化合物，支持名称/SMILES搜索`,
      cls: "compound-db-desc",
    });

    // 搜索框
    const searchContainer = contentEl.createDiv({ cls: "compound-db-search" });
    const searchInput = searchContainer.createEl("input", {
      type: "text",
      placeholder: "搜索化合物名/SMILES...",
      cls: "compound-db-search-input",
    });

    // 搜索类型切换
    const typeBar = contentEl.createDiv({ cls: "compound-db-type-bar" });
    const types = [
      { id: "all", name: "全部" },
      { id: "drug", name: "药物" },
      { id: "amino", name: "氨基酸" },
      { id: "vitamin", name: "维生素" },
      { id: "sugar", name: "糖类" },
    ];

    this.currentType = "all";
    types.forEach((t) => {
      const btn = typeBar.createEl("button", {
        text: t.name,
        cls: "compound-db-type-btn" + (t.id === this.currentType ? " active" : ""),
      });
      btn.onclick = () => {
        this.currentType = t.id;
        typeBar.querySelectorAll(".compound-db-type-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.renderResults(searchInput.value);
      };
    });

    // 结果列表
    const resultsDiv = contentEl.createDiv({ cls: "compound-db-results" });

    // 初始显示全部
    this.renderResults("");

    // 搜索事件
    searchInput.addEventListener("input", (e) => {
      this.renderResults(e.target.value);
    });

    this.addCSS();
  }

  renderResults(query) {
    const resultsDiv = this.contentEl.querySelector(".compound-db-results");
    if (!resultsDiv) return;

    resultsDiv.empty();
    const q = (query || "").toLowerCase().trim();

    // 过滤结果
    let entries = Object.entries(NAME_TO_SMILES);

    // 按类型过滤
    if (this.currentType !== "all") {
      const typeMap = {
        drug: ["布洛芬", "阿司匹林", "咖啡因", "阿莫西林", "青霉素", "紫杉醇", "雌二醇", "睾酮", "孕酮", "扑热息痛", "萘普生", "双氯芬酸", "吲哚美辛", "华法林", "硝苯地平", "硝酸甘油", "安定", "苯巴比妥", "顺铂"],
        amino: ["甘氨酸", "丙氨酸", "缬氨酸", "亮氨酸", "异亮氨酸", "苯丙氨酸", "酪氨酸", "色氨酸", "丝氨酸", "苏氨酸", "半胱氨酸", "甲硫氨酸", "天冬氨酸", "谷氨酸", "赖氨酸", "精氨酸", "组氨酸"],
        vitamin: ["维生素A", "维生素C", "维生素D", "维生素E", "维生素B1", "维生素B2", "维生素B6"],
        sugar: ["葡萄糖", "果糖", "蔗糖", "麦芽糖", "淀粉"],
      };
      if (typeMap[this.currentType]) {
        entries = entries.filter(([name]) => typeMap[this.currentType].includes(name));
      }
    }

    // 按搜索词过滤
    if (q) {
      entries = entries.filter(([name, smiles]) => {
        return (
          name.toLowerCase().includes(q) ||
          smiles.toLowerCase().includes(q)
        );
      });
    }

    if (entries.length === 0) {
      resultsDiv.createEl("p", {
        text: "未找到匹配的化合物",
        cls: "compound-db-empty",
      });
      return;
    }

    resultsDiv.createEl("p", {
      text: `找到 ${entries.length} 个化合物:`,
      cls: "compound-db-count",
    });

    const list = resultsDiv.createDiv({ cls: "compound-db-list" });

    entries.slice(0, 50).forEach(([name, smiles]) => {
      const item = list.createDiv({ cls: "compound-db-item" });

      const infoDiv = item.createDiv({ cls: "compound-db-info" });
      infoDiv.createEl("div", { text: name, cls: "compound-db-name" });
      infoDiv.createEl("code", { text: smiles, cls: "compound-db-smiles" });

      const btnDiv = item.createDiv({ cls: "compound-db-actions" });

      const copyBtn = btnDiv.createEl("button", { text: "复制", cls: "compound-db-btn" });
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(smiles);
        new Notice("SMILES 已复制", 1500);
      };

      const analyzeBtn = btnDiv.createEl("button", { text: "分析", cls: "compound-db-btn" });
      analyzeBtn.onclick = () => {
        new FunctionalGroupAnalysisModal(this.app, smiles).open();
      };
    });

    if (entries.length > 50) {
      resultsDiv.createEl("p", {
        text: `... 还有 ${entries.length - 50} 个结果，请输入更精确的搜索词`,
        cls: "compound-db-more",
      });
    }
  }

  addCSS() {
    if (document.getElementById("compound-db-css")) return;
    const style = document.createElement("style");
    style.id = "compound-db-css";
    style.textContent = `
      .compound-db-modal .compound-db-desc { color: var(--text-muted); margin-bottom: 15px; }
      .compound-db-modal .compound-db-search { margin-bottom: 10px; }
      .compound-db-modal .compound-db-search-input {
        width: 100%; padding: 8px 12px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 6px; background: var(--background-primary);
        color: var(--text-normal);
      }
      .compound-db-modal .compound-db-type-bar {
        display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 15px;
      }
      .compound-db-modal .compound-db-type-btn {
        padding: 4px 10px; border: 1px solid var(--background-modifier-border);
        border-radius: 15px; background: var(--background-primary);
        color: var(--text-muted); cursor: pointer; font-size: 12px;
      }
      .compound-db-modal .compound-db-type-btn.active {
        background: var(--interactive-accent); color: var(--text-on-accent);
        border-color: var(--interactive-accent);
      }
      .compound-db-modal .compound-db-count { color: var(--text-muted); font-size: 13px; margin-bottom: 10px; }
      .compound-db-modal .compound-db-list { max-height: 500px; overflow-y: auto; }
      .compound-db-modal .compound-db-item {
        display: flex; align-items: center; justify-content: space-between;
        padding: 10px; border-bottom: 1px solid var(--background-modifier-border);
      }
      .compound-db-modal .compound-db-item:hover { background: var(--background-modifier-hover); }
      .compound-db-modal .compound-db-name { font-weight: 500; margin-bottom: 2px; }
      .compound-db-modal .compound-db-smiles { font-size: 11px; color: var(--text-muted); font-family: monospace; }
      .compound-db-modal .compound-db-actions { display: flex; gap: 8px; }
      .compound-db-modal .compound-db-btn {
        padding: 4px 10px; border: 1px solid var(--background-modifier-border);
        border-radius: 4px; background: var(--background-primary);
        color: var(--text-normal); cursor: pointer; font-size: 12px;
      }
      .compound-db-modal .compound-db-btn:hover {
        background: var(--interactive-accent); color: var(--text-on-accent);
      }
      .compound-db-modal .compound-db-empty { text-align: center; color: var(--text-muted); padding: 30px; }
      .compound-db-modal .compound-db-more { color: var(--text-muted); font-size: 12px; margin-top: 10px; }
    `;
    document.head.appendChild(style);
  }
}
