// ========== 设置面板模块 ==========
// 学习自 obsidian-style-settings, editing-toolbar 等热门插件
// 使用 PluginSettingTab + Setting 组件

class ChemfigSettingTab extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "MikTeX Chemfig SVG Renderer 设置" });

    // ========== V2.0-iter: 渲染后端 / 缓存 / OCL ==========
    containerEl.createEl("h3", { text: "渲染后端 (V2.0)" });

    // SVG 渲染确认选项
    new Setting(containerEl)
      .setName("SVG 渲染确认")
      .setDesc(
        "开启后，编辑器里修改代码不会自动渲染；需在操作台点击「输出预览 / 确认生成」才进行编译渲染，避免误改即触发"
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.manualPreviewEnabled !== false).onChange(async (value) => {
          this.plugin.manualPreviewEnabled = value;
          await this.plugin.saveData({ manualPreviewEnabled: value });
        })
      );

    new Setting(containerEl)
      .setName("渲染后端 renderBackend")
      .setDesc(
        "bridge = 推荐, 由外部 Node 桥接服务编译 (安全, JobObject/队列管控); local = 遗留, 插件直接 spawn 本机 pdflatex (需 MiKTeX)"
      )
      .addDropdown((dropdown) =>
        dropdown
          .addOption("local", "local (遗留, 直连 MiKTeX)")
          .addOption("bridge", "bridge (推荐, 桥接服务)")
          .setValue(this.plugin.renderBackend || "local")
          .onChange(async (value) => {
            this.plugin.renderBackend = value;
            await this.plugin.saveData({ renderBackend: value });
            if (typeof syncLocalWarn === "function") syncLocalWarn();
          })
      );

    // local 模式常驻安全警告
    const localWarn = containerEl.createEl("div", {
      text: "⚠️ local 后端 (遗留) 会直接在本机 spawn pdflatex 进程, 存在注入/资源占用风险。强烈建议切换到 bridge 后端 (需先运行桥接服务 node server.js, 端口 9123)。",
    });
    localWarn.style.cssText =
      "color:var(--text-warning);font-size:12px;margin:4px 0 8px 0;padding:8px;border:1px solid var(--background-modifier-border);border-radius:6px;display:none;";
    const syncLocalWarn = () => {
      localWarn.style.display = this.plugin.renderBackend !== "bridge" ? "block" : "none";
    };
    syncLocalWarn();
    this.plugin.settingsManager.onChange(function (event) {
      if (event === "save" || event === "reset" || event === "batch") syncLocalWarn();
    });

    new Setting(containerEl)
      .setName("桥接服务地址 bridgeUrl")
      .setDesc("bridge 模式下的 Node 桥接服务地址 (默认 http://127.0.0.1:9123)")
      .addText((text) =>
        text
          .setPlaceholder("http://127.0.0.1:9123")
          .setValue(this.plugin.bridgeUrl || "http://127.0.0.1:9123")
          .onChange(async (value) => {
            this.plugin.bridgeUrl = value;
            await this.plugin.saveData({ bridgeUrl: value });
          })
      );

    new Setting(containerEl)
      .setName("启用 SVG 缓存 enableCache")
      .setDesc("以 chemfig 源码 SHA256 作为 key 缓存 SVG, 源码不变直接读缓存跳过编译")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.enableCache !== false).onChange(async (value) => {
          this.plugin.enableCache = value;
          await this.plugin.saveData({ enableCache: value });
        })
      );

    new Setting(containerEl)
      .setName("缓存目录 cacheFolder")
      .setDesc("缓存存放路径; 留空则使用 <插件目录>/svg-cache")
      .addText((text) =>
        text
          .setPlaceholder("留空使用默认")
          .setValue(this.plugin.cacheFolder || "")
          .onChange(async (value) => {
            this.plugin.cacheFolder = value;
            await this.plugin.saveData({ cacheFolder: value });
          })
      );

    new Setting(containerEl)
      .setName("SVG 输出目录 svgOutputFolder")
      .setDesc("SVG 源文件输出目录; 留空则保持旧布局 (笔记/svg_source)")
      .addText((text) =>
        text
          .setPlaceholder("留空使用默认")
          .setValue(this.plugin.svgOutputFolder || "")
          .onChange(async (value) => {
            this.plugin.svgOutputFolder = value;
            await this.plugin.saveData({ svgOutputFolder: value });
          })
      );

    new Setting(containerEl)
      .setName("分子画布编辑器 enableChemEditor")
      .setDesc("关闭后隐藏 OCL 分子画布编辑器入口 (结构式编辑 / SMILES / SMARTS)")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.enableChemEditor !== false).onChange(async (value) => {
          this.plugin.enableChemEditor = value;
          await this.plugin.saveData({ enableChemEditor: value });
        })
      );

    new Setting(containerEl)
      .setName("模板/片段库 enableTemplateLibrary")
      .setDesc("关闭后隐藏结构式模板库与画布片段库入口")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.enableTemplateLibrary !== false).onChange(async (value) => {
          this.plugin.enableTemplateLibrary = value;
          await this.plugin.saveData({ enableTemplateLibrary: value });
        })
      );

    // 默认渲染模式
    new Setting(containerEl)
      .setName("默认渲染模式")
      .setDesc("新建代码块时的默认模式")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("chem", "chem (最简写法)")
          .addOption("tikz", "tikz (完整写法)")
          .addOption("miktex", "miktex (完整LaTeX)")
          .setValue(this.plugin.defaultMode || "chem")
          .onChange(async (value) => {
            this.plugin.defaultMode = value;
            await this.plugin.saveData({ defaultMode: value });
          })
      );

    // PNG 缩放比例
    new Setting(containerEl)
      .setName("PNG 缩放比例")
      .setDesc("SVG 转 PNG 时的缩放比例 (越高越清晰, 文件越大)")
      .addSlider((slider) =>
        slider
          .setLimits(1, 3, 0.5)
          .setValue(this.plugin.pngScale || 1.5)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.pngScale = value;
            await this.plugin.saveData({ pngScale: value });
          })
      );

    // 编译缓存开关
    new Setting(containerEl)
      .setName("启用编译缓存")
      .setDesc("相同代码重复编译时使用缓存, 加速预览 (5分钟有效期)")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.compileCacheEnabled !== false).onChange(async (value) => {
          this.plugin.compileCacheEnabled = value;
          if (!value && this.plugin._compileCache) this.plugin._compileCache.clear();
          await this.plugin.saveData({ compileCacheEnabled: value });
        })
      );

    // 实时预览开关
    new Setting(containerEl)
      .setName("启用实时预览")
      .setDesc("编辑器中修改代码后自动编译预览 (防抖500ms)")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.livePreviewEnabled !== false).onChange(async (value) => {
          this.plugin.livePreviewEnabled = value;
          await this.plugin.saveData({ livePreviewEnabled: value });
        })
      );

    // 性能监控开关
    new Setting(containerEl)
      .setName("启用性能监控")
      .setDesc("记录各操作耗时, 超过100ms输出警告日志 (用于调试)")
      .addToggle((toggle) =>
        toggle.setValue(perf.enabled).onChange(async (value) => {
          perf.enabled = value;
          await this.plugin.saveData({ perfMonitorEnabled: value });
        })
      );

    // 性能报告按钮
    new Setting(containerEl)
      .setName("查看性能报告")
      .setDesc("在控制台输出各操作的平均/最大耗时")
      .addButton((btn) =>
        btn.setButtonText("输出报告").onClick(() => {
          const report = perf.getReport ? perf.getReport() : "暂无性能记录";
          console.log("[Chemfig-SVG 性能报告]", report);
          new Notice("性能报告已输出到控制台", 3000);
        })
      );

    // CM6 Live Preview 内联渲染 (实验性)
    new Setting(containerEl)
      .setName("CM6 Live Preview 渲染 (实验性)")
      .setDesc("在实时预览模式下内联显示编译结果, 需重载插件生效 (可能不稳定)")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.cm6LivePreviewEnabled === true).onChange(async (value) => {
          this.plugin.cm6LivePreviewEnabled = value;
          await this.plugin.saveData({ cm6LivePreviewEnabled: value });
          new Notice("设置已保存, 请重载插件生效", 3000);
        })
      );

    // ========== v10.11.0: 侧边栏设置 ==========
    containerEl.createEl("h3", { text: "侧边栏设置" });

    new Setting(containerEl)
      .setName("启用左侧操作面板")
      .setDesc("在左侧边栏显示化学式模板快速插入面板 (需重载插件生效)")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.leftSidebarEnabled !== false).onChange(async (value) => {
          this.plugin.leftSidebarEnabled = value;
          await this.plugin.saveData({ leftSidebarEnabled: value });
          new Notice("设置已保存, 请重载插件生效", 3000);
        })
      );

    new Setting(containerEl)
      .setName("启用右侧代码编辑器")
      .setDesc("在右侧边栏显示代码编辑器和预览面板 (需重载插件生效)")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.rightSidebarEnabled !== false).onChange(async (value) => {
          this.plugin.rightSidebarEnabled = value;
          await this.plugin.saveData({ rightSidebarEnabled: value });
          new Notice("设置已保存, 请重载插件生效", 3000);
        })
      );

    new Setting(containerEl)
      .setName("侧边栏与笔记双向同步")
      .setDesc("侧边栏代码修改后自动同步到当前笔记的代码块, 笔记代码修改时同步到侧边栏")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.sidebarSyncEnabled !== false).onChange(async (value) => {
          this.plugin.sidebarSyncEnabled = value;
          await this.plugin.saveData({ sidebarSyncEnabled: value });
        })
      );

    // 关于信息
    containerEl.createEl("hr");
    containerEl.createEl("p", { text: "编译依赖: MiKTeX (latex + dvisvgm)" });
    containerEl.createEl("p", { text: "编译链路: latex → DVI → dvisvgm --no-fonts" });
    containerEl.createEl("p", { text: "支持模式: chem / tikz / miktex" });
  }
}
