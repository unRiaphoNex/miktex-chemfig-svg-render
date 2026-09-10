// ========== 知识关联功能 (v15.6.0) ==========
// 在阅读模式下自动高亮化合物名称，点击显示详情

class KnowledgeLinking {
  constructor(plugin) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.enabled = true;
  }

  // 处理渲染后的 DOM
  processElement(el) {
    if (!this.enabled) return;
    if (!this.plugin.settings?.knowledgeLinkingEnabled) return;

    // 获取化合物名称列表
    const cardNames = (this.plugin.learningCards || []).map((c) => c.name);
    if (cardNames.length === 0) return;

    // 按长度排序，优先匹配长名称
    cardNames.sort((a, b) => b.length - a.length);

    // 遍历文本节点
    this.walkTextNodes(el, (node) => {
      const text = node.textContent;
      if (!text || text.length < 2) return;

      // 查找化合物名称
      for (const name of cardNames) {
        if (name.length < 2) continue;
        if (text.includes(name)) {
          this.highlightCompound(node, name, cardNames.find((c) => c === name));
          break; // 每个节点只高亮第一个匹配
        }
      }
    });
  }

  // 遍历文本节点
  walkTextNodes(el, callback) {
    const walker = document.createTreeWalker(
      el,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          // 跳过代码块、链接、已经处理过的节点
          if (node.parentElement.closest("code, pre, a, .knowledge-link")) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    const nodes = [];
    let node;
    while ((node = walker.nextNode())) {
      nodes.push(node);
    }

    nodes.forEach((n) => callback(n));
  }

  // 高亮化合物名称
  highlightCompound(textNode, name, card) {
    const text = textNode.textContent;
    const index = text.indexOf(name);
    if (index === -1) return;

    const parent = textNode.parentElement;
    if (!parent) return;

    // 创建高亮元素
    const highlight = document.createElement("span");
    highlight.className = "knowledge-link";
    highlight.textContent = name;
    highlight.dataset.compound = name;
    highlight.title = `点击查看 ${name} 详情`;

    // 点击事件
    highlight.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.showCompoundPopup(name, highlight);
    };

    // 分割文本节点
    const before = text.substring(0, index);
    const after = text.substring(index + name.length);

    const fragment = document.createDocumentFragment();
    if (before) fragment.appendChild(document.createTextNode(before));
    fragment.appendChild(highlight);
    if (after) fragment.appendChild(document.createTextNode(after));

    parent.replaceChild(fragment, textNode);
  }

  // 显示化合物详情弹窗
  showCompoundPopup(name, anchorEl) {
    // 查找化合物信息
    const card = (this.plugin.learningCards || []).find((c) => c.name === name);
    if (!card) return;

    // 创建弹窗
    const popup = document.createElement("div");
    popup.className = "knowledge-popup";
    popup.innerHTML = `
      <div class="knowledge-popup-header">
        <h3>${card.name}</h3>
        <button class="knowledge-popup-close">×</button>
      </div>
      <div class="knowledge-popup-body">
        ${card.englishName ? `<p class="popup-english">${card.englishName}</p>` : ""}
        ${card.formula ? `<p><strong>分子式:</strong> ${card.formula}</p>` : ""}
        ${card.category ? `<p><strong>分类:</strong> ${card.category}</p>` : ""}
        ${card.usage ? `<p><strong>用途:</strong> ${card.usage}</p>` : ""}
        ${card.smiles ? `<p><strong>SMILES:</strong><code>${card.smiles}</code></p>` : ""}
      </div>
      <div class="knowledge-popup-actions">
        <button class="popup-btn study-btn">开始学习</button>
        <button class="popup-btn quiz-btn">默写练习</button>
      </div>
    `;

    // 定位弹窗
    document.body.appendChild(popup);
    const rect = anchorEl.getBoundingClientRect();
    popup.style.top = `${rect.bottom + 10}px`;
    popup.style.left = `${Math.min(rect.left, window.innerWidth - 320)}px`;

    // 关闭按钮
    popup.querySelector(".knowledge-popup-close").onclick = () => {
      document.body.removeChild(popup);
    };

    // 点击外部关闭
    setTimeout(() => {
      const closeOnClick = (e) => {
        if (!popup.contains(e.target)) {
          document.body.removeChild(popup);
          document.removeEventListener("click", closeOnClick);
        }
      };
      document.addEventListener("click", closeOnClick);
    }, 0);

    // 学习按钮
    popup.querySelector(".study-btn").onclick = () => {
      new LearningCardModal(this.app, card, () => {}, {}).open();
      document.body.removeChild(popup);
    };

    // 默写按钮
    popup.querySelector(".quiz-btn").onclick = () => {
      new QuizModal(this.app, [card], "structure_to_name", { questionCount: 1 }).open();
      document.body.removeChild(popup);
    };
  }

  // 添加 CSS
  addCSS() {
    if (document.getElementById("knowledge-linking-css")) return;
    const style = document.createElement("style");
    style.id = "knowledge-linking-css";
    style.textContent = `
      .knowledge-link {
        color: var(--interactive-accent);
        border-bottom: 1px dashed var(--interactive-accent);
        cursor: pointer;
        transition: all 0.2s;
      }
      .knowledge-link:hover {
        background: var(--background-modifier-hover);
        border-radius: 3px;
      }
      .knowledge-popup {
        position: fixed;
        width: 300px;
        background: var(--background-primary);
        border: 1px solid var(--background-modifier-border);
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 1000;
        overflow: hidden;
      }
      .knowledge-popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 15px;
        background: var(--background-secondary);
        border-bottom: 1px solid var(--background-modifier-border);
      }
      .knowledge-popup-header h3 {
        margin: 0;
        font-size: 16px;
      }
      .knowledge-popup-close {
        border: none;
        background: none;
        font-size: 20px;
        cursor: pointer;
        color: var(--text-muted);
        padding: 0 5px;
      }
      .knowledge-popup-close:hover {
        color: var(--text-normal);
      }
      .knowledge-popup-body {
        padding: 12px 15px;
        font-size: 13px;
      }
      .knowledge-popup-body p {
        margin: 6px 0;
      }
      .knowledge-popup-body .popup-english {
        color: var(--text-muted);
        font-style: italic;
      }
      .knowledge-popup-body code {
        background: var(--background-secondary);
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 11px;
      }
      .knowledge-popup-actions {
        display: flex;
        gap: 8px;
        padding: 10px 15px;
        border-top: 1px solid var(--background-modifier-border);
      }
      .knowledge-popup-actions .popup-btn {
        flex: 1;
        padding: 6px 10px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background: var(--background-primary);
        color: var(--text-normal);
        cursor: pointer;
        font-size: 12px;
      }
      .knowledge-popup-actions .popup-btn.study-btn {
        background: var(--interactive-accent);
        color: var(--text-on-accent);
        border-color: var(--interactive-accent);
      }
    `;
    document.head.appendChild(style);
  }
}

// 导出
// KnowledgeLinking
