// ========== 知识库导出和统计 (v17.2.0) ==========
// 导出知识点为 Markdown 笔记
// 学习统计面板

/**
 * 知识库导出器
 */
class KnowledgeExporter {
  constructor(plugin) {
    this.plugin = plugin;
  }

  /**
   * 导出单个知识点为 Markdown
   */
  exportToMarkdown(knowledgeId, knowledge) {
    let md = `---\n`;
    md += `id: ${knowledgeId}\n`;
    md += `title: ${knowledge.title}\n`;
    md += `book: ${knowledge.bookName}\n`;
    md += `chapter: ${knowledge.chapter}\n`;
    md += `tags: [${(knowledge.keywords || []).join(", ")}]\n`;
    md += `---\n\n`;
    
    md += `# ${knowledgeId} ${knowledge.title}\n\n`;
    md += `## 基本信息\n\n`;
    md += `- **来源**: ${knowledge.bookName}\n`;
    md += `- **章节**: ${knowledge.chapter}\n`;
    if (knowledge.keywords && knowledge.keywords.length > 0) {
      md += `- **关键词**: ${knowledge.keywords.join(", ")}\n`;
    }
    md += `\n`;
    
    md += `## 内容\n\n`;
    md += `${knowledge.content}\n\n`;
    
    // 关联内容
    const relations = getKnowledgeRelations(knowledgeId);
    if (relations.relatedCompounds.length > 0) {
      md += `## 相关化合物\n\n`;
      relations.relatedCompounds.forEach((c) => {
        md += `- ${c}\n`;
      });
      md += `\n`;
    }
    
    if (relations.relatedReactions.length > 0) {
      md += `## 相关反应\n\n`;
      relations.relatedReactions.forEach((r) => {
        md += `- ${r}\n`;
      });
      md += `\n`;
    }
    
    if (relations.relatedDrugs.length > 0) {
      md += `## 相关药物\n\n`;
      relations.relatedDrugs.forEach((d) => {
        md += `- ${d}\n`;
      });
      md += `\n`;
    }
    
    return md;
  }

  /**
   * 导出所有知识点为 Markdown 笔记
   */
  async exportAll() {
    const allKnowledge = this.getAllKnowledge();
    let md = `# 化学知识库汇总\n\n`;
    md += `> 导出时间: ${new Date().toLocaleString()}\n\n`;
    md += `## 目录\n\n`;
    
    // 按教材分组
    const byBook = {};
    allKnowledge.forEach((k) => {
      if (!byBook[k.bookName]) byBook[k.bookName] = [];
      byBook[k.bookName].push(k);
    });
    
    Object.keys(byBook).forEach((bookName) => {
      md += `### ${bookName}\n\n`;
      byBook[bookName].forEach((k) => {
        md += `- [[${k.id} ${k.title}]]\n`;
      });
      md += `\n`;
    });
    
    md += `---\n\n`;
    
    // 所有知识点详情
    allKnowledge.forEach((k) => {
      md += this.exportToMarkdown(k.id, k);
      md += `---\n\n`;
    });
    
    return md;
  }

  /**
   * 获取所有知识点
   */
  getAllKnowledge() {
    const all = [];
    const databases = [
      TEXTBOOK_KNOWLEDGE_BASE,
      EXTENDED_TEXTBOOK_KNOWLEDGE,
      TEXTBOOK_KNOWLEDGE_EXPANSION_2,
    ];

    databases.forEach((db) => {
      Object.keys(db).forEach((bookName) => {
        const book = db[bookName];
        book.chapters.forEach((chapter) => {
          chapter.sections.forEach((section) => {
            all.push({
              ...section,
              bookName: bookName.replace("-扩展", "").replace("-二次扩展", ""),
              chapter: chapter.chapter,
            });
          });
        });
      });
    });

    return all;
  }
}

/**
 * 学习统计面板
 */
class LearningStatsPanel {
  constructor(plugin, container) {
    this.plugin = plugin;
    this.container = container;
    this.learningManager = new KnowledgeLearningManager(plugin);
  }

  async render() {
    this.container.empty();
    this.container.addClass("learning-stats-panel");

    const stats = this.learningManager.getStats();
    const dueForReview = this.learningManager.getDueForReview();

    // 标题
    this.container.createEl("h2", { text: "📊 学习统计" });

    // 统计卡片
    const statsGrid = this.container.createDiv({ cls: "stats-grid" });

    const cards = [
      { label: "总学习数", value: stats.total, icon: "📚" },
      { label: "已掌握", value: stats.mastered, icon: "✅" },
      { label: "学习中", value: stats.learning, icon: "📖" },
      { label: "待复习", value: dueForReview.length, icon: "🔄" },
      { label: "掌握率", value: `${stats.masterRate}%`, icon: "📈" },
    ];

    cards.forEach(({ label, value, icon }) => {
      const card = statsGrid.createDiv({ cls: "stat-card" });
      card.createDiv({ text: icon, cls: "stat-icon" });
      card.createDiv({ text: value, cls: "stat-value" });
      card.createDiv({ text: label, cls: "stat-label" });
    });

    // 待复习列表
    if (dueForReview.length > 0) {
      this.container.createEl("h3", { text: "🔄 待复习知识点" });
      
      const reviewList = this.container.createDiv({ cls: "review-list" });
      dueForReview.slice(0, 10).forEach((item) => {
        const itemEl = reviewList.createDiv({ cls: "review-item" });
        itemEl.createSpan({ text: item.id, cls: "review-id" });
        itemEl.createSpan({ text: `${item.daysPassed} 天未复习`, cls: "review-days" });
      });
    }

    // 操作按钮
    const actions = this.container.createDiv({ cls: "stats-actions" });
    
    const exportBtn = actions.createEl("button", {
      text: "📤 导出知识库",
      cls: "chemfig-action-btn",
    });
    exportBtn.onclick = async () => {
      const exporter = new KnowledgeExporter(this.plugin);
      const md = await exporter.exportAll();
      
      // 创建新笔记
      const date = new Date().toISOString().slice(0, 10);
      const fileName = `化学知识库导出-${date}.md`;
      await this.plugin.app.vault.create(fileName, md);
      
      new Notice(`知识库已导出到: ${fileName}`, 3000);
    };

    const resetBtn = actions.createEl("button", {
      text: "🗑️ 重置学习进度",
      cls: "chemfig-action-btn danger",
    });
    resetBtn.onclick = async () => {
      if (confirm("确定要重置所有学习进度吗？此操作不可恢复。")) {
        await this.learningManager.reset();
        new Notice("学习进度已重置", 2000);
        this.render();
      }
    };
  }
}

// 导出全局变量
// KnowledgeExporter, LearningStatsPanel
