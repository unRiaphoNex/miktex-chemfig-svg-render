// ========== 分子编辑器知识库索引面板 (v17.2.0) ==========
// 优化版：添加 CSS 动画、UI 美化
// 参考: uiverse.io, ant-design, freefrontend.org

class MoleculeKnowledgeIndexPanel {
  constructor(container, plugin) {
    this.container = container;
    this.plugin = plugin;
    this.searchInput = null;
    this.resultsContainer = null;
    this.selectedType = "all";
    this.isLoading = false;
  }

  /**
   * 初始化面板
   */
  init() {
    this.render();
    this.injectStyles();
  }

  /**
   * 注入 CSS 样式
   */
  injectStyles() {
    // 检查是否已注入
    if (document.getElementById("knowledge-index-styles")) return;

    const style = document.createElement("style");
    style.id = "knowledge-index-styles";
    style.textContent = `
      /* ========== 知识库索引面板样式 ========== */
      .knowledge-index-panel {
        padding: 16px;
        animation: knowledgeFadeIn 0.4s ease-out;
      }

      @keyframes knowledgeFadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      /* 标题 */
      .knowledge-index-title {
        margin: 0 0 16px 0;
        font-size: 18px;
        font-weight: 600;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        animation: titleGlow 2s ease-in-out infinite alternate;
      }

      @keyframes titleGlow {
        from { filter: drop-shadow(0 0 2px rgba(102, 126, 234, 0.3)); }
        to { filter: drop-shadow(0 0 8px rgba(118, 75, 162, 0.5)); }
      }

      /* 搜索框 */
      .knowledge-index-search {
        position: relative;
        margin-bottom: 12px;
      }

      .knowledge-index-input {
        width: 100%;
        padding: 10px 16px 10px 40px;
        border: 2px solid #e0e0e0;
        border-radius: 12px;
        font-size: 14px;
        background: #fafafa;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        outline: none;
      }

      .knowledge-index-input:focus {
        border-color: #667eea;
        background: #fff;
        box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
        transform: translateY(-1px);
      }

      .knowledge-index-search::before {
        content: "🔍";
        position: absolute;
        left: 14px;
        top: 50%;
        transform: translateY(-50%);
        font-size: 14px;
        opacity: 0.5;
        pointer-events: none;
      }

      /* 类型筛选 */
      .knowledge-index-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
      }

      .knowledge-index-filter-btn {
        padding: 6px 14px;
        border: 2px solid #e0e0e0;
        border-radius: 20px;
        background: #fff;
        color: #666;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
      }

      .knowledge-index-filter-btn::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        border-radius: 50%;
        background: rgba(102, 126, 234, 0.1);
        transform: translate(-50%, -50%);
        transition: width 0.4s ease, height 0.4s ease;
      }

      .knowledge-index-filter-btn:hover::before {
        width: 200px;
        height: 200px;
      }

      .knowledge-index-filter-btn:hover {
        border-color: #667eea;
        color: #667eea;
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(102, 126, 234, 0.15);
      }

      .knowledge-index-filter-btn.active {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-color: transparent;
        color: #fff;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      }

      /* 结果区域 */
      .knowledge-index-results {
        max-height: 500px;
        overflow-y: auto;
        padding-right: 4px;
      }

      .knowledge-index-results::-webkit-scrollbar {
        width: 6px;
      }

      .knowledge-index-results::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 3px;
      }

      .knowledge-index-results::-webkit-scrollbar-thumb {
        background: linear-gradient(135deg, #667eea, #764ba2);
        border-radius: 3px;
      }

      /* 结果项 */
      .knowledge-index-item {
        padding: 14px;
        margin-bottom: 10px;
        background: #fff;
        border: 1px solid #e8e8e8;
        border-radius: 12px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        animation: slideInRight 0.4s ease-out;
        position: relative;
        overflow: hidden;
      }

      @keyframes slideInRight {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }

      .knowledge-index-item::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        height: 100%;
        width: 3px;
        background: linear-gradient(180deg, #667eea, #764ba2);
        transform: scaleY(0);
        transition: transform 0.3s ease;
      }

      .knowledge-index-item:hover::before {
        transform: scaleY(1);
      }

      .knowledge-index-item:hover {
        border-color: #667eea;
        box-shadow: 0 8px 24px rgba(102, 126, 234, 0.12);
        transform: translateY(-2px);
      }

      /* 项头部 */
      .knowledge-index-item-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;
      }

      .knowledge-index-id {
        padding: 3px 8px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: #fff;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        font-family: 'Monaco', 'Consolas', monospace;
        letter-spacing: 0.5px;
      }

      .knowledge-index-item-title {
        font-size: 15px;
        font-weight: 600;
        color: #333;
      }

      /* 元信息 */
      .knowledge-index-meta {
        display: flex;
        gap: 12px;
        margin-bottom: 8px;
        font-size: 12px;
        color: #888;
      }

      .knowledge-index-book {
        padding: 2px 8px;
        background: #f5f5f5;
        border-radius: 4px;
      }

      .knowledge-index-chapter {
        padding: 2px 8px;
        background: #f0f4ff;
        color: #667eea;
        border-radius: 4px;
      }

      /* 内容预览 */
      .knowledge-index-preview {
        font-size: 13px;
        color: #666;
        line-height: 1.6;
        margin-bottom: 10px;
      }

      /* 操作按钮 */
      .knowledge-index-actions {
        display: flex;
        gap: 8px;
      }

      .knowledge-index-action-btn {
        padding: 6px 12px;
        border: none;
        border-radius: 8px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.3s ease;
      }

      .knowledge-index-action-btn:first-child {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: #fff;
      }

      .knowledge-index-action-btn:last-child {
        background: #f5f5f5;
        color: #666;
      }

      .knowledge-index-action-btn:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      }

      /* 空状态 */
      .knowledge-index-empty {
        text-align: center;
        padding: 40px 20px;
        color: #999;
        animation: bounceIn 0.5s ease-out;
      }

      @keyframes bounceIn {
        0% { opacity: 0; transform: scale(0.8); }
        50% { transform: scale(1.05); }
        100% { opacity: 1; transform: scale(1); }
      }

      .knowledge-index-empty::before {
        content: '🔍';
        display: block;
        font-size: 48px;
        margin-bottom: 16px;
        animation: float 3s ease-in-out infinite;
      }

      @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-10px); }
      }

      /* 加载动画 */
      .knowledge-index-loading {
        text-align: center;
        padding: 40px;
      }

      .knowledge-index-loading::before {
        content: '';
        display: inline-block;
        width: 32px;
        height: 32px;
        border: 3px solid #f3f3f3;
        border-top-color: #667eea;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }

      @keyframes spin {
        to { transform: rotate(360deg); }
      }

      /* 关键词标签 */
      .knowledge-keywords {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 12px;
      }

      .keyword-tag {
        padding: 4px 10px;
        background: linear-gradient(135deg, #f0f4ff, #e6e9ff);
        color: #667eea;
        border-radius: 16px;
        font-size: 12px;
        transition: all 0.3s ease;
        cursor: pointer;
      }

      .keyword-tag:hover {
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: #fff;
        transform: scale(1.05);
      }

      /* 统计信息 */
      .knowledge-index-stats {
        display: flex;
        justify-content: space-between;
        padding: 10px 14px;
        background: #f8f9ff;
        border-radius: 8px;
        margin-bottom: 12px;
        font-size: 12px;
        color: #667eea;
        animation: fadeIn 0.5s ease-out;
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      /* ========== 详情模态框样式（参考 galaxy 项目） ========== */
      .modal-content .knowledge-detail-modal {
        padding: 24px;
        animation: detailSlideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1);
      }

      @keyframes detailSlideIn {
        from { opacity: 0; transform: translateY(20px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .modal-content h2 {
        margin: 0 0 20px 0;
        font-size: 22px;
        font-weight: 700;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        position: relative;
        padding-bottom: 12px;
      }

      .modal-content h2::after {
        content: '';
        position: absolute;
        bottom: 0;
        left: 0;
        width: 60px;
        height: 3px;
        background: linear-gradient(90deg, #667eea, #764ba2);
        border-radius: 2px;
        animation: underlineGrow 0.6s ease-out;
      }

      @keyframes underlineGrow {
        from { width: 0; }
        to { width: 60px; }
      }

      .modal-content h3 {
        margin: 20px 0 10px 0;
        font-size: 15px;
        font-weight: 600;
        color: #333;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .modal-content h3::before {
        content: '';
        width: 4px;
        height: 16px;
        background: linear-gradient(180deg, #667eea, #764ba2);
        border-radius: 2px;
      }

      /* 元信息 */
      .knowledge-detail-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 20px;
      }

      .knowledge-detail-meta span {
        padding: 6px 12px;
        background: #f8f9ff;
        border: 1px solid #e8e9ff;
        border-radius: 8px;
        font-size: 12px;
        color: #667eea;
        transition: all 0.3s ease;
      }

      .knowledge-detail-meta span:hover {
        background: #f0f4ff;
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.15);
      }

      /* 内容区域 */
      .modal-content p {
        line-height: 1.8;
        color: #555;
        font-size: 14px;
      }

      /* 化学式代码块 */
      .knowledge-formula {
        padding: 16px;
        background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
        border-radius: 12px;
        margin: 12px 0;
        overflow-x: auto;
        position: relative;
      }

      .knowledge-formula::before {
        content: '🧪 化学方程式';
        position: absolute;
        top: 8px;
        right: 12px;
        font-size: 11px;
        color: #667eea;
        opacity: 0.8;
      }

      .knowledge-formula code {
        display: block;
        color: #00ff88;
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
        font-size: 13px;
        line-height: 1.6;
      }

      /* 反应机理区域 */
      .knowledge-mechanism {
        padding: 16px;
        background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
        border-left: 4px solid #667eea;
        border-radius: 0 12px 12px 0;
        margin: 12px 0;
      }

      .knowledge-mechanism p {
        margin: 0;
        color: #444;
      }

      /* 适用条件区域 */
      .knowledge-conditions {
        padding: 16px;
        background: linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%);
        border-left: 4px solid #ff6b6b;
        border-radius: 0 12px 12px 0;
        margin: 12px 0;
      }

      .knowledge-conditions p {
        margin: 0;
        color: #666;
      }

      /* 关键词标签（详情页） */
      .modal-content .knowledge-keywords {
        margin-top: 16px;
      }

      .modal-content .keyword-tag {
        padding: 6px 14px;
        background: linear-gradient(135deg, #667eea, #764ba2);
        color: #fff;
        border-radius: 20px;
        font-size: 12px;
        transition: all 0.3s ease;
        cursor: pointer;
      }

      .modal-content .keyword-tag:hover {
        transform: scale(1.08) rotate(-2deg);
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
      }

      /* ========== 列表页进一步优化（参考 galaxy） ========== */
      
      /* 搜索框微光效果 */
      .knowledge-index-search {
        position: relative;
      }

      .knowledge-index-search::after {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 100%;
        height: 100%;
        border-radius: 12px;
        background: linear-gradient(135deg, rgba(102, 126, 234, 0.1), rgba(118, 75, 162, 0.1));
        transform: translate(-50%, -50%);
        opacity: 0;
        z-index: -1;
        transition: opacity 0.3s ease;
        filter: blur(12px);
      }

      .knowledge-index-input:focus ~ .knowledge-index-search::after,
      .knowledge-index-search:focus-within::after {
        opacity: 1;
      }

      /* 结果项渐变边框 */
      .knowledge-index-item {
        background: #fff;
        border: 1px solid transparent;
        background-clip: padding-box;
        position: relative;
      }

      .knowledge-index-item::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: 12px;
        padding: 1px;
        background: linear-gradient(135deg, #667eea, #764ba2, #f093fb);
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        opacity: 0;
        transition: opacity 0.3s ease;
        pointer-events: none;
      }

      .knowledge-index-item:hover::before {
        opacity: 1;
      }

      /* 操作按钮增强 */
      .knowledge-index-action-btn {
        position: relative;
        overflow: hidden;
      }

      .knowledge-index-action-btn::before {
        content: '';
        position: absolute;
        top: 50%;
        left: 50%;
        width: 0;
        height: 0;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        transform: translate(-50%, -50%);
        transition: width 0.4s ease, height 0.4s ease;
      }

      .knowledge-index-action-btn:hover::before {
        width: 200px;
        height: 200px;
      }

      .knowledge-index-action-btn:first-child {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
      }

      .knowledge-index-action-btn:first-child:hover {
        box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
        transform: translateY(-2px);
      }

      /* 统计信息增强 */
      .knowledge-index-stats {
        background: linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%);
        border: 1px solid #e8e9ff;
        position: relative;
        overflow: hidden;
      }

      .knowledge-index-stats::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 2px;
        background: linear-gradient(90deg, #667eea, #764ba2, #f093fb);
        animation: statsShimmer 2s linear infinite;
        background-size: 200% 100%;
      }

      @keyframes statsShimmer {
        from { background-position: 0% 0; }
        to { background-position: 200% 0; }
      }

      /* 空状态增强 */
      .knowledge-index-empty {
        background: linear-gradient(135deg, #f8f9ff, #fff5f5);
        border-radius: 16px;
        margin: 20px 0;
      }

      /* 加载动画增强 */
      .knowledge-index-loading::before {
        box-shadow: 0 0 20px rgba(102, 126, 234, 0.3);
      }

      /* 分类标签颜色编码 */
      .knowledge-index-id[data-id^="ORG"] {
        background: linear-gradient(135deg, #667eea, #764ba2);
      }

      .knowledge-index-id[data-id^="DRUG"] {
        background: linear-gradient(135deg, #f093fb, #f5576c);
      }

      .knowledge-index-id[data-id^="PHARM"] {
        background: linear-gradient(135deg, #4facfe, #00f2fe);
      }

      .knowledge-index-id[data-id^="SYNTH"] {
        background: linear-gradient(135deg, #43e97b, #38f9d7);
      }

      .knowledge-index-id[data-id^="BIO"] {
        background: linear-gradient(135deg, #fa709a, #fee140);
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * 渲染面板
   */
  render() {
    const { container } = this;
    container.empty();

    // 添加主容器类
    container.addClass("knowledge-index-panel");

    // 标题
    container.createEl("h4", {
      text: "📚 知识库索引",
      cls: "knowledge-index-title",
    });

    // 统计信息
    const totalKnowledge = this.getAllKnowledge().length;
    const statsDiv = container.createDiv({ cls: "knowledge-index-stats" });
    statsDiv.createSpan({ text: `📊 共 ${totalKnowledge} 个知识点` });
    statsDiv.createSpan({ text: "🔍 支持模糊搜索" });

    // 搜索框
    const searchBox = container.createDiv({ cls: "knowledge-index-search" });
    
    this.searchInput = searchBox.createEl("input", {
      type: "text",
      placeholder: "搜索知识点或输入索引编号 (如: ORG-001)...",
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
    
    // 显示加载动画
    this.resultsContainer.empty();
    this.resultsContainer.createDiv({ cls: "knowledge-index-loading" });

    // 模拟异步搜索（优化动画效果）
    setTimeout(() => {
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
    }, 200);
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
      typeof TEXTBOOK_KNOWLEDGE_EXPANSION_6 !== "undefined" ? TEXTBOOK_KNOWLEDGE_EXPANSION_6 : {},
      typeof TEXTBOOK_EXPANSION_7 !== "undefined" ? TEXTBOOK_EXPANSION_7 : {},
      typeof TEXTBOOK_EXPANSION_8 !== "undefined" ? TEXTBOOK_EXPANSION_8 : {},
      typeof TEXTBOOK_COMPLETE !== "undefined" ? TEXTBOOK_COMPLETE : {},
    ];

    const results = [];

    allDatabases.forEach((db) => {
      Object.keys(db).forEach((bookName) => {
        const book = db[bookName];
        if (!book || !book.bookCode || !book.chapters) return;
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
    results.forEach((item, index) => {
      const resultItem = this.resultsContainer.createDiv({
        cls: "knowledge-index-item",
      });

      // 添加延迟动画
      resultItem.style.animationDelay = `${index * 0.05}s`;

      // 索引编号 + 标题
      const header = resultItem.createDiv({ cls: "knowledge-index-item-header" });
      header.createSpan({ text: item.id, cls: "knowledge-index-id" });
      header.createSpan({ text: item.title, cls: "knowledge-index-item-title" });

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
    try {
      // 直接从 obsidian 获取 Modal 和 Notice，避免作用域问题
      const obsidian = require("obsidian");
      const Modal = obsidian.Modal;
      const Notice = obsidian.Notice;
      
      // 获取 app 对象 - 优先使用 window.app（Obsidian 全局）
      const app = window.app || this.plugin.app || this.plugin;
      
      // 创建详情模态框
      const modal = new Modal(app);
      modal.contentEl.createEl("h2", { text: item.title });
      
      const meta = modal.contentEl.createDiv({ cls: "knowledge-detail-meta" });
      meta.createSpan({ text: `索引: ${item.id}`, cls: "detail-id" });
      meta.createSpan({ text: `书籍: ${item.bookName}`, cls: "detail-book" });
      meta.createSpan({ text: `章节: ${item.chapter}`, cls: "detail-chapter" });
      
      // 详细内容
      modal.contentEl.createEl("h3", { text: "📝 内容" });
      modal.contentEl.createEl("p", { text: item.content });

      // 化学式
      if (item.formula) {
        modal.contentEl.createEl("h3", { text: "🧪 化学式" });
        const formulaDiv = modal.contentEl.createDiv({ cls: "knowledge-formula" });
        formulaDiv.createEl("code", { text: item.formula });
        
        // 尝试渲染 chemfig 为 SVG
        this.renderFormulaToSvg(item.formula, formulaDiv);
      }

      // 反应机理
      if (item.mechanism) {
        modal.contentEl.createEl("h3", { text: "⚙️ 反应机理" });
        const mechanismDiv = modal.contentEl.createDiv({ cls: "knowledge-mechanism" });
        mechanismDiv.createEl("p", { text: item.mechanism });
      }

      // 适用条件
      if (item.conditions) {
        modal.contentEl.createEl("h3", { text: "📋 适用条件" });
        const conditionsDiv = modal.contentEl.createDiv({ cls: "knowledge-conditions" });
        conditionsDiv.createEl("p", { text: item.conditions });
      }

      // 关键词
      if (item.keywords && item.keywords.length > 0) {
        modal.contentEl.createEl("h3", { text: "🏷️ 关键词" });
        const keywordsDiv = modal.contentEl.createDiv({ cls: "knowledge-keywords" });
        item.keywords.forEach((kw) => {
          keywordsDiv.createSpan({ text: kw, cls: "keyword-tag" });
        });
      }

      modal.open();
    } catch (e) {
      console.error("showDetailModal error:", e);
      try {
        const Notice = require("obsidian").Notice;
        new Notice("打开详情失败: " + e.message, 3000);
      } catch (_) {}
    }
  }

  /**
   * 将 chemfig 代码渲染为 SVG
   */
  async renderFormulaToSvg(formulaCode, container) {
    try {
      // 创建渲染容器
      const svgContainer = container.createDiv({ cls: "formula-svg-container" });
      svgContainer.style.cssText = "display: flex; justify-content: center; padding: 16px; background: #f8f9fa; border-radius: 8px; margin-top: 8px; min-height: 100px; align-items: center;";
      
      // 显示加载状态
      svgContainer.innerHTML = '<div style="color: #999; font-size: 14px;">正在渲染...</div>';
      
      // 判断是否为完整反应式（包含 + 或 →）
      const isReaction = formulaCode.includes("+") || formulaCode.includes("→") || formulaCode.includes("\\xrightarrow") || formulaCode.includes("\\xleftarrow");
      
      if (isReaction) {
        // 完整反应式：直接显示格式化文本（chemfig 不支持反应箭头）
        const displayCode = formulaCode
          .replace(/\\chemfig\{/g, "")
          .replace(/\\}/g, "")
          .replace(/\}/g, "")
          .replace(/\\xrightarrow\{([^}]*)\}/g, " → $1 ")
          .replace(/\\xleftarrow\{([^}]*)\}/g, " ← $1 ");
        svgContainer.innerHTML = '<div style="font-family: monospace; font-size: 16px; text-align: center; color: #333; padding: 8px;">' + displayCode + '</div>';
        return;
      }
      
      // 单个分子结构：清理并渲染
      const cleanedCode = this.cleanChemfigCode(formulaCode);
      
      // 优先使用 this.plugin.bridgeClient（直接渲染，返回 SVG 字符串）
      if (this.plugin && this.plugin.bridgeClient) {
        try {
          const svg = await this.plugin.bridgeClient.render(cleanedCode, "normal");
          if (svg && svg.includes("<svg")) {
            svgContainer.innerHTML = svg;
            return;
          }
        } catch (e) {
          console.warn("[KnowledgeIndex] bridgeClient 渲染失败:", e);
        }
      }
      
      // 尝试通过全局插件实例渲染
      const app = window.app;
      if (app && app.plugins && app.plugins.plugins["miktex-chemfig-svg-render"]) {
        const plugin = app.plugins.plugins["miktex-chemfig-svg-render"];
        if (plugin.bridgeClient) {
          try {
            const svg = await plugin.bridgeClient.render(cleanedCode, "normal");
            if (svg && svg.includes("<svg")) {
              svgContainer.innerHTML = svg;
              return;
            }
          } catch (e) {
            console.warn("[KnowledgeIndex] 全局 bridgeClient 渲染失败:", e);
          }
        }
      }
      
      // 尝试通过全局 API 渲染
      if (window.chemfigAPI && window.chemfigAPI.renderChemfig) {
        try {
          const result = await window.chemfigAPI.renderChemfig(cleanedCode, {});
          if (result && result.svg) {
            svgContainer.innerHTML = result.svg;
            return;
          }
        } catch (e) {
          console.warn("[KnowledgeIndex] chemfigAPI 渲染失败:", e);
        }
      }
      
      // 降级：显示渲染提示
      svgContainer.innerHTML = '<div style="color: #999; font-size: 12px; text-align: center;">⚠️ 渲染服务未启动，请使用 MiKTeX 编译模式查看完整结构式</div>';
      
    } catch (e) {
      console.error("[KnowledgeIndex] renderFormulaToSvg error:", e);
    }
  }

  /**
   * 清理和规范化 chemfig 代码
   * - 如果代码中包含 \chemfig{}，提取第一个
   * - 如果代码不是纯 chemfig，包装成 chemfig 环境
   * - 去除 \xrightarrow 等非 chemfig 命令
   */
  cleanChemfigCode(code) {
    if (!code || typeof code !== "string") return "";
    
    let cleaned = code.trim();
    
    // 如果已经是纯 \chemfig{...} 格式，直接返回
    if (cleaned.startsWith("\\chemfig{")) {
      const firstChemfigEnd = cleaned.indexOf("}", cleaned.indexOf("{"));
      if (firstChemfigEnd > 0 && cleaned.slice(firstChemfigEnd + 1).trim() === "") {
        return cleaned;
      }
    }
    
    // 提取第一个 \chemfig{...} 块
    const match = cleaned.match(/\\chemfig\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/);
    if (match) {
      return "\\chemfig{" + match[1] + "}";
    }
    
    // 如果没有 \chemfig，但是有化学式内容，包装成 \chemfig{}
    // 去除 \xrightarrow 等命令
    cleaned = cleaned.replace(/\\xrightarrow\{[^}]*\}/g, "→");
    cleaned = cleaned.replace(/\\xleftarrow\{[^}]*\}/g, "←");
    cleaned = cleaned.replace(/\\xrightarrow/g, "→");
    cleaned = cleaned.replace(/\\xleftarrow/g, "←");
    
    // 如果清理后有内容，包装成 chemfig
    if (cleaned && !cleaned.startsWith("\\")) {
      return "\\chemfig{" + cleaned + "}";
    }
    
    return cleaned;
  }

  /**
   * 插入到笔记
   */
  insertToNote(item) {
    try {
      // 直接从 obsidian 获取 Notice
      const Notice = require("obsidian").Notice;
      
      // 获取 app 对象 - 优先使用 window.app（Obsidian 全局）
      const app = window.app || this.plugin.app || this.plugin;
      
      // 获取当前编辑器
      const activeEditor = app.workspace.activeEditor;
      if (activeEditor && activeEditor.editor) {
        // 构建插入内容：标题 + 代码块（chemfig 模式）+ 说明
        const tripleBacktick = "```";
        let content = "### " + item.id + ": " + item.title + "\n\n";
        content += tripleBacktick + "chem\n" + tripleBacktick + "\n\n";
        content += "**内容**: " + item.content + "\n\n";
        if (item.keywords && item.keywords.length > 0) {
          content += "**关键词**: " + item.keywords.join(", ") + "\n\n";
        }
        content += "---\n";
        
        activeEditor.editor.replaceSelection(content);
        new Notice("已插入知识点: " + item.id, 2000);
      } else {
        new Notice("请先打开一个笔记编辑器", 2000);
      }
    } catch (e) {
      console.error("insertToNote error:", e);
      try {
        const Notice = require("obsidian").Notice;
        new Notice("插入笔记失败: " + e.message, 3000);
      } catch (_) {}
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
window.MoleculeKnowledgeIndexPanel = MoleculeKnowledgeIndexPanel;
