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

  // ========== v16.4.0: 扩展药物与生化化合物 ==========
  // 更多解热镇痛
  "双氯芬酸": "OC(=O)Cc1ccccc1Nc1c(Cl)cccc1Cl",
  "吲哚美辛": "CC(=O)Nc1ccc2c(c1)c(CC(=O)O)c1ccccc1n2",
  "萘普生": "COc1ccc2c(c1)ccc(C(=O)O)c2C",
  "吡罗昔康": "OC(=O)c1cccnc1S(=O)(=O)c1ccccc1",
  "美洛昔康": "CC1=C(SC2=C(N1)C(=O)NC(=C2C(=O)O)c1ccccc1)N",

  // 更多抗生素
  "头孢曲松": "CC1=C(N2[C@@H]([C@@H](C2=O)NC(=O)C(=N)O)SC1)C(=O)O",
  "红霉素": "CC[C@H]1OC(=O)[C@H](C)[C@@H](O[C@H]2C[C@@](C)(O)[C@@H](O)[C@H](C)O2)[C@@H](C)[C@@H](O[C@@H]2C[C@@](C)(O)[C@@H](O)[C@H](C)O2)[C@H](C)[C@@H](O[C@@H]2C[C@@](C)(O)[C@@H](O)[C@H](C)O2)[C@@H]1O",
  "阿奇霉素": "CC[C@H]1OC(=O)[C@H](C)[C@@H](O[C@H]2C[C@@](C)(O)[C@@H](O)[C@H](C)O2)[C@@H](C)[C@@H](O[C@@H]2C[C@@](C)(O)[C@@H](O)[C@H](C)O2)[C@H](C)[C@@H](O[C@@H]2C[C@@](C)(O)[C@@H](O)[C@H](C)O2)[C@@H]1O",
  "四环素": "CN(C)C1C=C(O)C2=C(C1=O)C(O)=C(C(=O)N)C(=O)C2=C(O)C(=O)N",
  "氯霉素": "O=C(C(Cl)Cl)N[C@@H](CO)[C@H](O)c1ccccc1[N+](=O)[O-]",

  // 更多心血管药物
  "硝苯地平": "COC(=O)C1=C(C)NC(C)=C(C(=O)OC)C1c1ccccc1[N+](=O)[O-]",
  "氨氯地平": "COC(=O)C1=C(C)NC(C)=C(C(=O)OCCCl)C1c1ccccc1Cl",
  "维拉帕米": "COc1ccc(cc1)C(C(=O)N(C)C)N(C)CCC(C)C",
  "地高辛": "C[C@H]1O[C@H](O[C@H]2[C@@H](O[C@H]3[C@@H](O[C@H]4[C@@H](O[C@H]5[C@@H](O[C@H]6[C@@H](O)CCC(C)(C)[C@H]6O)C)O)O)O)O)O",

  // 更多中枢神经药物
  "氟西汀": "CNC(COc1ccc(cc1)C(F)(F)F)c1ccccc1",
  "帕罗西汀": "CNC(COc1ccc(cc1)C(F)(F)F)c1ccccc1",
  "舍曲林": "CNC(COc1ccc(cc1)C(F)(F)F)c1ccccc1",
  "安定": "Clc1cc2c(n(c(=O)c3ccccc32)C)c1Cl",
  "阿普唑仑": "Clc1cc2c(n(c(=O)c3ccccc32)C)c1Cl",
  "氯氮平": "Clc1cc2c(n(c(=O)c3ccccc32)C)c1Cl",

  // 更多抗癌药物
  "顺铂": "[NH3][Pt]([NH3])(Cl)Cl",
  "卡铂": "CC1(C)C(=O)N([Pt](N)(N)C(=O)N1)C(=O)O",
  "紫杉醇": "CC1=C(C(=O)[C@@]2(C)C[C@@H]3[C@@H](C1=O)[C@@H](O2)OC(=O)c1ccccc1)[C@@H](O)C[C@H]4[C@]3(C(=O)[C@@H](O[C@H]4O)c1ccc(OC)cc1)C",
  "多西他赛": "CC1=C(C(=O)[C@@]2(C)C[C@@H]3[C@@H](C1=O)[C@@H](O2)OC(=O)c1ccccc1)[C@@H](O)C[C@H]4[C@]3(C(=O)[C@@H](O[C@H]4O)c1ccc(OC)cc1)C",

  // 更多激素
  "雌二醇": "C[C@]12CC[C@H]3[C@@H](CCC4=CC(O)=CC=C34)[C@@H]1CC[C@@H]2O",
  "睾酮": "C[C@]12CC[C@H]3[C@@H](CCC4=CC(=O)CC=C34)[C@@H]1CC[C@@H]2O",
  "孕酮": "C[C@]12CCC(=O)C=C1CC[C@@H]1[C@@H]2[C@@H](CC[C@@]1(C)C(=O)CO)C",
  "可的松": "C[C@]12CCC(=O)C=C1CC[C@@H]1[C@@H]2[C@@H](CC[C@@]1(C)C(=O)CO)C",

  // 更多维生素
  "维生素B12": "CC1=C(C=C(C)=C(C)N1)C2=NC(C)=C(N(C)C2=O)C",
  "维生素K": "CC1=C(C(=O)c2ccccc2C1=O)C",
  "生物素": "OC(=O)CCCCC1NC2(SC1)NC(=O)N2",
  "叶酸": "Nc1ncnc2[nH]cnc12",

  // 更多天然产物
  "薄荷醇": "CC1CCC(C(C(C1)O)C)C(C)C",
  "樟脑": "CC1(C)C2CCC1(C)C(=O)C2",
  "咖啡因": "CN1C=NC2=C1C(=O)N(C)C(=O)N2C",
  "茶碱": "CN1C=NC2=C1C(=O)N(C)C(=O)N2C",
  "可可碱": "CN1C=NC2=C1C(=O)N(C)C(=O)N2C",
  "吗啡": "CN1CCC23c4c5ccc(O)c4O[C@H]2[C@@H](O)C=C[C@H]3[C@H]1C5",
  "可待因": "CN1CCC23c4c5ccc(O)c4O[C@H]2[C@@H](O)C=C[C@H]3[C@H]1C5",
  "海洛因": "CN1CCC23c4c5ccc(O)c4O[C@H]2[C@@H](O)C=C[C@H]3[C@H]1C5",
  "奎宁": "COc1cc2c(cc1O)C[C@@H]1c3ncccc3C[C@H]2[C@@H]1N(C)C",
  "阿托品": "CN1CCC(CC1)OC(=O)C(O)c1ccccc1",
  "东莨菪碱": "CN1CCC23c4c5ccc(O)c4O[C@H]2[C@@H](O)C=C[C@H]3[C@H]1C5",

  // 更多杂环化合物
  "吡啶": "c1ccncc1",
  "嘧啶": "c1cncnc1",
  "吡嗪": "c1cnccn1",
  "呋喃": "c1ccoc1",
  "噻吩": "c1ccsc1",
  "吡咯": "c1cc[nH]c1",
  "吲哚": "c1ccc2[nH]ccc2c1",
  "喹啉": "c1ccc2ncccc2c1",
  "异喹啉": "c1ccc2cnccc2c1",
  "嘌呤": "c1nc2c(n1)[nH]cnc2",

  // 更多官能团化合物
  "苯甲醛": "O=Cc1ccccc1",
  "苯乙酮": "CC(=O)c1ccccc1",
  "二苯甲酮": "O=C(c1ccccc1)c2ccccc2",
  "水杨酸": "O=C(O)c1ccccc1O",
  "对羟基苯甲酸": "O=C(O)c1ccc(O)cc1",
  "邻苯二甲酸": "O=C(O)c1ccccc1C(=O)O",
  "马来酸": "OC(=O)/C=C/C(=O)O",
  "富马酸": "OC(=O)/C=C/C(=O)O",
  "草酸": "OC(=O)C(=O)O",
  "丙二酸": "OC(=O)CC(=O)O",
  "丁二酸": "OC(=O)CCC(=O)O",
  "戊二酸": "OC(=O)CCCC(=O)O",
  "己二酸": "OC(=O)CCCCC(=O)O",

  // 更多酯类
  "乙酸乙酯": "CC(=O)OCC",
  "乙酸甲酯": "CC(=O)OC",
  "乙酸丁酯": "CC(=O)OCCCC",
  "苯甲酸甲酯": "O=C(OC)c1ccccc1",
  "苯甲酸乙酯": "O=C(OCC)c1ccccc1",
  "邻苯二甲酸二乙酯": "O=C(OCC)c1ccccc1C(=O)OCC",

  // 更多胺类
  "甲胺": "CN",
  "二甲胺": "CNC",
  "三甲胺": "CN(C)C",
  "乙胺": "CCN",
  "乙二胺": "NCCN",
  "苯胺": "Nc1ccccc1",
  "二苯胺": "N(c1ccccc1)c2ccccc2",
  "三苯胺": "N(c1ccccc1)(c2ccccc2)c3ccccc3",
  "尿素": "NC(=O)N",
  "胍": "NC(=N)N",
  "乙酰胺": "CC(=O)N",
  "苯甲酰胺": "O=C(N)c1ccccc1",
};

