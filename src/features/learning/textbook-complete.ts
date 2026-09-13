// ========== 完整教材知识库 - 详尽版 (v17.6.0) ==========
// 索引编号系统:
// ORG-xxx: 有机化学（第六版）
// DRUG-xxx: 药物化学（第三版）
// PHARM-xxx: 药理学（第九版）
// SYNTH-xxx: 药物合成反应（第四版）
// BIO-xxx: 生物化学与分子生物学（第10版）

/**
 * 完整教材知识库 - 详尽版
 * 每个知识点包含：id, title, content, formula, mechanism, conditions, keywords
 */
const TEXTBOOK_COMPLETE = {
  // ============================================================
  // 第一本: 有机化学（第六版）- 天津大学
  // ============================================================
  "有机化学（第六版）": {
    bookCode: "ORG",
    totalChapters: 16,
    chapters: [
      {
        chapter: "第一章 绪论",
        sections: [
          {
            id: "ORG-001",
            title: "有机化合物和有机化学",
            content: "有机化合物是含碳化合物（碳氢化合物及其衍生物）。有机化学是研究有机化合物的来源、制备、结构、性质、应用以及有关理论的科学。",
            formula: "",
            mechanism: "",
            conditions: "",
            keywords: ["有机化合物", "有机化学", "碳氢化合物"],
          },
          {
            id: "ORG-002",
            title: "有机化合物的特点",
            content: "1. 可燃 2. 熔点低 3. 难溶于水 4. 反应速率慢 5. 反应产物复杂 6. 同分异构现象普遍",
            formula: "",
            mechanism: "",
            conditions: "",
            keywords: ["熔点", "溶解性", "同分异构"],
          },
          {
            id: "ORG-003",
            title: "有机化合物的结构",
            content: "凯库勒结构式、路易斯结构式、构造式。共价键的键长、键角、键能。",
            formula: "",
            mechanism: "",
            conditions: "",
            keywords: ["凯库勒", "路易斯", "共价键", "键长", "键角", "键能"],
          },
          {
            id: "ORG-004",
            title: "共价键的断裂方式",
            content: "1. 均裂：形成自由基，自由基反应 2. 异裂：形成离子，离子型反应",
            formula: "",
            mechanism: "均裂：A:B → A· + B·（自由基）\n异裂：A:B → A⁺ + B⁻（离子）",
            conditions: "",
            keywords: ["均裂", "异裂", "自由基", "离子型反应"],
          },
          {
            id: "ORG-005",
            title: "有机反应的类型",
            content: "1. 按反应物和产物的关系：取代、加成、消除、重排、氧化还原\n2. 按反应机理：自由基反应、离子型反应、协同反应",
            formula: "",
            mechanism: "",
            conditions: "",
            keywords: ["取代反应", "加成反应", "消除反应", "重排反应", "氧化还原"],
          },
        ],
      },
      {
        chapter: "第二章 饱和烃（烷烃）",
        sections: [
          {
            id: "ORG-101",
            title: "烷烃的同系列和异构",
            content: "烷烃通式：CₙH₂ₙ₊₂。同系列：具有同一通式，结构和性质相似，组成上相差一个或多个 CH₂ 的化合物系列。同分异构：构造异构（碳链异构、位置异构、官能团异构）。",
            formula: "\\chemfig{CH_3-CH_2-CH_2-CH_3} (正丁烷) \\qquad \\chemfig{CH_3-CH(CH_3)-CH_3} (异丁烷)",
            mechanism: "",
            conditions: "",
            keywords: ["烷烃", "同系列", "同分异构", "碳链异构"],
          },
          {
            id: "ORG-102",
            title: "烷烃的命名",
            content: "系统命名法（IUPAC）：\n1. 选主链：选最长碳链作为主链\n2. 编号：从靠近支链的一端开始编号\n3. 写名称：取代基位置-取代基名称-母体名称",
            formula: "",
            mechanism: "",
            conditions: "",
            keywords: ["系统命名", "IUPAC", "主链", "支链"],
          },
          {
            id: "ORG-103",
            title: "烷烃的结构",
            content: "sp³ 杂化，正四面体结构，键角 109.5°。C-C 键长 154 pm，C-H 键长 109 pm。σ 键可以自由旋转。",
            formula: "",
            mechanism: "碳原子的 2s 和三个 2p 轨道杂化形成四个 sp³ 杂化轨道，指向正四面体的四个顶点。",
            conditions: "",
            keywords: ["sp³杂化", "正四面体", "σ键", "键角"],
          },
          {
            id: "ORG-104",
            title: "烷烃的物理性质",
            content: "沸点：随碳数增加而升高，直链比支链高。熔点：随碳数增加而升高，偶数碳比奇数碳高。密度：随碳数增加而增大，但都小于水。溶解性：不溶于水，易溶于有机溶剂。",
            formula: "",
            mechanism: "",
            conditions: "",
            keywords: ["沸点", "熔点", "密度", "溶解性"],
          },
          {
            id: "ORG-105",
            title: "烷烃的化学性质 - 卤代反应",
            content: "烷烃在光照或加热条件下与卤素发生取代反应。甲烷的氯代：生成一氯甲烷、二氯甲烷、三氯甲烷、四氯化碳的混合物。",
            formula: "\\chemfig{CH_4} + Cl_2 \\xrightarrow{光照} \\chemfig{CH_3Cl} + HCl",
            mechanism: "自由基链式反应：\n1. 链引发：Cl₂ → 2Cl·（光照）\n2. 链传递：Cl· + CH₄ → ·CH₃ + HCl；·CH₃ + Cl₂ → CH₃Cl + Cl·\n3. 链终止：自由基之间结合",
            conditions: "光照（紫外光）或加热（250-400°C）。氟代剧烈，氯代适中，溴代较慢，碘代不反应。",
            keywords: ["卤代反应", "自由基", "链式反应", "甲烷氯代"],
          },
          {
            id: "ORG-106",
            title: "烷烃的氧化和燃烧",
            content: "烷烃在空气中燃烧生成 CO₂ 和 H₂O，放出大量热。不完全燃烧生成 CO 或碳黑。",
            formula: "\\chemfig{CH_4} + 2O_2 \\xrightarrow{点燃} CO_2 + 2H_2O + 890 kJ/mol",
            mechanism: "",
            conditions: "点燃或催化剂。",
            keywords: ["燃烧", "氧化", "放热"],
          },
        ],
      },
    ],
  },
};

// 挂载到全局对象
window.TEXTBOOK_COMPLETE = TEXTBOOK_COMPLETE;
