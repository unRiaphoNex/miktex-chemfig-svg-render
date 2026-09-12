// ========== 知识库模块 (v17.2.0) ==========
// 从教材提取的知识点索引
// 教材来源:
// 1. 有机化学（第六版）- 天津大学
// 2. 药物化学（第三版）- 尤启冬
// 3. 药理学（第九版）- 杨宝峰
// 4. 药物合成反应（第四版）- 闻韧
// 5. 生物化学与分子生物学（第10版）- 高国全

/**
 * 知识点类型枚举
 */
const KnowledgeType = {
  // 有机化学
  ORGANIC_REACTION: "organic-reaction",
  FUNCTIONAL_GROUP: "functional-group",
  NOMENCLATURE: "nomenclature",
  STEREOCHEMISTRY: "stereochemistry",
  
  // 药物化学
  DRUG_CLASS: "drug-class",
  DRUG_MECHANISM: "drug-mechanism",
  DRUG_SIDE_EFFECT: "drug-side-effect",
  STRUCTURE_ACTIVITY: "structure-activity",
  
  // 药理学
  PHARMACOKINETICS: "pharmacokinetics",
  PHARMACODYNAMICS: "pharmacodynamics",
  CLINICAL_APPLICATION: "clinical-application",
  
  // 药物合成
  SYNTHESIS_ROUTE: "synthesis-route",
  REACTION_CONDITION: "reaction-condition",
  PURIFICATION: "purification",
  
  // 生物化学
  METABOLISM: "metabolism",
  ENZYME: "enzyme",
  BIOCHEM_PATHWAY: "biochem-pathway",
};

/**
 * 知识库条目
 */
class KnowledgeEntry {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.type = data.type;
    this.category = data.category;
    this.content = data.content;
    this.keywords = data.keywords || [];
    this.bookSource = data.bookSource;
    this.chapter = data.chapter;
    this.page = data.page;
    this.relatedCompounds = data.relatedCompounds || [];
    this.relatedReactions = data.relatedReactions || [];
  }
}

/**
 * 知识库索引
 */
class KnowledgeIndex {
  private static instance: KnowledgeIndex;
  private entries: Map<string, KnowledgeEntry> = new Map();
  private keywordIndex: Map<string, string[]> = new Map();
  private categoryIndex: Map<string, string[]> = new Map();
  private typeIndex: Map<string, string[]> = new Map();

  private constructor() {
    this.initDefaultKnowledge();
  }

  static getInstance(): KnowledgeIndex {
    if (!this.instance) {
      this.instance = new KnowledgeIndex();
    }
    return this.instance;
  }