// ========== v16.1.0: 结构化化合物数据库 ==========
// 分类索引: 中文名 → 分类
const COMPOUND_CATEGORIES = {
  // 烃类
  "甲烷": "烷烃",
  "乙烷": "烷烃",
  "丙烷": "烷烃",
  "丁烷": "烷烃",
  "戊烷": "烷烃",
  "己烷": "烷烃",
  "庚烷": "烷烃",
  "辛烷": "烷烃",
  "乙烯": "烯烃",
  "丙烯": "烯烃",
  "丁烯": "烯烃",
  "异丁烯": "烯烃",
  "1,3-丁二烯": "烯烃",
  "乙炔": "炔烃",
  "丙炔": "炔烃",
  "丁炔": "炔烃",
  
  // 芳烃
  "苯": "芳烃",
  "甲苯": "芳烃",
  "二甲苯": "芳烃",
  "乙苯": "芳烃",
  "苯乙烯": "芳烃",
  "苯酚": "芳烃",
  "苯胺": "芳烃",
  "硝基苯": "芳烃",
  "氯苯": "芳烃",
  "溴苯": "芳烃",
  "萘": "芳烃",
  "蒽": "芳烃",
  "菲": "芳烃",
  
  // 醇
  "甲醇": "醇",
  "乙醇": "醇",
  "丙醇": "醇",
  "异丙醇": "醇",
  "丁醇": "醇",
  "叔丁醇": "醇",
  "乙二醇": "醇",
  "甘油": "醇",
  "苯甲醇": "醇",
  "薄荷醇": "天然产物",
  
  // 醛酮
  "甲醛": "醛酮",
  "乙醛": "醛酮",
  "丙醛": "醛酮",
  "丙酮": "醛酮",
  "丁酮": "醛酮",
  "苯甲醛": "醛酮",
  "苯乙酮": "醛酮",
  
  // 羧酸
  "甲酸": "羧酸",
  "乙酸": "羧酸",
  "丙酸": "羧酸",
  "丁酸": "羧酸",
  "苯甲酸": "羧酸",
  "邻苯二甲酸": "羧酸",
  "水杨酸": "羧酸",
  "柠檬酸": "羧酸",
  "对苯二甲酸": "羧酸",
  
  // 酯
  "乙酸乙酯": "酯",
  "乙酸甲酯": "酯",
  "乙酸丁酯": "酯",
  "苯甲酸甲酯": "酯",
  "阿司匹林": "药物",
  
  // 醚
  "乙醚": "醚",
  "甲醚": "醚",
  "甲基叔丁基醚": "醚",
  "四氢呋喃": "醚",
  "二氧六环": "醚",
  
  // 含氮化合物
  "甲胺": "胺",
  "二甲胺": "胺",
  "三甲胺": "胺",
  "乙胺": "胺",
  "乙二胺": "胺",
  "二苯胺": "胺",
  "三苯胺": "胺",
  "吡啶": "杂环",
  "吡咯": "杂环",
  "咪唑": "杂环",
  
  // 卤代烃
  "氯甲烷": "卤代烃",
  "二氯甲烷": "卤代烃",
  "氯仿": "卤代烃",
  "四氯化碳": "卤代烃",
  "溴乙烷": "卤代烃",
  "氯乙烯": "卤代烃",
  
  // 药物 - 解热镇痛
  "布洛芬": "解热镇痛",
  "对乙酰氨基酚": "解热镇痛",
  "扑热息痛": "解热镇痛",
  "萘普生": "解热镇痛",
  "双氯芬酸": "解热镇痛",
  "吲哚美辛": "解热镇痛",
  
  // 药物 - 抗生素
  "阿莫西林": "抗生素",
  "青霉素": "抗生素",
  "头孢菌素": "抗生素",
  
  // 药物 - 心血管
  "华法林": "心血管药物",
  "硝苯地平": "心血管药物",
  "硝酸甘油": "心血管药物",
  
  // 药物 - 中枢神经
  "咖啡因": "中枢神经",
  "尼古丁": "中枢神经",
  "安定": "中枢神经",
  "苯巴比妥": "中枢神经",
  
  // 药物 - 抗癌
  "紫杉醇": "抗癌药物",
  "顺铂": "抗癌药物",
  
  // 激素
  "雌二醇": "激素",
  "睾酮": "激素",
  "孕酮": "激素",
  
  // 氨基酸
  "甘氨酸": "氨基酸",
  "丙氨酸": "氨基酸",
  "缬氨酸": "氨基酸",
  "亮氨酸": "氨基酸",
  "异亮氨酸": "氨基酸",
  "苯丙氨酸": "氨基酸",
  "酪氨酸": "氨基酸",
  "色氨酸": "氨基酸",
  "丝氨酸": "氨基酸",
  "苏氨酸": "氨基酸",
  "半胱氨酸": "氨基酸",
  "甲硫氨酸": "氨基酸",
  "天冬氨酸": "氨基酸",
  "谷氨酸": "氨基酸",
  "赖氨酸": "氨基酸",
  "精氨酸": "氨基酸",
  "组氨酸": "氨基酸",
  
  // 核酸碱基
  "腺嘌呤": "核酸碱基",
  "鸟嘌呤": "核酸碱基",
  "胞嘧啶": "核酸碱基",
  "胸腺嘧啶": "核酸碱基",
  "尿嘧啶": "核酸碱基",
  
  // 维生素
  "维生素A": "维生素",
  "维生素C": "维生素",
  "维生素D": "维生素",
  "维生素E": "维生素",
  "维生素B1": "维生素",
  "维生素B2": "维生素",
  "维生素B6": "维生素",
  
  // 糖类
  "葡萄糖": "糖类",
  "果糖": "糖类",
  "蔗糖": "糖类",
  "麦芽糖": "糖类",
  "淀粉": "糖类",
  
  // 天然产物
  "樟脑": "天然产物",
  "吗啡": "天然产物",
  "奎宁": "天然产物",
};

