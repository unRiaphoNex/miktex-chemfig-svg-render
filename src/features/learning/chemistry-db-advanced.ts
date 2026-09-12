// ========== 更多外部数据库和药物设计 (v17.2.0) ==========
// 接入 ChEMBL、ZINC、DrugBank
// 化合物对比、药物设计辅助

class AdvancedChemistryDB {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000;
  }

  /**
   * 从 ChEMBL 查询化合物
   * ChEMBL: 生物活性数据库
   */
  async queryChEMBL(query) {
    const cacheKey = `chembl-${query.toLowerCase()}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      // ChEMBL API
      const searchUrl = `https://www.ebi.ac.uk/chembl/api/data/molecule/search?q=${encodeURIComponent(query)}&format=json&limit=5`;
      
      const response = await fetch(searchUrl);
      if (!response.ok) {
        throw new Error(`ChEMBL API 错误: ${response.status}`);
      }

      const data = await response.json();
      const molecules = data.molecules || [];
      
      if (molecules.length === 0) {
        throw new Error("ChEMBL 未找到化合物");
      }

      const result = molecules.map((mol) => ({
        chemblId: mol.molecule_chembl_id,
        name: mol.molecule_name,
        formula: mol.molecule_properties?.full_molecules_formula,
        molecularWeight: mol.molecule_properties?.mw_freebase,
        smiles: mol.structures?.[0]?.smiles,
        source: "ChEMBL",
      }));

      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (e) {
      console.error("[ChEMBL] 查询失败:", e);
      throw e;
    }
  }

  /**
   * 从 ZINC 查询化合物
   * ZINC: 可购买化合物数据库
   */
  async queryZINC(query) {
    const cacheKey = `zinc-${query.toLowerCase()}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      // ZINC 搜索 API
      const searchUrl = `https://zinc15.docking.org/substances/search/?q=${encodeURIComponent(query)}&output=json`;
      
      const response = await fetch(searchUrl);
      if (!response.ok) {
        throw new Error(`ZINC API 错误: ${response.status}`);
      }

      const data = await response.json();
      const substances = data.substances || [];
      
      const result = substances.slice(0, 5).map((sub) => ({
        zincId: sub.zinc_id,
        name: sub.name || sub.zinc_id,
        formula: sub.formula,
        molecularWeight: sub.mw,
        smiles: sub.smiles,
        source: "ZINC",
      }));

      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (e) {
      console.error("[ZINC] 查询失败:", e);
      throw e;
    }
  }

  /**
   * 子结构搜索（基于 SMARTS）
   */
  async substructureSearch(smarts, database = "pubchem") {
    if (typeof OCL === "undefined") {
      throw new Error("OCL 未加载");
    }

    try {
      // 解析 SMARTS
      const queryMol = OCL.Molecule.fromSmarts(smarts);
      
      // 搜索本地数据库中匹配的化合物
      const results = [];
      
      if (typeof EXTENDED_COMPOUND_CATEGORIES !== "undefined") {
        Object.keys(EXTENDED_COMPOUND_CATEGORIES).forEach((category) => {
          const compounds = EXTENDED_COMPOUND_CATEGORIES[category];
          compounds.forEach((compound) => {
            if (compound.smiles) {
              try {
                const mol = OCL.Molecule.fromSmiles(compound.smiles);
                if (mol.hasSubstructure(queryMol)) {
                  results.push({
                    ...compound,
                    category: category,
                    match: true,
                  });
                }
              } catch (e) {
                // 忽略解析错误
              }
            }
          });
        });
      }

      return results;
    } catch (e) {
      console.error("[SubstructureSearch] 搜索失败:", e);
      throw e;
    }
  }

  /**
   * 化合物对比
   */
  async compareCompounds(compoundNames) {
    const results = [];
    
    for (const name of compoundNames) {
      try {
        const dbService = new AdvancedExternalDBService();
        const data = await dbService.queryPubChemDetailed(name);
        results.push(data);
      } catch (e) {
        results.push({
          name: name,
          error: e.message,
        });
      }
    }

    // 生成对比表格
    return this.generateComparisonTable(results);
  }

  /**
   * 生成对比表格
   */
  generateComparisonTable(compounds) {
    const table = {
      headers: ["属性", ...compounds.map((c) => c.name || "未知")],
      rows: [
        {
          property: "分子式",
          values: compounds.map((c) => c.formula || "-"),
        },
        {
          property: "分子量",
          values: compounds.map((c) => c.molecularWeight || "-"),
        },
        {
          property: "LogP",
          values: compounds.map((c) => c.xLogP || "-"),
        },
        {
          property: "TPSA",
          values: compounds.map((c) => c.tpsa || "-"),
        },
        {
          property: "氢键供体",
          values: compounds.map((c) => c.hbd || "-"),
        },
        {
          property: "氢键受体",
          values: compounds.map((c) => c.hba || "-"),
        },
        {
          property: "Lipinski",
          values: compounds.map((c) => c.lipinski ? (c.lipinski.passes ? "✅" : "⚠️") : "-"),
        },
      ],
    };

    return table;
  }

  /**
   * 药物设计辅助：基于目标性质推荐化合物
   */
  async recommendByProperties(targetProperties) {
    const {
      targetMW = null,
      targetLogP = null,
      targetTPSA = null,
      maxHBD = null,
      maxHBA = null,
    } = targetProperties;

    const recommendations = [];
    
    // 搜索本地数据库中符合条件的化合物
    if (typeof EXTENDED_COMPOUND_CATEGORIES !== "undefined") {
      Object.keys(EXTENDED_COMPOUND_CATEGORIES).forEach((category) => {
        const compounds = EXTENDED_COMPOUND_CATEGORIES[category];
        compounds.forEach((compound) => {
          let score = 0;
          let matches = 0;
          
          // 分子量匹配
          if (targetMW && compound.molecularWeight) {
            const diff = Math.abs(compound.molecularWeight - targetMW);
            if (diff < 100) {
              score += (100 - diff) / 100;
              matches++;
            }
          }
          
          // LogP 匹配
          if (targetLogP && compound.logP) {
            const diff = Math.abs(compound.logP - targetLogP);
            if (diff < 2) {
              score += (2 - diff) / 2;
              matches++;
            }
          }
          
          if (matches > 0) {
            recommendations.push({
              ...compound,
              category: category,
              score: score / matches, // 平均得分
              matches: matches,
            });
          }
        });
      });
    }

    // 按得分排序
    return recommendations.sort((a, b) => b.score - a.score).slice(0, 20);
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear();
    new Notice("高级数据库缓存已清空", 2000);
  }
}

