// ========== 知识点关联网络 (v17.2.0) ==========
// 建立知识点之间的关联网络
// 支持可视化展示、关联推荐

class KnowledgeRelationNetwork {
  constructor() {
    this.relations = new Map(); // 知识点ID -> 关联知识点ID列表
    this.buildRelationNetwork();
  }

  /**
   * 构建关联网络
   */
  buildRelationNetwork() {
    // 预定义的关联关系
    const predefinedRelations = {
      // ========== 有机化学关联 ==========
      // 烃类
      "ORG-001": ["ORG-002", "ORG-003", "ORG-081", "ORG-082"], // 烷烃 -> 烯烃/炔烃/物理性质/化学性质
      "ORG-002": ["ORG-001", "ORG-003", "ORG-004", "ORG-085", "ORG-086"], // 烯烃 -> 烷烃/炔烃/芳香烃/结构/亲电加成
      "ORG-003": ["ORG-001", "ORG-002", "ORG-089", "ORG-090"], // 炔烃 -> 烷烃/烯烃/结构/加成反应
      "ORG-004": ["ORG-002", "ORG-091", "ORG-092", "ORG-093"], // 芳香烃 -> 烯烃/苯的结构/亲电取代/定位效应
      "ORG-005": ["ORG-002", "ORG-094", "ORG-095", "ORG-096"], // 卤代烃 -> 烯烃/分类/亲核取代/消除反应
      
      // 含氧化合物
      "ORG-006": ["ORG-005", "ORG-097", "ORG-098"], // 醇酚醚 -> 卤代烃/醇的性质/酚的性质
      "ORG-007": ["ORG-006", "ORG-099", "ORG-100", "ORG-101"], // 醛酮 -> 醇酚醚/结构/亲核加成/氧化还原
      "ORG-008": ["ORG-007", "ORG-102", "ORG-103"], // 羧酸 -> 醛酮/酸性/衍生物
      
      // 含氮化合物
      "ORG-010": ["ORG-008", "ORG-104", "ORG-105"], // 含氮化合物 -> 羧酸/胺的分类/重氮盐
      
      // 立体化学
      "ORG-106": ["ORG-107", "ORG-108", "ORG-109"], // 手性 -> 旋光性/R-S构型/非对映异构
      "ORG-107": ["ORG-106", "ORG-108"], // 旋光性 -> 手性/R-S构型
      "ORG-108": ["ORG-106", "ORG-107", "ORG-109"], // R-S构型 -> 手性/旋光性/非对映异构
      "ORG-109": ["ORG-106", "ORG-108"], // 非对映异构 -> 手性/R-S构型
      
      // 格氏试剂和有机锂
      "ORG-110": ["ORG-005", "ORG-111"], // 格氏试剂 -> 卤代烃/有机锂
      "ORG-111": ["ORG-005", "ORG-110"], // 有机锂 -> 卤代烃/格氏试剂
      
      // 醚和环氧化合物
      "ORG-112": ["ORG-006", "ORG-113"], // 醚 -> 醇酚醚/环氧化合物
      "ORG-113": ["ORG-006", "ORG-112"], // 环氧化合物 -> 醇酚醚/醚
      
      // 烷烃和环烷烃
      "ORG-081": ["ORG-001", "ORG-082"], // 物理性质 -> 烷烃/化学性质
      "ORG-082": ["ORG-001", "ORG-081", "ORG-083"], // 化学性质 -> 烷烃/物理性质/自由基取代
      "ORG-083": ["ORG-082", "ORG-001"], // 自由基取代 -> 化学性质/烷烃
      "ORG-084": ["ORG-001", "ORG-081"], // 环烷烃张力 -> 烷烃/物理性质
      
      // 烯烃
      "ORG-085": ["ORG-002", "ORG-086", "ORG-088"], // 烯烃结构 -> 烯烃/亲电加成/氧化反应
      "ORG-086": ["ORG-002", "ORG-085", "ORG-087"], // 亲电加成 -> 烯烃/结构/马氏规则
      "ORG-087": ["ORG-086", "ORG-002"], // 马氏规则 -> 亲电加成/烯烃
      "ORG-088": ["ORG-085", "ORG-002"], // 氧化反应 -> 烯烃结构/烯烃
      
      // 炔烃
      "ORG-089": ["ORG-003", "ORG-090"], // 炔烃结构 -> 炔烃/加成反应
      "ORG-090": ["ORG-003", "ORG-089"], // 加成反应 -> 炔烃/结构
      
      // 芳香烃
      "ORG-091": ["ORG-004", "ORG-092", "ORG-093"], // 苯的结构 -> 芳香烃/亲电取代/定位效应
      "ORG-092": ["ORG-004", "ORG-091", "ORG-093"], // 亲电取代 -> 芳香烃/苯的结构/定位效应
      "ORG-093": ["ORG-004", "ORG-091", "ORG-092"], // 定位效应 -> 芳香烃/苯的结构/亲电取代
      
      // 卤代烃
      "ORG-094": ["ORG-005", "ORG-095", "ORG-096"], // 分类 -> 卤代烃/亲核取代/消除反应
      "ORG-095": ["ORG-005", "ORG-094", "ORG-096"], // 亲核取代 -> 卤代烃/分类/消除反应
      "ORG-096": ["ORG-005", "ORG-094", "ORG-095"], // 消除反应 -> 卤代烃/分类/亲核取代
      
      // 醇酚醚
      "ORG-097": ["ORG-006", "ORG-098"], // 醇的性质 -> 醇酚醚/酚的性质
      "ORG-098": ["ORG-006", "ORG-097"], // 酚的性质 -> 醇酚醚/醇的性质
      
      // 醛酮
      "ORG-099": ["ORG-007", "ORG-100", "ORG-101"], // 醛酮结构 -> 醛酮/亲核加成/氧化还原
      "ORG-100": ["ORG-007", "ORG-099", "ORG-101"], // 亲核加成 -> 醛酮/结构/氧化还原
      "ORG-101": ["ORG-007", "ORG-099", "ORG-100"], // 氧化还原 -> 醛酮/结构/亲核加成
      
      // 羧酸
      "ORG-102": ["ORG-008", "ORG-103"], // 羧酸酸性 -> 羧酸/衍生物
      "ORG-103": ["ORG-008", "ORG-102"], // 羧酸衍生物 -> 羧酸/酸性
      
      // 含氮化合物
      "ORG-104": ["ORG-010", "ORG-105"], // 胺的分类 -> 含氮化合物/重氮盐
      "ORG-105": ["ORG-010", "ORG-104"], // 重氮盐 -> 含氮化合物/胺的分类
      
      // ========== 药物化学关联 ==========
      // 神经系统药物
      "DRUG-081": ["DRUG-082", "DRUG-083", "PHARM-093"], // 苯二氮卓类 -> 巴比妥类/抗癫痫/抗高血压
      "DRUG-082": ["DRUG-081", "DRUG-083"], // 巴比妥类 -> 苯二氮卓类/抗癫痫
      "DRUG-083": ["DRUG-081", "DRUG-084", "DRUG-085"], // 抗癫痫 -> 苯二氮卓类/抗精神失常/抗抑郁
      
      // 精神药物
      "DRUG-085": ["DRUG-083", "DRUG-086", "DRUG-087"], // 抗精神失常 -> 抗癫痫/抗抑郁/镇痛药
      "DRUG-086": ["DRUG-085", "DRUG-087"], // 抗抑郁 -> 抗精神失常/镇痛药
      "DRUG-087": ["DRUG-085", "DRUG-086", "DRUG-088"], // 镇痛药 -> 抗精神失常/抗抑郁/解热镇痛
      "DRUG-088": ["DRUG-087", "DRUG-089"], // 解热镇痛 -> 镇痛药/阿司匹林
      
      // 心血管药物
      "DRUG-091": ["DRUG-092", "DRUG-093", "PHARM-094", "PHARM-095"], // 抗高血压 -> 抗心绞痛/抗心律失常/利尿药/ACEI
      "DRUG-092": ["DRUG-091", "DRUG-093"], // 抗心绞痛 -> 抗高血压/抗心律失常
      "DRUG-093": ["DRUG-091", "DRUG-092", "PHARM-096", "PHARM-097"], // 抗心律失常 -> 抗高血压/抗心绞痛/I类/III类
      
      // 消化系统和呼吸系统
      "DRUG-094": ["DRUG-091", "DRUG-095"], // 消化性溃疡 -> 抗高血压/平喘药
      "DRUG-095": ["DRUG-094", "DRUG-096"], // 平喘药 -> 消化性溃疡/降糖药
      "DRUG-096": ["DRUG-095", "DRUG-091"], // 降糖药 -> 平喘药/抗高血压
      
      // 抗生素
      "DRUG-097": ["DRUG-098", "DRUG-099"], // β-内酰胺类 -> 大环内酯/氨基糖苷
      "DRUG-098": ["DRUG-097", "DRUG-099"], // 大环内酯类 -> β-内酰胺/氨基糖苷
      "DRUG-099": ["DRUG-097", "DRUG-098"], // 氨基糖苷类 -> β-内酰胺/大环内酯
      
      // 抗肿瘤药
      "DRUG-100": ["DRUG-101"], // 烷化剂 -> 抗代谢物
      "DRUG-101": ["DRUG-100"], // 抗代谢物 -> 烷化剂
      
      // 调血脂药和抗心力衰竭药
      "DRUG-102": ["DRUG-091", "DRUG-103"], // 调血脂药 -> 抗高血压/抗心力衰竭
      "DRUG-103": ["DRUG-091", "DRUG-102"], // 抗心力衰竭药 -> 抗高血压/调血脂药
      
      // ========== 药理学关联 ==========
      // 药效学和药动学
      "PHARM-001": ["PHARM-002", "PHARM-003", "DRUG-001"], // 药效学 -> 药动学/影响因素/药物化学
      "PHARM-002": ["PHARM-001", "PHARM-083", "PHARM-084"], // 药动学 -> 药效学/体内过程/生物利用度
      "PHARM-083": ["PHARM-002", "PHARM-084", "PHARM-085"], // 体内过程 -> 药动学/生物利用度/半衰期
      "PHARM-084": ["PHARM-002", "PHARM-083", "PHARM-085"], // 生物利用度 -> 药动学/体内过程/半衰期
      "PHARM-085": ["PHARM-002", "PHARM-083", "PHARM-084"], // 半衰期 -> 药动学/体内过程/生物利用度
      "PHARM-086": ["PHARM-087", "PHARM-001"], // 药物因素 -> 机体因素/药效学
      "PHARM-087": ["PHARM-086", "PHARM-001"], // 机体因素 -> 药物因素/药效学
      
      // 传出神经系统
      "PHARM-088": ["PHARM-089", "PHARM-090"], // 拟胆碱药 -> 抗胆碱药/拟肾上腺素药
      "PHARM-089": ["PHARM-088", "PHARM-090"], // 抗胆碱药 -> 拟胆碱药/拟肾上腺素药
      "PHARM-090": ["PHARM-088", "PHARM-089"], // 拟肾上腺素药 -> 拟胆碱药/抗胆碱药
      
      // 麻醉药
      "PHARM-091": ["PHARM-092"], // 吸入麻醉药 -> 静脉麻醉药
      "PHARM-092": ["PHARM-091"], // 静脉麻醉药 -> 吸入麻醉药
      
      // 抗高血压药
      "PHARM-093": ["PHARM-094", "PHARM-095", "DRUG-091"], // 利尿药 -> ACEI/钙通道阻滞剂/抗高血压
      "PHARM-094": ["PHARM-093", "PHARM-095", "DRUG-091"], // ACEI/ARB -> 利尿药/钙通道阻滞剂/抗高血压
      "PHARM-095": ["PHARM-093", "PHARM-094", "DRUG-091"], // 钙通道阻滞剂 -> 利尿药/ACEI/抗高血压
      
      // 抗心律失常药
      "PHARM-096": ["PHARM-097", "DRUG-093"], // I类抗心律失常 -> III类/抗心律失常
      "PHARM-097": ["PHARM-096", "DRUG-093"], // III类抗心律失常 -> I类/抗心律失常
      
      // ========== 药物合成反应关联 ==========
      // 卤化、还原、氧化
      "SYNTH-001": ["SYNTH-002", "SYNTH-003", "ORG-005"], // 卤化反应 -> 还原/氧化/卤代烃
      "SYNTH-002": ["SYNTH-001", "SYNTH-003", "SYNTH-004"], // 还原反应 -> 卤化/氧化/烷基化
      "SYNTH-003": ["SYNTH-001", "SYNTH-002", "SYNTH-005"], // 氧化反应 -> 卤化/还原/酰基化
      
      // 卤化反应详细
      "SYNTH-081": ["SYNTH-001", "SYNTH-082"], // 卤加成 -> 卤化反应/卤取代
      "SYNTH-082": ["SYNTH-001", "SYNTH-081"], // 卤取代 -> 卤化反应/卤加成
      
      // 还原反应详细
      "SYNTH-083": ["SYNTH-002", "SYNTH-084"], // 催化氢化 -> 还原反应/金属氢化物
      "SYNTH-084": ["SYNTH-002", "SYNTH-083"], // 金属氢化物 -> 还原反应/催化氢化
      
      // 氧化反应详细
      "SYNTH-085": ["SYNTH-003", "SYNTH-086"], // 醇的氧化 -> 氧化反应/烯烃氧化
      "SYNTH-086": ["SYNTH-003", "SYNTH-085"], // 烯烃氧化 -> 氧化反应/醇的氧化
      
      // 烷基化和酰基化
      "SYNTH-087": ["SYNTH-002", "SYNTH-088", "SYNTH-089"], // C-烷基化 -> 还原/O-烷基化/C-酰基化
      "SYNTH-088": ["SYNTH-087", "SYNTH-090"], // O-烷基化 -> C-烷基化/N-酰基化
      "SYNTH-089": ["SYNTH-087", "SYNTH-090"], // C-酰基化 -> C-烷基化/N-酰基化
      "SYNTH-090": ["SYNTH-088", "SYNTH-089"], // N-酰基化 -> O-烷基化/C-酰基化
      
      // 重排和环合
      "SYNTH-091": ["SYNTH-092", "SYNTH-093"], // 频哪醇重排 -> 贝克曼重排/杂环合成
      "SYNTH-092": ["SYNTH-091", "SYNTH-093"], // 贝克曼重排 -> 频哪醇重排/杂环合成
      "SYNTH-093": ["SYNTH-091", "SYNTH-092"], // 杂环合成 -> 频哪醇重排/贝克曼重排
      
      // ========== 生物化学关联 ==========
      // 蛋白质结构
      "BIO-001": ["BIO-002", "BIO-003", "BIO-004"], // 一级结构 -> 二级/三级/四级结构
      "BIO-002": ["BIO-001", "BIO-003", "BIO-004"], // 二级结构 -> 一级/三级/四级结构
      "BIO-003": ["BIO-001", "BIO-002", "BIO-004"], // 三级结构 -> 一级/二级/四级结构
      "BIO-004": ["BIO-001", "BIO-002", "BIO-003"], // 四级结构 -> 一级/二级/三级结构
      
      // 酶
      "BIO-005": ["BIO-001", "BIO-006", "BIO-088"], // 酶的组成 -> 蛋白质/活性中心/糖代谢
      "BIO-006": ["BIO-001", "BIO-005", "BIO-088"], // 活性中心 -> 蛋白质/酶的组成/糖代谢
      "BIO-007": ["BIO-005", "BIO-006", "BIO-088"], // 酶促反应 -> 酶的组成/活性中心/糖代谢
      
      // 糖代谢
      "BIO-088": ["BIO-089", "BIO-005", "BIO-007"], // 糖酵解 -> 三羧酸循环/酶/酶促反应
      "BIO-089": ["BIO-088", "BIO-005", "BIO-007"], // 三羧酸循环 -> 糖酵解/酶/酶促反应
      
      // 脂类代谢
      "BIO-090": ["BIO-091", "BIO-088"], // 脂肪酸β-氧化 -> 酮体代谢/糖代谢
      "BIO-091": ["BIO-090", "BIO-088"], // 酮体代谢 -> 脂肪酸β-氧化/糖代谢
      
      // 氨基酸代谢
      "BIO-092": ["BIO-093", "BIO-001"], // 脱氨基 -> 氨代谢/蛋白质结构
      "BIO-093": ["BIO-092", "BIO-001"], // 氨代谢 -> 脱氨基/蛋白质结构
      
      // 核酸代谢
      "BIO-094": ["BIO-095", "BIO-096"], // 嘌呤核苷酸 -> DNA复制/损伤修复
      "BIO-095": ["BIO-094", "BIO-096", "BIO-098"], // DNA复制 -> 嘌呤核苷酸/损伤修复/转录
      "BIO-096": ["BIO-094", "BIO-095"], // DNA损伤修复 -> 嘌呤核苷酸/DNA复制
      
      // RNA转录和翻译
      "BIO-098": ["BIO-095", "BIO-099", "BIO-100"], // RNA转录 -> DNA复制/转录后加工/翻译
      "BIO-099": ["BIO-098", "BIO-100"], // 转录后加工 -> RNA转录/翻译
      "BIO-100": ["BIO-098", "BIO-099", "BIO-101"], // 翻译 -> RNA转录/转录后加工/遗传密码
      "BIO-101": ["BIO-100", "BIO-098"], // 遗传密码 -> 翻译/RNA转录
    };

    // 扩展关联关系（基于关键词匹配）
    this.buildAutomaticRelations();
  }

