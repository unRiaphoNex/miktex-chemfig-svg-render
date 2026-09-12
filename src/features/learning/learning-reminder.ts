// ========== 学习提醒功能 (v17.2.0) ==========
// 待复习知识点提醒
// 插件启动时检查待复习知识点，显示通知

class LearningReminder {
  constructor(plugin) {
    this.plugin = plugin;
    this.learningManager = new KnowledgeLearningManager(plugin);
    this.storageKey = "chemfig-learning-reminder";
    this.settings = {
      enabled: true,           // 是否启用提醒
      remindOnStartup: true,   // 插件启动时提醒
      remindDaily: true,       // 每日提醒
      dailyReminderTime: "09:00", // 每日提醒时间
      minDueCount: 5,          // 最少待复习数量才提醒
    };
    this.load();
  }

  async load() {
    try {
      const data = localStorage.getItem(this.storageKey);
      if (data) {
        this.settings = { ...this.settings, ...JSON.parse(data) };
      }
    } catch (e) {
      console.warn("[LearningReminder] 加载提醒设置失败:", e.message);
    }
  }

  async save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
    } catch (e) {
      console.warn("[LearningReminder] 保存提醒设置失败:", e.message);
    }
  }

  /**
   * 检查并显示提醒
   */
  async checkAndRemind() {
    if (!this.settings.enabled) return;

    const dueForReview = this.learningManager.getDueForReview();
    
    if (dueForReview.length >= this.settings.minDueCount) {
      this.showReminderNotification(dueForReview.length);
    }
  }

  /**
   * 显示提醒通知
   */
  showReminderNotification(count) {
    new Notice(`📚 您有 ${count} 个知识点待复习！`, 5000);
  }

  /**
   * 启动时提醒
   */
  async onPluginLoad() {
    if (this.settings.remindOnStartup) {
      await this.checkAndRemind();
    }
  }

  /**
   * 更新设置
   */
  async updateSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
    await this.save();
  }

  /**
   * 获取当前设置
   */
  getSettings() {
    return { ...this.settings };
  }
}

/**
 * 学习提醒设置模态框
 */
class LearningReminderSettingsModal extends Modal {
  constructor(app) {
    super(app);
    this.reminder = new LearningReminder(null);
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("learning-reminder-settings");

    contentEl.createEl("h2", { text: "🔔 学习提醒设置" });

    const settings = this.reminder.getSettings();

    // 启用提醒
    const enabledRow = contentEl.createDiv({ cls: "settings-row" });
    enabledRow.createLabel({ text: "启用提醒" });
    const enabledCheckbox = enabledRow.createEl("input", {
      type: "checkbox",
      attr: { checked: settings.enabled },
    });

    // 启动时提醒
    const startupRow = contentEl.createDiv({ cls: "settings-row" });
    startupRow.createLabel({ text: "插件启动时提醒" });
    const startupCheckbox = startupRow.createEl("input", {
      type: "checkbox",
      attr: { checked: settings.remindOnStartup },
    });

    // 每日提醒
    const dailyRow = contentEl.createDiv({ cls: "settings-row" });
    dailyRow.createLabel({ text: "每日提醒" });
    const dailyCheckbox = dailyRow.createEl("input", {
      type: "checkbox",
      attr: { checked: settings.remindDaily },
    });

    // 每日提醒时间
    const timeRow = contentEl.createDiv({ cls: "settings-row" });
    timeRow.createLabel({ text: "每日提醒时间" });
    const timeInput = timeRow.createEl("input", {
      type: "time",
      value: settings.dailyReminderTime,
    });

    // 最少待复习数量
    const countRow = contentEl.createDiv({ cls: "settings-row" });
    countRow.createLabel({ text: "最少待复习数量" });
    const countInput = countRow.createEl("input", {
      type: "number",
      value: settings.minDueCount,
      attr: { min: "1", max: "100" },
    });

    // 保存按钮
    const saveBtn = contentEl.createEl("button", {
      text: "保存设置",
      cls: "chemfig-action-btn",
    });

    saveBtn.onclick = async () => {
      await this.reminder.updateSettings({
        enabled: enabledCheckbox.checked,
        remindOnStartup: startupCheckbox.checked,
        remindDaily: dailyCheckbox.checked,
        dailyReminderTime: timeInput.value,
        minDueCount: parseInt(countInput.value) || 5,
      });
      new Notice("设置已保存", 2000);
      this.close();
    };
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// 导出全局变量
// LearningReminder, LearningReminderSettingsModal
