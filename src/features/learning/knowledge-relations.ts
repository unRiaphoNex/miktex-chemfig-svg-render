// ========== 知识点关联管理 (v17.2.0) ==========
// 知识点与化合物、反应、药物的关联管理

const KNOWLEDGE_RELATIONS = {
  // ========== 有机化学反应关联 ==========
  "ORG-004": {
    relatedCompounds: ["溴乙烷", "2-溴丙烷", "叔丁基溴"],
    relatedReactions: ["水解反应", "醇解反应", "氨解反应"],
    relatedDrugs: [],
  },
  "ORG-204": {
    relatedCompounds: ["乙烯", "丙烯", "1-丁烯"],
    relatedReactions: ["加氢", "加卤", "加水"],
    relatedDrugs: [],
  },
  "ORG-205": {
    relatedCompounds: ["丙烯", "2-甲基丙烯"],
    relatedReactions: ["HBr 加成", "H2O 加成"],
    relatedDrugs: [],
  },
  "ORG-206": {
    relatedCompounds: ["丙烯", "1-丁烯"],
    relatedReactions: ["HBr 过氧化物效应"],
    relatedDrugs: [],
  },
  "ORG-207": {
    relatedCompounds: ["乙烯", "丙烯", "环己烯"],
    relatedReactions: ["高锰酸钾氧化", "臭氧化分解", "OsO4 双羟基化"],
    relatedDrugs: [],
  },
  "ORG-305": {
    relatedCompounds: ["1,3-丁二烯", "异戊二烯"],
    relatedReactions: ["1,2-加成", "1,4-加成", "Diels-Alder"],
    relatedDrugs: [],
  },
  "ORG-307": {
    relatedCompounds: ["1,3-丁二烯", "马来酸酐"],
    relatedReactions: ["Diels-Alder 反应"],
    relatedDrugs: [],
  },
  "ORG-404": {
    relatedCompounds: ["环己烷", "环己醇", "环己酮"],
    relatedReactions: [],
    relatedDrugs: [],
  },
  "ORG-702": {
    relatedCompounds: ["溴乙烷", "2-溴丙烷", "叔丁基溴"],
    relatedReactions: ["SN1", "SN2", "水解", "醇解"],
    relatedDrugs: [],
  },
  "ORG-806": {
    relatedCompounds: ["乙醇", "异丙醇", "叔丁醇"],
    relatedReactions: ["醇氧化", "Jones 氧化", "PCC 氧化"],
    relatedDrugs: [],
  },
  "ORG-903": {
    relatedCompounds: ["甲醛", "乙醛", "丙酮", "苯甲醛"],
    relatedReactions: ["亲核加成", "HCN 加成", "NaHSO3 加成", "格氏反应"],
    relatedDrugs: [],
  },
  "ORG-904": {
    relatedCompounds: ["乙醛", "苯甲醛"],
    relatedReactions: ["Tollens 反应", "Fehling 反应"],
    relatedDrugs: [],
  },
  "ORG-905": {
    relatedCompounds: ["乙醛", "丙酮"],
    relatedReactions: ["NaBH4 还原", "LiAlH4 还原", "催化加氢"],
    relatedDrugs: [],
  },
  "ORG-906": {
    relatedCompounds: ["乙醛", "丙醛"],
    relatedReactions: ["羟醛缩合"],
    relatedDrugs: [],
  },
  "ORG-1004": {
    relatedCompounds: ["乙酸", "苯甲酸"],
    relatedReactions: ["LiAlH4 还原"],
    relatedDrugs: [],
  },

  // ========== 药物知识点关联 ==========
  "DRUG-001": {
    relatedCompounds: ["青霉素G", "阿莫西林", "头孢氨苄"],
    relatedReactions: [],
    relatedDrugs: ["青霉素G", "阿莫西林", "氨苄西林", "头孢氨苄", "头孢呋辛", "头孢曲松"],
  },
  "DRUG-002": {
    relatedCompounds: ["环丙沙星", "左氧氟沙星", "莫西沙星"],
    relatedReactions: [],
    relatedDrugs: ["诺氟沙星", "环丙沙星", "左氧氟沙星", "莫西沙星"],
  },
  "DRUG-401": {
    relatedCompounds: ["阿司匹林", "水杨酸"],
    relatedReactions: ["酯化反应"],
    relatedDrugs: ["阿司匹林"],
  },
  "DRUG-402": {
    relatedCompounds: ["对乙酰氨基酚"],
    relatedReactions: [],
    relatedDrugs: ["对乙酰氨基酚"],
  },
  "DRUG-403": {
    relatedCompounds: ["布洛芬", "萘普生", "双氯芬酸"],
    relatedReactions: [],
    relatedDrugs: ["布洛芬", "萘普生", "双氯芬酸", "吲哚美辛"],
  },
  "DRUG-501": {
    relatedCompounds: ["吗啡", "可待因"],
    relatedReactions: [],
    relatedDrugs: ["吗啡", "可待因", "哌替啶", "芬太尼"],
  },
  "DRUG-601": {
    relatedCompounds: ["硝苯地平", "维拉帕米", "地尔硫卓"],
    relatedReactions: [],
    relatedDrugs: ["硝苯地平", "尼莫地平", "维拉帕米", "地尔硫卓"],
  },
  "DRUG-602": {
    relatedCompounds: ["卡托普利", "依那普利"],
    relatedReactions: [],
    relatedDrugs: ["卡托普利", "依那普利", "氯沙坦", "缬沙坦"],
  },
  "DRUG-603": {
    relatedCompounds: ["普萘洛尔", "美托洛尔"],
    relatedReactions: [],
    relatedDrugs: ["普萘洛尔", "美托洛尔"],
  },
  "DRUG-701": {
    relatedCompounds: ["青霉素G", "阿莫西林"],
    relatedReactions: [],
    relatedDrugs: ["青霉素G", "阿莫西林", "氨苄西林", "头孢氨苄", "头孢呋辛"],
  },
  "DRUG-702": {
    relatedCompounds: ["红霉素", "阿奇霉素"],
    relatedReactions: [],
    relatedDrugs: ["红霉素", "阿奇霉素", "克拉霉素"],
  },
  "DRUG-703": {
    relatedCompounds: ["链霉素", "庆大霉素"],
    relatedReactions: [],
    relatedDrugs: ["链霉素", "庆大霉素", "阿米卡星"],
  },
  "DRUG-704": {
    relatedCompounds: ["四环素", "多西环素"],
    relatedReactions: [],
    relatedDrugs: ["四环素", "多西环素", "土霉素"],
  },
  "DRUG-801": {
    relatedCompounds: ["环丙沙星", "左氧氟沙星"],
    relatedReactions: [],
    relatedDrugs: ["诺氟沙星", "环丙沙星", "左氧氟沙星", "莫西沙星"],
  },
  "DRUG-901": {
    relatedCompounds: ["环磷酰胺"],
    relatedReactions: [],
    relatedDrugs: ["环磷酰胺", "氮芥"],
  },
  "DRUG-902": {
    relatedCompounds: ["甲氨蝶呤", "氟尿嘧啶"],
    relatedReactions: [],
    relatedDrugs: ["甲氨蝶呤", "氟尿嘧啶", "阿糖胞苷"],
  },
  "DRUG-903": {
    relatedCompounds: ["长春新碱", "紫杉醇"],
    relatedReactions: [],
    relatedDrugs: ["长春新碱", "紫杉醇"],
  },

  // ========== 药理学知识点关联 ==========
  "PHARM-001": {
    relatedCompounds: ["肾上腺素", "乙酰胆碱", "阿托品"],
    relatedReactions: [],
    relatedDrugs: ["肾上腺素", "乙酰胆碱", "阿托品"],
  },
  "PHARM-002": {
    relatedCompounds: [],
    relatedReactions: [],
    relatedDrugs: [],
  },
  "PHARM-1001": {
    relatedCompounds: ["阿司匹林", "对乙酰氨基酚", "布洛芬"],
    relatedReactions: [],
    relatedDrugs: ["阿司匹林", "对乙酰氨基酚", "布洛芬", "萘普生"],
  },
  "PHARM-1401": {
    relatedCompounds: ["氢化可的松", "泼尼松", "地塞米松"],
    relatedReactions: [],
    relatedDrugs: ["氢化可的松", "泼尼松", "地塞米松"],
  },

  // ========== 药物合成知识点关联 ==========
  "SYNTH-202": {
    relatedCompounds: ["阿司匹林", "水杨酸", "乙酸酐"],
    relatedReactions: ["酯化反应", "酰化反应"],
    relatedDrugs: ["阿司匹林"],
  },

  // ========== 生物化学知识点关联 ==========
  "BIO-101": {
    relatedCompounds: ["葡萄糖", "丙酮酸", "乳酸"],
    relatedReactions: ["糖酵解"],
    relatedDrugs: [],
  },
  "BIO-102": {
    relatedCompounds: ["乙酰CoA", "CO2", "H2O"],
    relatedReactions: ["三羧酸循环"],
    relatedDrugs: [],
  },
};

/**
 * 获取知识点的关联
 */
function getKnowledgeRelations(knowledgeId) {
  return KNOWLEDGE_RELATIONS[knowledgeId] || {
    relatedCompounds: [],
    relatedReactions: [],
    relatedDrugs: [],
  };
}

// 导出全局变量
// KNOWLEDGE_RELATIONS, getKnowledgeRelations