/**
 * 化合物对比模态框
 */
class CompoundCompareModal extends Modal {
  constructor(app, compounds = []) {
    super(app);
    this.compounds = compounds;
    this.dbService = new AdvancedChemistryDB();
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("compound-compare-modal");

    contentEl.createEl("h2", { text: "⚖️ 化合物对比" });

    // 输入框
    const inputRow = contentEl.createDiv({ cls: "compare-input-row" });
    
    const input = inputRow.createEl("input", {
      type: "text",
      placeholder: "输入化合物名称，用逗号分隔",
      cls: "compare-input",
    });

    const compareBtn = inputRow.createEl("button", {
      text: "对比",
      cls: "compare-btn",
    });

    // 结果区域
    this.resultsContainer = contentEl.createDiv({ cls: "compare-results" });

    // 对比事件
    compareBtn.onclick = async () => {
      const names = input.value.split(",").map((n) => n.trim()).filter((n) => n);
      if (names.length < 2) {
        new Notice("请至少输入 2 个化合物", 2000);
        return;
      }

      this.resultsContainer.empty();
      this.resultsContainer.createDiv({ text: "正在查询..." });

      try {
        const table = await this.dbService.compareCompounds(names);
        this.renderComparisonTable(table);
      } catch (e) {
        this.resultsContainer.empty();
        this.resultsContainer.createDiv({
          text: `对比失败: ${e.message}`,
          cls: "compare-error",
        });
      }
    };
  }

  renderComparisonTable(table) {
    this.resultsContainer.empty();

    // 创建表格
    const tableEl = this.resultsContainer.createEl("table", { cls: "comparison-table" });
    
    // 表头
    const thead = tableEl.createEl("thead");
    const headerRow = thead.createEl("tr");
    table.headers.forEach((header) => {
      headerRow.createEl("th", { text: header });
    });

    // 表体
    const tbody = tableEl.createEl("tbody");
    table.rows.forEach((row) => {
      const tr = tbody.createEl("tr");
      tr.createEl("td", { text: row.property, cls: "property-name" });
      row.values.forEach((value) => {
        tr.createEl("td", { text: value });
      });
    });
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// 导出全局变量
// AdvancedChemistryDB, CompoundCompareModal
