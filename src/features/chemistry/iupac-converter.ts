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
    if (formula) {
      const formulaDiv = contentEl.createDiv({ cls: "fg-formula" });
      formulaDiv.createEl("h3", { text: "📊 分子式估算" });
      formulaDiv.createEl("p", { text: `分子式: ${formula}` });
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