  /**
   * 自动构建关联关系（基于关键词匹配）
   */
  buildAutomaticRelations() {
    const allKnowledge = this.getAllKnowledge();
    const knowledgeMap = new Map();

    // 建立知识点ID -> 知识点的映射
    allKnowledge.forEach((item) => {
      knowledgeMap.set(item.id, item);
    });

    // 基于关键词匹配建立关联
    knowledgeMap.forEach((item1, id1) => {
      if (!this.relations.has(id1)) {
        this.relations.set(id1, new Set());
      }

      knowledgeMap.forEach((item2, id2) => {
        if (id1 === id2) return;

        // 计算关键词重叠度
        const keywords1 = new Set(item1.keywords || []);
        const keywords2 = new Set(item2.keywords || []);
        let overlap = 0;

        keywords1.forEach((kw) => {
          if (keywords2.has(kw)) {
            overlap++;
          }
        });

        // 如果关键词重叠度 >= 2，建立关联
        if (overlap >= 2) {
          this.relations.get(id1).add(id2);
        }
      });
    });
  }

  /**
   * 获取所有知识点
   */
  getAllKnowledge() {
    const allDatabases = [
      typeof TEXTBOOK_KNOWLEDGE_BASE !== "undefined" ? TEXTBOOK_KNOWLEDGE_BASE : {},
      typeof EXTENDED_TEXTBOOK_KNOWLEDGE !== "undefined" ? EXTENDED_TEXTBOOK_KNOWLEDGE : {},
      typeof TEXTBOOK_KNOWLEDGE_EXPANSION_2 !== "undefined" ? TEXTBOOK_KNOWLEDGE_EXPANSION_2 : {},
      typeof TEXTBOOK_KNOWLEDGE_EXPANSION_3 !== "undefined" ? TEXTBOOK_KNOWLEDGE_EXPANSION_3 : {},
      typeof TEXTBOOK_KNOWLEDGE_EXPANSION_4 !== "undefined" ? TEXTBOOK_KNOWLEDGE_EXPANSION_4 : {},
      typeof TEXTBOOK_KNOWLEDGE_EXPANSION_5 !== "undefined" ? TEXTBOOK_KNOWLEDGE_EXPANSION_5 : {},
    ];

    const results = [];

    allDatabases.forEach((db) => {
      Object.keys(db).forEach((bookName) => {
        const book = db[bookName];
        book.chapters.forEach((chapter) => {
          chapter.sections.forEach((section) => {
            results.push({
              ...section,
              bookName: bookName.replace(/-扩展.*/, ""),
              chapter: chapter.chapter,
            });
          });
        });
      });
    });

    return results;
  }