  /**
   * 初始化默认知识库
   */
  private initDefaultKnowledge(): void {
    // 有机化学 - 常见反应
    this.addEntry(new KnowledgeEntry({
      id: "org-001",
      title: "亲核取代反应 (SN1/SN2)",
      type: KnowledgeType.ORGANIC_REACTION,
      category: "脂肪族亲核取代",
      content: `亲核取代反应是有机化学中最基本的反应类型之一。
      
SN1 机制:
- 单分子反应，速率只与底物浓度有关
- 两步反应：离去基团先离开形成碳正离子，然后亲核试剂进攻
- 产物外消旋化
- 叔卤代烷 > 仲卤代烷 > 伯卤代烷

SN2 机制:
- 双分子反应，速率与底物和亲核试剂浓度都有关
- 一步反应，背面进攻
- 产物构型翻转 (Walden 翻转)
- 伯卤代烷 > 仲卤代烷 > 叔卤代烷`,
      keywords: ["SN1", "SN2", "亲核取代", "碳正离子", "构型翻转", "Walden"],
      bookSource: "有机化学（第六版）",
      chapter: "第八章 卤代烃",
      page: 234,
      relatedCompounds: ["溴乙烷", "2-溴丙烷", "叔丁基溴"],
      relatedReactions: ["水解反应", "醇解反应", "氨解反应"],
    }));

    this.addEntry(new KnowledgeEntry({
      id: "org-002",
      title: "亲电加成反应",
      type: KnowledgeType.ORGANIC_REACTION,
      category: "烯烃亲电加成",
      content: `烯烃的亲电加成反应是烯烃的特征反应。

马氏规则:
- H 加在含氢较多的双键碳上
- 卤素加在含氢较少的双键碳上

常见反应:
1. 加 HX: 卤代烷
2. 加 H2O: 醇
3. 加 X2: 邻二卤代物
4. 加 HOX: 卤代醇

过氧化物效应:
- 在过氧化物存在下，HBr 加成遵循反马氏规则
- 自由基加成机制`,
      keywords: ["亲电加成", "马氏规则", "过氧化物效应", "烯烃", "双键"],
      bookSource: "有机化学（第六版）",
      chapter: "第九章 烯烃",
      page: 267,
      relatedCompounds: ["乙烯", "丙烯", "1-丁烯"],
      relatedReactions: ["加氢", "加卤", "加水"],
    }));

    // 药物化学 - 常见药物分类
    this.addEntry(new KnowledgeEntry({
      id: "drug-001",
      title: "β-内酰胺类抗生素",
      type: KnowledgeType.DRUG_CLASS,
      category: "抗生素",
      content: `β-内酰胺类抗生素是临床上最常用的抗生素类别。

结构特征:
- 含有 β-内酰胺环 (四元环)
- 作用机制: 抑制细菌细胞壁合成

分类:
1. 青霉素类: 青霉素G、阿莫西林、氨苄西林
2. 头孢菌素类: 头孢氨苄、头孢呋辛、头孢曲松
3. 碳青霉烯类: 亚胺培南、美罗培南
4. 单环β-内酰胺类: 氨曲南

构效关系:
- β-内酰胺环是活性必需结构
- 侧链决定抗菌谱和稳定性`,
      keywords: ["抗生素", "β-内酰胺", "青霉素", "头孢", "细胞壁合成"],
      bookSource: "药物化学（第三版）",
      chapter: "第十一章 抗生素",
      page: 356,
      relatedCompounds: ["青霉素G", "阿莫西林", "头孢氨苄"],
      relatedReactions: [],
    }));

    this.addEntry(new KnowledgeEntry({
      id: "drug-002",
      title: "喹诺酮类抗菌药",
      type: KnowledgeType.DRUG_CLASS,
      category: "抗菌药",
      content: `喹诺酮类抗菌药是一类完全由人工合成的抗菌药物。

作用机制:
- 抑制 DNA 回旋酶 (拓扑异构酶 II)
- 阻碍细菌 DNA 合成

分类 (按代):
1. 第一代: 萘啶酸 (已淘汰)
2. 第二代: 诺氟沙星、依诺沙星
3. 第三代: 环丙沙星、氧氟沙星、左氧氟沙星
4. 第四代: 莫西沙星、加替沙星

构效关系:
- 3位羧基和4位羰基是抗菌活性必需
- 6位引入氟原子可增强抗菌活性`,
      keywords: ["喹诺酮", "抗菌药", "环丙沙星", "左氧氟沙星", "DNA回旋酶"],
      bookSource: "药物化学（第三版）",
      chapter: "第十二章 合成抗菌药",
      page: 389,
      relatedCompounds: ["环丙沙星", "左氧氟沙星", "莫西沙星"],
      relatedReactions: [],
    }));

    // 药理学 - 作用机制
    this.addEntry(new KnowledgeEntry({
      id: "pharm-001",
      title: "作用于受体的药物",
      type: KnowledgeType.DRUG_MECHANISM,
      category: "受体理论",
      content: `受体是一类介导细胞信号转导的功能蛋白质。

相关概念:
- 亲和力: 药物与受体结合的能力
- 内在活性: 药物激动受体产生效应的能力
- 激动药: 既有亲和力又有内在活性
- 拮抗药: 有亲和力但无内在活性
- 部分激动药: 有亲和力但内在活性不强

受体类型:
1. G 蛋白偶联受体 (GPCR) - 最大的受体家族
2. 离子通道受体
3. 酶活性受体
4. 细胞核激素受体`,
      keywords: ["受体", "激动剂", "拮抗剂", "亲和力", "内在活性", "GPCR"],
      bookSource: "药理学（第九版）",
      chapter: "第三章 药物效应动力学",
      page: 32,
      relatedCompounds: ["肾上腺素", "乙酰胆碱", "阿托品"],
      relatedReactions: [],
    }));

    // 药物合成 - 常见反应
    this.addEntry(new KnowledgeEntry({
      id: "synth-001",
      title: "阿司匹林的合成",
      type: KnowledgeType.SYNTHESIS_ROUTE,
      category: "解热镇痛药合成",
      content: `阿司匹林 (乙酰水杨酸) 的合成路线。

合成路线:
1. 水杨酸 + 乙酸酐 → 阿司匹林 + 乙酸
2. 催化剂: 浓硫酸
3. 反应条件: 加热 80-90°C

反应类型: 酰化反应 (酯化反应)

后处理:
1. 加水析出结晶
2. 重结晶纯化 (乙醇-水)
3. 干燥得到成品

杂质检查:
- 游离水杨酸 (与三氯化铁显色)
- 易炭化物`,
      keywords: ["阿司匹林", "乙酰水杨酸", "酯化", "酰化", "水杨酸"],
      bookSource: "药物合成反应（第四版）",
      chapter: "第五章 酰化反应",
      page: 156,
      relatedCompounds: ["阿司匹林", "水杨酸", "乙酸酐"],
      relatedReactions: ["酯化反应", "酰化反应"],
    }));

    // 生物化学 - 代谢途径
    this.addEntry(new KnowledgeEntry({
      id: "bio-001",
      title: "糖酵解途径 (EMP)",
      type: KnowledgeType.BIOCHEM_PATHWAY,
      category: "糖代谢",
      content: `糖酵解途径是葡萄糖分解代谢的第一阶段。

反应部位: 胞液

关键步骤:
1. 葡萄糖 → 6-磷酸葡萄糖 (己糖激酶)
2. 6-磷酸果糖 → 1,6-二磷酸果糖 (磷酸果糖激酶-1)
3. 磷酸烯醇式丙酮酸 → 丙酮酸 (丙酮酸激酶)

产物:
- 1 分子葡萄糖 → 2 分子丙酮酸
- 净生成 2 ATP + 2 NADH

生理意义:
- 缺氧条件下获得能量的有效方式
- 某些组织 (如红细胞) 完全依赖糖酵解供能`,
      keywords: ["糖酵解", "EMP", "丙酮酸", "ATP", "糖代谢"],
      bookSource: "生物化学与分子生物学（第10版）",
      chapter: "第六章 糖代谢",
      page: 189,
      relatedCompounds: ["葡萄糖", "丙酮酸", "乳酸"],
      relatedReactions: [],
    }));

    console.log(`[KnowledgeIndex] 初始化完成: ${this.entries.size} 个知识点`);
  }

