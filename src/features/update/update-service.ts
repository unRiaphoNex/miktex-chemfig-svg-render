// ========== 在线更新服务模块 (v11.1.0) ==========
// 功能: 在线检查化合物数据库更新、模板库更新、插件版本更新
// 数据源: GitHub 仓库 raw 文件

// ========== 更新配置 ==========
const UPDATE_CONFIG = {
  // 数据库版本信息 (JSON 文件, 包含版本号和数据)
  remoteVersionUrl:
    "https://raw.githubusercontent.com/unRiaphoNex/miktex-chemfig-svg-render/main/data/card-db-version.json",
  remoteCardDbUrl:
    "https://raw.githubusercontent.com/unRiaphoNex/miktex-chemfig-svg-render/main/data/learning-cards.json",
  remoteTemplateDbUrl:
    "https://raw.githubusercontent.com/unRiaphoNex/miktex-chemfig-svg-render/main/data/templates.json",

  // 插件 manifest 版本
  manifestUrl:
    "https://raw.githubusercontent.com/unRiaphoNex/miktex-chemfig-svg-render/main/manifest.json",

  // 本地存储键
  localCardDbKey: "chemfig-learning-cards-db",
  localCardDbVersionKey: "chemfig-learning-cards-db-version",
  localTemplateDbVersionKey: "chemfig-templates-db-version",
  localLastUpdateCheckKey: "chemfig-last-update-check",

  // 检查间隔 (毫秒): 24小时
  checkInterval: 24 * 60 * 60 * 1000,
};

// ========== 更新服务类 ==========
class UpdateService {
  constructor(plugin) {
    this.plugin = plugin;
    this.app = plugin.app;
    this.isUpdating = false;
  }

  /**
   * 获取本地数据库版本
   */
  getLocalCardDbVersion() {
    return localStorage.getItem(UPDATE_CONFIG.localCardDbVersionKey) || "1.0.0";
  }

  /**
   * 设置本地数据库版本
   */
  setLocalCardDbVersion(version) {
    localStorage.setItem(UPDATE_CONFIG.localCardDbVersionKey, version);
  }

  /**
   * 检查是否需要检查更新
   */
  shouldCheckUpdate() {
    const lastCheck = parseInt(localStorage.getItem(UPDATE_CONFIG.localLastUpdateCheckKey) || "0");
    const now = Date.now();
    return now - lastCheck > UPDATE_CONFIG.checkInterval;
  }

  /**
   * 标记已检查更新
   */
  markChecked() {
    localStorage.setItem(UPDATE_CONFIG.localLastUpdateCheckKey, String(Date.now()));
  }

