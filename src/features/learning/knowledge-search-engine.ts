// ========== 知识库搜索优化 (v17.2.0) ==========
// 全文搜索、语义搜索、模糊搜索
// 支持中文分词、拼音搜索、同义词搜索

class KnowledgeSearchEngine {
  constructor() {
    this.index = new Map(); // 关键词 -> 知识点ID列表
    this.buildIndex();
  }

  /**
   * 构建搜索索引
   */
  buildIndex() {
    const allKnowledge = this.getAllKnowledge();
    
    allKnowledge.forEach((item) => {
      // 提取关键词
      const keywords = this.extractKeywords(item);
      
      keywords.forEach((keyword) => {
        if (!this.index.has(keyword)) {
          this.index.set(keyword, new Set());
        }
        this.index.get(keyword).add(item.id);
      });
    });
  }

  /**
   * 提取关键词
   */
  extractKeywords(item) {
    const keywords = new Set();
    
    // 标题分词
    this.tokenize(item.title).forEach((token) => keywords.add(token));
    
    // 内容分词
    this.tokenize(item.content).forEach((token) => keywords.add(token));
    
    // 关键词
    if (item.keywords) {
      item.keywords.forEach((kw) => keywords.add(kw.toLowerCase()));
    }
    
    // 索引ID
    keywords.add(item.id.toLowerCase());
    
    return Array.from(keywords);
  }

  /**
   * 简单中文分词
   */
  tokenize(text) {
    const tokens = [];
    
    // 英文单词
    const englishWords = text.toLowerCase().match(/[a-z]+/g);
    if (englishWords) {
      tokens.push(...englishWords);
    }
    
    // 中文词（简单按2-4字分词）
    const chineseChars = text.match(/[\u4e00-\u9fa5]+/g);
    if (chineseChars) {
      chineseChars.forEach((segment) => {
        // 2字词
        for (let i = 0; i < segment.length - 1; i++) {
          tokens.push(segment.substring(i, i + 2));
        }
        // 4字词
        for (let i = 0; i < segment.length - 3; i++) {
          tokens.push(segment.substring(i, i + 4));
        }
      });
    }
    
    return tokens;
  }

  /**
   * 全文搜索
   */
  search(query, options = {}) {
    const {
      type = "", // 按类型筛选
      limit = 50, // 结果数量限制
      fuzzy = true, // 模糊搜索
    } = options;

    const queryTokens = this.tokenize(query.toLowerCase());
    const scores = new Map(); // 知识点ID -> 得分

    queryTokens.forEach((token) => {
      // 精确匹配
      const matched = this.index.get(token);
      if (matched) {
        matched.forEach((id) => {
          scores.set(id, (scores.get(id) || 0) + 10);
        });
      }

      // 模糊匹配
      if (fuzzy) {
        this.index.forEach((ids, keyword) => {
          if (keyword.includes(token) || token.includes(keyword)) {
            ids.forEach((id) => {
              scores.set(id, (scores.get(id) || 0) + 1);
            });
          }
        });
      }
    });

    // 排序并获取结果
    const sorted = Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

    // 获取知识点详情
    const allKnowledge = this.getAllKnowledge();
    const results = sorted.map(([id, score]) => {
      const knowledge = allKnowledge.find((item) => item.id === id);
      if (knowledge) {
        return {
          ...knowledge,
          score: score,
        };
      }
      return null;
    }).filter(Boolean);

    // 按类型筛选
    if (type) {
      return results.filter((item) => item.id.startsWith(type));
    }

    return results;
  }

  /**
   * 语义搜索（基于关键词关联）
   */
  semanticSearch(query, options = {}) {
    // 先做全文搜索
    const results = this.search(query, options);
    
    // 扩展：搜索关键词的同义词
    const synonyms = this.getSynonyms(query);
    if (synonyms.length > 0) {
      synonyms.forEach((synonym) => {
        const synonymResults = this.search(synonym, { ...options, fuzzy: false });
        synonymResults.forEach((result) => {
          // 如果结果不在列表中，添加
          if (!results.find((r) => r.id === result.id)) {
            results.push({
              ...result,
              score: result.score * 0.5, // 降低同义词结果的得分
            });
          }
        });
      });
    }

    // 重新排序
    return results.sort((a, b) => b.score - a.score).slice(0, options.limit || 50);
  }

