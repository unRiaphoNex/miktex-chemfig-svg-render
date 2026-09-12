// ========== 外部数据库集成 (v17.2.0) ==========
// 接入 PubChem、DrugBank 等外部数据库
// 支持查询化合物信息、SMILES、分子式等

class ExternalDatabaseService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24小时缓存
  }

  /**
   * 从 PubChem 查询化合物信息
   * @param {string} query 化合物名称或分子式
   */
  async queryPubChem(query) {
    const cacheKey = `pubchem-${query.toLowerCase()}`;
    
    // 检查缓存
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      // PubChem REST API
      const searchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/property/IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES,IsomericSMILES/JSON`;
      
      const response = await fetch(searchUrl);
      if (!response.ok) {
        throw new Error(`PubChem API 错误: ${response.status}`);
      }

      const data = await response.json();
      const properties = data.PropertyTable?.Properties?.[0];
      
      if (!properties) {
        throw new Error("未找到化合物信息");
      }

      const result = {
        name: properties.IUPACName || query,
        formula: properties.MolecularFormula,
        molecularWeight: properties.MolecularWeight,
        canonicalSmiles: properties.CanonicalSMILES,
        isomericSmiles: properties.IsomericSMILES,
        source: "PubChem",
      };

      // 缓存结果
      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (e) {
      console.error("[ExternalDB] PubChem 查询失败:", e);
      throw e;
    }
  }

  /**
   * 从 PubChem 通过 SMILES 查询
   * @param {string} smiles SMILES 字符串
   */
  async queryPubChemBySmiles(smiles) {
    const cacheKey = `pubchem-smiles-${smiles}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      const searchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/property/IUPACName,MolecularFormula,MolecularWeight/JSON`;
      
      const response = await fetch(searchUrl);
      if (!response.ok) {
        throw new Error(`PubChem API 错误: ${response.status}`);
      }

      const data = await response.json();
      const properties = data.PropertyTable?.Properties?.[0];
      
      if (!properties) {
        throw new Error("未找到化合物信息");
      }

      const result = {
        name: properties.IUPACName,
        formula: properties.MolecularFormula,
        molecularWeight: properties.MolecularWeight,
        source: "PubChem",
      };

      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (e) {
      console.error("[ExternalDB] PubChem SMILES 查询失败:", e);
      throw e;
    }
  }

  /**
   * 从本地数据库搜索
   * @param {string} query 搜索关键词
   */
  async searchLocalDatabase(query) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    // 搜索扩展化合物数据库
    if (typeof EXTENDED_COMPOUND_CATEGORIES !== "undefined") {
      Object.keys(EXTENDED_COMPOUND_CATEGORIES).forEach((category) => {
        const compounds = EXTENDED_COMPOUND_CATEGORIES[category];
        compounds.forEach((compound) => {
          if (
            compound.name.toLowerCase().includes(lowerQuery) ||
            (compound.formula && compound.formula.toLowerCase().includes(lowerQuery)) ||
            (compound.smiles && compound.smiles.toLowerCase().includes(lowerQuery))
          ) {
            results.push({
              ...compound,
              category: category,
              source: "本地数据库",
            });
          }
        });
      });
    }

    return results;
  }

  /**
   * 综合搜索
   * 先搜索本地数据库，再搜索外部数据库
   */
  async comprehensiveSearch(query) {
    const results = {
      local: [],
      external: null,
    };

    // 本地搜索
    try {
      results.local = await this.searchLocalDatabase(query);
    } catch (e) {
      console.warn("[ExternalDB] 本地搜索失败:", e);
    }

    // 外部搜索
    try {
      results.external = await this.queryPubChem(query);
    } catch (e) {
      console.warn("[ExternalDB] 外部搜索失败:", e);
    }

    return results;
  }

  /**
   * 保存外部查询结果到本地
   */
  async saveToLocalDatabase(query, data) {
    // 保存到 localStorage
    const storageKey = "chemfig-external-compounds";
    let existing = [];
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        existing = JSON.parse(saved);
      }
    } catch (e) {
      existing = [];
    }

    // 添加新化合物
    existing.push({
      query: query,
      ...data,
      savedAt: Date.now(),
    });

    localStorage.setItem(storageKey, JSON.stringify(existing));
  }

  /**
   * 获取已保存的外部化合物
   */
  getSavedCompounds() {
    try {
      const saved = localStorage.getItem("chemfig-external-compounds");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("[ExternalDB] 读取保存的化合物失败:", e);
    }
    return [];
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear();
    new Notice("外部数据库缓存已清空", 2000);
  }
}

/**
 * 外部数据库搜索模态框
 */
class ExternalDBSearchModal extends Modal {
  constructor(app) {
    super(app);
    this.dbService = new ExternalDatabaseService();
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("external-db-search-modal");

    contentEl.createEl("h2", { text: "🔍 外部数据库搜索" });

    // 搜索栏
    const searchBar = contentEl.createDiv({ cls: "external-search-bar" });
    
    const searchInput = searchBar.createEl("input", {
      type: "text",
      placeholder: "输入化合物名称、分子式或 SMILES...",
      cls: "external-search-input",
    });

    const searchBtn = searchBar.createEl("button", {
      text: "搜索",
      cls: "external-search-btn",
    });

    // 结果区域
    this.resultsContainer = contentEl.createDiv({ cls: "external-results" });

    // 搜索事件
    const doSearch = async () => {
      const query = searchInput.value.trim();
      if (!query) return;

      this.resultsContainer.empty();
      this.resultsContainer.createDiv({
        text: "搜索中...",
        cls: "searching",
      });

      try {
        const results = await this.dbService.comprehensiveSearch(query);
        this.renderResults(results);
      } catch (e) {
        this.resultsContainer.empty();
        this.resultsContainer.createDiv({
          text: `搜索失败: ${e.message}`,
          cls: "search-error",
        });
      }
    };

    searchBtn.onclick = doSearch;
    searchInput.onkeydown = (e) => {
      if (e.key === "Enter") doSearch();
    };
  }

  renderResults(results) {
    this.resultsContainer.empty();

    // 本地结果
    if (results.local.length > 0) {
      this.resultsContainer.createEl("h3", { text: `本地数据库 (${results.local.length})` });
      
      results.local.forEach((compound) => {
        const item = this.resultsContainer.createDiv({ cls: "external-result-item" });
        item.createDiv({ text: compound.name, cls: "result-name" });
        if (compound.formula) {
          item.createDiv({ text: `分子式: ${compound.formula}`, cls: "result-formula" });
        }
        item.createDiv({ text: `分类: ${compound.category}`, cls: "result-category" });
      });
    }

    // 外部结果
    if (results.external) {
      this.resultsContainer.createEl("h3", { text: "PubChem" });
      
      const item = this.resultsContainer.createDiv({ cls: "external-result-item pubchem" });
      item.createDiv({ text: results.external.name, cls: "result-name" });
      item.createDiv({ text: `分子式: ${results.external.formula}`, cls: "result-formula" });
      item.createDiv({ text: `分子量: ${results.external.molecularWeight}`, cls: "result-mw" });
      if (results.external.canonicalSmiles) {
        item.createDiv({ text: `SMILES: ${results.external.canonicalSmiles}`, cls: "result-smiles" });
      }

      // 保存到本地按钮
      const saveBtn = item.createEl("button", {
        text: "保存到本地库",
        cls: "save-to-local-btn",
      });
      
      saveBtn.onclick = async () => {
        await this.dbService.saveToLocalDatabase(results.external.name, results.external);
        new Notice("已保存到本地库", 2000);
      };
    }

    if (!results.external && results.local.length === 0) {
      this.resultsContainer.createDiv({
        text: "未找到相关化合物",
        cls: "no-results",
      });
    }
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// 导出全局变量
// ExternalDatabaseService, ExternalDBSearchModal
