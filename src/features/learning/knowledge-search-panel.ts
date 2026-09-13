// ========== 知识库搜索面板 (v17.2.0) ==========
// 集成到分子编辑器中的知识库搜索面板
// 功能：搜索知识点、查看详情、关联化合物/反应/药物

class KnowledgeSearchPanel {
  constructor(plugin, container) {
    this.plugin = plugin;
    this.container = container;
    this.currentPage = 0;
    this.pageSize = 10;
    this.currentResults = [];
  }

  render() {
    this.container.empty();
    this.container.addClass("knowledge-search-panel");

    // 搜索栏
    const searchBar = this.container.createDiv({ cls: "knowledge-search-bar" });
    
    const searchInput = searchBar.createEl("input", {
      type: "text",
      placeholder: "搜索知识点...",
      cls: "knowledge-search-input",
    });
    
    const searchBtn = searchBar.createEl("button", {
      text: "搜索",
      cls: "knowledge-search-btn",
    });

    // 类型筛选
    const filterBar = this.container.createDiv({ cls: "knowledge-filter-bar" });
    filterBar.createSpan({ text: "筛选:", cls: "filter-label" });
    
    const typeSelect = filterBar.createEl("select", { cls: "knowledge-type-select" });
    typeSelect.createEl("option", { text: "全部", value: "" });
    typeSelect.createEl("option", { text: "有机化学", value: "ORG" });
    typeSelect.createEl("option", { text: "药物化学", value: "DRUG" });
    typeSelect.createEl("option", { text: "药理学", value: "PHARM" });
    typeSelect.createEl("option", { text: "药物合成", value: "SYNTH" });
    typeSelect.createEl("option", { text: "生物化学", value: "BIO" });

    // 结果区域
    this.resultsContainer = this.container.createDiv({ cls: "knowledge-results" });

    // 搜索事件
    searchBtn.onclick = () => this.search(searchInput.value, typeSelect.value);
    searchInput.onkeydown = (e) => {
      if (e.key === "Enter") this.search(searchInput.value, typeSelect.value);
    };
    typeSelect.onchange = () => this.search(searchInput.value, typeSelect.value);

    // 默认显示全部
    this.search("", "");
  }

  search(query, typeFilter) {
    this.currentResults = [];
    
    // 从所有知识库中搜索
    const allDatabases = [
      typeof TEXTBOOK_KNOWLEDGE_BASE !== "undefined" ? TEXTBOOK_KNOWLEDGE_BASE : {},
      typeof EXTENDED_TEXTBOOK_KNOWLEDGE !== "undefined" ? EXTENDED_TEXTBOOK_KNOWLEDGE : {},
      typeof TEXTBOOK_KNOWLEDGE_EXPANSION_2 !== "undefined" ? TEXTBOOK_KNOWLEDGE_EXPANSION_2 : {},
      typeof TEXTBOOK_KNOWLEDGE_EXPANSION_3 !== "undefined" ? TEXTBOOK_KNOWLEDGE_EXPANSION_3 : {},
      typeof TEXTBOOK_KNOWLEDGE_EXPANSION_4 !== "undefined" ? TEXTBOOK_KNOWLEDGE_EXPANSION_4 : {},
      typeof TEXTBOOK_KNOWLEDGE_EXPANSION_5 !== "undefined" ? TEXTBOOK_KNOWLEDGE_EXPANSION_5 : {},
      typeof TEXTBOOK_KNOWLEDGE_EXPANSION_6 !== "undefined" ? TEXTBOOK_KNOWLEDGE_EXPANSION_6 : {},
      typeof TEXTBOOK_EXPANSION_7 !== "undefined" ? TEXTBOOK_EXPANSION_7 : {},
      typeof TEXTBOOK_EXPANSION_8 !== "undefined" ? TEXTBOOK_EXPANSION_8 : {},
      typeof TEXTBOOK_COMPLETE !== "undefined" ? TEXTBOOK_COMPLETE : {},
    ];

    allDatabases.forEach((db) => {
      Object.keys(db).forEach((bookName) => {
        const book = db[bookName];
        const bookCode = book.bookCode;
        
        // 类型筛选
        if (typeFilter && bookCode !== typeFilter) return;

        book.chapters.forEach((chapter) => {
          chapter.sections.forEach((section) => {
            // 关键词匹配
            if (query) {
              const lowerQuery = query.toLowerCase();
              const match =
                section.title.toLowerCase().includes(lowerQuery) ||
                section.content.toLowerCase().includes(lowerQuery) ||
                (section.keywords && section.keywords.some((k) => k.toLowerCase().includes(lowerQuery)));
              
              if (!match) return;
            }

            this.currentResults.push({
              ...section,
              bookName: bookName.replace("-扩展", "").replace("-二次扩展", ""),
              chapter: chapter.chapter,
            });
          });
        });
      });
    });

    // 分页
    this.currentPage = 0;
    this.renderResults();
  }