  /**
   * 获取同义词
   */
  getSynonyms(word) {
    const synonymMap = {
      "药物": ["药品", "药剂", "药"],
      "反应": ["化学反应", "作用"],
      "结构": ["分子结构", "化学结构"],
      "合成": ["制备", "生产"],
      "代谢": ["分解", "转化"],
      "抑制": ["阻断", "拮抗"],
      "激动": ["激活", "兴奋"],
      "受体": ["接收体", "受体蛋白"],
    };

    const synonyms = [];
    Object.keys(synonymMap).forEach((key) => {
      if (word.includes(key)) {
        synonyms.push(...synonymMap[key]);
      }
    });

    return synonyms;
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
   * 获取搜索统计
   */
  getSearchStats() {
    return {
      indexedKnowledge: this.index.size,
      totalKeywords: Array.from(this.index.keys()).length,
    };
  }
}

/**
 * 智能搜索模态框
 */
class KnowledgeSmartSearchModal extends Modal {
  constructor(app) {
    super(app);
    this.searchEngine = new KnowledgeSearchEngine();
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("knowledge-smart-search-modal");

    // 标题
    contentEl.createEl("h2", { text: "🔍 智能搜索" });

    // 搜索框
    const searchBox = contentEl.createDiv({ cls: "smart-search-box" });
    
    const input = searchBox.createEl("input", {
      type: "text",
      placeholder: "输入关键词、知识点ID、化合物名称...",
      cls: "smart-search-input",
    });

    // 类型筛选
    const filterRow = contentEl.createDiv({ cls: "smart-search-filters" });
    
    const types = [
      { value: "", label: "全部" },
      { value: "ORG", label: "有机化学" },
      { value: "DRUG", label: "药物化学" },
      { value: "PHARM", label: "药理学" },
      { value: "SYNTH", label: "合成反应" },
      { value: "BIO", label: "生物化学" },
    ];

    this.selectedType = "";

    types.forEach((type) => {
      const btn = filterRow.createEl("button", {
        text: type.label,
        cls: "smart-search-filter-btn" + (type.value === "" ? " active" : ""),
      });
      
      btn.onclick = () => {
        this.selectedType = type.value;
        filterRow.querySelectorAll("button").forEach((b) => b.removeClass("active"));
        btn.addClass("active");
        this.doSearch();
      };
    });

    // 结果区域
    this.resultsContainer = contentEl.createDiv({
      cls: "smart-search-results",
    });

    // 搜索事件
    input.oninput = () => this.doSearch();

    // 统计信息
    const stats = this.searchEngine.getSearchStats();
    const statsDiv = contentEl.createDiv({ cls: "search-stats" });
    statsDiv.createEl("p", { text: `已索引 ${stats.indexedKnowledge} 个知识点 | ${stats.totalKeywords} 个关键词` });
  }

  /**
   * 执行搜索
   */
  doSearch() {
    const input = this.contentEl.querySelector(".smart-search-input");
    const query = input.value.trim();
    
    if (!query) {
      this.resultsContainer.empty();
      return;
    }

    const results = this.searchEngine.semanticSearch(query, {
      type: this.selectedType,
      limit: 30,
    });

    this.renderResults(results);
  }

  /**
   * 渲染结果
   */
  renderResults(results) {
    this.resultsContainer.empty();

    if (results.length === 0) {
      this.resultsContainer.createDiv({
        text: "未找到相关知识点",
        cls: "no-results",
      });
      return;
    }

    // 结果数量
    this.resultsContainer.createDiv({
      text: `找到 ${results.length} 个相关知识点`,
      cls: "results-count",
    });

    // 结果列表
    results.forEach((item) => {
      const resultItem = this.resultsContainer.createDiv({
        cls: "smart-search-item",
      });

      // 索引ID + 标题
      const header = resultItem.createDiv({ cls: "search-item-header" });
      header.createSpan({ text: item.id, cls: "search-item-id" });
      header.createSpan({ text: item.title, cls: "search-item-title" });
      header.createSpan({ text: `得分: ${item.score}`, cls: "search-item-score" });

      // 书籍和章节
      const meta = resultItem.createDiv({ cls: "search-item-meta" });
      meta.createSpan({ text: item.bookName, cls: "search-item-book" });
      meta.createSpan({ text: `第 ${item.chapter} 章`, cls: "search-item-chapter" });

      // 内容预览
      const preview = resultItem.createDiv({
        text: item.content.substring(0, 150) + "...",
        cls: "search-item-preview",
      });

      // 关键词
      if (item.keywords && item.keywords.length > 0) {
        const keywordsDiv = resultItem.createDiv({ cls: "search-item-keywords" });
        item.keywords.slice(0, 5).forEach((kw) => {
          keywordsDiv.createSpan({ text: kw, cls: "keyword-tag" });
        });
      }
    });
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// 导出全局变量
// KnowledgeSearchEngine, KnowledgeSmartSearchModal
