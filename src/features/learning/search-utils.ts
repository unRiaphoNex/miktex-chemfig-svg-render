// ========== 搜索工具 (v17.2.0) ==========
// 模糊搜索、同义词搜索、拼音搜索

/**
 * 简单的拼音映射表（常用化学术语）
 */
const PINYIN_MAP = {
  "ben": "苯", "chun": "醇", "suan": "酸", "tong": "酮",
  "quan": "醛", "zhi": "酯", "an": "胺", "jing": "腈",
  "yang": "氧", "qing": "氢", "tan": "碳", "lu": "氯",
  "xiu": "溴", "dian": "碘", "fu": "氟", "liu": "硫",
  "fei": "酚", "mi": "醚", "jian": "碱", "lin": "磷",
  "gui": "硅", "lv": "铝", "tie": "铁", "tong": "铜",
  "yin": "银", "jin": "金", "meng": "锰", "ge": "铬",
  "gui": "硅", "na": "钠", "jia": "钾", "gai": "钙",
  "mei": "镁", "bei": "钡", "xin": "锌", "gong": "汞",
  "jia": "甲", "yi": "乙", "bing": "丙", "ding": "丁",
  "wu": "戊", "ji": "己", "geng": "庚", "xin": "辛",
  "ren": "壬", "gui": "癸",
  "fan": "反", "shun": "顺", "shun": "顺", "yi": "异",
  "xin": "新", "jiu": "旧", "qian": "前", "hou": "后",
  "zuo": "左", "you": "右", "nei": "内", "wai": "外",
  "shang": "上", "xia": "下", "zhong": "中", "jian": "间",
  "lin": "临", "dui": "对", "jian": "间", "wei": "位",
  "jia": "加", "jian": "减", "cheng": "乘", "chu": "除",
  "fanying": "反应", "jituan": "基团", "fenzi": "分子",
  "huaxue": "化学", "yaowu": "药物", "lilun": "理论",
  "shiyan": "实验", "fangfa": "方法", "yuanli": "原理",
  "guocheng": "过程", "jieguo": "结果", "yuanyin": "原因",
  "tiao": "条", "jian": "件", "cu": "催", "hua": "化",
  "huan": "还", "yuan": "原", "yang": "氧", "hua": "化",
  "jian": "加", "cheng": "成", "qu": "取", "dai": "代",
  "xiao": "消", "qu": "去", "chong": "重", "pai": "排",
  "lie": "裂", "jie": "解", "he": "合", "cheng": "成",
  "shui": "水", "jie": "解", "chun": "醇", "jie": "解",
  "an": "氨", "jie": "解", "zhi": "酯", "hua": "化",
  "xian": "酰", "ji": "基", "jia": "甲", "ji": "基",
  "yi": "乙", "ji": "基", "bing": "丙", "ji": "基",
  "ding": "丁", "ji": "基", "wu": "戊", "ji": "基",
  "ji": "己", "ji": "基", "geng": "庚", "ji": "基",
  "xin": "辛", "ji": "基",
};

/**
 * 同义词映射表
 */