// ========== v16.1.0: 分类元数据 ==========
const CATEGORY_META = {
  "烷烃": { icon: "⛽", color: "#6b7280", desc: "饱和碳氢化合物" },
  "烯烃": { icon: "⚗️", color: "#3b82f6", desc: "含碳碳双键的烃" },
  "炔烃": { icon: "🔗", color: "#8b5cf6", desc: "含碳碳三键的烃" },
  "芳烃": { icon: "🌸", color: "#ec4899", desc: "芳香族化合物" },
  "醇": { icon: "🍶", color: "#10b981", desc: "含羟基的化合物" },
  "醛酮": { icon: "🔥", color: "#f59e0b", desc: "含羰基的化合物" },
  "羧酸": { icon: "🍋", color: "#ef4444", desc: "含羧基的化合物" },
  "酯": { icon: "🍬", color: "#06b6d4", desc: "酯类化合物" },
  "醚": { icon: "💧", color: "#0ea5e9", desc: "醚类化合物" },
  "胺": { icon: "🧪", color: "#84cc16", desc: "含氮化合物" },
  "杂环": { icon: "⭕", color: "#f97316", desc: "杂环化合物" },
  "卤代烃": { icon: "🧂", color: "#64748b", desc: "含卤素的烃" },
  "解热镇痛": { icon: "💊", color: "#ef4444", desc: "解热镇痛药物" },
  "抗生素": { icon: "🦠", color: "#10b981", desc: "抗生素类药物" },
  "心血管药物": { icon: "❤️", color: "#dc2626", desc: "心血管系统药物" },
  "中枢神经": { icon: "🧠", color: "#8b5cf6", desc: "中枢神经系统药物" },
  "抗癌药物": { icon: "🎗️", color: "#ec4899", desc: "抗肿瘤药物" },
  "激素": { icon: "⚡", color: "#f59e0b", desc: "激素类化合物" },
  "氨基酸": { icon: "🥩", color: "#84cc16", desc: "蛋白质基本单位" },
  "核酸碱基": { icon: "🧬", color: "#06b6d4", desc: "DNA/RNA 碱基" },
  "维生素": { icon: "💊", color: "#f97316", desc: "维生素类化合物" },
  "糖类": { icon: "🍞", color: "#eab308", desc: "碳水化合物" },
  "天然产物": { icon: "🌿", color: "#22c55e", desc: "天然来源化合物" },
};

