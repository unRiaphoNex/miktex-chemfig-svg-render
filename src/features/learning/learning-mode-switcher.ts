// ========== 学习模式切换 (v17.2.0) ==========
// 浏览模式：正常使用，浏览/编辑片段库
// 练习模式：隐藏名称，只显示结构，用于自测
// 复习模式：根据间隔重复算法推送待复习卡片

const LEARNING_MODES = {
  BROWSE: "browse",
  PRACTICE: "practice",
  REVIEW: "review",
};

class LearningModeManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.storageKey = "chemfig-learning-mode";
    this.currentMode = LEARNING_MODES.BROWSE;
    this.modeSettings = {
      hideTitles: false, // 练习模式：隐藏标题
      showHints: true,  // 练习模式：显示提示
      autoAdvance: false, // 复习模式：自动推进
    };
    this.load();
  }

  async load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        this.currentMode = parsed.currentMode || LEARNING_MODES.BROWSE;
        this.modeSettings = { ...this.modeSettings, ...parsed.settings };
      }
    } catch (e) {
      console.warn("[LearningMode] 加载模式设置失败:", e.message);
    }
  }

  async save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({
        currentMode: this.currentMode,
        settings: this.modeSettings,
      }));
    } catch (e) {
      console.warn("[LearningMode] 保存模式设置失败:", e.message);
    }
  }

  /**
   * 切换模式
   */
  async switchMode(mode) {
    if (!Object.values(LEARNING_MODES).includes(mode)) {
      console.warn("[LearningMode] 无效的模式:", mode);
      return;
    }
    
    this.currentMode = mode;
    await this.save();
    
    // 触发模式切换事件
    this.onModeChange(mode);
    
    // 通知用户
    const modeNames = {
      [LEARNING_MODES.BROWSE]: "浏览模式",
      [LEARNING_MODES.PRACTICE]: "练习模式",
      [LEARNING_MODES.REVIEW]: "复习模式",
    };
    new Notice(`已切换到: ${modeNames[mode]}`, 2000);
  }

  /**
   * 模式切换回调
   */
  onModeChange(mode) {
    // 可以在这里触发 UI 更新
    // 例如：隐藏/显示标题，显示/隐藏提示
    document.body.classList.remove("learning-mode-browse", "learning-mode-practice", "learning-mode-review");
    document.body.classList.add(`learning-mode-${mode}`);
  }

  /**
   * 获取当前模式
   */
  getCurrentMode() {
    return this.currentMode;
  }

  /**
   * 是否应该隐藏标题
   */
  shouldHideTitles() {
    return this.currentMode === LEARNING_MODES.PRACTICE && this.modeSettings.hideTitles;
  }

  /**
   * 是否应该显示提示
   */
  shouldShowHints() {
    return this.currentMode === LEARNING_MODES.PRACTICE && this.modeSettings.showHints;
  }

  /**
   * 更新设置
   */
  async updateSettings(newSettings) {
    this.modeSettings = { ...this.modeSettings, ...newSettings };
    await this.save();
  }
}

/**
 * 学习模式切换器 UI
 */
class LearningModeSwitcher {
  constructor(plugin, container) {
    this.plugin = plugin;
    this.container = container;
    this.modeManager = new LearningModeManager(plugin);
  }

  render() {
    this.container.empty();
    this.container.addClass("learning-mode-switcher");

    // 模式标签
    const label = this.container.createSpan({
      text: "学习模式:",
      cls: "mode-label",
    });

    // 模式按钮组
    const modeGroup = this.container.createDiv({ cls: "mode-buttons" });

    const modes = [
      { value: LEARNING_MODES.BROWSE, name: "浏览", icon: "👁️" },
      { value: LEARNING_MODES.PRACTICE, name: "练习", icon: "✏️" },
      { value: LEARNING_MODES.REVIEW, name: "复习", icon: "🔄" },
    ];

    modes.forEach(({ value, name, icon }) => {
      const btn = modeGroup.createEl("button", {
        text: `${icon} ${name}`,
        cls: `mode-btn ${this.modeManager.getCurrentMode() === value ? "active" : ""}`,
      });
      
      btn.onclick = async () => {
        await this.modeManager.switchMode(value);
        this.render(); // 重新渲染以更新激活状态
      };
    });
  }
}

// 导出全局变量
// LEARNING_MODES, LearningModeManager, LearningModeSwitcher
