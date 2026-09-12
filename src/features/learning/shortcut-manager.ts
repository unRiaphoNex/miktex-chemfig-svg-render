// ========== 快捷键支持 (v17.2.0) ==========
// 快速搜索：Ctrl+K
// 翻转卡片：Space
// 标记难度：1/2/3/4

const SHORTCUTS = {
  OPEN_SEARCH: "Ctrl+K",        // 打开搜索
  OPEN_LEARNING: "Ctrl+L",      // 打开学习卡片
  OPEN_CALENDAR: "Ctrl+Shift+C", // 打开学习日历
  OPEN_STATS: "Ctrl+Shift+S",   // 打开学习统计
  FLIP_CARD: "Space",           // 翻转卡片
  RATE_AGAIN: "1",              // 忘记
  RATE_HARD: "2",               // 困难
  RATE_GOOD: "3",               // 良好
  RATE_EASY: "4",               // 简单
  NEXT_CARD: "ArrowRight",      // 下一张卡片
  PREV_CARD: "ArrowLeft",       // 上一张卡片
  CLOSE_MODAL: "Escape",        // 关闭弹窗
};

class ShortcutManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.enabled = true;
    this.activeModals = new Set(); // 当前活跃的模态框
  }

  /**
   * 初始化快捷键
   */
  init() {
    document.addEventListener("keydown", this.handleKeyDown.bind(this));
  }

  /**
   * 注册模态框
   */
  registerModal(modal) {
    this.activeModals.add(modal);
  }

  /**
   * 注销模态框
   */
  unregisterModal(modal) {
    this.activeModals.delete(modal);
  }

  /**
   * 检查是否有活跃的模态框
   */
  hasActiveModal() {
    return this.activeModals.size > 0;
  }

  /**
   * 处理按键事件
   */
  handleKeyDown(e) {
    if (!this.enabled) return;

    // 检查是否在输入框中
    const target = e.target;
    const isInput = target.tagName === "INPUT" || 
                    target.tagName === "TEXTAREA" || 
                    target.tagName === "SELECT" ||
                    target.isContentEditable;

    // Ctrl+K: 打开搜索（全局）
    if (e.ctrlKey && e.key === "k") {
      e.preventDefault();
      this.openSearch();
      return;
    }

    // Ctrl+L: 打开学习卡片（全局）
    if (e.ctrlKey && e.key === "l") {
      e.preventDefault();
      this.openLearningCards();
      return;
    }

    // Ctrl+Shift+C: 打开学习日历（全局）
    if (e.ctrlKey && e.shiftKey && e.key === "C") {
      e.preventDefault();
      this.openLearningCalendar();
      return;
    }

    // Ctrl+Shift+S: 打开学习统计（全局）
    if (e.ctrlKey && e.shiftKey && e.key === "S") {
      e.preventDefault();
      this.openLearningStats();
      return;
    }

    // 如果有活跃的模态框，处理模态框快捷键
    if (this.hasActiveModal()) {
      // Space: 翻转卡片
      if (e.key === " " && !isInput) {
        e.preventDefault();
        this.flipActiveCard();
        return;
      }

      // 1/2/3/4: 评分
      if (!isInput && ["1", "2", "3", "4"].includes(e.key)) {
        e.preventDefault();
        const rating = parseInt(e.key);
        this.rateActiveCard(rating);
        return;
      }

      // ArrowLeft/ArrowRight: 切换卡片
      if (!isInput && e.key === "ArrowRight") {
        e.preventDefault();
        this.nextCard();
        return;
      }
      if (!isInput && e.key === "ArrowLeft") {
        e.preventDefault();
        this.prevCard();
        return;
      }

      // Escape: 关闭模态框
      if (e.key === "Escape") {
        e.preventDefault();
        this.closeActiveModal();
        return;
      }
    }
  }

  /**
   * 打开搜索面板
   */
  openSearch() {
    // 触发打开知识库搜索面板的命令
    if (this.plugin && this.plugin.app) {
      this.plugin.app.workspace.openLinkText("", "", false);
      new Notice("按 Ctrl+K 打开搜索", 2000);
    }
  }

  /**
   * 打开学习卡片
   */
  openLearningCards() {
    if (typeof FSLearningCardModal !== "undefined") {
      const modal = new FSLearningCardModal(this.plugin.app, []);
      modal.open();
      this.registerModal(modal);
    } else {
      new Notice("学习卡片功能未加载", 2000);
    }
  }

  /**
   * 打开学习日历
   */
  openLearningCalendar() {
    if (typeof StudyCalendarModal !== "undefined") {
      const modal = new StudyCalendarModal(this.plugin.app);
      modal.open();
      this.registerModal(modal);
    } else {
      new Notice("学习日历功能未加载", 2000);
    }
  }

  /**
   * 打开学习统计
   */
  openLearningStats() {
    new Notice("学习统计面板", 2000);
  }

  /**
   * 翻转活跃卡片
   */
  flipActiveCard() {
    this.activeModals.forEach((modal) => {
      if (modal.flipCard) {
        modal.flipCard();
      }
    });
  }

  /**
   * 评分活跃卡片
   */
  rateActiveCard(rating) {
    this.activeModals.forEach((modal) => {
      if (modal.rateCard) {
        modal.rateCard(rating);
      }
    });
  }

  /**
   * 下一张卡片
   */
  nextCard() {
    this.activeModals.forEach((modal) => {
      if (modal.nextCard) {
        modal.nextCard();
      }
    });
  }

  /**
   * 上一张卡片
   */
  prevCard() {
    this.activeModals.forEach((modal) => {
      if (modal.prevCard) {
        modal.prevCard();
      }
    });
  }

  /**
   * 关闭活跃模态框
   */
  closeActiveModal() {
    this.activeModals.forEach((modal) => {
      if (modal.close) {
        modal.close();
      }
    });
    this.activeModals.clear();
  }

  /**
   * 销毁快捷键管理器
   */
  destroy() {
    document.removeEventListener("keydown", this.handleKeyDown.bind(this));
    this.activeModals.clear();
  }
}

// 导出全局变量
// SHORTCUTS, ShortcutManager
