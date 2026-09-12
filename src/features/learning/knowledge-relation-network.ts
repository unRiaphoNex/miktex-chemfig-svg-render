// ========== 知识点关联网络 (v17.2.0) ==========
// 建立知识点之间的关联网络
// 支持可视化展示、关联推荐

class KnowledgeRelationNetwork {
  constructor() {
    this.relations = new Map(); // 知识点ID -> 关联知识点ID列表
    this.buildRelationNetwork();
  }

  /**
   * 构建关联网络
   */
  buildRelationNetwork() {
    // 预定义的关联关系
    const predefinedRelations = {
      // 有机化学关联
      "ORG-001": ["ORG-002", "ORG-003", "DRUG-001"], // 烷烃 -> 烯烃/炔烃/药物化学
      "ORG-002": ["ORG-001", "ORG-004", "ORG-005"], // 烯烃 -> 烷烃/炔烃/芳香烃
      "ORG-003": ["ORG-001", "ORG-002", "ORG-006"], // 炔烃 -> 烷烃/烯烃/卤代烃
      "ORG-004": ["ORG-002", "ORG-007", "ORG-008"], // 芳香烃 -> 烯烃/醇酚醚/醛酮
      "ORG-005": ["ORG-002", "ORG-009", "ORG-010"], // 卤代烃 -> 烯烃/醇酚醚/含氮化合物
      "ORG-006": ["ORG-003", "ORG-005", "ORG-011"], // 醇酚醚 -> 炔烃/卤代烃/醛酮
      "ORG-007": ["ORG-004", "ORG-006", "ORG-012"], // 醛酮 -> 芳香烃/醇酚醚/羧酸
      "ORG-008": ["ORG-006", "ORG-007", "ORG-013"], // 羧酸 -> 醇酚醚/醛酮/含氮化合物
      
      // 药物化学关联
      "DRUG-001": ["ORG-001", "DRUG-002", "PHARM-001"], // 药物化学 -> 烷烃/药理学/药效学
      "DRUG-002": ["DRUG-001", "DRUG-003", "PHARM-002"], // 药理学 -> 药物化学/药动学
      
      // 药理学关联
      "PHARM-001": ["DRUG-001", "PHARM-002", "PHARM-003"], // 药效学 -> 药物化学/药动学/影响因素
      "PHARM-002": ["PHARM-001", "PHARM-004", "PHARM-005"], // 药动学 -> 药效学/受体/传出神经
      
      // 药物合成反应关联
      "SYNTH-001": ["ORG-005", "SYNTH-002", "SYNTH-003"], // 卤化反应 -> 卤代烃/还原/氧化
      "SYNTH-002": ["SYNTH-001", "SYNTH-003", "SYNTH-004"], // 还原反应 -> 卤化/氧化/烷基化
      "SYNTH-003": ["SYNTH-001", "SYNTH-002", "SYNTH-005"], // 氧化反应 -> 卤化/还原/酰基化
      
      // 生物化学关联
      "BIO-001": ["BIO-002", "BIO-003", "BIO-004"], // 蛋白质结构 -> 二级/三级/四级结构
      "BIO-002": ["BIO-001", "BIO-005", "BIO-006"], // 酶 -> 蛋白质/糖代谢/脂类代谢
      "BIO-003": ["BIO-002", "BIO-007", "BIO-008"], // 糖代谢 -> 酶/脂类代谢/氨基酸代谢
    };

    // 扩展关联关系（基于关键词匹配）
    this.buildAutomaticRelations();
  }