  /**
   * 添加知识点
   */
  addEntry(entry: KnowledgeEntry): void {
    this.entries.set(entry.id, entry);

    // 更新关键词索引
    entry.keywords.forEach((keyword) => {
      const lowerKeyword = keyword.toLowerCase();
      if (!this.keywordIndex.has(lowerKeyword)) {
        this.keywordIndex.set(lowerKeyword, []);
      }
      this.keywordIndex.get(lowerKeyword)!.push(entry.id);
    });

    // 更新分类索引
    if (!this.categoryIndex.has(entry.category)) {
      this.categoryIndex.set(entry.category, []);
    }
    this.categoryIndex.get(entry.category)!.push(entry.id);

    // 更新类型索引
    if (!this.typeIndex.has(entry.type)) {
      this.typeIndex.set(entry.type, []);
    }
    this.typeIndex.get(entry.type)!.push(entry.id);
  }

  /**
   * 按关键词搜索
   */
  searchByKeyword(query: string): KnowledgeEntry[] {
    const lowerQuery = query.toLowerCase();
    const results: KnowledgeEntry[] = [];
    const seen = new Set<string>();

    // 精确匹配关键词
    if (this.keywordIndex.has(lowerQuery)) {
      this.keywordIndex.get(lowerQuery)!.forEach((id) => {
        if (!seen.has(id)) {
          seen.add(id);
          results.push(this.entries.get(id)!);
        }
      });
    }

    // 模糊匹配标题和内容
    this.entries.forEach((entry) => {
      if (seen.has(entry.id)) return;
      if (
        entry.title.toLowerCase().includes(lowerQuery) ||
        entry.content.toLowerCase().includes(lowerQuery) ||
        entry.category.toLowerCase().includes(lowerQuery)
      ) {
        seen.add(entry.id);
        results.push(entry);
      }
    });

    return results;
  }

  /**
   * 按类型查询
   */
  getByType(type: string): KnowledgeEntry[] {
    const ids = this.typeIndex.get(type) || [];
    return ids.map((id) => this.entries.get(id)!).filter(Boolean);
  }

  /**
   * 按分类查询
   */
  getByCategory(category: string): KnowledgeEntry[] {
    const ids = this.categoryIndex.get(category) || [];
    return ids.map((id) => this.entries.get(id)!).filter(Boolean);
  }

  /**
   * 获取所有分类
   */
  getAllCategories(): string[] {
    return Array.from(this.categoryIndex.keys());
  }

  /**
   * 获取所有类型
   */
  getAllTypes(): string[] {
    return Array.from(this.typeIndex.keys());
  }

  /**
   * 获取统计信息
   */
  getStats(): { total: number; byType: Record<string, number>; byCategory: Record<string, number> } {
    const byType: Record<string, number> = {};
    const byCategory: Record<string, number> = {};

    this.typeIndex.forEach((ids, type) => {
      byType[type] = ids.length;
    });

    this.categoryIndex.forEach((ids, category) => {
      byCategory[category] = ids.length;
    });

    return {
      total: this.entries.size,
      byType,
      byCategory,
    };
  }
}

// 导出全局变量
// KnowledgeType, KnowledgeEntry, KnowledgeIndex
