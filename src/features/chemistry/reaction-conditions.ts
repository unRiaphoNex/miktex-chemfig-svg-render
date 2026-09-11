// ========== 反应条件速查数据库 (v11.6.0) ==========
// 常见有机化学反应条件速查

const REACTION_CONDITIONS = [
  {
    id: "acid-catalyzed-hydration",
    name: "酸催化水合",
    reagents: ["H2SO4", "H3O+", "稀酸"],
    reactant: "烯烃",
    product: "醇",
    mechanism: "亲电加成",
    notes: "马氏规则，主要生成更稳定的碳正离子",
    example: "乙烯 + H2O → 乙醇",
  },
  {
    id: "alkaline-kmno4",
    name: "碱性高锰酸钾氧化",
    reagents: ["KMnO4", "OH-", "加热"],
    reactant: "烯烃",
    product: "邻二醇 / 酮 / 羧酸",
    mechanism: "氧化断裂",
    notes: "冷稀碱性 → 邻二醇；加热 → 断裂氧化",
    example: "乙烯 + KMnO4 → 乙二醇",
  },
  {
    id: "hbr-addition",
    name: "HBr 加成",
    reagents: ["HBr", "无过氧化物"],
    reactant: "烯烃",
    product: "溴代烷",
    mechanism: "亲电加成",
    notes: "马氏规则，H 加在氢多的碳上",
    example: "丙烯 + HBr → 2-溴丙烷",
  },
  {
    id: "hbr-peroxide",
    name: "HBr 过氧化物效应",
    reagents: ["HBr", "ROOR", "过氧化物"],
    reactant: "烯烃",
    product: "溴代烷",
    mechanism: "自由基加成",
    notes: "反马氏规则！Br 加在氢多的碳上",
    example: "丙烯 + HBr + ROOR → 1-溴丙烷",
  },
  {
    id: "hydroboration",
    name: "硼氢化氧化",
    reagents: ["1. BH3·THF", "2. H2O2/OH-"],
    reactant: "烯烃",
    product: "醇",
    mechanism: "协同加成",
    notes: "反马氏规则，顺式加成",
    example: "丙烯 → 1-丙醇",
  },
  {
    id: "osmium-tetroxide",
    name: "四氧化锇双羟基化",
    reagents: ["1. OsO4", "2. NaHSO3/H2O"],
    reactant: "烯烃",
    product: "邻二醇",
    mechanism: "协同环加成",
    notes: "顺式加成，产率高",
    example: "环己烯 → 顺-1,2-环己二醇",
  },
  {
    id: "ozonolysis",
    name: "臭氧化分解",
    reagents: ["1. O3", "2. Zn/H2O 或 DMS"],
    reactant: "烯烃",
    product: "醛 / 酮",
    mechanism: "氧化断裂",
    notes: "还原性分解 → 醛/酮；氧化性分解 → 羧酸",
    example: "乙烯 + O3 → 甲醛",
  },
  {
    id: "catalytic-hydrogenation",
    name: "催化加氢",
    reagents: ["H2", "Pd/C 或 Pt 或 Ni"],
    reactant: "烯烃 / 炔烃",
    product: "烷烃",
    mechanism: "催化氢化",
    notes: "顺式加成，顺式烯烃更快",
    example: "乙烯 + H2/Pd → 乙烷",
  },
  {
    id: "lindlar-catalyst",
    name: "Lindlar 催化顺式加氢",
    reagents: ["H2", "Lindlar 催化剂 (Pd/CaCO3/Pb)"],
    reactant: "炔烃",
    product: "顺式烯烃",
    mechanism: "部分加氢",
    notes: "停在烯烃阶段，顺式加成",
    example: "乙炔 + H2/Lindlar → 顺-2-丁烯",
  },
  {
    id: "sodium-liquid-ammonia",
    name: "钠/液氨还原",
    reagents: ["Na", "液 NH3"],
    reactant: "炔烃",
    product: "反式烯烃",
    mechanism: "溶解金属还原",
    notes: "反式加成，与 Lindlar 互补",
    example: "2-丁炔 + Na/NH3 → 反-2-丁烯",
  },
  {
    id: "free-radical-halogenation",
    name: "自由基卤代",
    reagents: ["Br2", "光照 (hν)"],
    reactant: "烷烃",
    product: "卤代烷",
    mechanism: "自由基取代",
    notes: "选择性: 3° > 2° > 1°；Cl 活泼，Br 选择性好",
    example: "丙烷 + Br2/hν → 2-溴丙烷",
  },
  {
    id: "sn1",
    name: "SN1 亲核取代",
    reagents: ["弱亲核试剂", "极性溶剂"],
    reactant: "叔卤代烷",
    product: "取代产物",
    mechanism: "单分子亲核取代",
    notes: "两步反应，碳正离子中间体；外消旋化",
    example: "叔丁基溴 + H2O → 叔丁醇",
  },
  {
    id: "sn2",
    name: "SN2 亲核取代",
    reagents: ["强亲核试剂", "极性非质子溶剂"],
    reactant: "伯卤代烷",
    product: "取代产物",
    mechanism: "双分子亲核取代",
    notes: "一步反应，背面进攻；构型翻转",
    example: "溴甲烷 + OH- → 甲醇",
  },
  {
    id: "e1",
    name: "E1 消除反应",
    reagents: ["弱碱", "极性溶剂", "加热"],
    reactant: "叔卤代烷",
    product: "烯烃",
    mechanism: "单分子消除",
    notes: "两步反应，碳正离子中间体；扎伊采夫规则",
    example: "叔丁基溴 + 醇加热 → 异丁烯",
  },
  {
    id: "e2",
    name: "E2 消除反应",
    reagents: ["强碱", "加热"],
    reactant: "卤代烷",
    product: "烯烃",
    mechanism: "双分子消除",
    notes: "一步反应，反式共平面；扎伊采夫规则",
    example: "2-溴丙烷 + KOH/醇加热 → 丙烯",
  },
  {
    id: "grignard",
    name: "格氏试剂制备",
    reagents: ["Mg", "无水乙醚"],
    reactant: "卤代烷",
    product: "格氏试剂 (RMgX)",
    mechanism: "金属插入",
    notes: "必须无水！活泼亲核试剂",
    example: "溴乙烷 + Mg → 乙基溴化镁",
  },
  {
    id: "grignard-carbonyl",
    name: "格氏试剂与羰基加成",
    reagents: ["1. RMgX", "2. H3O+"],
    reactant: "醛 / 酮",
    product: "醇",
    mechanism: "亲核加成",
    notes: "甲醛 → 伯醇；醛 → 仲醇；酮 → 叔醇",
    example: "乙醛 + CH3MgBr → 2-丙醇",
  },
  {
    id: "friedel-crafts-acylation",
    name: "Friedel-Crafts 酰基化",
    reagents: ["RCOCl", "AlCl3"],
    reactant: "芳烃",
    product: "芳基酮",
    mechanism: "亲电取代",
    notes: "不重排！引入酰基，傅-克酰基化",
    example: "苯 + 乙酰氯 + AlCl3 → 苯乙酮",
  },
  {
    id: "friedel-crafts-alkylation",
    name: "Friedel-Crafts 烷基化",
    reagents: ["RX", "AlCl3"],
    reactant: "芳烃",
    product: "烷基苯",
    mechanism: "亲电取代",
    notes: "碳正离子重排！可能有多烷基化",
    example: "苯 + 氯乙烷 + AlCl3 → 乙苯",
  },
  {
    id: "nitration",
    name: "芳烃硝化",
    reagents: ["浓 HNO3", "浓 H2SO4"],
    reactant: "芳烃",
    product: "硝基芳烃",
    mechanism: "亲电取代",
    notes: "亲电试剂: NO2+；吸电子基钝化",
    example: "苯 + 浓 HNO3/H2SO4 → 硝基苯",
  },
  // ========== 醇和醚的反应 ==========
  {
    id: "dehydration-alcohol",
    name: "醇脱水",
    reagents: ["浓 H2SO4", "加热"],
    reactant: "醇",
    product: "烯烃",
    mechanism: "E1 消除",
    notes: "扎伊采夫规则，生成更稳定烯烃",
    example: "乙醇 → 乙烯",
  },
  {
    id: "oxidation-primary-alcohol",
    name: "伯醇氧化",
    reagents: ["KMnO4/H+", "或 K2Cr2O7/H+"],
    reactant: "伯醇",
    product: "醛 → 羧酸",
    mechanism: "氧化反应",
    notes: "强氧化剂 → 羧酸；弱氧化剂 → 醛",
    example: "乙醇 + KMnO4 → 乙酸",
  },
  {
    id: "oxidation-secondary-alcohol",
    name: "仲醇氧化",
    reagents: ["K2Cr2O7/H+"],
    reactant: "仲醇",
    product: "酮",
    mechanism: "氧化反应",
    notes: "不能继续氧化",
    example: "2-丙醇 → 丙酮",
  },
  {
    id: "esterification",
    name: "酯化反应",
    reagents: ["羧酸", "醇", "浓 H2SO4 催化"],
    reactant: "羧酸 + 醇",
    product: "酯 + 水",
    mechanism: "亲核酰基取代",
    notes: "可逆反应，酸催化",
    example: "乙酸 + 乙醇 → 乙酸乙酯",
  },

  // ========== 芳香族反应 ==========
  {
    id: "electrophilic-substitution-benzene",
    name: "苯的亲电取代",
    reagents: ["E+ 亲电试剂"],
    reactant: "苯",
    product: "取代苯",
    mechanism: "亲电芳香取代 (EAS)",
    notes: "Friedel-Crafts/卤代/硝化/磺化",
    example: "苯 + Br2/FeBr3 → 溴苯",
  },
  // ========== 羰基化合物反应 ==========
  {
    id: "aldol-condensation",
    name: "羟醛缩合",
    reagents: ["稀 NaOH", "加热"],
    reactant: "醛/酮 (含 α-H)",
    product: "β-羟基醛/酮 → α,β-不饱和醛/酮",
    mechanism: "亲核加成-消除",
    notes: "两分子醛/酮加成",
    example: "2 分子乙醛 → β-羟基丁醛 → 巴豆醛",
  },
  {
    id: "wittig-reaction",
    name: "Wittig 反应",
    reagents: ["磷叶立德 Ph3P=CR2"],
    reactant: "醛/酮",
    product: "烯烃",
    mechanism: "亲核加成",
    notes: "高效构建 C=C 双键",
    example: "丙酮 + Ph3P=CH2 → 2-甲基丙烯",
  },
  {
    id: "grignard-reaction",
    name: "格氏反应",
    reagents: ["格氏试剂 RMgX", "醚溶剂"],
    reactant: "醛/酮/酯",
    product: "醇",
    mechanism: "亲核加成",
    notes: "甲醛 → 伯醇；醛 → 仲醇；酮/酯 → 叔醇",
    example: "乙醛 + CH3MgBr → 2-丙醇",
  },

  // ========== 羧酸衍生物 ==========
  {
    id: "nucleophilic-acyl-substitution",
    name: "亲核酰基取代",
    reagents: ["亲核试剂 Nu-"],
    reactant: "酰卤/酸酐/酯/酰胺",
    product: "取代产物",
    mechanism: "加成-消除",
    notes: "活性顺序: 酰卤 > 酸酐 > 酯 > 酰胺",
    example: "乙酰氯 + H2O → 乙酸",
  },
  {
    id: "saponification",
    name: "皂化反应",
    reagents: ["NaOH/H2O", "加热"],
    reactant: "酯 (油脂)",
    product: "羧酸钠 + 醇",
    mechanism: "碱性水解",
    notes: "油脂碱性水解制肥皂",
    example: "硬脂酸甘油酯 + NaOH → 硬脂酸钠 + 甘油",
  },

  // ========== 人名反应 ==========
  {
    id: "gabriel-synthesis",
    name: "Gabriel 合成法",
    reagents: ["邻苯二甲酰亚胺", "KOH", "卤代烷"],
    reactant: "卤代烷",
    product: "伯胺",
    mechanism: "SN2",
    notes: "制备纯伯胺，无仲/叔胺副产物",
    example: "1-溴丙烷 → 丙胺",
  },
  {
    id: "williamson-ether-synthesis",
    name: "Williamson 醚合成",
    reagents: ["醇钠/酚钠", "卤代烷"],
    reactant: "醇 + 卤代烷",
    product: "醚",
    mechanism: "SN2",
    notes: "最好用伯卤代烷",
    example: "乙醇钠 + 溴乙烷 → 乙醚",
  },
  {
    id: "pinacol-rearrangement",
    name: "频哪醇重排",
    reagents: ["酸催化"],
    reactant: "邻二醇",
    product: "酮",
    mechanism: "碳正离子重排",
    notes: "生成更稳定碳正离子的基团迁移",
    example: "频哪醇 → 频哪酮",
  },
];