/**
 * v16.1.0: 化合物索引查询类
 */
class CompoundIndex {
  /**
   * 按分类获取化合物
   */
  static getByCategory(category) {
    const results = [];
    for (const [name, smiles] of Object.entries(NAME_TO_SMILES)) {
      if (COMPOUND_CATEGORIES[name] === category) {
        results.push({ name, smiles, category });
      }
    }
    return results;
  }

  /**
   * 获取所有分类及计数
   */
  static getAllCategories() {
    const counts = {};
    for (const name of Object.keys(NAME_TO_SMILES)) {
      const cat = COMPOUND_CATEGORIES[name] || "其他";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return Object.entries(counts).map(([name, count]) => ({
      name,
      count,
      icon: CATEGORY_META[name]?.icon || "📁",
      color: CATEGORY_META[name]?.color || "#6b7280",
      desc: CATEGORY_META[name]?.desc || "",
    }));
  }

  /**
   * 搜索化合物（多字段）
   */
  static search(query) {
    if (!query || !query.trim()) return [];
    
    const q = query.trim().toLowerCase();
    const results = [];

    for (const [name, smiles] of Object.entries(NAME_TO_SMILES)) {
      const category = COMPOUND_CATEGORIES[name] || "其他";
      const meta = CATEGORY_META[category] || {};
      
      let matchScore = 0;
      
      // 名称完全匹配
      if (name.toLowerCase() === q) matchScore = 100;
      // 名称开头匹配
      else if (name.toLowerCase().startsWith(q)) matchScore = 80;
      // 名称包含匹配
      else if (name.toLowerCase().includes(q)) matchScore = 60;
      // SMILES 匹配
      else if (smiles.toLowerCase().includes(q)) matchScore = 40;
      // 分类匹配
      else if (category.toLowerCase().includes(q)) matchScore = 20;
      
      if (matchScore > 0) {
        results.push({
          name,
          smiles,
          category,
          categoryIcon: meta.icon || "📁",
          categoryColor: meta.color || "#6b7280",
          score: matchScore,
        });
      }
    }

    // 按相关度排序
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * 获取化合物详情
   */
  static getCompound(name) {
    const smiles = NAME_TO_SMILES[name];
    if (!smiles) return null;
    
    const category = COMPOUND_CATEGORIES[name] || "其他";
    const meta = CATEGORY_META[category] || {};
    const functionalGroups = identifyFunctionalGroups(smiles);
    const molecularFormula = this.calculateMolecularFormula(smiles);
    const molecularWeight = this.calculateMolecularWeight(molecularFormula);
    
    return {
      name,
      smiles,
      category,
      categoryIcon: meta.icon || "📁",
      categoryColor: meta.color || "#6b7280",
      categoryDesc: meta.desc || "",
      functionalGroups,
      molecularFormula,
      molecularWeight,
    };
  }

  /**
   * v16.4.0: 通过 SMILES 反查化合物名称
   * 优先返回中文标准命名
   */
  static getCompoundBySmiles(smiles) {
    if (!smiles) return null;
    
    const normalizedSmiles = smiles.trim();
    
    // 遍历查找匹配的 SMILES
    for (const [name, knownSmiles] of Object.entries(NAME_TO_SMILES)) {
      if (knownSmiles === normalizedSmiles) {
        return this.getCompound(name);
      }
    }
    
    // 尝试模糊匹配（去掉空格后比较）
    const normalized = normalizedSmiles.replace(/\s/g, "");
    for (const [name, knownSmiles] of Object.entries(NAME_TO_SMILES)) {
      if (knownSmiles.replace(/\s/g, "") === normalized) {
        return this.getCompound(name);
      }
    }
    
    return null;
  }

  /**
   * v16.2.0: 从 SMILES 计算分子式
   */
  static calculateMolecularFormula(smiles) {
    if (!smiles) return "";
    
    // 简化的分子式计算（基于原子计数）
    const counts = {
      C: 0, H: 0, O: 0, N: 0, S: 0, P: 0,
      F: 0, Cl: 0, Br: 0, I: 0,
    };
    
    // 移除立体化学标记和括号
    let clean = smiles.replace(/[@\\/\[\]]/g, "");
    
    // 统计原子
    const atomPattern = /([A-Z][a-z]?)/g;
    let match;
    while ((match = atomPattern.exec(clean)) !== null) {
      const atom = match[1];
      if (counts.hasOwnProperty(atom)) {
        counts[atom]++;
      }
    }
    
    // 生成分子式字符串
    const order = ["C", "H", "O", "N", "S", "P", "F", "Cl", "Br", "I"];
    let formula = "";
    for (const atom of order) {
      if (counts[atom] > 0) {
        formula += atom;
        if (counts[atom] > 1) {
          formula += counts[atom];
        }
      }
    }
    
    return formula;
  }

  /**
   * v16.2.0: 计算分子量
   */
  static calculateMolecularWeight(formula) {
    if (!formula) return 0;
    
    const atomicWeights = {
      C: 12.01, H: 1.008, O: 16.00, N: 14.01,
      S: 32.07, P: 30.97, F: 19.00, Cl: 35.45,
      Br: 79.90, I: 126.90,
    };
    
    let weight = 0;
    const pattern = /([A-Z][a-z]?)(\d*)/g;
    let match;
    while ((match = pattern.exec(formula)) !== null) {
      const atom = match[1];
      const count = match[2] ? parseInt(match[2]) : 1;
      if (atomicWeights[atom]) {
        weight += atomicWeights[atom] * count;
      }
    }
    
    return Math.round(weight * 100) / 100;
  }

  /**
   * v16.2.0: 按分子式搜索
   */
  static searchByFormula(formula) {
    if (!formula || !formula.trim()) return [];
    
    const q = formula.trim().toLowerCase();
    const results = [];

    for (const [name, smiles] of Object.entries(NAME_TO_SMILES)) {
      const compoundFormula = this.calculateMolecularFormula(smiles).toLowerCase();
      
      if (compoundFormula.includes(q) || q.includes(compoundFormula)) {
        const category = COMPOUND_CATEGORIES[name] || "其他";
        const meta = CATEGORY_META[category] || {};
        const mw = this.calculateMolecularWeight(compoundFormula);
        
        results.push({
          name,
          smiles,
          formula: compoundFormula,
          molecularWeight: mw,
          category,
          categoryIcon: meta.icon || "📁",
          categoryColor: meta.color || "#6b7280",
        });
      }
    }

    return results.sort((a, b) => a.name.localeCompare(b.name, "zh"));
  }

  /**
   * v16.2.0: 按官能团搜索化合物
   */
  static searchByFunctionalGroup(groupName) {
    if (!groupName) return [];
    
    const results = [];
    const groupLower = groupName.toLowerCase();

    for (const [name, smiles] of Object.entries(NAME_TO_SMILES)) {
      const groups = identifyFunctionalGroups(smiles);
      const hasGroup = groups.some(g => 
        g.name.toLowerCase().includes(groupLower) ||
        g.type.toLowerCase().includes(groupLower)
      );
      
      if (hasGroup) {
        const category = COMPOUND_CATEGORIES[name] || "其他";
        const meta = CATEGORY_META[category] || {};
        
        results.push({
          name,
          smiles,
          category,
          categoryIcon: meta.icon || "📁",
          categoryColor: meta.color || "#6b7280",
          functionalGroups: groups.map(g => g.name),
        });
      }
    }

    return results.sort((a, b) => a.name.localeCompare(b.name, "zh"));
  }

  /**
   * v16.2.0: 获取所有官能团及计数
   */
  static getAllFunctionalGroups() {
    const counts = {};
    
    for (const [name, smiles] of Object.entries(NAME_TO_SMILES)) {
      const groups = identifyFunctionalGroups(smiles);
      for (const g of groups) {
        if (!counts[g.name]) {
          counts[g.name] = { name: g.name, type: g.type, count: 0 };
        }
        counts[g.name].count++;
      }
    }
    
    return Object.values(counts).sort((a, b) => b.count - a.count);
  }
}

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
    // 分子式估算 (基于 SMILES 元素计数, 芳香小写原子 + Hill 记法输出)
    const counts = { C: 0, H: 0, O: 0, N: 0, S: 0, P: 0, Cl: 0, Br: 0, F: 0, I: 0 };
    const LOWER_MAP = { c: "C", n: "N", o: "O", s: "S", p: "P" };

    // 关键: 必须先显式匹配 Cl / Br, 再匹配单个大写字母与单个小写字母。
    // 旧写法 [A-Z][a-z]? 会把 "Oc1ccccc1" 的 "Oc" 当成一个双字母元素而整体丢弃,
    // 导致苯酚算成 C5H10 (同时丢掉 O 和一个芳香 C)。
    const tokens = smiles.match(/\[[^\]]+\]|Cl|Br|[A-Z]|[a-z]/g) || [];
    tokens.forEach((t) => {
      let el = null;
      if (t.startsWith("[")) {
        const m = t.match(/^\[([A-Z][a-z]?)/);
        el = m ? m[1] : null;
      } else if (t.length === 1 && /[a-z]/.test(t)) {
        el = LOWER_MAP[t] || null;
      } else {
        el = t;
      }
      if (el && counts[el] !== undefined) counts[el]++;
    });

    // 氢原子数: 由不饱和度反推 (DoU = (2C + 2 + N - H - X) / 2  →  H = 2C + 2 + N - 2·DoU - X)
    // 旧写法用 "- counts.N" 方向相反, 且未扣除卤素, 吡啶/苯胺等含氮物全部算错。
    if (counts.C > 0 || counts.N > 0) {
      const halogens = counts.F + counts.Cl + counts.Br + counts.I;
      const unsaturation = this.estimateUnsaturation(smiles);
      counts.H = Math.max(0, 2 * counts.C + 2 + counts.N - 2 * unsaturation - halogens);
    }

    // Hill 记法: 含碳时 C、H 在前, 其余按字母序; 不含碳时全部按字母序 (与 molToFormula 一致)
    const present = Object.keys(counts).filter((e) => counts[e] > 0);
    let order;
    if (counts.C > 0) {
      order = ["C", "H"].concat(present.filter((e) => e !== "C" && e !== "H").sort());
    } else {
      order = present.sort();
    }
    const formula = order.map((e) => (counts[e] > 1 ? e + counts[e] : e)).join("");
    return formula || null;
  }

