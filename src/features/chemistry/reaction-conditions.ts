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
  // ========== v14.0.0: 扩展反应数据库 ==========
  {
    id: "friedel-crafts-acylation",
    name: "Friedel-Crafts 酰基化",
    reagents: ["RCOCl", "AlCl3"],
    reactant: "芳烃",
    product: "芳基酮",
    mechanism: "亲电取代",
    notes: "不会重排，可用于制备直链烷基苯",
    example: "苯 + CH3COCl → 苯乙酮",
  },
  {
    id: "friedel-crafts-alkylation",
    name: "Friedel-Crafts 烷基化",
    reagents: ["RX", "AlCl3"],
    reactant: "芳烃",
    product: "烷基苯",
    mechanism: "亲电取代",
    notes: "易发生碳正离子重排",
    example: "苯 + CH3CH2Cl → 乙苯",
  },
  {
    id: "grignard-reaction",
    name: "格氏反应",
    reagents: ["1. RMgX", "2. H3O+"],
    reactant: "醛 / 酮 / 酯",
    product: "醇",
    mechanism: "亲核加成",
    notes: "甲醛 → 伯醇；醛 → 仲醇；酮 → 叔醇",
    example: "乙醛 + CH3MgBr → 2-丙醇",
  },
  {
    id: "wittig-reaction",
    name: "Wittig 反应",
    reagents: ["Ph3P=CHR"],
    reactant: "醛 / 酮",
    product: "烯烃",
    mechanism: "羰基烯化",
    notes: "确定位置的双键形成",
    example: "苯甲醛 + Ph3P=CH2 → 苯乙烯",
  },
  {
    id: "diels-alder",
    name: "Diels-Alder 反应",
    reagents: ["加热", "无溶剂"],
    reactant: "二烯 + 亲二烯体",
    product: "环己烯衍生物",
    mechanism: "[4+2] 环加成",
    notes: "协同反应，顺式加成，内型规则",
    example: "环戊二烯 + 马来酸酐 → 降冰片烯",
  },
  {
    id: "sn1-reaction",
    name: "SN1 亲核取代",
    reagents: ["弱亲核试剂", "极性溶剂"],
    reactant: "叔卤代烷",
    product: "取代产物",
    mechanism: "单分子亲核取代",
    notes: "外消旋化；三级 > 二级 > 一级",
    example: "叔丁基氯 + H2O → 叔丁醇",
  },
  {
    id: "sn2-reaction",
    name: "SN2 亲核取代",
    reagents: ["强亲核试剂", "极性非质子溶剂"],
    reactant: "伯卤代烷",
    product: "取代产物",
    mechanism: "双分子亲核取代",
    notes: "构型翻转；一级 > 二级 > 三级",
    example: "CH3Br + OH- → CH3OH",
  },
  {
    id: "e1-elimination",
    name: "E1 消除",
    reagents: ["弱碱", "极性溶剂", "加热"],
    reactant: "叔卤代烷",
    product: "烯烃",
    mechanism: "单分子消除",
    notes: "Zaitsev 规则；常与 SN1 竞争",
    example: "叔丁基氯 + 乙醇 → 异丁烯",
  },
  {
    id: "e2-elimination",
    name: "E2 消除",
    reagents: ["强碱", "极性非质子溶剂"],
    reactant: "卤代烷",
    product: "烯烃",
    mechanism: "双分子消除",
    notes: "反式共平面；Zaitsev 规则",
    example: "2-溴丙烷 + KOH → 丙烯",
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