  /**
   * 获取关联知识点
   */
  getRelatedKnowledge(knowledgeId, depth = 1) {
    const visited = new Set();
    const results = [];

    const dfs = (id, currentDepth) => {
      if (currentDepth > depth || visited.has(id)) return;
      visited.add(id);

      const related = this.relations.get(id);
      if (related) {
        related.forEach((relatedId) => {
          if (!visited.has(relatedId)) {
            const knowledge = this.getKnowledgeById(relatedId);
            if (knowledge) {
              results.push({
                ...knowledge,
                depth: currentDepth,
              });
            }
            dfs(relatedId, currentDepth + 1);
          }
        });
      }
    };

    dfs(knowledgeId, 1);
    return results;
  }

  /**
   * 根据ID获取知识点
   */
  getKnowledgeById(id) {
    const allKnowledge = this.getAllKnowledge();
    return allKnowledge.find((item) => item.id === id);
  }

  /**
   * 获取关联统计
   */
  getRelationStats() {
    let totalRelations = 0;
    this.relations.forEach((relatedSet) => {
      totalRelations += relatedSet.size;
    });

    return {
      totalKnowledge: this.relations.size,
      totalRelations: totalRelations,
      avgRelations: (totalRelations / this.relations.size).toFixed(2),
    };
  }
}