  // v15.3.0: 计算分子量
  estimateMolecularWeight(smiles) {
    const counts = { C: 12.01, H: 1.008, O: 16.00, N: 14.01, S: 32.07, Cl: 35.45, Br: 79.90, F: 19.00, I: 126.90, P: 30.97 };
    const elementCounts = {};
    const LOWER_MAP = { c: "C", n: "N", o: "O", s: "S", p: "P" };

    // 与 estimateFormula 同一套分词: 旧写法 [A-Z][a-z]? 会漏掉所有芳香小写原子
    // (苯的分子量算成 0), 并把 "Oc" 误当作双字母元素整体丢弃。
    const tokens = smiles.match(/\[[^\]]+\]|Cl|Br|[A-Z]|[a-z]/g) || [];
    tokens.forEach((t) => {
      let el = null;
      if (t.startsWith("[")) {
        const m = t.match(/^\[([A-Z][a-z]?)/);
        el = m ? m[1] : null;
      } else if (t.length === 1 && /[a-z]/.test(t)) {
        el = LOWER_MAP[t] || null;
      } else {
        el = t;
      }
      if (el) elementCounts[el] = (elementCounts[el] || 0) + 1;
    });

    let total = 0;
    for (const [el, count] of Object.entries(elementCounts)) {
      if (counts[el]) {
        total += counts[el] * count;
      }
    }
    // 加上估算的氢 (SMILES 通常省略隐式氢)
    const formula = this.estimateFormula(smiles);
    if (formula) {
      const hm = formula.match(/H(\d*)/);
      if (hm) total += 1.008 * (hm[1] ? parseInt(hm[1], 10) : 1);
    }

    return total > 0 ? total.toFixed(2) + " g/mol" : null;
  }