const SYNONYM_MAP = {
  "苯": ["benzene", "苯环", "芳香环", "芳环"],
  "醇": ["alcohol", "羟基化合物", "醇羟基"],
  "酸": ["acid", "羧酸", "有机酸"],
  "酮": ["ketone", "酮基", "羰基化合物"],
  "醛": ["aldehyde", "醛基", "甲酰基"],
  "酯": ["ester", "酯基", "羧酸酯"],
  "胺": ["amine", "氨基", "胺基"],
  "酚": ["phenol", "酚羟基", "苯酚"],
  "醚": ["ether", "醚键", "醚类"],
  "反应": ["reaction", "化学反应", "化学变化"],
  "氧化": ["oxidation", "氧化反应", "氧化作用"],
  "还原": ["reduction", "还原反应", "还原作用"],
  "加成": ["addition", "加成反应", "加成作用"],
  "取代": ["substitution", "取代反应", "取代作用"],
  "消除": ["elimination", "消除反应", "消去反应"],
  "重排": ["rearrangement", "重排反应", "分子重排"],
  "水解": ["hydrolysis", "水解反应", "水解作用"],
  "聚合": ["polymerization", "聚合反应", "聚合作用"],
  "药物": ["drug", "药品", "药剂", "药品"],
  "治疗": ["treatment", "疗法", "医治"],
  "副作用": ["side effect", "不良反应", "副反应"],
  "剂量": ["dose", "用量", "用药量"],
  "机理": ["mechanism", "作用机制", "反应机理"],
  "构效关系": ["structure-activity relationship", "SAR", "构效"],
  "药效学": ["pharmacodynamics", "PD", "药效"],
  "药动学": ["pharmacokinetics", "PK", "药代动力学"],
  "代谢": ["metabolism", "新陈代谢", "代谢作用"],
  "吸收": ["absorption", "吸收作用", "吸收过程"],
  "分布": ["distribution", "分布过程", "分布情况"],
  "排泄": ["excretion", "排泄过程", "排泄作用"],
};

/**
 * 模糊搜索匹配算法
 * 使用编辑距离（Levenshtein Distance）
 */
function fuzzyMatch(query, target, threshold = 0.7) {
  if (!query || !target) return false;
  
  const lowerQuery = query.toLowerCase();
  const lowerTarget = target.toLowerCase();
  
  // 完全匹配
  if (lowerTarget.includes(lowerQuery)) return true;
  
  // 编辑距离计算
  const maxLength = Math.max(lowerQuery.length, lowerTarget.length);
  if (maxLength === 0) return false;
  
  const distance = levenshteinDistance(lowerQuery, lowerTarget);
  const similarity = 1 - (distance / maxLength);
  
  return similarity >= threshold;
}

/**
 * Levenshtein Distance 编辑距离算法
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length;
  const n = str2.length;
  
  // 创建矩阵
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // 初始化
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // 计算编辑距离
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j - 1] + 1, // 替换
          dp[i - 1][j] + 1,     // 删除
          dp[i][j - 1] + 1      // 插入
        );
      }
    }
  }
  
  return dp[m][n];
}

/**
 * 搜索增强函数
 * 支持模糊搜索、同义词搜索、拼音搜索
 */
function enhancedSearch(query, knowledgeItem) {
  const lowerQuery = query.toLowerCase();
  const searchableText = [
    knowledgeItem.title,
    knowledgeItem.content,
    ...(knowledgeItem.keywords || []),
  ].join(" ").toLowerCase();
  
  // 1. 精确匹配
  if (searchableText.includes(lowerQuery)) return true;
  
  // 2. 模糊匹配（编辑距离）
  if (fuzzyMatch(lowerQuery, knowledgeItem.title.toLowerCase(), 0.6)) return true;
  if (knowledgeItem.keywords && knowledgeItem.keywords.some((k) => 
    fuzzyMatch(lowerQuery, k.toLowerCase(), 0.6)
  )) return true;
  
  // 3. 同义词搜索
  for (const [key, synonyms] of Object.entries(SYNONYM_MAP)) {
    if (lowerQuery.includes(key.toLowerCase())) {
      // 检查同义词是否在知识项中
      for (const synonym of synonyms) {
        if (searchableText.includes(synonym.toLowerCase())) return true;
      }
    }
  }
  
  // 4. 拼音搜索
  if (/^[a-z]+$/i.test(lowerQuery)) {
    // 如果查询是纯拼音，检查是否匹配拼音映射
    for (const [pinyin, chinese] of Object.entries(PINYIN_MAP)) {
      if (lowerQuery.includes(pinyin) && searchableText.includes(chinese)) {
        return true;
      }
    }
  }
  
  return false;
}

// 导出全局变量
// fuzzyMatch, levenshteinDistance, enhancedSearch, SYNONYM_MAP, PINYIN_MAP
