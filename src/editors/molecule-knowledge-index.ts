// ========== 分子编辑器知识库索引面板 (v17.2.0) ==========
// 在分子编辑器中加入知识库索引系统
// 支持按索引编号查询、搜索知识点

class MoleculeKnowledgeIndexPanel {
  constructor(container, plugin) {
    this.container = container;
    this.plugin = plugin;
    this.searchInput = null;
    this.resultsContainer = null;
    this.selectedType = "all";
  }

  /**
   * 初始化面板
   */
  init() {
    this.render();
  }

  /**
   * 渲染面板
   */
  render() {
    const { container } = this;
    container.empty();

    // 标题
    container.createEl("h4", {
      text: "📚 知识库索引",
      cls: "knowledge-index-title",
    });

    // 搜索框
    const searchBox = container.createDiv({ cls: "knowledge-index-search" });
    
    this.searchInput = searchBox.createEl("input", {
      type: "text",
      placeholder: "搜索知识点或输入索引编号...",
      cls: "knowledge-index-input",
    });

    // 类型筛选
    const filterRow = container.createDiv({ cls: "knowledge-index-filters" });
    
    const types = [
      { value: "all", label: "全部" },
      { value: "ORG", label: "有机化学" },
      { value: "DRUG", label: "药物化学" },
      { value: "PHARM", label: "药理学" },
      { value: "SYNTH", label: "合成反应" },
      { value: "BIO", label: "生物化学" },
    ];

    types.forEach((type) => {
      const btn = filterRow.createEl("button", {
        text: type.label,
        cls: "knowledge-index-filter-btn" + (type.value === "all" ? " active" : ""),
      });
      
      btn.onclick = () => {
        this.selectedType = type.value;
        // 更新按钮状态
        filterRow.querySelectorAll("button").forEach((b) => b.removeClass("active"));
        btn.addClass("active");
        this.searchKnowledge();
      };
    });

    // 搜索事件
    this.searchInput.oninput = () => this.searchKnowledge();

    // 结果区域
    this.resultsContainer = container.createDiv({
      cls: "knowledge-index-results",
    });

    // 默认显示全部
    this.searchKnowledge();
  }

  /**
   * 搜索知识点
   */
  searchKnowledge() {
    const query = this.searchInput.value.trim().toLowerCase();
    
    // 从所有数据库中搜索
    const allKnowledge = this.getAllKnowledge();
    let results = allKnowledge;

    // 按类型筛选
    if (this.selectedType !== "all") {
      results = results.filter((item) => 
        item.id.startsWith(this.selectedType)
      );
    }

    // 按关键词搜索
    if (query) {
      results = results.filter((item) => {
        return (
          item.id.toLowerCase().includes(query) ||
          item.title.toLowerCase().includes(query) ||
          item.content.toLowerCase().includes(query) ||
          (item.keywords && item.keywords.some((k) => k.toLowerCase().includes(query)))
        );
      });
    }

    // 显示结果
    this.renderResults(results.slice(0, 50)); // 限制显示50条
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
    ];

    const results = [];

    allDatabases.forEach((db) => {
      Object.keys(db).forEach((bookName) => {
        const book = db[bookName];
        const bookCode = book.bookCode;

        book.chapters.forEach((chapter) => {
          chapter.sections.forEach((section) => {
            results.push({
              ...section,
              bookName: bookName.replace(/-扩展.*/, ""),
              chapter: chapter.chapter,
              bookCode: bookCode,
            });
          });
        });
      });
    });

    return results;
  }

  /**
   * 渲染搜索结果
   */
  renderResults(results) {
    this.resultsContainer.empty();

    if (results.length === 0) {
      this.resultsContainer.createDiv({
        text: "未找到相关知识点",
        cls: "knowledge-index-empty",
      });
      return;
    }

    // 结果列表
    results.forEach((item) => {
      const resultItem = this.resultsContainer.createDiv({
        cls: "knowledge-index-item",
      });

      // 索引编号 + 标题
      const header = resultItem.createDiv({ cls: "knowledge-index-item-header" });
      header.createSpan({ text: item.id, cls: "knowledge-index-id" });
      header.createSpan({ text: item.title, cls: "knowledge-index-title" });

      // 书籍和章节
      const meta = resultItem.createDiv({ cls: "knowledge-index-meta" });
      meta.createSpan({ text: item.bookName, cls: "knowledge-index-book" });
      meta.createSpan({ text: `第 ${item.chapter} 章`, cls: "knowledge-index-chapter" });

      // 内容预览
      const preview = resultItem.createDiv({
        text: item.content.substring(0, 100) + "...",
        cls: "knowledge-index-preview",
      });

      // 操作按钮
      const actions = resultItem.createDiv({ cls: "knowledge-index-actions" });
      
      const viewBtn = actions.createEl("button", {
        text: "查看详情",
        cls: "knowledge-index-action-btn",
      });
      
      viewBtn.onclick = () => {
        this.showDetailModal(item);
      };

      const insertBtn = actions.createEl("button", {
        text: "插入笔记",
        cls: "knowledge-index-action-btn",
      });
      
      insertBtn.onclick = () => {
        this.insertToNote(item);
      };
    });
  }

  /**
   * 显示详情模态框
   */
  showDetailModal(item) {
    // 创建详情模态框
    const modal = new Modal(this.plugin.app);
    modal.contentEl.createEl("h2", { text: item.title });
    
    const meta = modal.contentEl.createDiv({ cls: "knowledge-detail-meta" });
    meta.createSpan({ text: `索引: ${item.id}`, cls: "detail-id" });
    meta.createSpan({ text: `书籍: ${item.bookName}`, cls: "detail-book" });
    meta.createSpan({ text: `章节: 第 ${item.chapter} 章`, cls: "detail-chapter" });
    
    modal.contentEl.createEl("h3", { text: "内容" });
    modal.contentEl.createP({ text: item.content });

    if (item.keywords && item.keywords.length > 0) {
      modal.contentEl.createEl("h3", { text: "关键词" });
      const keywordsDiv = modal.contentEl.createDiv({ cls: "knowledge-keywords" });
      item.keywords.forEach((kw) => {
        keywordsDiv.createSpan({ text: kw, cls: "keyword-tag" });
      });
    }

    modal.open();
  }

  /**
   * 插入到笔记
   */
  insertToNote(item) {
    // 插入格式化的知识点到当前笔记
    const content = `### ${item.id}: ${item.title}\n\n${item.content}\n\n---\n`;
    
    // 获取当前编辑器
    const activeEditor = this.plugin.app.workspace.activeEditor;
    if (activeEditor && activeEditor.editor) {
      activeEditor.editor.replaceSelection(content);
      new Notice(`已插入知识点: ${item.id}`, 2000);
    } else {
      new Notice("请先打开一个笔记编辑器", 2000);
    }
  }

  /**
   * 销毁面板
   */
  destroy() {
    this.container.empty();
  }
}

// 导出全局变量
// MoleculeKnowledgeIndexPanel