  renderResults() {
    this.resultsContainer.empty();

    const start = this.currentPage * this.pageSize;
    const end = start + this.pageSize;
    const pageResults = this.currentResults.slice(start, end);

    if (this.currentResults.length === 0) {
      this.resultsContainer.createDiv({
        text: "未找到相关知识点",
        cls: "knowledge-empty",
      });
      return;
    }

    // 结果统计
    const stats = this.resultsContainer.createDiv({ cls: "knowledge-stats" });
    stats.createSpan({ text: `共找到 ${this.currentResults.length} 个知识点` });

    // 结果列表
    const resultsList = this.resultsContainer.createDiv({ cls: "knowledge-results-list" });

    pageResults.forEach((result) => {
      const item = resultsList.createDiv({ cls: "knowledge-item" });
      
      // 标题
      const titleEl = item.createDiv({ cls: "knowledge-item-title" });
      titleEl.createSpan({ text: result.id, cls: "knowledge-item-id" });
      titleEl.createSpan({ text: result.title, cls: "knowledge-item-name" });

      // 来源
      const sourceEl = item.createDiv({ cls: "knowledge-item-source" });
      sourceEl.createSpan({ text: `${result.bookName} - ${result.chapter}`, cls: "source-text" });

      // 内容预览
      const contentEl = item.createDiv({ cls: "knowledge-item-content" });
      contentEl.textContent = result.content.substring(0, 100) + (result.content.length > 100 ? "..." : "");

      // 关键词
      if (result.keywords && result.keywords.length > 0) {
        const keywordsEl = item.createDiv({ cls: "knowledge-item-keywords" });
        result.keywords.forEach((keyword) => {
          keywordsEl.createSpan({ text: keyword, cls: "keyword-tag" });
        });
      }

      // 点击展开详情
      item.onclick = () => this.showDetail(result);
    });

    // 分页
    if (this.currentResults.length > this.pageSize) {
      const pagination = this.resultsContainer.createDiv({ cls: "knowledge-pagination" });
      
      const prevBtn = pagination.createEl("button", {
        text: "上一页",
        cls: "page-btn",
      });
      prevBtn.disabled = this.currentPage === 0;
      prevBtn.onclick = () => {
        this.currentPage--;
        this.renderResults();
      };

      pagination.createSpan({
        text: `${this.currentPage + 1} / ${Math.ceil(this.currentResults.length / this.pageSize)}`,
        cls: "page-info",
      });

      const nextBtn = pagination.createEl("button", {
        text: "下一页",
        cls: "page-btn",
      });
      nextBtn.disabled = end >= this.currentResults.length;
      nextBtn.onclick = () => {
        this.currentPage++;
        this.renderResults();
      };
    }
  }

  showDetail(result) {
    // 显示详情模态框
    const modal = new Modal(this.plugin.app);
    modal.titleEl.setText(`📚 ${result.id} - ${result.title}`);
    
    const contentEl = modal.contentEl;
    contentEl.addClass("knowledge-detail-modal");

    // 来源
    const sourceEl = contentEl.createDiv({ cls: "detail-source" });
    sourceEl.createSpan({ text: "来源:", cls: "detail-label" });
    sourceEl.createSpan({ text: `${result.bookName} - ${result.chapter}`, cls: "detail-value" });

    // 内容
    const contentTitle = contentEl.createEl("h4", { text: "内容" });
    const contentText = contentEl.createDiv({ cls: "detail-content" });
    contentText.textContent = result.content;

    // 关键词
    if (result.keywords && result.keywords.length > 0) {
      const keywordsTitle = contentEl.createEl("h4", { text: "关键词" });
      const keywordsEl = contentEl.createDiv({ cls: "detail-keywords" });
      result.keywords.forEach((keyword) => {
        keywordsEl.createSpan({ text: keyword, cls: "keyword-tag" });
      });
    }

    // 操作按钮
    const actionsEl = contentEl.createDiv({ cls: "detail-actions" });
    
    const insertBtn = actionsEl.createEl("button", {
      text: "插入知识点",
      cls: "chemfig-action-btn",
    });
    insertBtn.onclick = () => {
      // 插入到编辑器
      const activeEditor = this.plugin.app.workspace.activeEditor;
      if (activeEditor && activeEditor.editor) {
        const snippet = `> [!note] ${result.id} ${result.title}\n> ${result.content}\n\n`;
        activeEditor.editor.replaceSelection(snippet);
      }
      modal.close();
    };

    modal.open();
  }
}

// 导出全局变量
// KnowledgeSearchPanel