  /**
   * 自动构建关联关系（基于关键词匹配）
   */
  buildAutomaticRelations() {
    const allKnowledge = this.getAllKnowledge();
    const knowledgeMap = new Map();

    // 建立知识点ID -> 知识点的映射
    allKnowledge.forEach((item) => {
      knowledgeMap.set(item.id, item);
    });

    // 基于关键词匹配建立关联
    knowledgeMap.forEach((item1, id1) => {
      if (!this.relations.has(id1)) {
        this.relations.set(id1, new Set());
      }

      knowledgeMap.forEach((item2, id2) => {
        if (id1 === id2) return;

        // 计算关键词重叠度
        const keywords1 = new Set(item1.keywords || []);
        const keywords2 = new Set(item2.keywords || []);
        let overlap = 0;

        keywords1.forEach((kw) => {
          if (keywords2.has(kw)) {
            overlap++;
          }
        });

        // 如果关键词重叠度 >= 2，建立关联
        if (overlap >= 2) {
          this.relations.get(id1).add(id2);
        }
      });
    });
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
   * 获取关联知识点
   */
  getRelatedKnowledge(knowledgeId, depth = 1) {
    const visited = new Set();
    const results = [];

    const dfs = (id, currentDepth) => {
      if (currentDepth > depth || visited.has(id)) return;
      visited.add(id);

      const related = this.relations.get(id);
      if (related) {
        related.forEach((relatedId) => {
          if (!visited.has(relatedId)) {
            const knowledge = this.getKnowledgeById(relatedId);
            if (knowledge) {
              results.push({
                ...knowledge,
                depth: currentDepth,
              });
            }
            dfs(relatedId, currentDepth + 1);
          }
        });
      }
    };

    dfs(knowledgeId, 1);
    return results;
  }

  /**
   * 根据ID获取知识点
   */
  getKnowledgeById(id) {
    const allKnowledge = this.getAllKnowledge();
    return allKnowledge.find((item) => item.id === id);
  }

  /**
   * 获取关联统计
   */
  getRelationStats() {
    let totalRelations = 0;
    this.relations.forEach((relatedSet) => {
      totalRelations += relatedSet.size;
    });

    return {
      totalKnowledge: this.relations.size,
      totalRelations: totalRelations,
      avgRelations: (totalRelations / this.relations.size).toFixed(2),
    };
  }
}

/**
 * 知识点关联网络可视化模态框
 */
class KnowledgeRelationNetworkModal extends Modal {
  constructor(app, knowledgeId = "") {
    super(app);
    this.knowledgeId = knowledgeId;
    this.network = new KnowledgeRelationNetwork();
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("knowledge-relation-modal");

    // 标题
    contentEl.createEl("h2", { text: "🕸️ 知识点关联网络" });

    // 搜索框
    const searchBox = contentEl.createDiv({ cls: "relation-search-box" });
    
    const input = searchBox.createEl("input", {
      type: "text",
      placeholder: "输入知识点ID或名称搜索...",
      value: this.knowledgeId,
      cls: "relation-search-input",
    });

    const searchBtn = searchBox.createEl("button", {
      text: "查看关联",
      cls: "relation-search-btn",
    });

    // 可视化容器
    this.vizContainer = contentEl.createDiv({
      cls: "relation-viz-container",
    });

    // 统计信息
    const stats = this.network.getRelationStats();
    const statsDiv = contentEl.createDiv({ cls: "relation-stats" });
    statsDiv.createP({ text: `总知识点: ${stats.totalKnowledge} | 总关联: ${stats.totalRelations} | 平均关联度: ${stats.avgRelations}` });

    // 搜索事件
    searchBtn.onclick = () => {
      const query = input.value.trim();
      if (!query) return;

      this.showRelationNetwork(query);
    };

    // 如果有初始ID，自动显示
    if (this.knowledgeId) {
      this.showRelationNetwork(this.knowledgeId);
    }
  }

  /**
   * 显示关联网络
   */
  showRelationNetwork(knowledgeId) {
    this.vizContainer.empty();

    const related = this.network.getRelatedKnowledge(knowledgeId, 2);

    if (related.length === 0) {
      this.vizContainer.createDiv({
        text: "未找到关联知识点",
        cls: "no-relations",
      });
      return;
    }

    // 创建简单的可视化（SVG）
    const svg = this.vizContainer.createEl("svg", {
      attr: {
        width: "100%",
        height: "600",
        viewBox: "0 0 800 600",
      },
      cls: "relation-svg",
    });

    // 中心节点
    const centerX = 400;
    const centerY = 300;

    // 绘制中心节点
    const centerCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    centerCircle.setAttribute("cx", centerX);
    centerCircle.setAttribute("cy", centerY);
    centerCircle.setAttribute("r", 40);
    centerCircle.setAttribute("fill", "var(--interactive-accent)");
    svg.appendChild(centerCircle);

    // 中心节点文本
    const centerText = document.createElementNS("http://www.w3.org/2000/svg", "text");
    centerText.setAttribute("x", centerX);
    centerText.setAttribute("y", centerY);
    centerText.setAttribute("text-anchor", "middle");
    centerText.setAttribute("dominant-baseline", "middle");
    centerText.setAttribute("fill", "white");
    centerText.textContent = knowledgeId;
    svg.appendChild(centerText);

    // 绘制关联节点
    related.forEach((item, index) => {
      const angle = (index / related.length) * 2 * Math.PI;
      const radius = 150 + (item.depth - 1) * 100;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);

      // 连线
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", centerX);
      line.setAttribute("y1", centerY);
      line.setAttribute("x2", x);
      line.setAttribute("y2", y);
      line.setAttribute("stroke", "var(--text-muted)");
      line.setAttribute("stroke-width", "1");
      svg.appendChild(line);

      // 节点圆
      const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      circle.setAttribute("cx", x);
      circle.setAttribute("cy", y);
      circle.setAttribute("r", 25);
      circle.setAttribute("fill", item.depth === 1 ? "var(--background-modifier-hover)" : "var(--background-secondary)");
      circle.setAttribute("stroke", "var(--interactive-accent)");
      circle.setAttribute("stroke-width", "1");
      svg.appendChild(circle);

      // 节点文本
      const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
      text.setAttribute("x", x);
      text.setAttribute("y", y);
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      text.setAttribute("font-size", "10");
      text.textContent = item.id;
      svg.appendChild(text);
    });
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// 导出全局变量
// KnowledgeRelationNetwork, KnowledgeRelationNetworkModal