/**
 * 知识点关联网络可视化模态框
 */
class KnowledgeRelationNetworkModal extends Modal {
  constructor(app, knowledgeId = "") {
    super(app);
    this.knowledgeId = knowledgeId;
    this.network = new KnowledgeRelationNetwork();
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("knowledge-relation-modal");

    // 标题
    contentEl.createEl("h2", { text: "🕸️ 知识点关联网络" });

    // 搜索框
    const searchBox = contentEl.createDiv({ cls: "relation-search-box" });
    
    const input = searchBox.createEl("input", {
      type: "text",
      placeholder: "输入知识点ID或名称搜索...",
      value: this.knowledgeId,
      cls: "relation-search-input",
    });

    const searchBtn = searchBox.createEl("button", {
      text: "查看关联",
      cls: "relation-search-btn",
    });

    // 可视化容器
    this.vizContainer = contentEl.createDiv({
      cls: "relation-viz-container",
    });

    // 统计信息
    const stats = this.network.getRelationStats();
    const statsDiv = contentEl.createDiv({ cls: "relation-stats" });
    statsDiv.createP({ text: `总知识点: ${stats.totalKnowledge} | 总关联: ${stats.totalRelations} | 平均关联度: ${stats.avgRelations}` });

    // 搜索事件
    searchBtn.onclick = () => {
      const query = input.value.trim();
      if (!query) return;

      this.showRelationNetwork(query);
    };

    // 如果有初始ID，自动显示
    if (this.knowledgeId) {
      this.showRelationNetwork(this.knowledgeId);
    }
  }