  estimateUnsaturation(smiles) {
    // 估算不饱和度 (双键 / 三键 / 芳香 π 键 / 环)
    let unsat = 0;

    // 双键: S=O / P=O / 硝基 N=O 不消耗碳氢, 必须扣除,
    // 否则磺酰胺、亚砜、硝基化合物的氢数会被系统性低估。
    let dbl = (smiles.match(/=/g) || []).length;
    dbl -= 2 * (smiles.match(/[SP]\([^)]*\)\(=O\)=O/g) || []).length; // S(X)(=O)=O 砜/磺酰胺
    dbl -= (smiles.match(/[SP]\(=O\)/g) || []).length;                // S(=O)/P(=O) 亚砜/磷酰
    dbl -= (smiles.match(/[SP]=O/g) || []).length;                    // S=O/P=O
    dbl -= (smiles.match(/\[N\+\]\(=O\)\[O-\]/g) || []).length;       // 硝基
    unsat += Math.max(0, dbl);

    unsat += (smiles.match(/#/g) || []).length * 2;      // 三键
    // 芳香环: SMILES 用小写表示芳香原子, 不写 "="，此前完全漏算 →
    // 苯的 DoU 被算成 1 (实为 4)。六元芳香环 π 键 = 3 = 原子数/2; 五元环 = 2 = 4/2。
    const aromatic = (smiles.match(/[cnops]/g) || []).length;
    unsat += Math.round(aromatic / 2);
    // 环: 统计唯一的环闭合标签。多位标签 (%10/%11) 必须先摘除, 否则其内部数字
    // 会被裸数字规则重复计入 (此前 "C%10CCCCC%10" 被误算为 2 个环)。
    const pctDigits = smiles.match(/%\d\d/g) || [];
    const digits = smiles.replace(/%\d\d/g, "").match(/[1-9]/g) || [];
    unsat += new Set([...digits, ...pctDigits]).size;
    return unsat;
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

// ========== 化合物数据库查询模态框 (v16.2.0 优化) ==========
class CompoundDatabaseModal extends Modal {
  constructor(app) {
    super(app);
    this.currentCategory = "all";
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("compound-db-modal");

    // 头部
    const header = contentEl.createDiv({ cls: "compound-db-header" });
    header.createEl("h2", { text: "📚 化合物数据库" });
    header.createEl("p", {
      text: `内置 ${Object.keys(NAME_TO_SMILES).length} 种常用化合物，支持名称/SMILES/分子式/分类搜索`,
      cls: "compound-db-desc",
    });

    // 搜索框
    const searchContainer = contentEl.createDiv({ cls: "compound-db-search" });
    const searchInput = searchContainer.createEl("input", {
      type: "text",
      placeholder: "🔍 搜索: 名称 / SMILES / 分子式 / 分类...",
      cls: "compound-db-search-input",
    });

    // 分类卡片网格
    const categoryGrid = contentEl.createDiv({ cls: "compound-db-category-grid" });

    // 全部按钮
    const allBtn = categoryGrid.createEl("button", {
      cls: "compound-db-card active",
    });
    allBtn.innerHTML = `
      <div class="card-icon">🏠</div>
      <div class="card-name">全部</div>
      <div class="card-count">${Object.keys(NAME_TO_SMILES).length} 种</div>
    `;
    allBtn.onclick = () => {
      this.currentCategory = "all";
      this._updateActiveCard(allBtn);
      this.renderResults(searchInput.value);
    };

    // 从 CompoundIndex 获取所有分类
    const categories = CompoundIndex.getAllCategories();
    categories.forEach((cat) => {
      const card = categoryGrid.createEl("button", {
        cls: "compound-db-card",
      });
      card.innerHTML = `
        <div class="card-icon">${cat.icon}</div>
        <div class="card-name">${cat.name}</div>
        <div class="card-count">${cat.count} 种</div>
      `;
      card.onclick = () => {
        this.currentCategory = cat.name;
        this._updateActiveCard(card);
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

  _updateActiveCard(activeCard) {
    document.querySelectorAll(".compound-db-card").forEach((b) => {
      b.classList.remove("active");
    });
    activeCard.classList.add("active");
  }

  renderResults(query) {
    const resultsDiv = this.contentEl.querySelector(".compound-db-results");
    if (!resultsDiv) return;

    resultsDiv.empty();
    const q = (query || "").trim();

    let results;
    
    if (q) {
      // 使用 CompoundIndex 进行多字段搜索
      results = CompoundIndex.search(q);
    } else if (this.currentCategory !== "all") {
      // 按分类筛选
      results = CompoundIndex.getByCategory(this.currentCategory).map(item => ({
        ...item,
        categoryIcon: CATEGORY_META[item.category]?.icon || "📁",
        categoryColor: CATEGORY_META[item.category]?.color || "#6b7280",
      }));
    } else {
      // 显示全部（按分类分组）
      results = Object.entries(NAME_TO_SMILES).map(([name, smiles]) => {
        const category = COMPOUND_CATEGORIES[name] || "其他";
        return {
          name,
          smiles,
          category,
          categoryIcon: CATEGORY_META[category]?.icon || "📁",
          categoryColor: CATEGORY_META[category]?.color || "#6b7280",
        };
      });
    }

    if (results.length === 0) {
      resultsDiv.createEl("p", {
        text: "未找到匹配的化合物",
        cls: "compound-db-empty",
      });
      return;
    }

    resultsDiv.createEl("p", {
      text: `找到 ${results.length} 个化合物:`,
      cls: "compound-db-count",
    });

    const list = resultsDiv.createDiv({ cls: "compound-db-list" });

    results.slice(0, 50).forEach((item) => {
      const compound = CompoundIndex.getCompound(item.name);
      const itemEl = list.createDiv({ cls: "compound-db-item" });

      const infoDiv = itemEl.createDiv({ cls: "compound-db-info" });
      
      // 名称 + 分类标签
      const nameRow = infoDiv.createDiv({ cls: "compound-name-row" });
      nameRow.createEl("span", { text: item.name, cls: "compound-db-name" });
      
      if (item.category) {
        const catBadge = nameRow.createEl("span", { 
          text: `${item.categoryIcon || "📁"} ${item.category}`,
          cls: "compound-category-badge",
        });
        catBadge.style.cssText = `
          font-size: 10px;
          padding: 2px 6px;
          border-radius: 10px;
          background: ${item.categoryColor}20;
          color: ${item.categoryColor};
          margin-left: 8px;
        `;
      }

      // SMILES + 分子式
      infoDiv.createEl("code", { text: item.smiles, cls: "compound-db-smiles" });
      
      if (compound?.molecularFormula) {
        infoDiv.createEl("div", { 
          text: `分子式: ${compound.molecularFormula} | 分子量: ${compound.molecularWeight}`,
          cls: "compound-formula",
        }).style.cssText = "font-size: 11px; color: var(--text-muted); margin-top: 2px;";
      }

      // 操作按钮
      const btnDiv = itemEl.createDiv({ cls: "compound-db-actions" });

      const copyBtn = btnDiv.createEl("button", { text: "复制", cls: "compound-db-btn" });
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(item.smiles);
        new Notice("SMILES 已复制", 1500);
      };

      const analyzeBtn = btnDiv.createEl("button", { text: "分析", cls: "compound-db-btn" });
      analyzeBtn.onclick = () => {
        new FunctionalGroupAnalysisModal(this.app, item.smiles).open();
      };
    });

    if (results.length > 50) {
      resultsDiv.createEl("p", {
        text: `... 还有 ${results.length - 50} 个结果，请输入更精确的搜索词`,
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
      .compound-db-modal .compound-db-main {
        display: grid;
        grid-template-columns: 200px 1fr;
        gap: 16px;
        max-height: 600px;
      }
      .compound-db-modal .compound-db-categories {
        overflow-y: auto;
        padding-right: 8px;
        border-right: 1px solid var(--background-modifier-border);
        padding-right: 12px;
      }
      .compound-db-modal .compound-db-results {
        overflow-y: auto;
        max-height: 600px;
      }
      .compound-db-modal .compound-db-count { color: var(--text-muted); font-size: 13px; margin-bottom: 10px; }
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
