// ========== 知识库侧边栏 (v17.2.0) ==========
// Obsidian 侧边栏视图
// 显示知识库搜索、学习进度、统计等功能

const KNOWLEDGE_VIEW_TYPE = "chemfig-knowledge-view";

class KnowledgeSidebarView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return KNOWLEDGE_VIEW_TYPE;
  }

  getDisplayText() {
    return "化学知识库";
  }

  getIcon() {
    return "book-open";
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("knowledge-sidebar-view");

    // 标签页
    const tabs = contentEl.createDiv({ cls: "sidebar-tabs" });
    
    const searchTab = tabs.createEl("button", {
      text: "🔍 搜索",
      cls: "sidebar-tab active",
    });
    const learningTab = tabs.createEl("button", {
      text: "📚 学习",
      cls: "sidebar-tab",
    });
    const statsTab = tabs.createEl("button", {
      text: "📊 统计",
      cls: "sidebar-tab",
    });

    // 内容区域
    this.contentArea = contentEl.createDiv({ cls: "sidebar-content" });

    // 默认显示搜索
    this.showSearchTab();

    // 标签页切换
    searchTab.onclick = () => {
      this.setActiveTab(searchTab);
      this.showSearchTab();
    };
    
    learningTab.onclick = () => {
      this.setActiveTab(learningTab);
      this.showLearningTab();
    };
    
    statsTab.onclick = () => {
      this.setActiveTab(statsTab);
      this.showStatsTab();
    };
  }

  /**
   * 设置激活的标签页
   */
  setActiveTab(activeTab) {
    const tabs = this.contentEl.querySelectorAll(".sidebar-tab");
    tabs.forEach((tab) => tab.removeClass("active"));
    activeTab.addClass("active");
  }

  /**
   * 显示搜索标签页
   */
  showSearchTab() {
    this.contentArea.empty();

    // 搜索输入框
    const searchBar = this.contentArea.createDiv({ cls: "sidebar-search-bar" });
    
    const searchInput = searchBar.createEl("input", {
      type: "text",
      placeholder: "搜索知识点...",
      cls: "sidebar-search-input",
    });

    // 快速分类
    const categories = this.contentArea.createDiv({ cls: "sidebar-categories" });
    
    const categoryItems = [
      { name: "全部", value: "" },
      { name: "有机化学", value: "ORG" },
      { name: "药物化学", value: "DRUG" },
      { name: "药理学", value: "PHARM" },
      { name: "药物合成", value: "SYNTH" },
      { name: "生物化学", value: "BIO" },
    ];

    categoryItems.forEach(({ name, value }) => {
      const btn = categories.createEl("button", {
        text: name,
        cls: "category-btn",
      });
      btn.onclick = () => {
        this.searchKnowledge(searchInput.value, value);
      };
    });

    // 搜索结果
    this.searchResultsContainer = this.contentArea.createDiv({ cls: "sidebar-results" });

    // 搜索事件
    searchInput.oninput = () => {
      this.searchKnowledge(searchInput.value, "");
    };

    // 默认显示全部
    this.searchKnowledge("", "");
  }

  /**
   * 搜索知识点
   */
  searchKnowledge(query, typeFilter) {
    this.searchResultsContainer.empty();

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

        if (typeFilter && bookCode !== typeFilter) return;

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

    // 显示结果（最多20条）
    results.slice(0, 20).forEach((result) => {
      const item = this.searchResultsContainer.createDiv({ cls: "sidebar-result-item" });
      
      item.createDiv({ text: result.title, cls: "result-title" });
      item.createDiv({ text: `${result.bookName} - ${result.chapter}`, cls: "result-source" });

      // 点击事件
      item.onclick = () => {
        this.showKnowledgeDetail(result);
      };
    });

    if (results.length === 0) {
      this.searchResultsContainer.createDiv({
        text: "未找到相关知识点",
        cls: "sidebar-empty",
      });
    } else if (results.length > 20) {
      this.searchResultsContainer.createDiv({
        text: `... 共 ${results.length} 个结果，显示前 20 个`,
        cls: "sidebar-more",
      });
    }
  }

  /**
   * 显示知识点详情
   */
  showKnowledgeDetail(knowledge) {
    this.contentArea.empty();

    // 返回按钮
    const backBtn = this.contentArea.createEl("button", {
      text: "← 返回搜索",
      cls: "sidebar-back-btn",
    });
    backBtn.onclick = () => this.showSearchTab();

    // 详情内容
    this.contentArea.createH3({ text: knowledge.title });
    this.contentArea.createP({ text: `${knowledge.bookName} - ${knowledge.chapter}` });
    
    if (knowledge.keywords && knowledge.keywords.length > 0) {
      const keywordsEl = this.contentArea.createDiv({ cls: "sidebar-keywords" });
      knowledge.keywords.forEach((keyword) => {
        keywordsEl.createSpan({ text: keyword, cls: "keyword-tag" });
      });
    }

    this.contentArea.createP({ text: knowledge.content });

    // 关联内容
    const relations = getKnowledgeRelations(knowledge.id);
    
    if (relations.relatedCompounds.length > 0) {
      this.contentArea.createH4({ text: "相关化合物:" });
      relations.relatedCompounds.forEach((c) => {
        this.contentArea.createP({ text: `- ${c}` });
      });
    }

    if (relations.relatedDrugs.length > 0) {
      this.contentArea.createH4({ text: "相关药物:" });
      relations.relatedDrugs.forEach((d) => {
        this.contentArea.createP({ text: `- ${d}` });
      });
    }
  }

  /**
   * 显示学习标签页
   */
  showLearningTab() {
    this.contentArea.empty();

    // 学习模式切换
    const modeSwitcher = this.contentArea.createDiv({ cls: "sidebar-learning-mode" });
    modeSwitcher.createH4({ text: "学习模式" });

    const modes = [
      { name: "浏览", icon: "👁️" },
      { name: "练习", icon: "✏️" },
      { name: "复习", icon: "🔄" },
    ];

    modes.forEach(({ name, icon }) => {
      const btn = modeSwitcher.createEl("button", {
        text: `${icon} ${name}`,
        cls: "mode-btn",
      });
    });

    // 学习进度
    const progress = this.contentArea.createDiv({ cls: "sidebar-learning-progress" });
    progress.createH4({ text: "学习进度" });

    const learningManager = new KnowledgeLearningManager(this.plugin);
    const stats = learningManager.getStats();

    progress.createP({ text: `总学习: ${stats.total}` });
    progress.createP({ text: `已掌握: ${stats.mastered} (${stats.masterRate}%)` });
    progress.createP({ text: `待复习: ${stats.review}` });

    // 快捷操作
    const actions = this.contentArea.createDiv({ cls: "sidebar-actions" });
    actions.createH4({ text: "快捷操作" });

    const openCardsBtn = actions.createEl("button", {
      text: "📚 打开学习卡片",
      cls: "sidebar-action-btn",
    });

    const openCalendarBtn = actions.createEl("button", {
      text: "📅 打开学习日历",
      cls: "sidebar-action-btn",
    });

    const openStatsBtn = actions.createEl("button", {
      text: "📊 打开统计面板",
      cls: "sidebar-action-btn",
    });
  }

  /**
   * 显示统计标签页
   */
  showStatsTab() {
    this.contentArea.empty();

    const statsPanel = new LearningStatsPanel(this.plugin, this.contentArea);
    statsPanel.render();
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// 导出全局变量
// KNOWLEDGE_VIEW_TYPE, KnowledgeSidebarView
