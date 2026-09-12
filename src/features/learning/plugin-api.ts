// ========== 插件 API 接口 (v17.2.0) ==========
// 提供 API 接口供其他插件调用
// 通过 window.chemfigAPI 访问

class ChemfigAPI {
  constructor(plugin) {
    this.plugin = plugin;
    this.dbService = new ExternalDatabaseService();
    this.learningManager = new KnowledgeLearningManager(plugin);
    this.achievementManager = new AchievementManager(plugin);
  }

  /**
   * 初始化 API
   */
  init() {
    window.chemfigAPI = {
      // 知识库 API
      knowledge: {
        search: (query, type) => this.searchKnowledge(query, type),
        getById: (id) => this.getKnowledgeById(id),
        getRelations: (id) => getKnowledgeRelations(id),
        import: (content, format) => this.importKnowledge(content, format),
        export: () => this.exportKnowledge(),
      },

      // 学习 API
      learning: {
        markAsLearned: (id, level) => this.learningManager.markAsLearned(id, level),
        getStatus: (id) => this.learningManager.getKnowledgeStatus(id),
        getDueForReview: (days) => this.learningManager.getDueForReview(days),
        getStats: () => this.learningManager.getStats(),
      },

      // 成就 API
      achievements: {
        getAll: () => this.achievementManager.getAllAchievements(),
        check: () => this.achievementManager.checkAchievements(this.learningManager.getStats()),
      },

      // 外部数据库 API
      externalDB: {
        queryPubChem: (query) => this.dbService.queryPubChem(query),
        queryBySmiles: (smiles) => this.dbService.queryPubChemBySmiles(smiles),
        searchLocal: (query) => this.dbService.searchLocalDatabase(query),
        comprehensiveSearch: (query) => this.dbService.comprehensiveSearch(query),
      },

      // 渲染 API
      render: {
        renderChemfig: (code, options) => this.renderChemfig(code, options),
        renderSmiles: (smiles, options) => this.renderSmiles(smiles, options),
      },

      // 版本信息
      version: "17.2.0",
    };

    console.log("[ChemfigAPI] API 已初始化，可通过 window.chemfigAPI 访问");
  }

  /**
   * 搜索知识点
   */
  searchKnowledge(query, type = "") {
    const allDatabases = [
      TEXTBOOK_KNOWLEDGE_BASE,
      EXTENDED_TEXTBOOK_KNOWLEDGE,
      TEXTBOOK_KNOWLEDGE_EXPANSION_2,
      TEXTBOOK_KNOWLEDGE_EXPANSION_3,
    ];

    const results = [];

    allDatabases.forEach((db) => {
      Object.keys(db).forEach((bookName) => {
        const book = db[bookName];
        const bookCode = book.bookCode;

        if (type && bookCode !== type) return;

        book.chapters.forEach((chapter) => {
          chapter.sections.forEach((section) => {
            if (query) {
              const lowerQuery = query.toLowerCase();
              const match =
                section.title.toLowerCase().includes(lowerQuery) ||
                section.content.toLowerCase().includes(lowerQuery) ||
                (section.keywords && section.keywords.some((k) => k.toLowerCase().includes(lowerQuery)));

              if (!match) return;
            }

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
   * 根据 ID 获取知识点
   */
  getKnowledgeById(id) {
    const allDatabases = [
      TEXTBOOK_KNOWLEDGE_BASE,
      EXTENDED_TEXTBOOK_KNOWLEDGE,
      TEXTBOOK_KNOWLEDGE_EXPANSION_2,
      TEXTBOOK_KNOWLEDGE_EXPANSION_3,
    ];

    for (const db of allDatabases) {
      for (const bookName of Object.keys(db)) {
        const book = db[bookName];
        for (const chapter of book.chapters) {
          for (const section of chapter.sections) {
            if (section.id === id) {
              return {
                ...section,
                bookName: bookName.replace(/-扩展.*/, ""),
                chapter: chapter.chapter,
              };
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * 导入知识点
   */
  async importKnowledge(content, format = "json") {
    const importer = new KnowledgeImporter(this.plugin);
    
    switch (format.toLowerCase()) {
      case "json":
        return await importer.importFromJSON(content);
      case "markdown":
      case "md":
        return await importer.importFromMarkdown(content);
      case "csv":
        return await importer.importFromCSV(content);
      default:
        throw new Error(`不支持的格式: ${format}`);
    }
  }

  /**
   * 导出知识点
   */
  async exportKnowledge() {
    const exporter = new KnowledgeExporter(this.plugin);
    return await exporter.exportAll();
  }

  /**
   * 渲染 chemfig 代码
   */
  async renderChemfig(code, options = {}) {
    // 调用插件的渲染服务
    if (this.plugin && this.plugin.bridgeClient) {
      try {
        const result = await this.plugin.bridgeClient.renderChemfig(code, options);
        return result;
      } catch (e) {
        console.error("[ChemfigAPI] 渲染失败:", e);
        throw e;
      }
    }
    throw new Error("渲染服务未初始化");
  }

  /**
   * 渲染 SMILES
   */
  async renderSmiles(smiles, options = {}) {
    // 调用 OCL 渲染
    if (typeof OCL !== "undefined") {
      try {
        const mol = OCL.Molecule.fromSmiles(smiles);
        const svg = mol.toSVG(400, 300);
        return { svg: svg, smiles: smiles };
      } catch (e) {
        console.error("[ChemfigAPI] SMILES 渲染失败:", e);
        throw e;
      }
    }
    throw new Error("OCL 未加载");
  }

  /**
   * 销毁 API
   */
  destroy() {
    if (window.chemfigAPI) {
      delete window.chemfigAPI;
    }
  }
}

// 导出全局变量
// ChemfigAPI
