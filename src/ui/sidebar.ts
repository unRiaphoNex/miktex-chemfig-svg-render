// ========== 侧边栏视图模块 (v10.11.0) ==========
// 左侧边栏: ce操作页面 (模板选择 + 结构式库联动 + 快捷插入)
// 右侧边栏: 代码编辑页面 (代码编辑 + 预览 + 组分调整 + 双向同步)
// 注意: 本模块直接定义全局类, 不使用 module.exports (与其他模块保持一致)
// ItemView, WorkspaceLeaf, Notice 已在其他模块从 obsidian 导入, 这里直接使用

// ========== 左侧边栏: ce操作页面 ==========
class ChemfigLeftSidebarView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.navigation = false;
    this.libraryItems = [];
  }

  getViewType() {
    return "chemfig-left-sidebar";
  }
  getDisplayText() {
    return "Chemfig 操作面板";
  }
  getIcon() {
    return "flask";
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("chemfig-sidebar-view");

    // 标题
    const header = contentEl.createDiv({ cls: "chemfig-sidebar-header" });
    header.createEl("h3", { text: "🧪 Chemfig 操作面板" });
    header.createEl("p", { text: "快速插入化学式模板", cls: "chemfig-sidebar-subtitle" });

    // 搜索框
    const searchContainer = contentEl.createDiv({ cls: "chemfig-sidebar-search" });
    const searchInput = searchContainer.createEl("input", {
      type: "text",
      placeholder: "搜索模板...",
      cls: "chemfig-sidebar-search-input",
    });

    // v10.15.0: 面包屑导航 + 完整模板库
    const breadcrumbEl = contentEl.createDiv({ cls: "chemfig-sidebar-breadcrumb" });
    this.breadcrumb = ["全部"];

    // 从完整模板库获取所有分类
    this.allTemplates = [];
    try {
      // 从 MODES 获取所有模式的模板
      const modes = ["chem", "tikz", "miktex", "ce"];
      for (let mi = 0; mi < modes.length; mi++) {
        const mode = modes[mi];
        const tpls = (typeof MODES !== "undefined" && MODES[mode] && MODES[mode].templates) || [];
        for (let ti = 0; ti < tpls.length; ti++) {
          const t = tpls[ti];
          this.allTemplates.push({
            name: t.name,
            code: t.code,
            category: t.category || "未分类",
            subcategory: t.subcategory || "",
            mode: mode,
          });
        }
      }
    } catch (e) {
      console.warn("[Chemfig-SVG] 加载模板库失败:", e.message);
    }

    // v2.0: 结构式库联动 —— 读取插件实例中的结构式库 (IndexedDB/localStorage 已加载)
    this.libraryItems =
      this.plugin.structureLibrary && Array.isArray(this.plugin.structureLibrary)
        ? this.plugin.structureLibrary
        : [];

    // 模板列表容器
    const templateContainer = contentEl.createDiv({ cls: "chemfig-sidebar-templates" });

    // 渲染面包屑 (v2.0: 修复 var 闭包导致点击始终跳最后一级的问题)
    const self = this;
    function renderBreadcrumb() {
      breadcrumbEl.empty();
      self.breadcrumb.forEach(function (crumb, idx) {
        const crumbEl = breadcrumbEl.createSpan({ cls: "chemfig-breadcrumb-item" });
        crumbEl.textContent = crumb;
        if (idx < self.breadcrumb.length - 1) {
          crumbEl.textContent += " / ";
        }
        crumbEl.style.cursor = "pointer";
        crumbEl.style.color = "var(--interactive-accent)";
        crumbEl.onclick = function () {
          self.breadcrumb = self.breadcrumb.slice(0, idx + 1);
          renderBreadcrumb();
          renderTemplates(searchInput.value);
        };
      });
    }

    // 渲染模板列表
    function renderTemplates(filter) {
      filter = filter || "";
      templateContainer.empty();
      const q = filter.toLowerCase();

      // 获取当前层级的分类
      const currentCat = self.breadcrumb[self.breadcrumb.length - 1];
      const currentSubcat =
        self.breadcrumb.length > 2 ? self.breadcrumb[self.breadcrumb.length - 1] : null;

      // 过滤模板
      const filtered = self.allTemplates.filter(function (t) {
        // 搜索过滤
        if (q && t.name.toLowerCase().indexOf(q) < 0 && t.code.toLowerCase().indexOf(q) < 0)
          return false;
        // 分类过滤
        if (currentCat === "全部") return true;
        if (t.category !== currentCat) return false;
        if (currentSubcat && t.subcategory !== currentSubcat) return false;
        return true;
      });

      // 如果在一级分类下，显示二级分类（subcategory）
      if (self.breadcrumb.length === 2 && !q) {
        // 收集当前分类下的所有 subcategory
        const subcats = {};
        for (let i = 0; i < filtered.length; i++) {
          const sc = filtered[i].subcategory || "其他";
          if (!subcats[sc]) subcats[sc] = [];
          subcats[sc].push(filtered[i]);
        }
        // 渲染二级分类按钮
        const subGrid = templateContainer.createDiv({ cls: "chemfig-sidebar-subcat-grid" });
        const subNames = Object.keys(subcats).sort();
        for (let si = 0; si < subNames.length; si++) {
          const sn = subNames[si];
          const subBtn = subGrid.createEl("button", {
            text: sn + " (" + subcats[sn].length + ")",
            cls: "chemfig-sidebar-subcat-btn",
          });
          subBtn.onclick = (function (name) {
            return function () {
              self.breadcrumb.push(name);
              renderBreadcrumb();
              renderTemplates(searchInput.value);
            };
          })(sn);
        }
        // 同时显示当前分类下的所有模板
        self.renderCategory(templateContainer, { name: currentCat, icon: "📁" }, filtered);
      } else {
        // 显示模板列表
        self.renderCategory(templateContainer, { name: currentCat, icon: "📁" }, filtered);
      }
      // v2.0: 始终渲染结构式库联动区
      self.renderLibrary(templateContainer, q);
    }

    // 初始渲染
    renderBreadcrumb();
    renderTemplates();
    searchInput.oninput = function () {
      renderTemplates(searchInput.value);
    };

    // 底部操作区
    const footer = contentEl.createDiv({ cls: "chemfig-sidebar-footer" });
    const openEditorBtn = footer.createEl("button", {
      text: "✏️ 打开代码编辑器",
      cls: "chemfig-sidebar-action-btn",
    });
    openEditorBtn.onclick = () => {
      this.plugin.openRightSidebar();
    };

    const openGroupBtn = footer.createEl("button", {
      text: "🎨 打开组分调整",
      cls: "chemfig-sidebar-action-btn",
    });
    openGroupBtn.onclick = () => {
      const activeLeaf = this.plugin.app.workspace.activeLeaf;
      if (activeLeaf && activeLeaf.view && activeLeaf.view.editor) {
        this.plugin.openGroupLayoutFromEditor(activeLeaf.view.editor);
      } else {
        new Notice("请先在编辑器中定位到代码块", 2000);
      }
    };

    // v10.11.0: 刷新结构式库按钮
    const refreshLibBtn = footer.createEl("button", {
      text: "🔄 刷新结构式库",
      cls: "chemfig-sidebar-action-btn",
    });
    refreshLibBtn.onclick = async () => {
      try {
        if (this.plugin._loadLibraryFromDB) {
          await this.plugin._loadLibraryFromDB();
        }
        if (this.plugin.structureLibrary && Array.isArray(this.plugin.structureLibrary)) {
          this.libraryItems = this.plugin.structureLibrary;
        }
        renderTemplates(searchInput.value);
        new Notice("结构式库已刷新 (" + this.libraryItems.length + " 个)", 2000);
      } catch (e) {
        new Notice("刷新失败: " + e.message, 3000);
      }
    };
  }

  // 渲染单个分类
  renderCategory(container, cat, templates) {
    const catDiv = container.createDiv({ cls: "chemfig-sidebar-category" });
    const catHeader = catDiv.createDiv({ cls: "chemfig-sidebar-category-header" });
    catHeader.createSpan({ text: cat.icon + " " + cat.name + " (" + templates.length + ")" });

    const grid = catDiv.createDiv({ cls: "chemfig-sidebar-template-grid" });
    for (const tpl of templates) {
      const btn = grid.createEl("button", {
        text: tpl.name,
        cls: "chemfig-sidebar-template-btn",
      });
      btn.title = tpl.code;
      // v10.11.0: 用户自定义结构式显示模式标签
      if (tpl.mode) {
        btn.createSpan({ text: " [" + tpl.mode + "]", cls: "chemfig-sidebar-template-mode" });
      }
      btn.onclick = () => {
        const activeLeaf = this.plugin.app.workspace.activeLeaf;
        if (activeLeaf && activeLeaf.view && activeLeaf.view.editor) {
          const editor = activeLeaf.view.editor;
          const cursor = editor.getCursor();
          editor.replaceRange(tpl.code, cursor);
          new Notice("已插入: " + tpl.name, 1500);
        } else {
          new Notice("请先打开一个笔记", 2000);
        }
      };
    }
  }

  // v2.0: 渲染结构式库联动区 (IndexedDB/localStorage 结构式库, 与左侧边栏真正联动)
  renderLibrary(container, filter) {
    const kw = (filter || "").toLowerCase();
    const items = (this.libraryItems || []).filter((s) => {
      if (!s || !s.name) return false;
      if (!kw) return true;
      return (
        String(s.name).toLowerCase().includes(kw) ||
        String(s.code || "")
          .toLowerCase()
          .includes(kw) ||
        String(s.category || "")
          .toLowerCase()
          .includes(kw)
      );
    });
    if (items.length === 0) return;

    const catDiv = container.createDiv({ cls: "chemfig-sidebar-category" });
    const catHeader = catDiv.createDiv({ cls: "chemfig-sidebar-category-header" });
    catHeader.createSpan({ text: "📚 结构式库 (" + items.length + ")" });

    const grid = catDiv.createDiv({ cls: "chemfig-sidebar-template-grid" });
    for (const item of items) {
      const btn = grid.createEl("button", {
        text: item.name,
        cls: "chemfig-sidebar-template-btn",
      });
      btn.title = item.code || "";
      if (item.mode) {
        btn.createSpan({ text: " [" + item.mode + "]", cls: "chemfig-sidebar-template-mode" });
      }
      btn.onclick = () => {
        const activeLeaf = this.plugin.app.workspace.activeLeaf;
        if (activeLeaf && activeLeaf.view && activeLeaf.view.editor) {
          const editor = activeLeaf.view.editor;
          const cursor = editor.getCursor();
          editor.replaceRange((item.code || "") + "\n", cursor);
          new Notice("已插入结构式: " + item.name, 1500);
        } else {
          new Notice("请先打开一个笔记", 2000);
        }
      };
    }
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// ========== 右侧边栏: 代码编辑页面 ==========
class ChemfigRightSidebarView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.navigation = false;
    this.currentCode = "";
    this.currentMode = "chem";
    this.currentBlockStart = -1;
    this.currentBlockEnd = -1;
    this.syncEnabled = true;
    this._syncTimer = null;
    this._editorChangeRef = null;
    this._readTimer = null;
    this.currentEditor = null; // 关联的目标编辑器 (v0.1.0)
    this.currentFile = null; // 关联的目标笔记文件
  }

  getViewType() {
    return "chemfig-right-sidebar";
  }
  getDisplayText() {
    return "Chemfig 代码编辑器";
  }
  getIcon() {
    return "code";
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("chemfig-sidebar-view", "chemfig-right-sidebar");

    // 读取同步设置
    this.syncEnabled = this.plugin.sidebarSyncEnabled !== false;

    // 标题
    const header = contentEl.createDiv({ cls: "chemfig-sidebar-header" });
    header.createEl("h3", { text: "⌨️ Chemfig 代码编辑器" });

    // 同步状态指示
    const syncIndicator = header.createEl("span", {
      text: this.syncEnabled ? "🔄 同步中" : "⏸ 同步暂停",
      cls: "chemfig-sidebar-sync-indicator",
    });

    // 模式选择
    const modeBar = contentEl.createDiv({ cls: "chemfig-sidebar-mode-bar" });
    const modes = [
      { id: "chem", label: "chem" },
      { id: "tikz", label: "tikz" },
      { id: "miktex", label: "miktex" },
      { id: "ce", label: "ce" },
    ];
    for (const m of modes) {
      const btn = modeBar.createEl("button", {
        text: m.label,
        cls: "chemfig-sidebar-mode-btn" + (m.id === this.currentMode ? " active" : ""),
      });
      btn.onclick = () => {
        this.currentMode = m.id;
        modeBar
          .querySelectorAll(".chemfig-sidebar-mode-btn")
          .forEach((b) => b.removeClass("active"));
        btn.addClass("active");
        // v10.11.0: 模式切换时同步到笔记
        this.syncToNote();
      };
    }

    // 代码编辑区
    const codeContainer = contentEl.createDiv({ cls: "chemfig-sidebar-code-container" });
    const codeLabel = codeContainer.createEl("div", {
      cls: "chemfig-sidebar-label",
      text: "代码:",
    });
    this.codeTextarea = codeContainer.createEl("textarea", {
      cls: "chemfig-sidebar-textarea",
      placeholder: "% NAME: 反应名称\n\\chemfig{...}\n\\arrow{->[条件][]}\n\\chemfig{...}",
    });
    this.codeTextarea.style.cssText =
      "width:100%;min-height:180px;font-family:monospace;font-size:12px;padding:8px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);color:var(--text-normal);resize:vertical;";

    // v10.11.0: 代码变化时自动同步到笔记 (防抖500ms)
    this.codeTextarea.oninput = () => {
      if (this._syncTimer) clearTimeout(this._syncTimer);
      this._syncTimer = setTimeout(() => this.syncToNote(), 500);
    };

    // 预览区
    const previewContainer = contentEl.createDiv({ cls: "chemfig-sidebar-preview-container" });
    const previewLabel = previewContainer.createEl("div", {
      cls: "chemfig-sidebar-label",
      text: "预览:",
    });
    this.previewDiv = previewContainer.createDiv({ cls: "chemfig-sidebar-preview" });
    this.previewDiv.style.cssText =
      "min-height:120px;border:1px solid var(--background-modifier-border);border-radius:4px;background:white;padding:16px;display:flex;align-items:center;justify-content:center;overflow:auto;";

    // 按钮区
    const btnContainer = contentEl.createDiv({ cls: "chemfig-sidebar-buttons" });
    const previewBtn = btnContainer.createEl("button", {
      text: "👁 输出预览",
      cls: "chemfig-sidebar-action-btn",
    });
    previewBtn.onclick = () => this.doPreview();

    const insertBtn = btnContainer.createEl("button", {
      text: "📝 插入到笔记",
      cls: "chemfig-sidebar-action-btn",
    });
    insertBtn.onclick = () => this.doInsert();

    // v10.11.0: 组分调整按钮
    const groupBtn = btnContainer.createEl("button", {
      text: "🎨 组分调整",
      cls: "chemfig-sidebar-action-btn",
    });
    groupBtn.onclick = () => this.openGroupLayout();

    const clearBtn = btnContainer.createEl("button", {
      text: "🗑 清空",
      cls: "chemfig-sidebar-action-btn",
    });
    clearBtn.onclick = () => {
      this.codeTextarea.value = "";
      this.previewDiv.empty();
      this.currentBlockStart = -1;
      this.currentBlockEnd = -1;
    };

    // 从当前编辑器读取代码
    const readBtn = btnContainer.createEl("button", {
      text: "📖 从编辑器读取",
      cls: "chemfig-sidebar-action-btn",
    });
    readBtn.onclick = () => this.readFromEditor();

    // v0.1.0: 分子画布编辑按钮 —— 与画布编辑器联动
    const canvasBtn = btnContainer.createEl("button", {
      text: "🧪 画布编辑",
      cls: "chemfig-sidebar-action-btn",
    });
    canvasBtn.onclick = () => this.openMoleculeCanvas();

    // v10.11.0: 同步开关
    const syncBtn = btnContainer.createEl("button", {
      text: this.syncEnabled ? "⏸ 暂停同步" : "🔄 开启同步",
      cls: "chemfig-sidebar-action-btn",
    });
    syncBtn.onclick = () => {
      this.syncEnabled = !this.syncEnabled;
      syncBtn.setText(this.syncEnabled ? "⏸ 暂停同步" : "🔄 开启同步");
      syncIndicator.setText(this.syncEnabled ? "🔄 同步中" : "⏸ 同步暂停");
    };

    // v10.11.0: 监听编辑器变化, 自动从笔记同步到侧边栏
    this.setupEditorSync();

    // 自动从当前编辑器读取
    this.readFromEditor();
  }

  // v10.11.0: 设置编辑器同步监听
  setupEditorSync() {
    try {
      this._editorChangeRef = (editor, data) => {
        if (!this.syncEnabled) return;
        if (typeof this.currentBlockStart !== "number" || this.currentBlockStart < 0) return;
        if (!editor || typeof editor.getCursor !== "function") return;
        const cursor = editor.getCursor();
        if (!cursor || typeof cursor.line !== "number") return;
        if (cursor.line >= this.currentBlockStart && cursor.line <= this.currentBlockEnd) {
          // 防抖读取
          if (this._readTimer) clearTimeout(this._readTimer);
          this._readTimer = setTimeout(() => this.readFromEditor(true), 800);
        }
      };
      this.registerEvent(this.plugin.app.workspace.on("editor-change", this._editorChangeRef));
    } catch (e) {
      console.warn("[Chemfig-SVG] 编辑器同步监听设置失败:", e.message);
    }
  }

  // v0.1.0: 载入指定代码块, 建立侧边栏<->笔记双向同步
  loadBlock(editor, startLine, endLine, mode, body, file) {
    if (!editor) return;
    this.currentEditor = editor;
    this.currentFile = file || null;
    this.currentMode = mode || "chem";
    this.currentBlockStart = startLine;
    this.currentBlockEnd = endLine;
    if (this.codeTextarea) this.codeTextarea.value = body || "";
    const order = ["chem", "tikz", "miktex", "ce"];
    this.contentEl.querySelectorAll(".chemfig-sidebar-mode-btn").forEach((b, idx) => {
      b.toggleClass("active", order[idx] === this.currentMode);
    });
    const indicator = this.contentEl.querySelector(".chemfig-sidebar-sync-indicator");
    if (indicator) indicator.setText(this.syncEnabled ? "🔄 同步中" : "⏸ 同步暂停");
  }

  // 优先使用关联的编辑器, 否则回退到当前活动编辑器
  _resolveEditor() {
    if (this.currentEditor && typeof this.currentEditor.getCursor === "function")
      return this.currentEditor;
    const l = this.plugin.app.workspace.activeLeaf;
    return l && l.view && l.view.editor ? l.view.editor : null;
  }

  // v0.1.0: 用分子画布重绘当前代码块结构, 结果写回侧边栏并同步回笔记
  openMoleculeCanvas() {
    const lines = (this.codeTextarea?.value || "").split("\n");
    const smiles = extractSmilesFromBlockLines(lines);
    // 无归档 SMILES 时, 尝试直接解析手写 chemfig (实现「手写 chemfig → 画布再编辑」)
    let chemfigSrc = "";
    if (!smiles) {
      const text = this.codeTextarea?.value || "";
      const i = text.indexOf("\\chemfig");
      if (i >= 0) chemfigSrc = text.slice(i);
    }
    new MoleculeEditorModal(
      this.plugin.app,
      smiles,
      (result) => {
        if (result.type === "chemfig") {
          this.currentMode = "chem";
          this.codeTextarea.value =
            (result.smiles ? "% smiles: " + result.smiles + "\n" : "") + result.code;
          const order = ["chem", "tikz", "miktex", "ce"];
          this.contentEl
            .querySelectorAll(".chemfig-sidebar-mode-btn")
            .forEach((b, idx) => b.toggleClass("active", order[idx] === "chem"));
          this.syncToNote();
          new Notice("已将画布结构写回代码块", 2500);
        } else if (result.type === "smiles") {
          new Notice("已生成 SMILES（可插入 ```smiles 块）: " + result.value, 4000);
        }
      },
      chemfigSrc,
      { enableTemplateLibrary: this.plugin.enableTemplateLibrary }
    ).open();
  }

  // v10.15.5: 从侧边栏打开组分调整
  async openGroupLayoutFromSidebar() {
    try {
      const code = this.codeTextarea?.value?.trim();
      if (!code) {
        new Notice("侧边栏代码为空，请先加载代码块", 2500);
        return;
      }

      // 解析代码块为组分 (parseGroups 返回 { nameLine, groups })
      const mode = this.currentMode || "chem";
      const parsed = parseGroups(code);
      const groups = parsed.groups;

      if (!groups || groups.length < 2) {
        new Notice("代码中至少需要2个组分才能进行组分调整", 3000);
        return;
      }

      // 提取名称
      const nameMatch = code.match(/^%%?\s*(?:NAME|name)\s*:\s*(.+)$/m);
      const nameLine = parsed.nameLine || (nameMatch ? nameMatch[1].trim() : "未命名反应");

      // v10.15.x: 恢复已保存的组分布局
      const file = this.currentFile || this.plugin.app.workspace.getActiveFile();
      const savedLayout = await this.plugin._loadSavedLayout(file, nameLine, groups);

      // 打开 GroupLayoutModal
      const layoutModal = new GroupLayoutModal(
        this.app,
        this.plugin,
        mode,
        nameLine,
        groups,
        (mergedSvg, layout, bgColor) => {
          new Notice("组分调整已应用", 2000);
        },
        savedLayout
      );
      layoutModal.open();
    } catch (e) {
      new Notice("组分调整打开失败: " + e.message, 3000);
    }
  }

  // v10.11.0: 同步代码到笔记
  syncToNote() {
    if (!this.syncEnabled) return;
    if (this.currentBlockStart < 0 || this.currentBlockEnd < 0) return;
    try {
      const editor = this._resolveEditor();
      if (!editor) return;
      const code = this.codeTextarea.value;
      // 替换代码块内容 (不包含 ``` 标记行)
      const startLine = this.currentBlockStart + 1;
      const endLine = this.currentBlockEnd - 1;
      if (endLine < startLine) return;
      editor.replaceRange(code + "\n", { line: startLine, ch: 0 }, { line: endLine + 1, ch: 0 });
      console.log("[Chemfig-SVG] 侧边栏代码已同步到笔记 (行 " + startLine + "-" + endLine + ")");
    } catch (e) {
      console.warn("[Chemfig-SVG] 同步到笔记失败:", e.message);
    }
  }

  // v10.11.0: 打开组分调整
  async openGroupLayout() {
    const code = this.codeTextarea.value.trim();
    if (!code) {
      new Notice("请先输入代码", 2000);
      return;
    }
    try {
      // 解析组分 (parseGroups 返回 { nameLine, groups })
      const parsed = parseGroups(code);
      const groups = parsed.groups;
      if (!groups || groups.length < 2) {
        new Notice("代码中至少需要2个组分才能进行组分调整", 3000);
        return;
      }
      // 提取名称
      const nameMatch = code.match(/^%%?\s*(?:NAME|name)\s*:\s*(.+)$/m);
      const nameLine = parsed.nameLine || (nameMatch ? nameMatch[1].trim() : "未命名反应");

      // v10.15.x: 恢复已保存的组分布局
      const file = this.currentFile || this.plugin.app.workspace.getActiveFile();
      const savedLayout = await this.plugin._loadSavedLayout(file, nameLine, groups);

      // 打开组分调整模态框
      const modal = new GroupLayoutModal(
        this.plugin.app,
        this.plugin,
        this.currentMode,
        nameLine,
        groups,
        async (mergedSvg, layout, bgColor) => {
          // 保存回调: 更新预览 (FileReader 转换, 避免 Buffer 不可用)
          this.previewDiv.empty();
          const img = this.previewDiv.createEl("img");
          img.src = await svgToDataURL(mergedSvg);
          img.style.cssText = "max-width:100%;max-height:300px;";
          new Notice("组分布局已应用", 2000);
        },
        savedLayout
      );
      modal.open();
    } catch (e) {
      new Notice("组分调整失败: " + e.message, 3000);
      console.error("[Chemfig-SVG] 组分调整失败:", e);
    }
  }

  async doPreview() {
    const code = this.codeTextarea.value.trim();
    if (!code) {
      new Notice("请先输入代码", 2000);
      return;
    }
    this.previewDiv.empty();
    const loading = this.previewDiv.createEl("span", { text: "编译中..." });
    try {
      const svg = await this.plugin.compileTikz(this.currentMode, code);
      this.previewDiv.empty();
      const img = this.previewDiv.createEl("img");
      img.src = await svgToDataURL(svg);
      img.style.cssText = "max-width:100%;max-height:300px;";
    } catch (e) {
      this.previewDiv.empty();
      const err = this.previewDiv.createEl("div", { text: "编译失败: " + e.message });
      err.style.cssText = "color:red;font-size:12px;white-space:pre-wrap;";
    }
  }

  doInsert() {
    const code = this.codeTextarea.value.trim();
    if (!code) {
      new Notice("请先输入代码", 2000);
      return;
    }
    const activeLeaf = this.plugin.app.workspace.activeLeaf;
    if (activeLeaf && activeLeaf.view && activeLeaf.view.editor) {
      const editor = activeLeaf.view.editor;
      const cursor = editor.getCursor();
      const block = "```" + this.currentMode + "\n" + code + "\n```\n";
      editor.replaceRange(block, cursor);
      new Notice("已插入代码块", 1500);
    } else {
      new Notice("请先打开一个笔记", 2000);
    }
  }

  readFromEditor(silent = false) {
    const editor = this._resolveEditor();
    if (!editor || typeof editor.getCursor !== "function") return;
    const cursor = editor.getCursor();
    if (!cursor || typeof cursor.line !== "number") return;
    const line = editor.getLine(cursor.line);
    if (!line) return;
    if (line.startsWith("```")) {
      // 读取整个代码块
      let code = "";
      let i = cursor.line + 1;
      this.currentBlockStart = cursor.line;
      while (i < editor.lineCount()) {
        const l = editor.getLine(i);
        if (l.startsWith("```")) {
          this.currentBlockEnd = i;
          break;
        }
        code += l + "\n";
        i++;
      }
      const newCode = code.trim();
      // 避免循环同步: 如果代码相同则不更新
      if (newCode !== this.codeTextarea.value) {
        this.codeTextarea.value = newCode;
      }
      // 检测模式
      const mode = line.replace(/```/, "").trim();
      if (["chem", "tikz", "miktex", "ce"].includes(mode)) {
        this.currentMode = mode;
        this.contentEl.querySelectorAll(".chemfig-sidebar-mode-btn").forEach((b, idx) => {
          b.toggleClass("active", ["chem", "tikz", "miktex", "ce"][idx] === mode);
        });
      }
      if (!silent) new Notice("已从编辑器读取代码", 1500);
    } else {
      // 光标不在代码块内, 尝试向上查找最近的代码块
      let blockStart = -1;
      for (let i = cursor.line; i >= 0; i--) {
        const l = editor.getLine(i);
        if (l && l.startsWith("```")) {
          blockStart = i;
          break;
        }
      }
      if (blockStart >= 0) {
        const startLine = editor.getLine(blockStart);
        const mode = startLine.replace(/```/, "").trim();
        if (["chem", "tikz", "miktex", "ce"].includes(mode)) {
          let code = "";
          let i = blockStart + 1;
          this.currentBlockStart = blockStart;
          while (i < editor.lineCount()) {
            const l = editor.getLine(i);
            if (l.startsWith("```")) {
              this.currentBlockEnd = i;
              break;
            }
            code += l + "\n";
            i++;
          }
          const newCode = code.trim();
          if (newCode !== this.codeTextarea.value) {
            this.codeTextarea.value = newCode;
          }
          this.currentMode = mode;
          document.querySelectorAll(".chemfig-sidebar-mode-btn").forEach((b, idx) => {
            b.toggleClass("active", ["chem", "tikz", "miktex", "ce"][idx] === mode);
          });
          if (!silent) new Notice("已从附近代码块读取", 1500);
        } else if (!silent) {
          new Notice("请将光标放在代码块内", 2000);
        }
      }
    }
  }

  async onClose() {
    if (this._syncTimer) clearTimeout(this._syncTimer);
    if (this._readTimer) clearTimeout(this._readTimer);
    this.contentEl.empty();
  }
}