  /**
   * 从远程获取版本信息
   */
  async fetchRemoteVersion() {
    try {
      const response = await fetch(UPDATE_CONFIG.remoteVersionUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (e) {
      console.warn("[Chemfig-SVG] 获取远程版本失败:", e.message);
      return null;
    }
  }

  /**
   * 从远程获取卡片数据库
   */
  async fetchRemoteCardDb() {
    try {
      const response = await fetch(UPDATE_CONFIG.remoteCardDbUrl, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (e) {
      console.warn("[Chemfig-SVG] 获取远程卡片库失败:", e.message);
      return null;
    }
  }

  /**
   * 版本比较: 比较两个语义化版本号
   * @returns {number} 1 = remote > local, 0 = equal, -1 = remote < local
   */
  compareVersions(remote, local) {
    const parse = (v) => v.split(".").map((n) => parseInt(n, 10) || 0);
    const r = parse(remote);
    const l = parse(local);
    for (let i = 0; i < 3; i++) {
      if (r[i] > l[i]) return 1;
      if (r[i] < l[i]) return -1;
    }
    return 0;
  }

  /**
   * 检查更新
   * @param {boolean} showNotice - 是否显示提示
   * @returns {Object|null} 更新信息 { hasUpdate, remoteVersion, localVersion, cardCount }
   */
  async checkForUpdates(showNotice = true) {
    if (this.isUpdating) {
      new Notice("[Chemfig-SVG] 更新正在进行中...", 2000);
      return null;
    }

    this.markChecked();

    const remoteInfo = await this.fetchRemoteVersion();
    if (!remoteInfo) {
      if (showNotice) new Notice("[Chemfig-SVG] 无法连接到更新服务器", 3000);
      return null;
    }

    const localVersion = this.getLocalCardDbVersion();
    const remoteVersion = remoteInfo.version || "1.0.0";
    const hasUpdate = this.compareVersions(remoteVersion, localVersion) > 0;

    if (showNotice) {
      if (hasUpdate) {
        new Notice(
          `[Chemfig-SVG] 发现新数据库版本: ${remoteVersion} (当前: ${localVersion})`,
          4000
        );
      } else {
        new Notice(
          `[Chemfig-SVG] 数据库已是最新版本 (${localVersion})`,
          2000
        );
      }
    }

    return {
      hasUpdate,
      remoteVersion,
      localVersion,
      cardCount: remoteInfo.cardCount || 0,
      changelog: remoteInfo.changelog || "",
    };
  }

  /**
   * 执行更新
   * @returns {boolean} 是否成功
   */
  async updateCardDb() {
    if (this.isUpdating) return false;
    this.isUpdating = true;

    try {
      new Notice("[Chemfig-SVG] 正在下载最新数据库...", 2000);

      const remoteData = await this.fetchRemoteCardDb();
      if (!remoteData || !Array.isArray(remoteData.cards)) {
        throw new Error("远程数据格式错误");
      }

      // 合并本地和远程卡片 (本地用户自定义的保留, 远程新的添加)
      const localCards = this.plugin.learningCards || [];
      const localIds = new Set(localCards.map((c) => c.id));

      const merged = [...localCards];
      let newCount = 0;

      for (const remoteCard of remoteData.cards) {
        const cardId = remoteCard.id || "remote_" + remoteCard.name;
        if (!localIds.has(cardId)) {
          // 新卡片: 添加默认学习状态
          merged.push({
            ...remoteCard,
            id: cardId,
            state: SM2Algorithm.defaultState(),
          });
          newCount++;
        }
      }

      // 保存到 localStorage
      this.plugin.learningCards = merged;
      this.plugin.saveLearningCards();

      // 更新版本号
      const remoteVersion = remoteData.version || "1.0.0";
      this.setLocalCardDbVersion(remoteVersion);

      new Notice(
        `✅ 数据库更新完成! 新增 ${newCount} 张卡片, 共 ${merged.length} 张`,
        4000
      );

      console.log(
        `[Chemfig-SVG] 数据库更新: ${localCards.length} → ${merged.length} (新增 ${newCount})`
      );
      return true;
    } catch (e) {
      console.error("[Chemfig-SVG] 数据库更新失败:", e);
      new Notice("[Chemfig-SVG] 更新失败: " + e.message, 4000);
      return false;
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * 检查插件版本更新
   */
  async checkPluginUpdate() {
    try {
      const response = await fetch(UPDATE_CONFIG.manifestUrl);
      if (!response.ok) return null;
      const remoteManifest = await response.json();
      const localVersion = this.plugin.manifest?.version || "0.0.0";
      const remoteVersion = remoteManifest.version || "0.0.0";

      return {
        hasUpdate: this.compareVersions(remoteVersion, localVersion) > 0,
        localVersion,
        remoteVersion,
      };
    } catch (e) {
      return null;
    }
  }
}

// ========== 更新设置面板 UI ==========
class UpdateSettingsPanel {
  /**
   * 在设置面板中添加更新区块
   * @param {HTMLElement} container - 设置面板容器
   * @param {Object} plugin - 插件实例
   */
  static render(container, plugin) {
    const updateService = new UpdateService(plugin);

    // 创建更新区块
    const section = container.createDiv({ cls: "chemfig-update-section" });

    section.createEl("h3", { text: "🔄 在线更新" });

    // 当前版本信息
    const versionInfo = section.createDiv({ cls: "chemfig-update-info" });
    const localVersion = localStorage.getItem(UPDATE_CONFIG.localCardDbVersionKey) || "1.0.0";
    const cardCount = (plugin.learningCards || []).length;

    versionInfo.createEl("p", {
      text: `数据库版本: v${localVersion} | 卡片数量: ${cardCount}`,
    });

    // 按钮组
    const btnGroup = section.createDiv({ cls: "chemfig-update-buttons" });

    // 检查更新按钮
    const checkBtn = btnGroup.createEl("button", {
      text: "检查更新",
      cls: "chemfig-action-btn",
    });
    checkBtn.onclick = async () => {
      checkBtn.disabled = true;
      checkBtn.textContent = "检查中...";
      const result = await updateService.checkForUpdates(true);
      checkBtn.disabled = false;
      checkBtn.textContent = "检查更新";

      if (result && result.hasUpdate) {
        // 显示更新确认
        const updateBtn = btnGroup.createEl("button", {
          text: `更新到 v${result.remoteVersion}`,
          cls: "chemfig-primary-btn",
        });
        updateBtn.onclick = async () => {
          updateBtn.disabled = true;
          updateBtn.textContent = "更新中...";
          await updateService.updateCardDb();
          updateBtn.remove();
          // 刷新版本显示
          this.refreshVersionInfo(versionInfo, plugin);
        };
      }
    };

    // 立即更新按钮 (强制更新)
    const forceUpdateBtn = btnGroup.createEl("button", {
      text: "强制更新数据库",
      cls: "chemfig-secondary-btn",
    });
    forceUpdateBtn.onclick = async () => {
      forceUpdateBtn.disabled = true;
      forceUpdateBtn.textContent = "更新中...";
      await updateService.updateCardDb();
      forceUpdateBtn.disabled = false;
      forceUpdateBtn.textContent = "强制更新数据库";
      this.refreshVersionInfo(versionInfo, plugin);
    };
  }

  static refreshVersionInfo(el, plugin) {
    const localVersion = localStorage.getItem(UPDATE_CONFIG.localCardDbVersionKey) || "1.0.0";
    const cardCount = (plugin.learningCards || []).length;
    el.empty();
    el.createEl("p", {
      text: `数据库版本: v${localVersion} | 卡片数量: ${cardCount}`,
    });
  }
}

// ========== 更新功能 CSS ==========
const UPDATE_CSS = `
.chemfig-update-section {
  margin: 20px 0;
  padding: 16px;
  background: var(--background-secondary);
  border-radius: 8px;
}
.chemfig-update-info {
  margin: 12px 0;
  font-size: 14px;
  color: var(--text-muted);
}
.chemfig-update-buttons {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.chemfig-primary-btn {
  padding: 8px 16px;
  background: var(--interactive-accent);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.chemfig-primary-btn:hover {
  opacity: 0.9;
}
.chemfig-secondary-btn {
  padding: 8px 16px;
  background: var(--background-primary);
  color: var(--text-normal);
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  cursor: pointer;
}
.chemfig-secondary-btn:hover {
  background: var(--background-modifier-hover);
}
`;

// 导出全局变量
// UpdateService, UpdateSettingsPanel, UPDATE_CSS, UPDATE_CONFIG
