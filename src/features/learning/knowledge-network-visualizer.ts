// ========== 知识点网络可视化 (v17.2.0) ==========
// 使用 SVG 可视化展示知识点之间的关联

class KnowledgeNetworkVisualizer {
  constructor(container) {
    this.container = container;
    this.nodes = [];
    this.edges = [];
    this.nodePositions = new Map();
  }

  /**
   * 构建网络
   */
  buildNetwork() {
    this.nodes = [];
    this.edges = [];
    this.nodePositions.clear();

    // 获取所有知识点
    const allKnowledge = this.getAllKnowledge();
    
    // 创建节点
    allKnowledge.forEach((item, index) => {
      this.nodes.push({
        id: item.id,
        title: item.title,
        type: item.bookCode,
        x: 0,
        y: 0,
      });
    });

    // 创建边（关联关系）
    Object.keys(KNOWLEDGE_RELATIONS).forEach((knowledgeId) => {
      const relations = KNOWLEDGE_RELATIONS[knowledgeId];
      
      // 关联化合物和反应暂时作为独立节点
      // 这里主要展示知识点之间的关联
    });

    // 计算布局（简单的圆形布局）
    this.calculateLayout();
  }

  /**
   * 计算布局
   * 简单的圆形布局算法
   */
  calculateLayout() {
    const centerX = 400;
    const centerY = 300;
    const radius = 200;
    
    this.nodes.forEach((node, index) => {
      const angle = (index / this.nodes.length) * 2 * Math.PI;
      node.x = centerX + radius * Math.cos(angle);
      node.y = centerY + radius * Math.sin(angle);
      this.nodePositions.set(node.id, { x: node.x, y: node.y });
    });
  }

  /**
   * 渲染网络
   */
  render() {
    this.container.empty();
    this.container.addClass("knowledge-network");

    // SVG 画布
    const svg = this.container.createSvg("svg", {
      attr: {
        width: "800",
        height: "600",
        viewBox: "0 0 800 600",
        class: "network-svg",
      },
    });

    // 绘制边
    this.edges.forEach((edge) => {
      const source = this.nodePositions.get(edge.source);
      const target = this.nodePositions.get(edge.target);
      if (!source || !target) return;

      const line = svg.createSvg("line", {
        attr: {
          x1: source.x,
          y1: source.y,
          x2: target.x,
          y2: target.y,
          stroke: "#ccc",
          "stroke-width": 1,
        },
      });
    });

    // 绘制节点
    this.nodes.forEach((node) => {
      const g = svg.createSvg("g", {
        attr: {
          transform: `translate(${node.x}, ${node.y})`,
          class: "network-node",
        },
      });

      // 圆形
      g.createSvg("circle", {
        attr: {
          r: 20,
          fill: this.getNodeColor(node.type),
          stroke: "#fff",
          "stroke-width": 2,
        },
      });

      // 标签
      g.createSvg("text", {
        attr: {
          y: 35,
          "text-anchor": "middle",
          "font-size": 10,
          fill: "#333",
        },
        text: node.title.substring(0, 6) + "...",
      });

      // 点击事件
      g.addEventListener("click", () => {
        this.onNodeClick(node);
      });
    });
  }

  /**
   * 获取节点颜色
   */
  getNodeColor(type) {
    const colors = {
      "ORG": "#3498db", // 有机化学 - 蓝色
      "DRUG": "#e74c3c", // 药物化学 - 红色
      "PHARM": "#2ecc71", // 药理学 - 绿色
      "SYNTH": "#f39c12", // 药物合成 - 橙色
      "BIO": "#9b59b6", // 生物化学 - 紫色
    };
    return colors[type] || "#95a5a6";
  }

  /**
   * 节点点击事件
   */
  onNodeClick(node) {
    // 显示节点详情
    this.showNodeDetail(node);
  }

  /**
   * 显示节点详情
   */
  showNodeDetail(node) {
    // 创建详情面板
    const detailPanel = this.container.createDiv({ cls: "network-node-detail" });
    
    detailPanel.createH4({ text: node.title });
    detailPanel.createP({ text: `类型: ${node.type}` });
    detailPanel.createP({ text: `ID: ${node.id}` });

    // 显示关联
    const relations = getKnowledgeRelations(node.id);
    if (relations.relatedCompounds.length > 0) {
      detailPanel.createH5({ text: "相关化合物:" });
      relations.relatedCompounds.forEach((c) => {
        detailPanel.createP({ text: c });
      });
    }

    if (relations.relatedDrugs.length > 0) {
      detailPanel.createH5({ text: "相关药物:" });
      relations.relatedDrugs.forEach((d) => {
        detailPanel.createP({ text: d });
      });
    }
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
      TEXTBOOK_KNOWLEDGE_EXPANSION_3,
    ];

    databases.forEach((db) => {
      Object.keys(db).forEach((bookName) => {
        const book = db[bookName];
        book.chapters.forEach((chapter) => {
          chapter.sections.forEach((section) => {
            all.push({
              ...section,
              bookCode: book.bookCode,
            });
          });
        });
      });
    });

    return all;
  }
}

// 导出全局变量
// KnowledgeNetworkVisualizer