// ========== 侧边栏CSS样式 ==========
const SIDEBAR_CSS = `
.chemfig-sidebar-view {
  padding: 12px;
  overflow-y: auto;
  min-height: 0;
  box-sizing: border-box;
}
.chemfig-sidebar-header h3 {
  margin: 0 0 4px 0;
  font-size: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.chemfig-sidebar-subtitle {
  margin: 0 0 12px 0;
  font-size: 12px;
  color: var(--text-muted);
}
.chemfig-sidebar-sync-indicator {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: normal;
}
/* v10.15.0: 面包屑导航样式 */
.chemfig-sidebar-breadcrumb {
  display: flex;
  flex-wrap: nowrap;
  gap: 2px;
  padding: 6px 0;
  margin-bottom: 8px;
  font-size: 12px;
  border-bottom: 1px solid var(--background-modifier-border);
  overflow-x: auto;
  overflow-y: hidden;
  white-space: nowrap;
  scrollbar-width: thin;
}
.chemfig-sidebar-breadcrumb::-webkit-scrollbar {
  height: 4px;
}
.chemfig-sidebar-breadcrumb::-webkit-scrollbar-thumb {
  background: var(--background-modifier-border);
  border-radius: 2px;
}
.chemfig-breadcrumb-item {
  padding: 2px 6px;
  border-radius: 3px;
  transition: background 0.15s ease;
}
.chemfig-breadcrumb-item:hover {
  background: var(--background-modifier-hover);
}
/* v10.15.0: 二级分类按钮网格 */
.chemfig-sidebar-subcat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 12px;
}
.chemfig-sidebar-subcat-btn {
  padding: 8px 10px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 6px;
  background: var(--background-secondary);
  color: var(--text-normal);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.2s ease;
}
.chemfig-sidebar-subcat-btn:hover {
  background: var(--background-modifier-hover);
  border-color: var(--interactive-accent);
  transform: translateY(-1px);
}
.chemfig-sidebar-search-input {
  width: 100%;
  padding: 6px 10px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background: var(--background-primary);
  color: var(--text-normal);
  font-size: 13px;
  margin-bottom: 12px;
  box-sizing: border-box;
}
.chemfig-sidebar-category {
  margin-bottom: 12px;
}
.chemfig-sidebar-category-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 6px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--background-modifier-border);
}
.chemfig-sidebar-template-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
.chemfig-sidebar-template-btn {
  padding: 6px 8px;
  font-size: 12px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background: var(--background-secondary);
  color: var(--text-normal);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}
.chemfig-sidebar-template-btn:hover {
  background: var(--interactive-hover);
  border-color: var(--interactive-accent);
}
.chemfig-sidebar-template-mode {
  font-size: 10px;
  color: var(--text-muted);
  margin-left: 4px;
}
.chemfig-sidebar-footer {
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--background-modifier-border);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.chemfig-sidebar-action-btn {
  padding: 8px 12px;
  font-size: 13px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background: var(--interactive-normal);
  color: var(--text-normal);
  cursor: pointer;
  transition: background 0.15s;
}
.chemfig-sidebar-action-btn:hover {
  background: var(--interactive-hover);
}
.chemfig-sidebar-mode-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 12px;
}
.chemfig-sidebar-mode-btn {
  flex: 1;
  padding: 6px;
  font-size: 12px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background: var(--background-secondary);
  color: var(--text-normal);
  cursor: pointer;
}
.chemfig-sidebar-mode-btn.active {
  background: var(--interactive-accent);
  color: white;
  border-color: var(--interactive-accent);
}
.chemfig-sidebar-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  margin-bottom: 4px;
}
.chemfig-sidebar-code-container,
.chemfig-sidebar-preview-container {
  margin-bottom: 12px;
}
.chemfig-sidebar-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.chemfig-sidebar-buttons .chemfig-sidebar-action-btn {
  flex: 1;
  min-width: 80px;
  padding: 6px 8px;
  font-size: 12px;
}
`;
// 全局变量, 供 main.js 使用
// ChemfigLeftSidebarView, ChemfigRightSidebarView, SIDEBAR_CSS 已在上方定义