// ========== 反应条件速查查询界面 ==========
class ReactionConditionsModal extends Modal {
  constructor(app) {
    super(app);
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("chemfig-reaction-modal");

    contentEl.createEl("h2", { text: "🧪 反应条件速查" });
    contentEl.createEl("p", {
      text: "输入试剂或反应类型，查询常见有机反应",
      cls: "chemfig-modal-desc",
    });

    // 搜索框
    const searchInput = contentEl.createEl("input", {
      type: "text",
      placeholder: "输入试剂/反应名，如 HBr、SN1、加氢...",
      cls: "chemfig-search-input",
    });

    // 结果列表
    const resultsEl = contentEl.createDiv({ cls: "chemfig-reaction-results" });

    // 初始显示全部
    this.renderResults(resultsEl, REACTION_CONDITIONS);

    // 搜索事件
    searchInput.addEventListener("input", (e) => {
      const query = e.target.value.toLowerCase().trim();
      if (!query) {
        this.renderResults(resultsEl, REACTION_CONDITIONS);
        return;
      }

      const filtered = REACTION_CONDITIONS.filter((rc) => {
        return (
          rc.name.toLowerCase().includes(query) ||
          rc.reactant.toLowerCase().includes(query) ||
          rc.product.toLowerCase().includes(query) ||
          rc.mechanism.toLowerCase().includes(query) ||
          rc.reagents.some((r) => r.toLowerCase().includes(query))
        );
      });
      this.renderResults(resultsEl, filtered);
    });
  }

  renderResults(container, list) {
    container.empty();

    if (list.length === 0) {
      container.createEl("p", {
        text: "未找到匹配的反应，请尝试其他关键词",
        cls: "chemfig-no-result",
      });
      return;
    }

    list.forEach((rc) => {
      const card = container.createDiv({ cls: "chemfig-reaction-card" });

      card.createEl("h4", { text: rc.name });

      const info = card.createDiv({ cls: "chemfig-reaction-info" });
      info.createEl("p", { text: `反应物: ${rc.reactant}` });
      info.createEl("p", { text: `产物: ${rc.product}` });
      info.createEl("p", { text: `机理: ${rc.mechanism}` });
      info.createEl("p", { text: `试剂: ${rc.reagents.join(", ")}` });

      if (rc.notes) {
        const notes = card.createEl("p", {
          text: `⚠️ ${rc.notes}`,
          cls: "chemfig-reaction-notes",
        });
      }

      if (rc.example) {
        card.createEl("p", {
          text: `例: ${rc.example}`,
          cls: "chemfig-reaction-example",
        });
      }
    });
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// 导出
// REACTION_CONDITIONS, ReactionConditionsModal
