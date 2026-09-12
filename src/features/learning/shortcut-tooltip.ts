// ========== 快捷键提示 UI (v17.2.0) ==========
// 在 UI 中显示快捷键提示
// 悬浮提示框，显示快捷键说明

class ShortcutTooltip {
  constructor() {
    this.tooltip = null;
  }

  /**
   * 显示快捷键提示
   */
  show(anchorEl, shortcuts) {
    this.hide();

    // 创建提示框
    this.tooltip = document.createElement("div");
    this.tooltip.addClass("shortcut-tooltip");

    // 标题
    const title = document.createElement("div");
    title.addClass("shortcut-tooltip-title");
    title.textContent = "快捷键";
    this.tooltip.appendChild(title);

    // 快捷键列表
    const list = document.createElement("div");
    list.addClass("shortcut-tooltip-list");

    shortcuts.forEach(({ key, description }) => {
      const item = document.createElement("div");
      item.addClass("shortcut-tooltip-item");

      const keyEl = document.createElement("kbd");
      keyEl.addClass("shortcut-key");
      keyEl.textContent = key;

      const descEl = document.createElement("span");
      descEl.addClass("shortcut-desc");
      descEl.textContent = description;

      item.appendChild(keyEl);
      item.appendChild(descEl);
      list.appendChild(item);
    });

    this.tooltip.appendChild(list);

    // 定位
    document.body.appendChild(this.tooltip);
    
    const rect = anchorEl.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();
    
    this.tooltip.style.top = `${rect.bottom + 10}px`;
    this.tooltip.style.left = `${rect.left + (rect.width - tooltipRect.width) / 2}px`;

    // 自动隐藏
    this.autoHideTimeout = setTimeout(() => this.hide(), 3000);
  }

  /**
   * 隐藏快捷键提示
   */
  hide() {
    if (this.autoHideTimeout) {
      clearTimeout(this.autoHideTimeout);
      this.autoHideTimeout = null;
    }
    if (this.tooltip) {
      this.tooltip.remove();
      this.tooltip = null;
    }
  }
}

/**
 * 快捷键帮助模态框
 */
class ShortcutHelpModal extends Modal {
  constructor(app) {
    super(app);
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("shortcut-help-modal");

    contentEl.createEl("h2", { text: "⌨️ 快捷键帮助" });

    // 全局快捷键
    contentEl.createEl("h3", { text: "全局快捷键" });
    
    const globalShortcuts = contentEl.createDiv({ cls: "shortcut-section" });
    
    const globalItems = [
      { key: "Ctrl+K", description: "打开知识库搜索" },
      { key: "Ctrl+L", description: "打开学习卡片" },
      { key: "Ctrl+Shift+C", description: "打开学习日历" },
      { key: "Ctrl+Shift+S", description: "打开学习统计" },
      { key: "Escape", description: "关闭弹窗" },
    ];

    globalItems.forEach(({ key, description }) => {
      const item = globalShortcuts.createDiv({ cls: "shortcut-item" });
      item.createEl("kbd", { text: key, cls: "shortcut-key" });
      item.createSpan({ text: description, cls: "shortcut-desc" });
    });

    // 学习卡片快捷键
    contentEl.createEl("h3", { text: "学习卡片快捷键" });
    
    const cardShortcuts = contentEl.createDiv({ cls: "shortcut-section" });
    
    const cardItems = [
      { key: "Space", description: "翻转卡片" },
      { key: "1", description: "标记为忘记" },
      { key: "2", description: "标记为困难" },
      { key: "3", description: "标记为良好" },
      { key: "4", description: "标记为简单" },
      { key: "→", description: "下一张卡片" },
      { key: "←", description: "上一张卡片" },
    ];

    cardItems.forEach(({ key, description }) => {
      const item = cardShortcuts.createDiv({ cls: "shortcut-item" });
      item.createEl("kbd", { text: key, cls: "shortcut-key" });
      item.createSpan({ text: description, cls: "shortcut-desc" });
    });
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// 导出全局变量
// ShortcutTooltip, ShortcutHelpModal