  /**
   * 显示关联网络
   */
  showRelationNetwork(knowledgeId) {
    this.vizContainer.empty();

    const related = this.network.getRelatedKnowledge(knowledgeId, 2);

    if (related.length === 0) {
      this.vizContainer.createDiv({
        text: "未找到关联知识点",
        cls: "no-relations",
      });
      return;
    }

    // 创建简单的可视化（SVG）
    const svg = this.vizContainer.createEl("svg", {
      attr: {
        width: "100%",
        height: "600",
        viewBox: "0 0 800 600",
      },
      cls: "relation-svg",
    });

    // 中心节点
    const centerX = 400;
    const centerY = 300;

    // 绘制中心节点
    const centerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    centerCircle.setAttribute("cx", centerX);
    centerCircle.setAttribute("cy", centerY);
    centerCircle.setAttribute("r", 40);
    centerCircle.setAttribute("fill", "var(--interactive-accent)");
    svg.appendChild(centerCircle);

    // 中心节点文本
    const centerText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    centerText.setAttribute("x", centerX);
    centerText.setAttribute("y", centerY);
    centerText.setAttribute("text-anchor", "middle");
    centerText.setAttribute("dominant-baseline", "middle");
    centerText.setAttribute("fill", "white");
    centerText.textContent = knowledgeId;
    svg.appendChild(centerText);

    // 绘制关联节点
    related.forEach((item, index) => {
      const angle = (index / related.length) * 2 * Math.PI;
      const radius = 150 + (item.depth - 1) * 100;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      // 连线
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", centerX);
      line.setAttribute("y1", centerY);
      line.setAttribute("x2", x);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", "var(--text-muted)");
      line.setAttribute("stroke-width", "1");
      svg.appendChild(line);

      // 节点圆
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", x);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", 25);
      circle.setAttribute("fill", item.depth === 1 ? "var(--background-modifier-hover)" : "var(--background-secondary)");
      circle.setAttribute("stroke", "var(--interactive-accent)");
      circle.setAttribute("stroke-width", "1");
      svg.appendChild(circle);

      // 节点文本
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", x);
      text.setAttribute("y", y);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      text.setAttribute("font-size", "10");
      text.textContent = item.id;
      svg.appendChild(text);
    });
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// 导出全局变量
// KnowledgeRelationNetwork, KnowledgeRelationNetworkModal
