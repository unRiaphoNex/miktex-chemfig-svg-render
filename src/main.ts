// ========== 主插件模块 ==========
// 从 main.js 自动提取

module.exports = class ChemfigSvgPlugin extends Plugin {
  async onload() {
    try {
      console.log("[Chemfig-SVG v10.15] 加载中...");

      // v10.14.0: 使用 EnvironmentManager 管理编译环境
      this.envManager = new EnvironmentManager();
      this.envManager.initLazy();
      this.envReady = false;
      this._envChecked = false;
      // 保持向后兼容: envManager.ready 映射到 this.envReady
      Object.defineProperty(this, "envReady", {
        get: function () {
          return this.envManager.ready;
        },
        set: function (v) {
          this.envManager.ready = v;
        },
        configurable: true,
      });
      Object.defineProperty(this, "_envChecked", {
        get: function () {
          return this.envManager.checked;
        },
        set: function (v) {
          this.envManager.checked = v;
        },
        configurable: true,
      });

      // v10.14.0: 使用 SettingsManager 管理设置
      this.settingsManager = new SettingsManager(this);
      this.templateBrowser = new TemplateBrowser(this);

      // 加载用户自定义模板 (通过 TemplateBrowser)
      await this.templateBrowser.loadCustom();
      this.customTemplates = this.templateBrowser.customTemplates;

      // 异步触发环境检查 (不阻塞插件加载, 确保右键菜单等功能立即可用)
      this.envManager
        .check()
        .catch((e) => console.warn("[Chemfig-SVG] 环境初始化失败:", e.message));

      // v10.12.0: 侧边栏注册延迟到设置加载后, 受设置开关控制
      this._sidebarRegistered = false;
      this._leftRibbonIcon = null;

      // 保存事件 (防抖)
      this.debounceTimer = null;
      this.registerEvent(
        this.app.vault.on("modify", (file) => {
          if (file.extension !== "md") return;
          // 懒加载: 首次保存时触发环境检查
          if (!this._envChecked) {
            this.envManager
              .check()
              .catch((e) => console.warn("[Chemfig-SVG] 环境初始化失败:", e.message));
          }
          if (!this._renderReady()) return;
          if (this.debounceTimer) clearTimeout(this.debounceTimer);
          this.debounceTimer = setTimeout(() => {
            this.handleMarkdown(file).catch((e) => console.error("[Chemfig-SVG]", e));
          }, 600);
        })
      );

      // 删除图片后自动清理残存链接和关联代码块
      this.registerEvent(
        this.app.vault.on("delete", (file) => {
          if (!this._renderReady()) return;
          this.cleanupAfterImageDelete(file).catch((e) =>
            console.error("[Chemfig-SVG] cleanup:", e)
          );
        })
      );

      // 信号机制: A=SVG编辑, B=组分调整, C=编辑模式就绪
      this.signalA = null;
      this.signalB = null;
      this._signalPolling = false;

      // 编译缓存 (LRU 内存层, 磁盘持久化由 SvgCacheManager 负责)
      this._compileCache = new LRUCache(100, 300000);
      this._compileQueue = new CompileQueue(2);
      this._perfReporter = new PerformanceReporter();
      this._lastCompileError = null;

      // ========== V2.0-iter: 双后端 / 安全 / SHA256 源码缓存 ==========
      this.renderBackend = "local"; // local (遗留) | bridge (推荐, 需外部桥接服务)
      this.bridgeUrl = "http://127.0.0.1:9123";
      this.enableCache = true;
      this.cacheFolder = ""; // 空 = 默认 <插件目录>/svg-cache
      this.svgOutputFolder = ""; // 空 = 保持旧布局 svg_source/png_out
      this.enableChemEditor = true; // OCL 画布功能开关
      this.enableTemplateLibrary = true; // 模板/片段库开关
      this._bridgeChecked = false;
      this.bridgeClient = new CompileBridgeClient(this, { url: this.bridgeUrl });
      this.svgCacheManager = new SvgCacheManager(this, {
        enabled: this.enableCache,
        folder: this.cacheFolder,
      });

      // Service 层 (延迟加载, 可选)
      this._serviceManager = null;
      this._useServiceLayer = false; // 默认关闭, 避免影响现有逻辑

      // 结构式库: 全局存储, 跨笔记复用 (从 localStorage 加载)
      this.structureLibrary = this.loadStructureLibrary();

      // SVG 渲染确认 (默认开启: 手动确认后才渲染, 见 settings.js)
      this.manualPreviewEnabled = true;

      // v10.14.0: 使用 SettingsManager 加载设置
      this.settingsManager.load().then((settings) => {
        // 映射到实例属性 (保持向后兼容)
        this.defaultMode = settings.defaultMode;
        this.pngScale = settings.pngScale;
        this.compileCacheEnabled = settings.compileCacheEnabled;
        this.livePreviewEnabled = settings.livePreviewEnabled;
        this.manualPreviewEnabled = settings.manualPreviewEnabled;
        this.cm6LivePreviewEnabled = settings.cm6LivePreviewEnabled;
        // V2.0-iter: 双后端 / 缓存 / OCL 开关
        this.renderBackend = settings.renderBackend || "local";
        this.bridgeUrl = settings.bridgeUrl || "http://127.0.0.1:9123";
        this.enableCache = settings.enableCache !== false;
        this.cacheFolder = settings.cacheFolder || "";
        this.svgOutputFolder = settings.svgOutputFolder || "";
        this.enableChemEditor = settings.enableChemEditor !== false;
        this.enableTemplateLibrary = settings.enableTemplateLibrary !== false;
        if (this.bridgeClient) this.bridgeClient.baseUrl = this.bridgeUrl.replace(/\/+$/, "");
        if (this.svgCacheManager) {
          this.svgCacheManager.enabled = this.enableCache;
          this.svgCacheManager.folder = this.cacheFolder;
          this.svgCacheManager.version = settings.cacheVersion || "2";
          this.svgCacheManager.checkVersion();
        }
        setSvgOutputFolder(this.svgOutputFolder);
        perf.enabled = settings.perfMonitorEnabled;
        this.leftSidebarEnabled = settings.leftSidebarEnabled;
        this.rightSidebarEnabled = settings.rightSidebarEnabled;
        this.sidebarSyncEnabled = settings.sidebarSyncEnabled;
        // v10.12.0: 设置加载完成后注册侧边栏 (受开关控制)
        if (!this._sidebarRegistered) {
          this.registerSidebarViews();
          this._sidebarRegistered = true;
        }
        // V2.0-iter: 启动探测后端可用性
        if (this.renderBackend === "bridge") {
          this._probeBridge();
        } else {
          new Notice(
            "[Chemfig-SVG] 当前为 local 后端 (遗留·不安全), 建议在设置中切换到 bridge",
            8000
          );
        }
      });

      // active-leaf-change: 切换笔记时清理图片位置缓存 (位置已失效)
      this.registerEvent(
        this.app.workspace.on("active-leaf-change", () => {
          if (this._imageCache) this._imageCache = { rects: [], timestamp: 0 };
        })
      );

      // ========== 全局图片放大拦截: pointer-events:none + 缓存位置判断 ==========
      this._globalZoomState = {
        mouseDownTime: 0,
        mouseDownX: 0,
        mouseDownY: 0,
        isLongPress: false,
        longPressTimer: null,
      };
      // 图片位置缓存 (500ms内复用, 减少重复遍历)
      this._imageCache = { rects: [], timestamp: 0 };
      const refreshImageCache = () => {
        const rects = [];
        const allImages = document.querySelectorAll(
          ".markdown-source-view img, .markdown-source-view svg, .markdown-source-view canvas, " +
            ".markdown-preview-view img, .markdown-preview-view svg, .markdown-preview-view canvas, " +
            ".image-embed, .miktex-svg-container, .chemfig-img-wrapper"
        );
        for (const img of allImages) {
          const rect = img.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            rects.push({ el: img, rect });
          }
        }
        this._imageCache.rects = rects;
        this._imageCache.timestamp = Date.now();
      };
      // 判断坐标是否在图片类元素上 (优先返回 img/svg/canvas)
      const isImageAtPoint = (x, y) => {
        if (Date.now() - this._imageCache.timestamp > 500) refreshImageCache();
        // 第一优先级: 直接图片元素
        for (const { el, rect } of this._imageCache.rects) {
          if (el.tagName === "IMG" || el.tagName === "SVG" || el.tagName === "CANVAS") {
            if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return el;
          }
        }
        // 第二优先级: 容器
        for (const { el, rect } of this._imageCache.rects) {
          if (x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom) return el;
        }
        return null;
      };
      // ========== "编辑这个区块"按钮: 使用Obsidian原生行为展开源代码 (v10.9.5) ==========
      // 不再拦截原生编辑按钮, 让用户点击后直接展开源代码进行编辑
      // 进入SVG编辑操作台请使用右键菜单或图片旁的工具栏按钮

      // mousedown: 记录状态
      const onMouseDown = (e) => {
        if (e.button !== 0 && e.button !== 2) return;
        // 排除: 插件自身模态框/编辑器/工具栏/放大预览层内的点击
        if (
          e.target.closest(
            ".chemfig-zoom-overlay, .chemfig-edit-modal, .modal-container, .group-layout-modal, .chemfig-img-toolbar"
          )
        )
          return;
        const target = isImageAtPoint(e.clientX, e.clientY);
        if (!target) return;
        const st = this._globalZoomState;
        st.mouseDownTime = Date.now();
        st.mouseDownX = e.clientX;
        st.mouseDownY = e.clientY;
        st.isLongPress = false;
        if (st.longPressTimer) clearTimeout(st.longPressTimer);
        st.longPressTimer = setTimeout(() => {
          st.isLongPress = true;
        }, 300);
      };
      const onMouseUp = () => {
        const st = this._globalZoomState;
        if (st.longPressTimer) {
          clearTimeout(st.longPressTimer);
          st.longPressTimer = null;
        }
      };
      // click: 短按触发 showImageZoom
      const onClick = (e) => {
        // 排除: 插件自身模态框/编辑器/工具栏/放大预览层内的点击
        if (
          e.target.closest(
            ".chemfig-zoom-overlay, .chemfig-edit-modal, .modal-container, .group-layout-modal, .chemfig-img-toolbar"
          )
        )
          return;
        const target = isImageAtPoint(e.clientX, e.clientY);
        if (!target) return;
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        const st = this._globalZoomState;
        if (st.isLongPress) return;
        const pressDuration = Date.now() - st.mouseDownTime;
        const moveDist = Math.abs(e.clientX - st.mouseDownX) + Math.abs(e.clientY - st.mouseDownY);
        if (pressDuration > 300 || moveDist > 5) return;
        const name =
          target.getAttribute?.("data-svg-name") ||
          target.getAttribute?.("data-tikz-name") ||
          target.getAttribute?.("alt") ||
          target.tagName ||
          "图片";
        this.showImageZoom(target, name);
      };
      // mouseover: 图片预加载 (hover 时预加载放大预览图片)
      const preloadedImages = new Set();
      const onMouseOver = (e) => {
        const target = isImageAtPoint(e.clientX, e.clientY);
        if (!target) return;
        const tag = target.tagName;
        let src = null;
        if (tag === "IMG") src = target.src;
        else {
          const innerImg = target.querySelector("img");
          if (innerImg) src = innerImg.src;
        }
        if (src && !preloadedImages.has(src)) {
          preloadedImages.add(src);
          const preloadImg = new Image();
          preloadImg.src = src;
        }
      };
      // contextmenu: 长按时阻止, 短按保留原生菜单
      const onContextMenu = (e) => {
        // 排除: 插件自身模态框/编辑器/工具栏/放大预览层内的点击
        if (
          e.target.closest(
            ".chemfig-zoom-overlay, .chemfig-edit-modal, .modal-container, .group-layout-modal, .chemfig-img-toolbar"
          )
        )
          return;
        const target = isImageAtPoint(e.clientX, e.clientY);
        if (!target) return;
        const st = this._globalZoomState;
        if (st.isLongPress || (st.mouseDownTime && Date.now() - st.mouseDownTime > 300)) {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        }
      };
      // window capture 阶段 (最外层, 最先触发)
      window.addEventListener("mousedown", onMouseDown, true);
      window.addEventListener("mouseup", onMouseUp, true);
      window.addEventListener("click", onClick, true);
      window.addEventListener("contextmenu", onContextMenu, true);
      window.addEventListener("mouseover", onMouseOver, true);
      // 保存引用, 供 onunload 清理
      this._globalZoomHandlers = {
        mousedown: onMouseDown,
        mouseup: onMouseUp,
        click: onClick,
        contextmenu: onContextMenu,
        mouseover: onMouseOver,
      };

      // 专业代码块处理器 (学习自 obsidian-better-codeblock, 比 PostProcessor 更高效)
      // 只处理指定语言的代码块, 避免遍历所有 DOM 元素
      try {
        if (typeof this.registerMarkdownCodeBlockProcessor === "function") {
          for (const lang of ["chem", "tikz", "miktex", "ce"]) {
            this.registerMarkdownCodeBlockProcessor(lang, (source, el, ctx) => {
              if (!this._renderReady()) return;
              perf.start("codeBlockProcessor:" + lang);
              try {
                const name = getBlockName(source);
                if (!name) {
                  const hint = document.createElement("div");
                  hint.style.cssText =
                    "padding:8px;color:var(--text-muted);font-size:12px;border:1px dashed var(--background-modifier-border);border-radius:4px;";
                  hint.textContent = `[${lang}] 缺少 %% name: 标识符 标记, 保存后将自动编译`;
                  el.appendChild(hint);
                  return;
                }
                const noteDir = path.dirname(ctx.sourcePath);
                const pngRelPath = path.join(noteDir, "png_out", `${name}.png`).replace(/\\/g, "/");
                const pngFile = this.app.vault.getFileByPath(pngRelPath);
                if (pngFile) {
                  const wrapper = document.createElement("div");
                  wrapper.className = "chemfig-png-wrapper";
                  wrapper.style.cssText = "text-align:center;margin:0.8em 0;";
                  const img = document.createElement("img");
                  img.src = this.app.vault.getResourcePath(pngFile);
                  img.alt = name;
                  img.style.cssText =
                    "max-width:500px;width:100%;height:auto;display:inline-block;";
                  img.loading = "lazy";
                  img.setAttribute("data-chemfig-svg", "true");
                  img.setAttribute("data-svg-name", name);
                  img.setAttribute("data-tikz-name", name);
                  img.setAttribute("data-src", pngFile.path);
                  img.onerror = () => {
                    const escaped = source
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;");
                    const fallback = document.createElement("div");
                    fallback.style.cssText =
                      "text-align:left;padding:8px;background:var(--background-secondary);border:1px solid var(--background-modifier-error);border-radius:4px;";
                    fallback.innerHTML =
                      `<div style="color:#ff6b6b;font-size:12px;font-weight:bold;margin-bottom:4px;">⚠️ 渲染失败 [${name}]</div>` +
                      `<pre style="margin:0;padding:6px;background:var(--background-primary);border-radius:4px;max-height:150px;overflow:auto;white-space:pre-wrap;font-size:11px;">${escaped}</pre>`;
                    wrapper.replaceChild(fallback, img);
                  };
                  wrapper.appendChild(img);
                  this.bindSvgContextMenu(img, name, ctx.sourcePath, null);
                  el.appendChild(wrapper);
                } else {
                  const hint = document.createElement("div");
                  hint.style.cssText =
                    "padding:8px;color:var(--text-muted);font-size:12px;border:1px dashed var(--background-modifier-border);border-radius:4px;";
                  hint.textContent = `[${lang}] ${name} - 保存笔记后自动编译`;
                  el.appendChild(hint);
                }
              } finally {
                perf.end("codeBlockProcessor:" + lang);
              }
            });
          }
          console.log("[Chemfig-SVG] registerMarkdownCodeBlockProcessor 已注册");
        } else {
          console.warn(
            "[Chemfig-SVG] registerMarkdownCodeBlockProcessor 不可用, 回退到 PostProcessor"
          );
        }
      } catch (e) {
        console.error("[Chemfig-SVG] registerMarkdownCodeBlockProcessor 注册失败:", e);
      }

      // smiles 代码块 (OpenChemLib 前端即时渲染, v10.15.0)
      try {
        if (typeof this.registerMarkdownCodeBlockProcessor === "function") {
          this.registerMarkdownCodeBlockProcessor("smiles", (source, el, ctx) => {
            const smiles = stripSmilesMetas(source);
            if (!smiles) {
              el.createEl("div", { text: "[smiles] 空内容", cls: "chemfig-hint" });
              return;
            }
            try {
              const wrapper = el.createDiv("smiles-render-wrapper");
              wrapper.style.cssText = "text-align:center;margin:0.8em 0;";
              wrapper.innerHTML = renderSmilesSvg(smiles);
              const svg = wrapper.querySelector("svg");
              if (svg) {
                svg.setAttribute("title", "smiles 结构式（右键可编辑/复制）");
                svg.style.cursor = "context-menu";
              }
              this.bindSmilesContextMenu(wrapper, smiles);
            } catch (e) {
              el.createEl("div", { text: "[smiles] 解析失败: " + e.message, cls: "chemfig-hint" });
            }
          });
          console.log("[Chemfig-SVG] smiles 代码块已注册");
        }
      } catch (e) {
        console.error("[Chemfig-SVG] smiles 代码块注册失败:", e);
      }

      // 阅读模式渲染 (内联SVG, 修复路径问题) - 保留用于处理 ![[png]] 嵌入和旧格式
      this.registerMarkdownPostProcessor((el, ctx) => {
        if (!this._renderReady()) return;
        this.postProcessRender(el, ctx).catch((e) => console.error("[Chemfig-SVG] render:", e));
      });

      // 编辑模式: details 中代码修改后自动同步刷新 SVG (防抖 0.5s, 仅代码变化时触发)
      this.autoRegenTimer = null;
      this.lastAutoRegenHash = "";
      this.registerEvent(
        this.app.workspace.on("editor-change", (editor, info) => {
          if (!this._renderReady()) return;
          const cursor = editor.getCursor();
          // 检测是否在 [code] details 内的代码块中
          const ctx2 = this.detectDetailsCodeContext(editor, cursor.line);
          if (!ctx2) return;
          if (this.autoRegenTimer) clearTimeout(this.autoRegenTimer);
          this.autoRegenTimer = setTimeout(() => {
            this.autoRegenFromEditor(editor, info, ctx2).catch((e) => {
              console.warn("[Chemfig-SVG] 自动刷新失败:", e.message);
            });
          }, 500);
        })
      );

      // 编辑器右键菜单
      this.registerEvent(
        this.app.workspace.on("editor-menu", (menu, editor, view) => {
          const cursor = editor.getCursor();
          const line = cursor.line;
          const inCode = this.isInCodeBlock(editor, line);
          if (!inCode) return;

          const getFile = () => view.file || this.app.workspace.getActiveFile();

          menu.addItem((item) => {
            item
              .setTitle("Chemfig-SVG: 在侧边栏编辑结构式")
              .setIcon("pencil")
              .onClick(() => this.openBlockInSidebar(getFile(), editor, line));
          });

          // 高级弹窗编辑 (保留原 ChemfigEditModal)
          menu.addItem((item) => {
            item
              .setTitle("Chemfig-SVG: 弹窗高级编辑")
              .setIcon("gear")
              .onClick(() => this.openEditorModal(getFile(), editor, line));
          });

          // 切换渲染模式: 子菜单形式, 不再弹到左上角
          menu.addItem((item) => {
            item.setTitle("Chemfig-SVG: 切换渲染模式").setIcon("shuffle");
            const { mode: currentMode } = this.extractBlock(editor, line);
            const submenu = item.setSubmenu();
            for (const [key, m] of Object.entries(MODES)) {
              submenu.addItem((sub) => {
                sub
                  .setTitle((key === currentMode ? "✓ " : "") + m.label)
                  .onClick(() => this.switchMode(editor, line, key));
              });
            }
          });

          menu.addItem((item) => {
            item
              .setTitle("Chemfig-SVG: 预览当前结构式")
              .setIcon("image")
              .onClick(() => this.previewCurrentBlock(getFile(), editor, line));
          });
        })
      );

      // 命令面板
      this.addCommand({
        id: "edit-current-block",
        name: "编辑光标处的结构式代码块",
        checkCallback: (checking) => {
          const editor = this.app.workspace.activeEditor?.editor;
          const f = this.app.workspace.getActiveFile();
          if (checking)
            return !!(editor && f && this.isInCodeBlock(editor, editor.getCursor().line));
          if (editor && f) this.openEditorModal(f, editor, editor.getCursor().line);
        },
      });
      this.addCommand({
        id: "recompile-all",
        name: "重新编译当前笔记全部结构式",
        checkCallback: (checking) => {
          const f = this.app.workspace.getActiveFile();
          if (checking) return f && f.extension === "md";
          if (f) this.handleMarkdown(f, true).catch(console.error);
        },
      });
      this.addCommand({
        id: "debug-first",
        name: "调试: 编译第一个结构式并保留临时文件",
        checkCallback: (checking) => {
          const f = this.app.workspace.getActiveFile();
          if (checking) return f && f.extension === "md";
          if (f) this.debugFirst(f).catch(console.error);
        },
      });

      // 结构式库: 保存当前结构式到库
      this.addCommand({
        id: "save-to-library",
        name: "结构式库: 保存光标处结构式到库",
        checkCallback: (checking) => {
          if (this.enableTemplateLibrary === false) {
            if (checking) return false;
            new Notice("模板/片段库已在设置中关闭 (enableTemplateLibrary)", 3000);
            return;
          }
          const editor = this.app.workspace.activeEditor?.editor;
          const f = this.app.workspace.getActiveFile();
          if (checking)
            return !!(editor && f && this.isInCodeBlock(editor, editor.getCursor().line));
          if (editor && f) this.saveToLibrary(f, editor, editor.getCursor().line);
        },
      });

      // 结构式库: 从库插入结构式
      this.addCommand({
        id: "insert-from-library",
        name: "结构式库: 从库插入结构式",
        checkCallback: (checking) => {
          if (this.enableTemplateLibrary === false) {
            if (checking) return false;
            new Notice("模板/片段库已在设置中关闭 (enableTemplateLibrary)", 3000);
            return;
          }
          const editor = this.app.workspace.activeEditor?.editor;
          if (checking) return !!editor;
          if (editor) this.openLibraryPicker(editor);
        },
      });

      // 结构式库: 管理结构式库
      this.addCommand({
        id: "manage-library",
        name: "结构式库: 管理(查看/删除)",
        callback: () => {
          if (this.enableTemplateLibrary === false) {
            new Notice("模板/片段库已在设置中关闭 (enableTemplateLibrary)", 3000);
            return;
          }
          this.openLibraryManager();
        },
      });

      // 批量导出: 导出当前笔记所有结构式为 PNG
      this.addCommand({
        id: "export-all-png",
        name: "批量导出: 当前笔记所有结构式为 PNG",
        checkCallback: (checking) => {
          const f = this.app.workspace.getActiveFile();
          if (checking) return f && f.extension === "md";
          if (f) this.exportAllPng(f).catch(console.error);
        },
      });

      // 编译预热: 预编译常用模板
      this.addCommand({
        id: "warmup-compile",
        name: "编译预热: 预编译常用模板(加速后续编译)",
        callback: () => this.warmupCompile(),
      });

      // 清理缓存: 清理编译缓存和图片缓存
      this.addCommand({
        id: "clear-cache",
        name: "清理缓存: 编译缓存+图片缓存",
        callback: () => {
          if (this._compileCache) this._compileCache.clear();
          if (this.svgCacheManager) this.svgCacheManager.clear();
          this._imageCache = { rects: [], timestamp: 0 };
          new Notice("缓存已清理 (内存 + 磁盘)", 2000);
        },
      });

      // V2.0-iter: 清理孤儿缓存 (磁盘存在但索引无记录的 .svg)
      this.addCommand({
        id: "clear-orphan-cache",
        name: "清理缓存: 孤儿 SVG 缓存文件",
        callback: () => {
          if (!this.svgCacheManager) {
            new Notice("缓存管理器未初始化", 2000);
            return;
          }
          const n = this.svgCacheManager.removeOrphans();
          new Notice("已清理孤儿 SVG 缓存: " + n + " 个", 3000);
        },
      });

      // V2.0-iter: 检测桥接服务连通性
      this.addCommand({
        id: "check-bridge",
        name: "桥接服务: 检测连通性",
        callback: async () => {
          if (!this.bridgeClient) {
            new Notice("桥接客户端未初始化", 3000);
            return;
          }
          new Notice("正在检测桥接服务: " + this.bridgeUrl + " ...", 3000);
          const r = await this.bridgeClient.health();
          if (r.ok) {
            new Notice(
              "桥接服务在线 (v" + (r.data && r.data.version ? r.data.version : "?") + ")",
              4000
            );
          } else {
            new Notice(
              "桥接服务不可用: " +
                (r.error || "未知错误") +
                "。请确认已运行 node server.js (端口 9123)",
              6000
            );
          }
          this._bridgeChecked = true;
        },
      });

      // 性能报告: 显示缓存统计和性能数据
      this.addCommand({
        id: "perf-report",
        name: "性能报告: 缓存统计+编译耗时",
        callback: () => {
          const cacheStats = this._compileCache ? this._compileCache.getStats() : null;
          const queueStatus = this._compileQueue ? this._compileQueue.getStatus() : null;
          let report = "=== Chemfig-SVG 性能报告 ===\n\n";
          if (cacheStats) {
            report += "编译缓存:\n";
            report += `  大小: ${cacheStats.size}/${cacheStats.maxSize}\n`;
            report += `  命中: ${cacheStats.hits}\n`;
            report += `  未命中: ${cacheStats.misses}\n`;
            report += `  淘汰: ${cacheStats.evictions}\n`;
            report += `  命中率: ${cacheStats.hitRate}\n\n`;
          }
          if (queueStatus) {
            report += "编译队列:\n";
            report += `  活跃: ${queueStatus.active}\n`;
            report += `  排队: ${queueStatus.queued}\n`;
            report += `  最大并发: ${queueStatus.concurrency}\n\n`;
          }
          const perfRecords = perf.getRecords ? perf.getRecords() : [];
          if (perfRecords.length > 0) {
            report += `性能记录: ${perfRecords.length} 条\n`;
            const slowOps = perfRecords.filter((r) => r.duration > 100);
            if (slowOps.length > 0) {
              report += `慢操作 (>100ms): ${slowOps.length} 条\n`;
              for (const op of slowOps.slice(0, 5)) {
                report += `  - ${op.name}: ${op.duration}ms\n`;
              }
            }
          }
          console.log(report);
          new Notice("性能报告已输出到控制台", 3000);
        },
      });

      // Service 层状态: 查看 ServiceManager 状态
      this.addCommand({
        id: "service-status",
        name: "Service层状态: 查看服务管理器状态",
        callback: () => {
          const status = {
            serviceLayerEnabled: this._useServiceLayer,
            serviceManagerInitialized: this._serviceManager !== null,
            compileCacheSize: this._compileCache ? this._compileCache.size : 0,
            compileQueueActive: this._compileQueue ? this._compileQueue.active : 0,
          };
          console.log("=== Chemfig-SVG Service 层状态 ===");
          console.log(JSON.stringify(status, null, 2));
          if (this._serviceManager) {
            console.log("ServiceManager 状态:", this._serviceManager.getStatus());
          }
          new Notice("Service层状态已输出到控制台", 3000);
        },
      });

      // 分子画布编辑器 (OpenChemLib, v10.15.0)
      this.addCommand({
        id: "open-molecule-editor",
        name: "打开分子结构式画布编辑器",
        callback: () => this.openMoleculeEditor(),
      });
      this.addRibbonIcon("atom", "分子结构式画布编辑器", (evt) => {
        this.openMoleculeEditor();
      });
      this.addCommand({
        id: "smiles-search-render",
        name: "化学式搜索与渲染 (SMILES → SVG)",
        callback: () => this.openSmilesSearch(),
      });

      new Notice("[Chemfig-SVG v10.15] 已加载 (懒加载模式)", 3000);

      // CM6 Live Preview 内联渲染 (实验性功能, 默认关闭)
      // 学习自 obsidian-cm6-attributes, chem 插件, 使用 ViewPlugin + WidgetType
      // v2.0: 先注入插件实例 —— 此前 setPluginInstance 从未被调用, widget 恒显示「插件实例未就绪」
      setPluginInstance(this);
      if (this.cm6LivePreviewEnabled) {
        const viewPlugin = createChemfigViewPluginV2();
        if (viewPlugin) {
          this.registerEditorExtension([viewPlugin]);
          console.log("[Chemfig-SVG] CM6 Live Preview 渲染已启用 (实验性)");
        } else {
          console.warn("[Chemfig-SVG] CM6 Live Preview 渲染启用失败: 模块不可用");
        }
      }

      // ========== v11.0.0: 学习辅助模块 ==========
      // 注入学习模块 CSS
      if (typeof LEARNING_CSS !== "undefined" && LEARNING_CSS) {
        const styleEl = document.createElement("style");
        styleEl.id = "chemfig-learning-css";
        styleEl.textContent = LEARNING_CSS;
        document.head.appendChild(styleEl);
      }

      // 加载学习卡片 (从 IndexedDB / localStorage, 首次加载内置默认卡片)
      this.learningCards = this.loadLearningCards();

      // 学习相关命令
      this.addCommand({
        id: "open-learning-stats",
        name: "打开学习统计面板",
        callback: () => {
          new LearningStatsModal(this.app, this).open();
        },
      });

      this.addCommand({
        id: "start-review-session",
        name: "开始今日复习",
        callback: () => {
          this.startReviewSession();
        },
      });

      // 默写练习命令
      this.addCommand({
        id: "quiz-structure-to-name",
        name: "默写练习: 结构→命名",
        callback: () => {
          new QuizModal(this.app, this.learningCards || [], "structure_to_name").open();
        },
      });

      this.addCommand({
        id: "quiz-name-to-structure",
        name: "默写练习: 命名→结构",
        callback: () => {
          new QuizModal(this.app, this.learningCards || [], "name_to_structure").open();
        },
      });

      this.addCommand({
        id: "quiz-formula-to-name",
        name: "默写练习: 分子式→命名",
        callback: () => {
          new QuizModal(this.app, this.learningCards || [], "formula_to_name").open();
        },
      });

      // 追加默写练习 CSS
      if (typeof QUIZ_CSS !== "undefined" && QUIZ_CSS) {
        const quizStyleEl = document.createElement("style");
        quizStyleEl.id = "chemfig-quiz-css";
        quizStyleEl.textContent = QUIZ_CSS;
        document.head.appendChild(quizStyleEl);
      }

      // ========== v11.1.0: 在线更新服务 ==========
      if (typeof UPDATE_CSS !== "undefined" && UPDATE_CSS) {
        const updateStyleEl = document.createElement("style");
        updateStyleEl.id = "chemfig-update-css";
        updateStyleEl.textContent = UPDATE_CSS;
        document.head.appendChild(updateStyleEl);
      }

      this.updateService = new UpdateService(this);

      // 更新相关命令
      this.addCommand({
        id: "check-for-updates",
        name: "检查数据库更新",
        callback: () => {
          this.updateService.checkForUpdates(true);
        },
      });

      // ========== v11.4.0: 新增学习命令 ==========
      this.addCommand({
        id: "show-daily-card",
        name: "每日一题: 查看今日推荐化合物",
        callback: () => this.showDailyCard(),
      });

      this.addCommand({
        id: "start-weak-review",
        name: "复习薄弱卡片 (错题本)",
        callback: () => this.startWeakCardsReview(),
      });

      // ========== v11.6.0: 反应条件速查 ==========
      this.addCommand({
        id: "reaction-conditions-search",
        name: "反应条件速查: 查询常见有机反应",
        callback: () => {
          if (typeof ReactionConditionsModal !== "undefined") {
            new ReactionConditionsModal(this.app).open();
          }
        },
      });

      // ========== v11.7.0: 数据导出/导入 ==========
      this.addCommand({
        id: "export-learning-data",
        name: "学习模块: 导出学习数据备份",
        callback: () => this.exportLearningData(),
      });

      this.addCommand({
        id: "import-learning-data",
        name: "学习模块: 导入学习数据备份",
        callback: () => this.importLearningData(),
      });

      // ========== v11.8.0: 配对游戏 ==========
      this.addCommand({
        id: "matching-game",
        name: "官能团配对游戏",
        callback: () => {
          if (typeof MatchingGameModal !== "undefined") {
            new MatchingGameModal(this.app).open();
          }
        },
      });

      // ========== v11.9.0: 从笔记导入卡片 ==========
      this.addCommand({
        id: "import-cards-from-note",
        name: "学习模块: 从当前笔记导入卡片",
        callback: async () => {
          const activeFile = this.app.workspace.getActiveFile();
          if (!activeFile) {
            new Notice("请先打开一个笔记", 2000);
            return;
          }

          const text = await this.app.vault.read(activeFile);
          if (typeof parseCardsFromMarkdown !== "function") {
            new Notice("卡片解析功能未加载", 2000);
            return;
          }

          const cards = parseCardsFromMarkdown(text);
          if (cards.length === 0) {
            new Notice("未在笔记中找到卡片格式", 2000);
            return;
          }

          // 初始化每张卡片的状态
          cards.forEach(card => {
            card.state = SM2Algorithm.defaultState();
          });

          // 合并到现有卡片
          const existingIds = new Set((this.learningCards || []).map(c => c.id));
          const newCards = cards.filter(c => !existingIds.has(c.id));

          this.learningCards = [...(this.learningCards || []), ...newCards];
          this.saveLearningCards();

          new Notice(`✅ 成功导入 ${newCards.length} 张卡片`, 3000);
        },
      });

      // ========== v12.0.0: 3D 分子查看器 ==========
      this.addCommand({
        id: "view-molecule-3d",
        name: "3D 分子查看器",
        callback: async () => {
          if (typeof Molecule3DModal === "undefined") {
            new Notice("3D 查看器未加载", 2000);
            return;
          }

          // 弹出选择预设化合物或输入 SMILES
          const { value: smiles } = await this.app.vault.manager?.prompt({
            prompt: "输入 SMILES 或选择预设:",
            placeholder: "c1ccccc1",
          }) || {};

          if (!smiles) {
            // 显示预设列表
            this.showPresetMolecules();
            return;
          }

          new Molecule3DModal(this.app, smiles.trim()).open();
        },
      });

      this.addCommand({
        id: "update-card-db",
        name: "更新化合物数据库",
        callback: () => {
          this.updateService.updateCardDb();
        },
      });

      // 启动时自动检查更新 (如果超过24小时)
      if (this.updateService.shouldCheckUpdate()) {
        setTimeout(() => {
          this.updateService.checkForUpdates(false);
        }, 3000);
      }

      // ========== v11.2.0: SMILES 纯前端渲染 ==========
      if (typeof SMILES_CSS !== "undefined" && SMILES_CSS) {
        const smilesStyleEl = document.createElement("style");
        smilesStyleEl.id = "chemfig-smiles-css";
        smilesStyleEl.textContent = SMILES_CSS;
        document.head.appendChild(smilesStyleEl);
      }

      // 注册 SMILES 代码块处理器
      if (typeof registerSMILESProcessor === "function") {
        registerSMILESProcessor(this);
      }

      // 注册 IUPAC 转换命令
      if (typeof registerIUPACCommands === "function") {
        registerIUPACCommands(this);
      }

      console.log("[Chemfig-SVG] 学习模块已加载 (" + (this.learningCards?.length || 0) + " 张卡片)");

      // 注册设置面板
      this.addSettingTab(new ChemfigSettingTab(this.app, this));
      console.log("[Chemfig-SVG v10.15] 加载完成");
    } catch (e) {
      console.error("[Chemfig-SVG] 插件加载失败:", e);
      console.error(e.stack);
      new Notice("[Chemfig-SVG] 加载失败: " + e.message, 10000);
    }
  }

  onunload() {
    // 清理防抖定时器
    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    // 停止信号轮询 (设置标志位, 递归 setTimeout 会自动退出)
    this._signalPolling = false;
    this.signalA = null;
    this.signalB = null;
    // 清理全局事件监听器
    if (this._globalZoomHandlers) {
      const { mousedown, mouseup, click, contextmenu, mouseover } = this._globalZoomHandlers;
      window.removeEventListener("mousedown", mousedown, true);
      window.removeEventListener("mouseup", mouseup, true);
      window.removeEventListener("click", click, true);
      window.removeEventListener("contextmenu", contextmenu, true);
      window.removeEventListener("mouseover", mouseover, true);
      this._globalZoomHandlers = null;
    }
    // 清理代码块编辑按钮拦截
    if (this._codeBlockEditHandler) {
      document.removeEventListener("click", this._codeBlockEditHandler, true);
      this._codeBlockEditHandler = null;
    }
    // 清理编译缓存
    if (this._compileCache) this._compileCache.clear();
    // 清理图片位置缓存
    this._imageCache = { rects: [], timestamp: 0 };
    // 清理结构式库引用
    this.structureLibrary = [];
  }

  // 检测某行是否在代码块内 (向上找 ```, 支持任意语言标记)
  isInCodeBlock(editor, line) {
    let inBlock = false;
    for (let i = 0; i <= line; i++) {
      const l = editor.getLine(i);
      if (/^\s*```/.test(l)) {
        inBlock = !inBlock;
      }
    }
    // 如果当前行本身是 ``` 行, 也算代码块区域 (方便右键)
    if (/^\s*```/.test(editor.getLine(line))) inBlock = true;
    return inBlock;
  }

  // 预览当前代码块 (快速预览, 不打开完整编辑器)
  async previewCurrentBlock(file, editor, line) {
    const { start, end, mode, body } = this.extractBlock(editor, line);
    const name = getBlockName(body);
    if (!name || name === getHash(body)) {
      new Notice("请先在代码第一行写 % NAME: 名称", 4000);
      return;
    }
    try {
      const svg = await this.compileTikz(mode, body);
      // 读取 SVG 实际尺寸
      const vbMatch = svg.match(/viewBox="([^"]+)"/);
      const vb = vbMatch ? vbMatch[1].split(/\s+/).map(Number) : [0, 0, 400, 200];
      const svgW = vb[2],
        svgH = vb[3];
      const padding = 32; // 预留白边
      const modalW = Math.min(svgW + padding * 2 + 40, window.innerWidth * 0.9);
      const scale = Math.min(1, (modalW - padding * 2) / svgW);
      const displayW = svgW * scale;
      const displayH = svgH * scale;

      const modal = new Modal(this.app);
      modal.contentEl.empty();
      modal.contentEl.style.textAlign = "center";
      modal.contentEl.style.width = modalW + "px";
      modal.contentEl.style.maxWidth = "95vw";
      modal.contentEl.style.padding = "16px";
      modal.contentEl.createEl("h3", { text: `预览: ${name}` }).style.margin = "0 0 12px 0";
      const preview = modal.contentEl.createDiv();
      preview.style.textAlign = "center";
      preview.style.padding = padding + "px";
      preview.style.background = "white";
      preview.style.border = "1px solid var(--background-modifier-border)";
      preview.style.borderRadius = "4px";
      preview.style.overflow = "hidden";
      preview.innerHTML = svg;
      const svgEl = preview.querySelector("svg");
      if (svgEl) {
        svgEl.style.width = displayW + "px";
        svgEl.style.height = displayH + "px";
        svgEl.style.maxWidth = "none";
        svgEl.style.maxHeight = "80vh";
        svgEl.style.display = "block";
        svgEl.style.margin = "0 auto";
      }
      // 按钮栏
      const btnBar = modal.contentEl.createDiv();
      btnBar.style.display = "flex";
      btnBar.style.justifyContent = "center";
      btnBar.style.gap = "10px";
      btnBar.style.marginTop = "8px";
      const insertBtn = btnBar.createEl("button", { text: "✓ 插入SVG到笔记" });
      insertBtn.style.padding = "6px 18px";
      insertBtn.style.cursor = "pointer";
      insertBtn.style.background = "var(--interactive-accent)";
      insertBtn.style.color = "white";
      insertBtn.style.border = "none";
      insertBtn.style.borderRadius = "4px";
      insertBtn.style.fontSize = "13px";
      insertBtn.onclick = async () => {
        await this.insertSvgToNote(file, editor, start, end, mode, body, name, svg);
        modal.close();
      };
      const closeBtn = btnBar.createEl("button", { text: "关闭" });
      closeBtn.style.padding = "6px 18px";
      closeBtn.style.cursor = "pointer";
      closeBtn.style.fontSize = "13px";
      closeBtn.onclick = () => modal.close();
      modal.open();
    } catch (e) {
      new Notice(`预览失败: ${e.message.slice(0, 60)}`, 5000);
    }
  }

  // ========== 信号机制: 阅读视图→编辑视图自动流转 ==========
  // 信号定义:
  //   A = SVG编辑模式信号 (打开代码编译台)
  //   B = 重构化学式信号 (打开组分调整操作台)
  //   C = 编辑模式就绪信号 (触发后执行A或B)

  // 设置信号A: SVG编辑模式
  setSignalA(name, sourcePath) {
    this.signalA = { name, sourcePath };
    this.signalB = null;
    console.log(`[Chemfig-SVG] 信号A已设置: ${name}`);
    this.startSignalPolling();
  }

  // 设置信号B: 重构化学式(组分调整)
  setSignalB(name, sourcePath) {
    this.signalB = { name, sourcePath };
    this.signalA = null;
    console.log(`[Chemfig-SVG] 信号B已设置: ${name}`);
    this.startSignalPolling();
  }

  // 信号C轮询: 检测编辑模式就绪后执行A或B
  startSignalPolling() {
    if (this._signalPolling) return;
    this._signalPolling = true;
    let attempts = 0;
    const poll = async () => {
      // 无信号则停止
      if (!this.signalA && !this.signalB) {
        this._signalPolling = false;
        return;
      }
      attempts++;
      if (attempts > 30) {
        this._signalPolling = false;
        this.signalA = null;
        this.signalB = null;
        new Notice("编辑视图切换超时，请手动切换到编辑模式后重试", 4000);
        return;
      }
      // 信号C: 检测编辑模式就绪
      const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (activeView && activeView.getMode() === "source" && activeView.editor) {
        // 信号C触发, 等待 editor 完全就绪
        await new Promise((r) => setTimeout(r, 200));
        const editor = activeView.editor;
        if (this.signalA) {
          const data = this.signalA;
          this.signalA = null;
          await this.executeSignalA(editor, data);
        } else if (this.signalB) {
          const data = this.signalB;
          this.signalB = null;
          await this.executeSignalB(editor, data);
        }
        this._signalPolling = false;
        return;
      }
      setTimeout(poll, 200);
    };
    setTimeout(poll, 200);
  }

  // 执行信号A: 打开代码编译台(结构式编辑器)
  async executeSignalA(editor, data) {
    const { name, sourcePath } = data;
    const { codeStart, codeEnd, mode } = this.findCodeBlockByName(editor, name);
    if (codeStart < 0) {
      new Notice(`未找到 "${name}" 代码块`, 3000);
      return;
    }
    // 定位光标并滚动
    editor.setCursor({ line: codeStart, ch: 0 });
    editor.scrollIntoView({ from: { line: codeStart, ch: 0 }, to: { line: codeEnd, ch: 0 } }, 100);
    // 打开编辑器模态框
    const file = this.app.vault.getFileByPath(sourcePath);
    if (file) this.openEditorModal(file, editor, codeStart);
    new Notice(`[信号A] 已定位并打开 "${name}" 代码编译台`, 2000);
  }

  // 执行信号B: 打开组分调整操作台
  async executeSignalB(editor, data) {
    const { name, sourcePath } = data;
    const { codeStart, codeEnd, mode, lines } = this.findCodeBlockByName(editor, name);
    if (codeStart < 0) {
      new Notice(`未找到 "${name}" 代码块`, 3000);
      return;
    }
    // 定位光标并滚动
    editor.setCursor({ line: codeStart, ch: 0 });
    editor.scrollIntoView({ from: { line: codeStart, ch: 0 }, to: { line: codeEnd, ch: 0 } }, 100);
    // 提取代码并解析组分
    const codeLines = [];
    for (let i = codeStart + 1; i < codeEnd; i++) codeLines.push(lines[i]);
    const code = codeLines.join("\n");
    const { nameLine, groups } = parseGroups(code);
    if (groups.length < 2) {
      new Notice("需要至少2个组分", 4000);
      return;
    }

    // 优先从反应信息文件读取组分 (v10.8.0)
    let finalGroups = groups;
    let savedLayout = null;
    try {
      const file = this.app.vault.getFileByPath(sourcePath);
      if (file) {
        const noteDir = path.dirname(this.app.vault.adapter.getFullPath(file.path));
        const svgName = getBlockName(nameLine + "\n" + groups.map((g) => g.code).join("\n"));
        const infoPath = path
          .join(noteDir, "svg_source", `${svgName}.info.txt`)
          .replace(/\\/g, "/");
        const infoFile = this.app.vault.getFileByPath(infoPath);
        if (infoFile) {
          const infoText = await this.app.vault.read(infoFile);
          const reactionInfo = parseReactionInfo(infoText);
          if (reactionInfo.layout && reactionInfo.layout.length > 0) {
            savedLayout = reactionInfo.layout.map((l) => ({
              x: l.x,
              y: l.y,
              scaleX: l.scaleX,
              scaleY: l.scaleY,
              locked: l.locked,
            }));
          }
          if (reactionInfo.components && reactionInfo.components.length > 0) {
            const infoGroups = reactionInfoToGroups(reactionInfo);
            // 验证组分代码非空
            const validGroups = infoGroups.filter((g) => g.code && g.code.trim());
            if (validGroups.length >= 2) {
              finalGroups = validGroups;
              console.log("[Chemfig-SVG] 从反应信息文件读取组分:", finalGroups.length, "个");
            } else {
              console.log("[Chemfig-SVG] 反应信息文件组分代码为空, 使用原始解析");
            }
          }
        }
      }
    } catch (infoErr) {
      console.warn("[Chemfig-SVG] 读取反应信息失败, 使用原始解析:", infoErr.message);
    }

    // 打开组分调整模态框
    const file = this.app.vault.getFileByPath(sourcePath);
    const layoutModal = new GroupLayoutModal(
      this.app,
      this,
      mode,
      nameLine,
      finalGroups,
      async (mergedSvg, layout, bgColor) => {
        const svgName = getBlockName(nameLine + "\n" + groups.map((g) => g.code).join("\n"));
        if (!svgName) return;
        try {
          const bgLine = bgColor && bgColor !== "#ffffff" ? `% BG: ${bgColor}\n` : "";
          const layoutLines = layout.map(
            (p, i) =>
              `% LAYOUT: ${groups[i].name} x=${Math.round(p.x)} y=${Math.round(p.y)} scaleX=${(p.scaleX || 1).toFixed(2)} scaleY=${(p.scaleY || 1).toFixed(2)}${p.locked ? " locked" : ""}`
          );
          const fullCode =
            nameLine +
            "\n" +
            bgLine +
            layoutLines.join("\n") +
            "\n" +
            groups.map((g) => `% GROUP: ${g.name}\n${g.code}`).join("\n") +
            "\n";
          const noteDir = path.dirname(this.app.vault.adapter.getFullPath(file.path));
          await saveSvgAndPng(mergedSvg, svgName, noteDir);
          // 保存反应信息文件 (v10.8.0)
          try {
            const reactionInfo = extractReactionInfo(fullCode, mode, svgName);
            const infoText = reactionInfoToText(reactionInfo, layout);
            const infoPath = path
              .join(noteDir, "svg_source", `${svgName}.info.txt`)
              .replace(/\\/g, "/");
            const infoFile = this.app.vault.getFileByPath(infoPath);
            if (infoFile) {
              await this.app.vault.modify(infoFile, infoText);
            } else {
              await this.app.vault.create(infoPath, infoText);
            }
          } catch (infoErr) {
            console.warn("[Chemfig-SVG] 保存反应信息失败:", infoErr.message);
          }
          const noteRelDir = path.dirname(file.path).replace(/\\/g, "/");
          const pngVaultRel = (noteRelDir ? noteRelDir + "/" : "") + "png_out/" + svgName + ".png";
          const newContent = `![[${pngVaultRel}]]\n\`\`\`${mode}\n${fullCode}\n\`\`\``;
          editor.replaceRange(
            newContent,
            { line: codeStart, ch: 0 },
            { line: codeEnd, ch: lines[codeEnd].length }
          );
          new Notice(`✓ 已生成: ${svgName}`, 3000);
          layoutModal.close();
        } catch (e) {
          new Notice(`生成失败: ${e.message.slice(0, 50)}`, 4000);
        }
      },
      savedLayout
    );
    layoutModal.open();
    new Notice(`[信号B] 已定位并打开 "${name}" 组分调整操作台`, 2000);
  }

  // 通用: 按名称搜索代码块 (支持 %% name: 和 % NAME:)
  findCodeBlockByName(editor, name) {
    const fullContent = editor.getValue();
    const lines = fullContent.split("\n");
    let codeStart = -1,
      codeEnd = -1,
      mode = "chem";
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(`%% name: ${name}`) || lines[i].includes(`% NAME: ${name}`)) {
        for (let j = i; j >= 0 && j >= i - 5; j--) {
          const m = lines[j].match(/^```(\w+)/);
          if (m) {
            codeStart = j;
            mode = m[1];
            break;
          }
        }
        for (let j = i; j < lines.length; j++) {
          if (lines[j].trim() === "```" && j > codeStart) {
            codeEnd = j;
            break;
          }
        }
        break;
      }
    }
    return { codeStart, codeEnd, mode, lines };
  }

  // ========== 分子画布编辑器 (OpenChemLib) ==========
  moleculeSaveHandler(editor) {
    return (result) => {
      if (!editor) return;
      if (result.type === "smiles") {
        editor.replaceRange(result.value, editor.getCursor());
        new Notice("已插入 SMILES", 2000);
      } else if (result.type === "chemfig") {
        const block = "```chem\n% smiles: " + result.smiles + "\n" + result.code + "\n```\n";
        editor.replaceRange(block, editor.getCursor());
        new Notice("已插入结构式代码块", 3000);
      }
    };
  }

  openMoleculeEditor() {
    if (this.enableChemEditor === false) {
      new Notice("分子画布编辑器已在设置中关闭 (enableChemEditor)", 3000);
      return;
    }
    const editor = this.app.workspace.activeEditor?.editor;
    const initialSmiles = this.getSmilesFromCursorBlock(editor);
    new MoleculeEditorModal(this.app, initialSmiles, this.moleculeSaveHandler(editor), "", {
      enableTemplateLibrary: this.enableTemplateLibrary,
    }).open();
  }

  openSmilesSearch() {
    const editor = this.app.workspace.activeEditor?.editor;
    new SmilesSearchModal(this.app, (action, smiles) => {
      if (!editor) return;
      if (action === "block") {
        editor.replaceRange("```smiles\n" + smiles + "\n```\n", editor.getCursor());
        new Notice("已插入 smiles 结构式", 2000);
      } else if (action === "molecule") {
        if (this.enableChemEditor === false) {
          new Notice("分子画布编辑器已在设置中关闭", 3000);
          return;
        }
        new MoleculeEditorModal(this.app, smiles, this.moleculeSaveHandler(editor), "", {
          enableTemplateLibrary: this.enableTemplateLibrary,
        }).open();
      }
    }).open();
  }

  bindSmilesContextMenu(wrapper, smiles) {
    wrapper.addEventListener("contextmenu", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      if (evt.stopImmediatePropagation) evt.stopImmediatePropagation();
      const editor = this.app.workspace.activeEditor?.editor;
      const menu = new Menu();
      menu.addItem((item) =>
        item
          .setTitle("用分子编辑器打开")
          .setIcon("pencil")
          .onClick(() => {
            if (editor)
              new MoleculeEditorModal(this.app, smiles, this.moleculeSaveHandler(editor), "", {
                enableTemplateLibrary: this.enableTemplateLibrary,
              }).open();
          })
      );
      menu.addItem((item) =>
        item
          .setTitle("复制 SMILES")
          .setIcon("copy")
          .onClick(() => {
            navigator.clipboard.writeText(smiles);
            new Notice("SMILES 已复制", 1500);
          })
      );
      menu.showAtMouseEvent(evt);
    });
  }

  getSmilesFromCursorBlock(editor) {
    if (!editor) return "";
    try {
      const cursor = editor.getCursor();
      const lines = editor.getValue().split("\n");
      let start = cursor.line;
      while (start >= 0 && !lines[start].trim().startsWith("```")) start--;
      if (start < 0) return "";
      let end = cursor.line;
      while (end < lines.length && !lines[end].trim().startsWith("```")) end++;
      if (end >= lines.length) return "";
      return extractSmilesFromBlockLines(lines.slice(start + 1, end));
    } catch (e) {
      return "";
    }
  }

  // ========== 工作流: FrontMatter 映射表存储 ==========
  async getTikzSvgMap(file) {
    try {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.["tikz-svg-map"]) {
        return cache.frontmatter["tikz-svg-map"];
      }
    } catch (e) {}
    return [];
  }

  async saveTikzSvgMap(file, records) {
    try {
      await this.app.vault.processFrontMatter(file, (fm) => {
        fm["tikz-svg-map"] = records;
      });
    } catch (e) {
      console.error("[Chemfig-SVG] saveTikzSvgMap:", e.message);
    }
  }

  // 解析笔记中所有代码块, 生成 mapRecords
  async buildTikzSvgMap(file, editor) {
    try {
      const content = editor ? editor.getValue() : await this.app.vault.read(file);
      const lines = content.split("\n");
      const records = [];
      const nameSet = new Set();
      let i = 0;
      while (i < lines.length) {
        const m = lines[i].match(/^```(\w+)/);
        if (m && ["chem", "tikz", "miktex"].includes(m[1])) {
          const startLine = i;
          const mode = m[1];
          let endLine = -1;
          const codeLines = [];
          i++;
          while (i < lines.length) {
            if (lines[i].trim() === "```") {
              endLine = i;
              break;
            }
            codeLines.push(lines[i]);
            i++;
          }
          if (endLine > 0) {
            const body = codeLines.join("\n");
            const name = extractName(body);
            const hash = getHash(body).slice(0, 16);
            let svgBasename = name;
            // 重名检测
            if (name && nameSet.has(name)) {
              new Notice(`⚠️ name 重复: ${name}, 已降级为 hash 命名`, 4000);
              svgBasename = hash;
            } else if (name) {
              nameSet.add(name);
            } else {
              svgBasename = hash;
            }
            const noteDir = path.dirname(file.path).replace(/\\/g, "/");
            const svgRel = (noteDir ? noteDir + "/" : "") + "svg_out/" + svgBasename + ".svg";
            records.push({
              name: name || null,
              hash,
              svgBasename,
              svg: svgRel,
              startLine,
              endLine,
            });
          }
        }
        i++;
      }
      await this.saveTikzSvgMap(file, records);
      return records;
    } catch (e) {
      console.error("[Chemfig-SVG] buildTikzSvgMap:", e.message);
      return [];
    }
  }

  // 删除图片后自动清理残存链接和关联代码块
  async cleanupAfterImageDelete(deletedFile) {
    try {
      const delPath = deletedFile.path || "";
      // 只处理插件生成的图片 (svg_source/ png_out/ svg_out/)
      if (!/(svg_source|png_out|svg_out)\//.test(delPath)) return;
      // 提取文件名 (不含扩展名)
      const nameMatch = delPath.match(/([^/]+)\.(svg|png)$/);
      if (!nameMatch) return;
      const imgName = nameMatch[1];
      console.log(`[Chemfig-SVG] 检测到图片删除: ${imgName}, 开始清理残存链接`);
      // 遍历所有 md 文件
      const mdFiles = this.app.vault.getFiles().filter((f) => f.extension === "md");
      let cleanedCount = 0;
      for (const mdFile of mdFiles) {
        const content = await this.app.vault.read(mdFile);
        const lines = content.split("\n");
        const newLines = [];
        let i = 0;
        let modified = false;
        while (i < lines.length) {
          const line = lines[i];
          // 检测是否为该图片的嵌入链接 ![[...imgName.png]] 或 ![[...imgName.svg]]
          const embedMatch = line.match(
            /!\[\[([^\]]*\/)?(svg_source|png_out|svg_out)\/[^/]*${escapeReg(imgName)}\.(png|svg)\]\]/
          );
          if (embedMatch) {
            modified = true;
            cleanedCount++;
            // 只删除嵌入链接行, 保留代码块
            i++;
            // 跳过链接后紧跟的空行 (最多2行, 不删除代码块前的空行)
            let blankSkipped = 0;
            while (i < lines.length && lines[i].trim() === "" && blankSkipped < 2) {
              i++;
              blankSkipped++;
            }
            continue;
          }
          newLines.push(line);
          i++;
        }
        if (modified) {
          const newContent = newLines.join("\n");
          await this.app.vault.modify(mdFile, newContent);
          console.log(`[Chemfig-SVG] 已清理 ${mdFile.path} 中的 ${imgName} 残存链接`);
        }
      }
      if (cleanedCount > 0) {
        new Notice(`✓ 已清理 ${cleanedCount} 处 "${imgName}" 残存链接`, 3000);
      }
    } catch (e) {
      console.error("[Chemfig-SVG] 清理残存链接失败:", e.message);
    }
  }

  // 将 SVG 插入笔记: 保存文件 + 替换代码块为图片嵌入
  async insertSvgToNote(file, editor, start, end, mode, body, name, svg) {
    try {
      const adapter = this.app.vault.adapter;
      const noteDir = path.dirname(adapter.getFullPath(file.path));
      await saveSvgAndPng(svg, name, noteDir);
      // vault 相对路径用于 ![[...]]
      const noteRelDir = path.dirname(file.path).replace(/\\/g, "/");
      const pngVaultRel = (noteRelDir ? noteRelDir + "/" : "") + "png_out/" + name + ".png";
      // 替换代码块为图片嵌入 + 源代码块 (PNG展示结果, 代码展示逻辑)
      const embedLine = `![[${pngVaultRel}]]`;
      const codeBlock = `\`\`\`${mode}\n${body}\n\`\`\``;
      const newContent = embedLine + "\n" + codeBlock;
      editor.replaceRange(
        newContent,
        { line: start, ch: 0 },
        { line: end, ch: editor.getLine(end).length }
      );
      // 更新 FrontMatter 映射表 (工作流子流程1)
      setTimeout(() => this.buildTikzSvgMap(file, editor), 300);
      new Notice(`✓ 已插入: ${name}.png`, 3000);
    } catch (e) {
      new Notice(`插入失败: ${e.message.slice(0, 60)}`, 5000);
    }
  }

  // 获取代码块的起止行
  getCodeBlockRange(editor, line) {
    let start = line;
    while (start >= 0 && !editor.getLine(start).trim().startsWith("```")) start--;
    let end = line;
    const total = editor.lineCount();
    while (end < total && !editor.getLine(end).trim().startsWith("```")) end++;
    // end 是结束的 ``` 那行
    return { start, end };
  }

  // 提取代码块内容和模式
  extractBlock(editor, line) {
    const { start, end } = this.getCodeBlockRange(editor, line);
    const firstLine = editor.getLine(start).trim();
    const modeMatch = firstLine.match(/```(chem|tikz|miktex|ce)/);
    const mode = modeMatch ? modeMatch[1] : "tikz";
    let body = "";
    for (let i = start + 1; i < end; i++) {
      body += editor.getLine(i) + (i < end - 1 ? "\n" : "");
    }
    return { start, end, mode, body };
  }

  // ========== 保存时编译 ==========
  async handleMarkdown(file, force = false) {
    const content = await this.app.vault.read(file);
    const adapter = this.app.vault.adapter;
    const noteDir = path.dirname(adapter.getFullPath(file.path));
    const svgOutDir = path.join(noteDir, "svg_out");
    if (!fs.existsSync(svgOutDir)) fs.mkdirSync(svgOutDir, { recursive: true });

    const blocks = [];
    let m;
    TIKZ_BLOCK_REG.lastIndex = 0;
    while ((m = TIKZ_BLOCK_REG.exec(content)) !== null) {
      blocks.push({ mode: m[1], body: m[2] });
    }
    if (blocks.length === 0) return;

    const records = [];
    for (const blk of blocks) {
      const name = getBlockName(blk.body);
      const svgFile = path.join(svgOutDir, `${name}.svg`);
      records.push({ name, mode: blk.mode, svg: `svg_out/${name}.svg` });
      if (!force && fs.existsSync(svgFile)) continue;
      try {
        const svg = await this.compileTikz(blk.mode, blk.body);
        fs.writeFileSync(svgFile, svg, "utf8");
        console.log(`[Chemfig-SVG] 编译: ${name}.svg`);
      } catch (e) {
        console.error(`[Chemfig-SVG] 失败 [${name}]:`, e.message);
        new Notice(`[Chemfig-SVG] 编译失败 [${name}]: ${e.message.slice(0, 60)}`, 8000);
      }
    }
    // 更新 frontmatter
    try {
      await this.app.fileManager.processFrontMatter(file, (fm) => {
        fm["tikz-svg-map"] = records;
      });
    } catch (e) {}
  }

  // ========== v10.12.0: 左右侧边栏视图 (受设置开关控制) ==========
  registerSidebarViews() {
    try {
      // 注入侧边栏CSS
      if (typeof SIDEBAR_CSS !== "undefined" && SIDEBAR_CSS) {
        const styleEl = document.createElement("style");
        styleEl.id = "chemfig-sidebar-css";
        styleEl.textContent = SIDEBAR_CSS;
        document.head.appendChild(styleEl);
      }

      // 左右侧边栏视图始终注册 (设置开关只控制图标/命令显隐, 不阻止右键"在侧边栏编辑"直接调用)
      // 注意: 官方 API 为 registerView; 旧代码误用 registerViewType 导致视图类型未注册
      if (typeof ChemfigLeftSidebarView !== "undefined") {
        if (this.registerView)
          this.registerView(
            "chemfig-left-sidebar",
            (leaf) => new ChemfigLeftSidebarView(leaf, this)
          );
        else if (this.registerViewType)
          this.registerViewType(
            "chemfig-left-sidebar",
            (leaf) => new ChemfigLeftSidebarView(leaf, this)
          );
        console.log("[Chemfig-SVG] 左侧边栏视图已注册");
      }

      if (typeof ChemfigRightSidebarView !== "undefined") {
        if (this.registerView)
          this.registerView(
            "chemfig-right-sidebar",
            (leaf) => new ChemfigRightSidebarView(leaf, this)
          );
        else if (this.registerViewType)
          this.registerViewType(
            "chemfig-right-sidebar",
            (leaf) => new ChemfigRightSidebarView(leaf, this)
          );
        console.log("[Chemfig-SVG] 右侧边栏视图已注册");
      }

      // 添加命令 (仅在对应侧边栏启用时)
      if (this.leftSidebarEnabled !== false) {
        this.addCommand({
          id: "open-left-sidebar",
          name: "打开操作面板（左侧边栏）",
          callback: () => this.openLeftSidebar(),
        });
      }
      if (this.rightSidebarEnabled !== false) {
        this.addCommand({
          id: "open-right-sidebar",
          name: "打开代码编辑器（右侧边栏）",
          callback: () => this.openRightSidebar(),
        });
      }

      // v10.12.0: 添加左侧边栏图标 (受设置开关控制)
      if (this.leftSidebarEnabled !== false) {
        try {
          this._leftRibbonIcon = this.addRibbonIcon("flask", "Chemfig 操作面板", (evt) => {
            this.openLeftSidebar();
          });
          console.log("[Chemfig-SVG] 左侧边栏图标已添加");
        } catch (e) {
          console.warn("[Chemfig-SVG] 添加侧边栏图标失败:", e.message);
        }
      }

      console.log("[Chemfig-SVG] 侧边栏命令已注册");
    } catch (e) {
      console.warn("[Chemfig-SVG] 侧边栏视图注册失败:", e.message);
    }
  }

  // ========== v11.0.0: 学习辅助方法 ==========

  // 加载学习卡片 (从 localStorage, 首次加载内置默认卡片)
  loadLearningCards() {
    try {
      const data = localStorage.getItem("chemfig-learning-cards");
      if (data) {
        return JSON.parse(data);
      }
      // 首次加载: 使用内置默认卡片
      if (typeof DEFAULT_LEARNING_CARDS !== "undefined") {
        const cards = DEFAULT_LEARNING_CARDS.map((c, i) => ({
          ...c,
          id: "default_" + i,
          state: SM2Algorithm.defaultState(),
        }));
        this.saveLearningCards(cards);
        return cards;
      }
      return [];
    } catch (e) {
      console.warn("[Chemfig-SVG] 学习卡片加载失败:", e.message);
      return [];
    }
  }

  // 保存学习卡片
  saveLearningCards(cards) {
    try {
      localStorage.setItem("chemfig-learning-cards", JSON.stringify(cards || this.learningCards));
    } catch (e) {
      console.warn("[Chemfig-SVG] 学习卡片保存失败:", e.message);
    }
  }

  // 记录复习历史 (用于热力图)
  recordReviewHistory() {
    try {
      const today = new Date().toISOString().split("T")[0];
      const history = JSON.parse(
        localStorage.getItem("chemfig-review-history") || "{}"
      );
      history[today] = (history[today] || 0) + 1;
      localStorage.setItem("chemfig-review-history", JSON.stringify(history));
    } catch (e) {
      console.warn("[Chemfig-SVG] 复习历史记录失败:", e.message);
    }
  }

  // 添加到薄弱卡片列表
  addToWeakCards(cardId) {
    try {
      const weakCards = JSON.parse(
        localStorage.getItem("chemfig-weak-cards") || "[]"
      );
      if (!weakCards.includes(cardId)) {
        weakCards.push(cardId);
        localStorage.setItem("chemfig-weak-cards", JSON.stringify(weakCards));
      }
    } catch (e) {
      console.warn("[Chemfig-SVG] 薄弱卡片记录失败:", e.message);
    }
  }

  // 开始薄弱卡片复习
  startWeakCardsReview() {
    try {
      const weakCardIds = JSON.parse(
        localStorage.getItem("chemfig-weak-cards") || "[]"
      );

      if (weakCardIds.length === 0) {
        new Notice("🎉 没有薄弱卡片! 继续保持!", 3000);
        return;
      }

      // 筛选出薄弱卡片
      const weakCards = (this.learningCards || []).filter((c) =>
        weakCardIds.includes(c.id)
      );

      if (weakCards.length === 0) {
        new Notice("薄弱卡片列表为空", 2000);
        return;
      }

      // 打乱顺序
      const shuffled = weakCards.sort(() => Math.random() - 0.5);
      let idx = 0;
      let cleared = 0;

      const showNext = () => {
        if (idx >= shuffled.length) {
          // 复习完成，清除答对的薄弱卡片
          const remaining = JSON.parse(
            localStorage.getItem("chemfig-weak-cards") || "[]"
          );
          const newWeak = remaining.filter((id) => {
            const card = shuffled.find((c) => c.id === id);
            return card && card._justCleared !== true;
          });
          localStorage.setItem("chemfig-weak-cards", JSON.stringify(newWeak));

          new Notice(
            `✅ 薄弱卡片复习完成! 答对了 ${cleared} / ${shuffled.length} 张`,
            3000
          );
          return;
        }
        const card = shuffled[idx];
        idx++;

        const modal = new LearningCardModal(
          this.app,
          card,
          (quality) => {
            // 答对了 (质量分 >= 3) 就从薄弱列表中移除
            if (quality >= 3) {
              card._justCleared = true;
              cleared++;
            }
            setTimeout(showNext, 300);
          }
        );
        modal.open();
      };

      showNext();
    } catch (e) {
      console.error("[Chemfig-SVG] 薄弱卡片复习失败:", e);
    }
  }

  // ========== v11.4.0: 每日一题 ==========
  getDailyCard() {
    const cards = this.learningCards || [];
    if (cards.length === 0) return null;

    // 根据日期选择卡片 (同一天显示同一张)
    const today = new Date().toISOString().split("T")[0];
    const dayOfYear = Math.floor(
      (new Date(today) - new Date(new Date(today).getFullYear(), 0, 0)) /
        86400000
    );

    // 用日期作为种子选择卡片
    const index = dayOfYear % cards.length;
    return cards[index];
  }

  // 显示每日一题
  showDailyCard() {
    const card = this.getDailyCard();
    if (!card) {
      new Notice("暂无学习卡片", 2000);
      return;
    }

    const modal = new LearningCardModal(this.app, card, () => {});
    modal.open();
  }

  // ========== v12.0.0: 显示预设化合物列表 ==========
  showPresetMolecules() {
    if (typeof PRESET_MOLECULES === "undefined") return;

    // 创建选择模态框
    const modal = new Modal(this.app);
    modal.titleEl.setText("选择预设化合物");

    const container = modal.contentEl;
    container.empty();

    const list = container.createDiv({ cls: "preset-molecules-list" });

    PRESET_MOLECULES.forEach((mol) => {
      const item = list.createDiv({ cls: "preset-molecule-item" });
      item.createEl("div", { text: mol.name, cls: "preset-name" });
      item.createEl("code", { text: mol.smiles, cls: "preset-smiles" });

      item.onclick = () => {
        modal.close();
        new Molecule3DModal(this.app, mol.smiles).open();
      };
    });

    modal.open();
  }

  // ========== v11.7.0: 学习数据导出/导入 ==========
  async exportLearningData() {
    try {
      const data = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        cards: this.learningCards || [],
        reviewHistory: JSON.parse(
          localStorage.getItem("chemfig-review-history") || "{}"
        ),
        weakCards: JSON.parse(
          localStorage.getItem("chemfig-weak-cards") || "[]"
        ),
        settings: this.settings || {},
      };

      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });

      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `chemfig-learning-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);

      new Notice("✅ 学习数据已导出", 3000);
    } catch (e) {
      console.error("[Chemfig-SVG] 导出失败:", e);
      new Notice("❌ 导出失败: " + e.message, 3000);
    }
  }

  async importLearningData() {
    try {
      // 创建文件选择器
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json";

      input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const text = await file.text();
        const data = JSON.parse(text);

        // 验证数据格式
        if (!data.cards) {
          new Notice("❌ 无效的备份文件", 3000);
          return;
        }

        // 确认导入
        const confirmed = window.confirm(
          `将导入 ${data.cards.length} 张卡片，是否覆盖现有数据？\n\n(点击确定覆盖，取消则合并)`
        );

        if (confirmed) {
          // 覆盖导入
          this.learningCards = data.cards;
          this.saveLearningCards();
        } else {
          // 合并导入 (按 id 去重)
          const existingIds = new Set((this.learningCards || []).map((c) => c.id));
          const newCards = data.cards.filter((c) => !existingIds.has(c.id));
          this.learningCards = [...(this.learningCards || []), ...newCards];
          this.saveLearningCards();
          new Notice(`✅ 合并导入 ${newCards.length} 张新卡片`, 3000);
          return;
        }

        // 导入其他数据
        if (data.reviewHistory) {
          localStorage.setItem(
            "chemfig-review-history",
            JSON.stringify(data.reviewHistory)
          );
        }
        if (data.weakCards) {
          localStorage.setItem(
            "chemfig-weak-cards",
            JSON.stringify(data.weakCards)
          );
        }

        new Notice("✅ 学习数据导入成功", 3000);
      };

      input.click();
    } catch (e) {
      console.error("[Chemfig-SVG] 导入失败:", e);
      new Notice("❌ 导入失败: " + e.message, 3000);
    }
  }

  // 开始复习会话
  startReviewSession(categoryFilter) {
    const now = Date.now();
    // 支持 FSRS 和 SM-2 两种字段名
    let dueCards = (this.learningCards || []).filter(
      (c) => (c.state?.due || c.state?.nextReview || 0) <= now
    );

    // 如果指定了分类筛选
    if (categoryFilter) {
      dueCards = dueCards.filter((c) => c.category === categoryFilter);
    }

    if (dueCards.length === 0) {
      new Notice(
        `🎉 ${categoryFilter ? "[" + categoryFilter + "] " : ""}今日复习已完成! 暂无待复习卡片`,
        3000
      );
      return;
    }

    // 获取使用的算法和模式 (默认 SM-2, 可在设置中切换)
    const reviewMode = this.settings?.reviewMode || "adaptive"; // adaptive / fixed
    const algorithm = this.settings?.spacedRepetitionAlgorithm || "sm2";
    const fixedInterval = this.settings?.fixedIntervalDays || 3; // 固定间隔天数

    // 打乱顺序
    const shuffled = dueCards.sort(() => Math.random() - 0.5);
    let idx = 0;

    const showNext = () => {
      if (idx >= shuffled.length) {
        new Notice("✅ 复习完成! 共复习 " + shuffled.length + " 张卡片", 3000);
        return;
      }
      const card = shuffled[idx];
      idx++;

      const modal = new LearningCardModal(
        this.app,
        card,
        (quality) => {
          // 根据模式选择复习逻辑
          if (reviewMode === "fixed") {
            // 固定间隔模式: 简单逻辑
            // 记住了 → X 天后复习; 忘记了 → 明天复习
            const intervalDays = quality >= 3 ? fixedInterval : 1;
            card.state = card.state || {};
            card.state.nextReview = Date.now() + intervalDays * 86400000;
            card.state.status = "learning";
          } else if (algorithm === "fsrs" && typeof FSRSScheduler !== "undefined") {
            // FSRS 算法
            const fsrsRating =
              quality <= 2 ? "again" : quality === 3 ? "hard" : quality === 4 ? "good" : "easy";
            card.state = FSRSScheduler.review(card.state, fsrsRating);
          } else {
            // SM-2 算法
            card.state = SM2Algorithm.review(card.state, quality);
          }

          this.saveLearningCards();

          // 记录复习历史 (用于热力图)
          this.recordReviewHistory();

          // 记录错题 (质量分 <= 2 标记为薄弱)
          if (quality <= 2) {
            this.addToWeakCards(card.id);
          }

          // 显示下一张
          setTimeout(showNext, 300);
        }
      );
      modal.open();
    };

    showNext();
  }

  async openLeftSidebar() {
    try {
      // getLeftLeaf(true) 确保创建新leaf
      const leaf = this.app.workspace.getLeftLeaf(true);
      if (leaf) {
        await leaf.open({ type: "chemfig-left-sidebar" });
        this.app.workspace.revealLeaf(leaf);
        console.log("[Chemfig-SVG] 左侧边栏已打开");
      } else {
        new Notice("无法打开左侧边栏", 2000);
      }
    } catch (e) {
      new Notice("打开左侧边栏失败: " + e.message, 3000);
      console.error("[Chemfig-SVG] 打开左侧边栏失败:", e);
    }
  }

  async openRightSidebar() {
    try {
      // getRightLeaf(true) 确保创建新leaf
      const leaf = this.app.workspace.getRightLeaf(true);
      if (leaf) {
        await leaf.open({ type: "chemfig-right-sidebar" });
        this.app.workspace.revealLeaf(leaf);
        console.log("[Chemfig-SVG] 右侧边栏已打开");
      } else {
        new Notice("无法打开右侧边栏", 2000);
      }
    } catch (e) {
      new Notice("打开右侧边栏失败: " + e.message, 3000);
      console.error("[Chemfig-SVG] 打开右侧边栏失败:", e);
    }
  }

  // v10.15.x: 从 .info.txt 读取已保存的组分布局 (供 main/sidebar 入口恢复布局, 与 editor.ts 一致)
  async _loadSavedLayout(file, nameLine, groups) {
    try {
      if (!file) return null;
      const name = getBlockName((nameLine || "") + "\n" + groups.map((g) => g.code).join("\n"));
      if (!name || name === getHash(nameLine || "")) return null;
      const adapter = this.app.vault.adapter;
      const noteDir = path.dirname(adapter.getFullPath(file.path));
      const infoPath = path.join(noteDir, "svg_source", name + ".info.txt").replace(/\\/g, "/");
      if (!(await adapter.exists(infoPath))) return null;
      const info = parseReactionInfo(await adapter.read(infoPath));
      if (!info.layout || info.layout.length === 0) return null;
      return info.layout.map((l) => ({
        x: l.x,
        y: l.y,
        scaleX: l.scaleX,
        scaleY: l.scaleY,
        locked: l.locked,
      }));
    } catch (e) {
      console.warn("[Chemfig-SVG] 读取布局信息失败:", e);
      return null;
    }
  }

  // v10.11.0: 从编辑器当前代码块打开组分调整
  async openGroupLayoutFromEditor(editor) {
    try {
      if (!editor) {
        const activeLeaf = this.app.workspace.activeLeaf;
        if (activeLeaf && activeLeaf.view && activeLeaf.view.editor) {
          editor = activeLeaf.view.editor;
        } else {
          new Notice("请先打开一个笔记", 2000);
          return;
        }
      }
      const cursor = editor.getCursor();
      const line = editor.getLine(cursor.line);
      if (!line.startsWith("```")) {
        new Notice("请将光标放在代码块的 ``` 行", 2000);
        return;
      }
      const mode = line.replace(/```/, "").trim();
      if (!["chem", "tikz", "miktex", "ce"].includes(mode)) {
        new Notice("不支持的代码块模式: " + mode, 2000);
        return;
      }
      // 读取代码块内容
      let code = "";
      let i = cursor.line + 1;
      while (i < editor.lineCount()) {
        const l = editor.getLine(i);
        if (l.startsWith("```")) break;
        code += l + "\n";
        i++;
      }
      code = code.trim();
      if (!code) {
        new Notice("代码块为空", 2000);
        return;
      }
      // 解析组分 (parseGroups 返回 { nameLine, groups })
      const parsed = parseGroups(code);
      const groups = parsed.groups;
      if (!groups || groups.length < 2) {
        new Notice("代码中至少需要2个组分才能进行组分调整", 3000);
        return;
      }
      // 提取名称 (优先 parseGroups 的 nameLine, 回退正则)
      const nameMatch = code.match(/^%%?\s*(?:NAME|name)\s*:\s*(.+)$/m);
      const nameLine = parsed.nameLine || (nameMatch ? nameMatch[1].trim() : "未命名反应");
      // v10.15.x: 恢复已保存的组分布局
      const file = this.app.workspace.getActiveFile();
      const savedLayout = await this._loadSavedLayout(file, nameLine, groups);
      // 打开组分调整模态框
      const modal = new GroupLayoutModal(
        this.app,
        this,
        mode,
        nameLine,
        groups,
        (mergedSvg, layout, bgColor) => {
          new Notice("组分布局已应用", 2000);
        },
        savedLayout
      );
      modal.open();
    } catch (e) {
      new Notice("打开组分调整失败: " + e.message, 3000);
      console.error("[Chemfig-SVG] 打开组分调整失败:", e);
    }
  }

  // V2.0-iter: 渲染就绪判断 —— bridge 模式不依赖本机 MiKTeX
  _renderReady() {
    return this.renderBackend === "bridge" || this.envReady;
  }

  // V2.0-iter: 启动时探测桥接服务可用性 (异步不阻塞, 不可用给出降级提示)
  async _probeBridge() {
    if (this._bridgeChecked) return;
    this._bridgeChecked = true;
    const r = await this.bridgeClient.health();
    if (r.ok) {
      console.log("[Chemfig-SVG] 桥接服务在线:", r.data && r.data.version);
    } else {
      new Notice(
        "[Chemfig-SVG] 桥接服务不可用 (" +
          (r.error || "未响应") +
          ")。请启动 node server.js (端口 9123), 或切回 local 后端",
        10000
      );
    }
  }

  // ========== 编译核心 (V2.0-iter: 安全清洗 + 双后端 + SHA256 缓存) ==========
  // priority: "high" (用户手动渲染, 桥接队列优先) | "normal" (保存自动渲染)
  compileTikz(mode, body, priority) {
    const prio = priority === "high" ? "high" : "normal";
    perf.start("compileTikz:" + mode);
    // V2.0-iter 安全层: 插件侧 LaTeX 输入清洗 (bridge 模式桥接服务会二次清洗)
    const { code, removed } = sanitizeLatex(body);
    if (removed.length) {
      console.warn("[Chemfig-SVG] 已移除高危 LaTeX 命令:", removed.join(", "));
      new Notice("已过滤高危 LaTeX 命令: " + removed.join(", "), 4000);
    }
    if (!code || !code.trim()) {
      perf.end("compileTikz:" + mode);
      return Promise.reject(new Error("代码为空或仅包含被禁止的命令"));
    }
    // bridge 模式不依赖本机 pdflatex, 跳过环境检查
    if (this.renderBackend === "bridge") {
      return this._doCompile(mode, code, prio);
    }
    // local 模式: 懒加载环境检查
    if (!this._envChecked) {
      return this.envManager.check().then(() => {
        if (!this.envReady) {
          perf.end("compileTikz:" + mode);
          return Promise.reject(new Error("编译环境未就绪"));
        }
        return this._doCompile(mode, code, prio);
      });
    }
    if (!this.envReady) {
      perf.end("compileTikz:" + mode);
      return Promise.reject(new Error("编译环境未就绪"));
    }
    return this._doCompile(mode, code, prio);
  }

  _doCompile(mode, body, priority) {
    const cacheKey = mode + ":" + getHash(body);
    // V2.0-iter: SHA256 源码缓存 (内存 LRU + 磁盘持久化)
    let cached = undefined;
    if (this.svgCacheManager) cached = this.svgCacheManager.get(cacheKey);
    if (cached === undefined && this._compileCache) cached = this._compileCache.get(cacheKey);
    if (cached !== undefined) {
      console.log(`[Chemfig-SVG] 编译缓存命中: ${cacheKey.slice(0, 16)}`);
      perf.end("compileTikz:" + mode);
      return Promise.resolve(cached);
    }
    if (this.renderBackend === "bridge") {
      return this._compileViaBridge(mode, body, cacheKey, priority);
    }
    return this._compileViaLocal(mode, body, cacheKey);
  }

  async _compileViaBridge(mode, body, cacheKey, priority) {
    try {
      // 桥接服务会执行二次清洗 (双重防护); high 优先级 = 用户手动渲染
      const svg = await this.bridgeClient.render(body, priority === "high" ? "high" : "normal");
      const final = ensureSvgNamespace(svg);
      if (this.svgCacheManager) this.svgCacheManager.set(cacheKey, final);
      if (this._compileCache) this._compileCache.set(cacheKey, final);
      perf.end("compileTikz:" + mode);
      return final;
    } catch (e) {
      // v10.15.0: bridge 连接失败时自动回退到 local 模式
      if (
        e.message &&
        (e.message.includes("ECONNREFUSED") ||
          e.message.includes("Connection") ||
          e.message.includes("fetch"))
      ) {
        console.warn("[Chemfig-SVG] bridge 服务不可用, 自动回退到 local 模式:", e.message);
        new Notice("[Chemfig-SVG] bridge 服务未运行, 已自动切换到本地编译", 5000);
        this.renderBackend = "local";
        return this._compileViaLocal(mode, body, cacheKey);
      }
      this._lastCompileError = {
        summary: e.message,
        fullLog: e.message,
        mode,
        body,
        time: Date.now(),
        errors: e.errors || [],
        warnings: e.warnings || [],
      };
      perf.end("compileTikz:" + mode);
      throw e;
    }
  }

  _compileViaLocal(mode, body, cacheKey) {
    const task = () =>
      compileLatexLocal(mode, body)
        .then((svg) => {
          const final = ensureSvgNamespace(svg);
          if (this.svgCacheManager) this.svgCacheManager.set(cacheKey, final);
          if (this._compileCache) this._compileCache.set(cacheKey, final);
          if (this._perfReporter) this._perfReporter.record("compile:" + mode, 0);
          return final;
        })
        .catch((e) => {
          if (e && e.detail) {
            this._lastCompileError = Object.assign({ mode, body, time: Date.now() }, e.detail);
          } else if (e) {
            this._lastCompileError = {
              summary: e.message,
              fullLog: e.message,
              mode,
              body,
              time: Date.now(),
            };
          }
          throw e;
        })
        .finally(() => {
          perf.end("compileTikz:" + mode);
        });
    return this._compileQueue ? this._compileQueue.add(task) : task();
  }

  cleanup(dir) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch (e) {}
  }

  // ========== 结构式库: 全局存储, 跨笔记复用 ==========
  // 结构式库: 内存数组 + IndexedDB 持久化 (混合方案, 保持同步访问)
  loadStructureLibrary() {
    // 同步返回空数组, 实际数据异步加载
    this._loadLibraryFromDB();
    return [];
  }

  // 异步从 IndexedDB 加载结构式库, 首次加载时从 localStorage 迁移
  async _loadLibraryFromDB() {
    try {
      const db = getStructureIndexDB();
      if (!db) {
        // IndexedDB 不可用, 回退到 localStorage
        const data = localStorage.getItem("chemfig-structure-library");
        this.structureLibrary = data ? JSON.parse(data) : [];
        return;
      }
      const all = await db.getAll();
      if (all.length > 0) {
        // IndexedDB 有数据, 直接使用
        this.structureLibrary = all.map((s) => ({
          name: s.name,
          mode: s.mode,
          code: s.code,
          category: s.category || "未分类",
          createdAt: s.createdAt || Date.now(),
        }));
      } else {
        // IndexedDB 为空, 尝试从 localStorage 迁移
        const data = localStorage.getItem("chemfig-structure-library");
        if (data) {
          const legacy = JSON.parse(data);
          this.structureLibrary = legacy;
          // 迁移到 IndexedDB
          for (const item of legacy) {
            await db.put({
              id: `lib_${item.name}_${item.createdAt}`,
              name: item.name,
              mode: item.mode,
              code: item.code,
              category: item.category || "未分类",
              createdAt: item.createdAt || Date.now(),
              type: "library",
            });
          }
          console.log(`[Chemfig-SVG] 已迁移 ${legacy.length} 个结构式到 IndexedDB`);
        } else {
          this.structureLibrary = [];
        }
      }
    } catch (e) {
      console.warn("[Chemfig-SVG] 结构式库加载失败, 回退 localStorage:", e.message);
      const data = localStorage.getItem("chemfig-structure-library");
      this.structureLibrary = data ? JSON.parse(data) : [];
    }
  }

  // 保存结构式库到 IndexedDB (同时保留 localStorage 备份)
  async saveStructureLibrary() {
    try {
      // localStorage 备份 (向后兼容)
      localStorage.setItem("chemfig-structure-library", JSON.stringify(this.structureLibrary));
      // IndexedDB 持久化
      const db = getStructureIndexDB();
      if (db) {
        // 先清空旧数据, 再批量写入
        await db.clear();
        for (const item of this.structureLibrary) {
          await db.put({
            id: `lib_${item.name}_${item.createdAt}`,
            name: item.name,
            mode: item.mode,
            code: item.code,
            category: item.category || "未分类",
            createdAt: item.createdAt || Date.now(),
            type: "library",
          });
        }
      }
    } catch (e) {
      console.warn("[Chemfig-SVG] 结构式库保存失败:", e.message);
    }
  }

  // 保存光标处结构式到库
  async saveToLibrary(file, editor, line) {
    const block = this.extractCodeBlock(editor, line);
    if (!block) {
      new Notice("未找到结构式代码块", 3000);
      return;
    }
    const name = getBlockName(block.body) || `结构式_${Date.now()}`;
    // 检查是否已存在
    const existing = this.structureLibrary.findIndex((s) => s.name === name);
    if (existing >= 0) {
      this.structureLibrary[existing] = {
        name,
        mode: block.mode,
        code: block.body,
        category: "未分类",
        createdAt: Date.now(),
      };
    } else {
      this.structureLibrary.push({
        name,
        mode: block.mode,
        code: block.body,
        category: "未分类",
        createdAt: Date.now(),
      });
    }
    await this.saveStructureLibrary();
    new Notice(`已保存到结构式库: ${name}`, 3000);
  }

  // 从库选择并插入结构式 (使用 FuzzySuggestModal 模糊搜索)
  openLibraryPicker(editor) {
    if (this.structureLibrary.length === 0) {
      new Notice("结构式库为空, 请先保存结构式", 3000);
      return;
    }
    const modal = new StructureLibraryModal(this.app, this.structureLibrary, (selected) => {
      if (!selected) return;
      const cursor = editor.getCursor();
      editor.replaceRange(`\`\`\`${selected.mode}\n${selected.code}\n\`\`\`\n`, cursor);
      new Notice(`已插入: ${selected.name}`, 2000);
    });
    modal.open();
  }

  // 管理结构式库 (查看/删除)
  async openLibraryManager() {
    if (this.structureLibrary.length === 0) {
      new Notice("结构式库为空", 2000);
      return;
    }
    const names = this.structureLibrary
      .map((s, i) => `${i + 1}. ${s.name} [${s.mode}] ${s.category}`)
      .join("\n");
    const idxStr = prompt(
      `结构式库管理 (共 ${this.structureLibrary.length} 个)\n\n${names}\n\n输入序号删除, 或留空取消:`
    );
    if (!idxStr) return;
    const idx = parseInt(idxStr) - 1;
    if (isNaN(idx) || idx < 0 || idx >= this.structureLibrary.length) {
      new Notice("无效序号", 2000);
      return;
    }
    const removed = this.structureLibrary.splice(idx, 1)[0];
    await this.saveStructureLibrary();
    new Notice(`已删除: ${removed.name}`, 2000);
  }

  // ========== 批量导出: 当前笔记所有结构式为 PNG ==========
  async exportAllPng(file) {
    const content = await this.app.vault.read(file);
    const blocks = this.extractAllCodeBlocks(content);
    if (blocks.length === 0) {
      new Notice("未找到结构式代码块", 3000);
      return;
    }
    const noteDir = file.parent?.path || "";
    const exportDir = path.join(noteDir, "export_png");
    // 创建导出目录
    try {
      await this.app.vault.createFolder(exportDir);
    } catch (e) {
      /* 已存在 */
    }

    let success = 0,
      failed = 0;
    for (let i = 0; i < blocks.length; i++) {
      const blk = blocks[i];
      const name = getBlockName(blk.body) || `结构式_${i + 1}`;
      try {
        const svg = await this.compileTikz(blk.mode, blk.body);
        const pngBuffer = await svgToPng(svg);
        const pngPath = path.join(exportDir, `${name}.png`);
        await this.app.vault.createBinary(pngPath, pngBuffer);
        success++;
      } catch (e) {
        console.warn(`[Chemfig-SVG] 导出失败: ${name}`, e.message);
        failed++;
      }
    }
    new Notice(`导出完成: 成功 ${success}, 失败 ${failed}\n路径: ${exportDir}`, 5000);
  }

  // ========== 编译预热: 预编译常用模板 ==========
  warmupCompile() {
    const warmupCodes = [
      { mode: "chem", code: "% NAME: warmup_benzene\n\\chemfig{*6(-=-=-=)}" },
      {
        mode: "chem",
        code: "% NAME: warmup_arrow\n\\chemfig{A}\\arrow{->[催化剂][加热]}\\chemfig{B}",
      },
      {
        mode: "tikz",
        code: "% NAME: warmup_tikz\n\\begin{tikzpicture}\\draw (0,0) -- (1,1);\\end{tikzpicture}",
      },
    ];
    new Notice("编译预热中...", 2000);
    warmupCodes.forEach(async (w) => {
      try {
        await this.compileTikz(w.mode, w.code);
        console.log(`[Chemfig-SVG] 预热完成: ${w.code.split("\n")[0]}`);
      } catch (e) {
        console.warn("[Chemfig-SVG] 预热失败:", e.message?.slice(0, 50));
      }
    });
    setTimeout(() => new Notice("编译预热完成", 2000), 3000);
  }

  // ========== 图片预加载: hover 时预加载放大预览 ==========
  // 在 bindSvgContextMenu 中添加 hover 预加载
  // (已在旁侧工具栏实现, 这里添加全局图片 hover 预加载)

  // ========== 内存管理: 离开笔记时清理缓存 ==========
  // 在 active-leaf-change 时清理旧缓存
  // (已在视图切换轮询中实现, 这里添加主动清理)

  // ========== 自定义模板管理 (委托给 TemplateBrowser) ==========
  // 获取指定模式的所有模板 (内置 + 自定义)
  getAllTemplates(mode) {
    return this.templateBrowser.getAll(mode);
  }

  // 保存自定义模板
  async saveCustomTemplate(name, code, mode, category, subcategory) {
    const tpl = await this.templateBrowser.saveCustom(name, code, mode, category, subcategory);
    this.customTemplates = this.templateBrowser.customTemplates;
    return tpl;
  }

  // 删除自定义模板
  async deleteCustomTemplate(name) {
    await this.templateBrowser.deleteCustom(name);
    this.customTemplates = this.templateBrowser.customTemplates;
  }

  // ========== 阅读模式渲染 (内联SVG修复) ==========
  // 检测光标是否在 [code] details 内的代码块中
  detectDetailsCodeContext(editor, cursorLine) {
    const totalLines = editor.lineCount();
    // 检测光标是否在代码块 ```mode ... ``` 中
    let codeStart = -1,
      codeEnd = -1,
      mode = "";
    for (let i = cursorLine; i >= 0 && i >= cursorLine - 30; i--) {
      const m = editor.getLine(i).match(/^```(\w+)/);
      if (m) {
        codeStart = i;
        mode = m[1];
        break;
      }
    }
    if (codeStart < 0) return null;
    for (let i = cursorLine; i < totalLines && i <= cursorLine + 30; i++) {
      if (editor.getLine(i).trim() === "```" && i > codeStart) {
        codeEnd = i;
        break;
      }
    }
    if (codeEnd < 0) return null;
    if (cursorLine <= codeStart || cursorLine >= codeEnd) return null;
    // 检测代码块上方是否有 SVG 嵌入 ![[svg_out/...svg]]
    let hasSvgEmbed = false;
    for (let i = codeStart - 1; i >= 0 && i >= codeStart - 5; i--) {
      if (editor.getLine(i).includes("![[") && editor.getLine(i).includes("svg_out/")) {
        hasSvgEmbed = true;
        break;
      }
    }
    // 兼容旧 details 格式: 上方有 <details><summary>[code]
    if (!hasSvgEmbed) {
      for (let i = codeStart - 1; i >= 0 && i >= codeStart - 10; i--) {
        if (editor.getLine(i).includes("<details>") || editor.getLine(i).includes("[code]")) {
          hasSvgEmbed = true;
          break;
        }
      }
    }
    if (!hasSvgEmbed) return null;
    // 提取名称
    const codeLines = [];
    for (let i = codeStart + 1; i < codeEnd; i++) codeLines.push(editor.getLine(i));
    const code = codeLines.join("\n");
    const name = getBlockName(code) || mode;
    return { name, mode, codeStart, codeEnd };
  }

  // 编辑模式自动刷新: 从编辑器提取代码编译更新 SVG
  async autoRegenFromEditor(editor, info, ctx) {
    // 提取代码
    const codeLines = [];
    for (let i = ctx.codeStart + 1; i < ctx.codeEnd; i++) {
      codeLines.push(editor.getLine(i));
    }
    const code = codeLines.join("\n").trim();
    if (!code || code.length < 5) return;
    // 代码未变化则跳过 (简单哈希)
    let hash = 0;
    for (let i = 0; i < code.length; i++) {
      hash = ((hash << 5) - hash + code.charCodeAt(i)) | 0;
    }
    const hashKey = `${ctx.name}:${hash}`;
    if (hashKey === this.lastAutoRegenHash) return;
    this.lastAutoRegenHash = hashKey;
    const svgName = getBlockName(code) || ctx.name;
    if (!svgName) return;
    try {
      // 编译
      let svg;
      if (/%\s*GROUP:/.test(code)) {
        svg = await this.compileFromGroups(code);
      } else {
        svg = await this.compileTikz(ctx.mode, code);
      }
      // 保存 SVG (从 activeEditor 获取 file, 因为 info?.file 可能为空)
      const file = info?.file || this.app.workspace.activeEditor?.file;
      if (!file) return;
      const noteDir = path.dirname(this.app.vault.adapter.getFullPath(file.path));
      await saveSvgAndPng(svg, svgName, noteDir);
      // 实时更新页面上的 PNG 图片 (加时间戳强制刷新缓存)
      const allImgs = document.querySelectorAll("img[src*='png_out/']");
      for (const img of allImgs) {
        if (img.src.includes(encodeURIComponent(svgName)) || img.src.includes(svgName)) {
          const baseSrc = img.src.split("?")[0];
          img.src = baseSrc + "?t=" + Date.now();
        }
      }
      // 同时更新内联 SVG 容器
      const containers = document.querySelectorAll(".miktex-svg-container");
      for (const c of containers) {
        const parent = c.closest("p, div, span");
        if (parent?.textContent?.includes(`% NAME: ${svgName}`)) {
          c.innerHTML = svg;
          const innerSvg = c.querySelector("svg");
          if (innerSvg) {
            innerSvg.style.maxWidth = "100%";
            innerSvg.style.height = "auto";
            innerSvg.style.display = "inline-block";
          }
        }
      }
      console.log(`[Chemfig-SVG] 自动刷新: ${svgName}`);
    } catch (e) {
      console.warn("[Chemfig-SVG] 自动刷新编译失败:", e.message?.slice(0, 80));
    }
  }

  // 通用: 给 SVG 元素(img或内联容器)绑定右键菜单(编辑+刷新)
  // 图片旁侧浮动工具栏: 编辑/刷新/互转/放大 (不阻止原生右键菜单)
  bindSvgContextMenu(element, svgName, sourcePath, refreshTrigger) {
    element.setAttribute("data-chemfig-svg", "true");
    element.setAttribute("data-svg-name", svgName);
    // 避免重复绑定
    if (element.parentElement?.classList?.contains("chemfig-img-wrapper")) return;
    const isPng = element.tagName === "IMG";
    // 包裹元素
    const wrapper = document.createElement("span");
    wrapper.className = "chemfig-img-wrapper";
    wrapper.style.cssText = "position:relative;display:inline-block;vertical-align:middle;";
    element.parentNode.insertBefore(wrapper, element);
    wrapper.appendChild(element);
    // 浮动按钮组 (右上角, 悬停显示)
    const toolbar = document.createElement("div");
    toolbar.className = "chemfig-img-toolbar";
    toolbar.style.cssText = "position:absolute;top:6px;right:6px;display:none;gap:4px;z-index:100;";
    wrapper.addEventListener("mouseenter", () => {
      toolbar.style.display = "flex";
    });
    wrapper.addEventListener("mouseleave", () => {
      toolbar.style.display = "none";
    });
    const BTN_CSS =
      "width:26px;height:26px;border:none;border-radius:4px;background:rgba(0,0,0,0.6);color:white;cursor:pointer;font-size:13px;padding:0;display:flex;align-items:center;justify-content:center;";
    const mkBtn = (text, title, onclick) => {
      const b = document.createElement("button");
      b.textContent = text;
      b.title = title;
      b.style.cssText = BTN_CSS;
      b.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onclick(e);
      };
      toolbar.appendChild(b);
      return b;
    };
    // 放大按钮
    mkBtn("🔍", "放大预览", () => this.showImageZoom(element, svgName));
    // 查看源代码按钮 (v2.0): 定位到笔记中对应代码块
    mkBtn("📄", "查看源代码", () => {
      const leaf = this.app.workspace.activeLeaf;
      const editor = leaf && leaf.view && leaf.view.editor;
      if (editor && typeof this.findCodeBlockByName === "function") {
        const found = this.findCodeBlockByName(editor, svgName);
        const codeStart = found && typeof found === "object" ? found.codeStart : -1;
        if (codeStart >= 0) {
          editor.setCursor({ line: codeStart, ch: 0 });
          editor.scrollIntoView({ from: { line: codeStart, ch: 0 } }, 100);
          new Notice("已定位到源代码块 (第 " + (codeStart + 1) + " 行)", 2000);
          return;
        }
      }
      new Notice("未找到对应源代码块", 2000);
    });
    // SVG/PNG 互转按钮 (v2.0)
    mkBtn("⇄", "SVG/PNG 互转", () => this.toggleSvgPng(element, svgName, sourcePath));
    // 刷新按钮 (仅当有 refreshTrigger 回调时)
    if (typeof refreshTrigger === "function") {
      mkBtn("🔄", "刷新", () => refreshTrigger());
    }
    // 进入svg编辑按钮: 打开代码编译台
    mkBtn("✏️", "进入SVG编辑", () => {
      // 编辑模式下直接打开代码编译台, 阅读模式下通过信号机制切换
      const activeLeaf = this.app.workspace.activeLeaf;
      if (
        activeLeaf &&
        activeLeaf.view &&
        activeLeaf.view.getMode &&
        activeLeaf.view.getMode() === "source"
      ) {
        const editor = activeLeaf.view.editor;
        if (editor) {
          const { codeStart } = this.findCodeBlockByName(editor, svgName);
          if (codeStart >= 0) {
            editor.setCursor({ line: codeStart, ch: 0 });
            editor.scrollIntoView({ from: { line: codeStart, ch: 0 } }, 100);
            const file = this.app.vault.getFileByPath(sourcePath);
            if (file) this.openEditorModal(file, editor, codeStart);
            return;
          }
        }
      }
      // 阅读模式或未找到: 通过信号机制切换
      this.editEmbeddedSvg({ clientX: 0, clientY: 0 }, sourcePath, element);
    });
    wrapper.appendChild(toolbar);
    // 全局放大拦截已统一处理所有 img 的左右键事件, 此处不再重复绑定
    element.style.cursor = "zoom-in";
  }

  // 图片放大预览模态框 (5种背景效果)
  showImageZoom(element, svgName) {
    const bgStyles = {
      亚克力:
        "background:rgba(30,30,30,0.65);backdrop-filter:blur(20px) saturate(180%);-webkit-backdrop-filter:blur(20px) saturate(180%);",
      Glass:
        "background:rgba(255,255,255,0.15);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.2);",
      安卓原生:
        "background:rgba(0,0,0,0.92);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);",
      深色: "background:rgba(0,0,0,0.95);",
      浅色: "background:rgba(245,245,245,0.95);",
    };
    let currentBg = "亚克力";

    // ===== 遮罩层 =====
    const overlay = document.createElement("div");
    overlay.className = "chemfig-zoom-overlay";
    overlay.style.cssText = bgStyles[currentBg];

    // ===== 容器 =====
    const container = document.createElement("div");
    container.className = "chemfig-zoom-container";

    // ===== 图片包装 =====
    const imgWrapper = document.createElement("div");
    imgWrapper.className = "chemfig-zoom-image-wrapper";

    // 支持所有图片类元素: IMG, SVG, CANVAS, .image-embed, 容器
    let displayEl = null;
    const tag = element.tagName;
    const commonStyle = "max-width:100%;max-height:75vh;object-fit:contain;display:block;";
    if (tag === "IMG") {
      displayEl = document.createElement("img");
      displayEl.src = element.src;
      displayEl.style.cssText = commonStyle;
    } else if (tag === "SVG") {
      displayEl = element.cloneNode(true);
      displayEl.style.cssText = commonStyle + "width:auto;height:auto;";
    } else if (tag === "CANVAS") {
      displayEl = document.createElement("img");
      displayEl.src = element.toDataURL("image/png");
      displayEl.style.cssText = commonStyle;
    } else {
      const innerImg = element.querySelector("img");
      const innerSvg = element.querySelector("svg");
      const innerCanvas = element.querySelector("canvas");
      if (innerImg) {
        displayEl = document.createElement("img");
        displayEl.src = innerImg.src;
        displayEl.style.cssText = commonStyle;
      } else if (innerSvg) {
        displayEl = innerSvg.cloneNode(true);
        displayEl.style.cssText = commonStyle + "width:auto;height:auto;";
      } else if (innerCanvas) {
        displayEl = document.createElement("img");
        displayEl.src = innerCanvas.toDataURL("image/png");
        displayEl.style.cssText = commonStyle;
      } else {
        displayEl = element.cloneNode(true);
        displayEl.style.cssText = commonStyle;
      }
    }
    imgWrapper.appendChild(displayEl);
    container.appendChild(imgWrapper);

    // ===== 标题 =====
    let titleText = svgName;
    if (titleText === "SPAN" || titleText === "DIV" || !titleText) {
      const img = element.tagName === "IMG" ? element : element.querySelector("img");
      if (img) {
        const src = img.src || "";
        const fname = src.split("/").pop().split("?")[0];
        titleText = decodeURIComponent(fname) || "图片";
      } else {
        titleText = "图片";
      }
    }
    const title = document.createElement("div");
    title.textContent = titleText;
    title.style.cssText =
      "position:absolute;top:-36px;left:0;color:white;font-size:15px;font-weight:500;text-shadow:0 1px 3px rgba(0,0,0,0.5);";
    container.appendChild(title);

    // ===== 工具栏 =====
    const toolbar = document.createElement("div");
    toolbar.className = "chemfig-zoom-toolbar";

    // 缩放控制
    let scale = 1;
    let tx = 0;
    let ty = 0;
    const scaleLabel = document.createElement("span");
    scaleLabel.className = "chemfig-zoom-scale";
    scaleLabel.textContent = "100%";
    const applyTransform = () => {
      displayEl.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
      scaleLabel.textContent = Math.round(scale * 100) + "%";
    };
    const doZoom = (f) => {
      scale = Math.max(0.1, Math.min(5, scale * f));
      applyTransform();
    };
    const doReset = () => {
      scale = 1;
      tx = 0;
      ty = 0;
      applyTransform();
    };

    const zoomInBtn = document.createElement("button");
    zoomInBtn.textContent = "➕";
    zoomInBtn.title = "放大";
    zoomInBtn.onclick = (e) => {
      e.stopPropagation();
      doZoom(1.2);
    };

    const zoomOutBtn = document.createElement("button");
    zoomOutBtn.textContent = "➖";
    zoomOutBtn.title = "缩小";
    zoomOutBtn.onclick = (e) => {
      e.stopPropagation();
      doZoom(1 / 1.2);
    };

    const resetBtn = document.createElement("button");
    resetBtn.textContent = "↺";
    resetBtn.title = "重置";
    resetBtn.onclick = (e) => {
      e.stopPropagation();
      doReset();
    };

    toolbar.appendChild(zoomOutBtn);
    toolbar.appendChild(scaleLabel);
    toolbar.appendChild(zoomInBtn);
    toolbar.appendChild(resetBtn);

    // 背景切换
    const bgSwitcher = document.createElement("div");
    bgSwitcher.className = "chemfig-zoom-bg-switcher";
    const applyBg = (bgName) => {
      const style = bgStyles[bgName];
      const bgMatch = style.match(/background:([^;]+)/);
      if (bgMatch) overlay.style.background = bgMatch[1].trim();
      const bfMatch = style.match(/backdrop-filter:([^;]+)/);
      if (bfMatch) overlay.style.backdropFilter = bfMatch[1].trim();
      const wbfMatch = style.match(/-webkit-backdrop-filter:([^;]+)/);
      if (wbfMatch) overlay.style.webkitBackdropFilter = wbfMatch[1].trim();
      const borderMatch = style.match(/border:([^;]+)/);
      if (borderMatch) overlay.style.border = borderMatch[1].trim();
      bgSwitcher
        .querySelectorAll(".chemfig-zoom-bg-btn")
        .forEach((b) => b.classList.remove("active"));
      const activeBtn = bgSwitcher.querySelector(`[data-bg="${bgName}"]`);
      if (activeBtn) activeBtn.classList.add("active");
      title.style.color = bgName === "浅色" ? "#333" : "white";
    };
    for (const bgName of Object.keys(bgStyles)) {
      const btn = document.createElement("button");
      btn.className = "chemfig-zoom-bg-btn";
      btn.setAttribute("data-bg", bgName);
      btn.title = bgName;
      if (bgName === currentBg) btn.classList.add("active");
      // 用颜色区分背景
      const bgColors = {
        亚克力: "#1e1e1e",
        Glass: "#ffffff",
        安卓原生: "#000000",
        深色: "#000000",
        浅色: "#f5f5f5",
      };
      btn.style.background = bgColors[bgName] || "#333";
      btn.onclick = (e) => {
        e.stopPropagation();
        currentBg = bgName;
        applyBg(bgName);
      };
      bgSwitcher.appendChild(btn);
    }
    toolbar.appendChild(bgSwitcher);

    container.appendChild(toolbar);
    overlay.appendChild(container);

    // 滚轮缩放
    overlay.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        doZoom(e.deltaY > 0 ? 0.9 : 1.1);
      },
      { passive: false }
    );

    // v2.0: 键盘 +/- 缩放、0 重置
    const keyHandler = (e) => {
      if (e.key === "+" || e.key === "=") doZoom(1.2);
      else if (e.key === "-" || e.key === "_") doZoom(1 / 1.2);
      else if (e.key === "0") doReset();
    };
    document.addEventListener("keydown", keyHandler);

    // v2.0: 拖动平移
    let panning = false,
      panX = 0,
      panY = 0,
      startTx = 0,
      startTy = 0;
    const panMove = (e) => {
      if (!panning) return;
      tx = startTx + (e.clientX - panX);
      ty = startTy + (e.clientY - panY);
      applyTransform();
    };
    const panUp = () => {
      if (panning) {
        panning = false;
        container.style.cursor = "";
      }
    };
    container.addEventListener("mousedown", (e) => {
      if (e.target.closest && e.target.closest("button")) return;
      panning = true;
      panX = e.clientX;
      panY = e.clientY;
      startTx = tx;
      startTy = ty;
      container.style.cursor = "grabbing";
    });
    document.addEventListener("mousemove", panMove);
    document.addEventListener("mouseup", panUp);

    // v2.0: 双击重置缩放
    overlay.addEventListener("dblclick", (e) => {
      if (e.target.closest && e.target.closest("button")) return;
      doReset();
    });

    // 点击遮罩关闭
    overlay.onclick = (e) => {
      if (e.target === overlay) closeOverlay();
    };
    // ESC 关闭
    const escHandler = (e) => {
      if (e.key === "Escape") closeOverlay();
    };
    const closeOverlay = () => {
      overlay.remove();
      document.removeEventListener("keydown", escHandler);
      document.removeEventListener("keydown", keyHandler);
      document.removeEventListener("mousemove", panMove);
      document.removeEventListener("mouseup", panUp);
    };
    document.addEventListener("keydown", escHandler);
    document.body.appendChild(overlay);
  }

  // SVG/PNG 互转: PNG -> 内联SVG(可编辑), SVG -> PNG显示
  async toggleSvgPng(element, svgName, sourcePath) {
    try {
      const noteDir = path.dirname(sourcePath);
      const isPng = element.tagName === "IMG";
      // 获取 wrapper (元素可能被 .chemfig-img-wrapper 包裹)
      const wrapper = element.closest(".chemfig-img-wrapper") || element.parentElement;
      if (isPng) {
        // PNG -> 内联 SVG (进入可编辑模式)
        const svgPath = path.join(noteDir, "svg_source", `${svgName}.svg`).replace(/\\/g, "/");
        const svgFile = this.app.vault.getFileByPath(svgPath);
        if (!svgFile) {
          new Notice(`未找到 SVG 源文件: ${svgName}.svg`, 3000);
          return;
        }
        const svgContent = await this.app.vault.read(svgFile);
        const container = document.createElement("div");
        container.className = "miktex-svg-container chemfig-svg-editing";
        container.style.cssText =
          "display:inline-block;text-align:center;margin:0;position:relative;cursor:pointer;";
        container.innerHTML = svgContent;
        const svgEl = container.querySelector("svg");
        if (svgEl) {
          svgEl.style.maxWidth = "500px";
          svgEl.style.width = "100%";
          svgEl.style.height = "auto";
          svgEl.style.display = "inline-block";
          svgEl.style.border = "2px dashed var(--interactive-accent)";
          svgEl.style.padding = "8px";
          svgEl.style.borderRadius = "4px";
          svgEl.style.pointerEvents = "none"; // 让点击事件落到 container
        }
        // 提示标签
        const hint = document.createElement("div");
        hint.textContent = "SVG 编辑模式 - 点击进入代码编辑器";
        hint.style.cssText =
          "font-size:11px;color:var(--interactive-accent);margin-top:4px;font-weight:bold;";
        container.appendChild(hint);
        // 点击进入编辑器
        container.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          const fakeImg = { getAttribute: (k) => (k === "src" ? `svg_source/${svgName}.svg` : "") };
          this.editEmbeddedSvg({ clientX: 0, clientY: 0 }, sourcePath, fakeImg);
        };
        // 右键退出编译模式, 返回阅读视图(PNG显示)——改用原生 Menu, 避免点击穿透
        container.oncontextmenu = (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          const menu = new Menu();
          menu.addItem((item) =>
            item
              .setTitle("退出编译模式, 返回阅读视图")
              .setIcon("eye")
              .onClick(() => this.toggleSvgPng(container, svgName, sourcePath))
          );
          menu.showAtMouseEvent(e);
        };
        // 替换 wrapper 中的内容
        if (wrapper && wrapper.classList.contains("chemfig-img-wrapper")) {
          wrapper.innerHTML = "";
          wrapper.appendChild(container);
        } else {
          element.parentNode.replaceChild(container, element);
        }
        // 不调用 bindSvgContextMenu, 因为已有自定义右键菜单
        new Notice(`已转为 SVG 编辑模式，点击进入代码编辑器`, 3000);
      } else {
        // 内联 SVG -> PNG 显示
        const pngPath = path.join(noteDir, "png_out", `${svgName}.png`).replace(/\\/g, "/");
        const pngFile = this.app.vault.getFileByPath(pngPath);
        if (!pngFile) {
          new Notice(`未找到 PNG 文件: ${svgName}.png`, 3000);
          return;
        }
        const img = document.createElement("img");
        img.src = this.app.vault.getResourcePath(pngFile);
        img.alt = svgName;
        img.style.cssText = "max-width:500px;width:100%;height:auto;display:inline-block;";
        img.loading = "lazy";
        img.setAttribute("data-chemfig-svg", "true");
        img.setAttribute("data-svg-name", svgName);
        // 替换 wrapper 中的内容
        if (wrapper && wrapper.classList.contains("chemfig-img-wrapper")) {
          wrapper.innerHTML = "";
          wrapper.appendChild(img);
        } else {
          element.parentNode.replaceChild(img, element);
        }
        this.bindSvgContextMenu(img, svgName, sourcePath, null);
        new Notice(`已转为 PNG 显示模式`, 2000);
      }
    } catch (e) {
      new Notice(`互转失败: ${e.message.slice(0, 60)}`, 4000);
    }
  }

  async postProcessRender(el, ctx) {
    perf.start("postProcessRender");
    // 旧 SVG 嵌入自动转换为 PNG (如果 PNG 存在)
    const oldSvgImgs = el.querySelectorAll("img[src*='svg_out/']");
    for (const oldImg of oldSvgImgs) {
      const src = oldImg.getAttribute("src") || "";
      const m = src.match(/svg_out\/(.+?)\.svg/);
      if (!m) continue;
      const name = decodeURIComponent(m[1]);
      const noteDir = path.dirname(ctx.sourcePath);
      const pngPath = path.join(noteDir, "png_out", `${name}.png`).replace(/\\/g, "/");
      const pngFile = this.app.vault.getFileByPath(pngPath);
      if (pngFile) {
        oldImg.src = this.app.vault.getResourcePath(pngFile);
        oldImg.setAttribute("data-svg-name", name);
        console.log(`[Chemfig-SVG] 旧SVG嵌入已转换为PNG: ${name}`);
      }
    }
    // 匹配三种代码块: 如果对应PNG存在, 在代码块前插入PNG图片 (代码块保留显示运行逻辑)
    const selectors = [
      "pre > code.language-chem",
      "pre > code.language-tikz",
      "pre > code.language-miktex",
    ];
    for (const sel of selectors) {
      const codeBlocks = el.querySelectorAll(sel);
      for (const codeEl of codeBlocks) {
        const preEl = codeEl.parentElement;
        if (!preEl) continue;
        // 避免重复插入: 代码块前已有 wrapper 或代码块内已有 codeBlockProcessor 处理的 wrapper
        if (preEl.previousElementSibling?.classList?.contains("chemfig-png-wrapper")) continue;
        if (preEl.querySelector(".chemfig-png-wrapper")) continue;
        const body = codeEl.textContent;
        const name = getBlockName(body);
        if (!name) continue;
        const noteDir = path.dirname(ctx.sourcePath);
        const pngRelPath = path.join(noteDir, "png_out", `${name}.png`).replace(/\\/g, "/");
        const pngFile = this.app.vault.getFileByPath(pngRelPath);
        if (pngFile) {
          try {
            // 创建 PNG 图片容器
            const pngWrapper = document.createElement("div");
            pngWrapper.className = "chemfig-png-wrapper";
            pngWrapper.style.cssText = "text-align:center;margin:0.8em 0;";
            const img = document.createElement("img");
            img.src = this.app.vault.getResourcePath(pngFile);
            img.alt = name;
            // 限制显示尺寸, 匹配 SVG 原始显示大小
            img.style.cssText = "max-width:500px;width:100%;height:auto;display:inline-block;";
            img.loading = "lazy";
            img.setAttribute("data-chemfig-svg", "true");
            img.setAttribute("data-svg-name", name);
            // 工作流: data-tikz-name 属性用于代码块-SVG绑定
            img.setAttribute("data-tikz-name", name);
            // 添加标准图片属性, 兼容其他图片插件的右键功能
            img.setAttribute("data-src", pngFile.path);
            // 渲染失败: 展示源代码
            img.onerror = () => {
              const codeText = codeEl.textContent || "";
              const escaped = codeText
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;");
              const fallback = document.createElement("div");
              fallback.style.cssText =
                "text-align:left;margin:0.8em 0;padding:8px;background:var(--background-secondary);border:1px solid var(--background-modifier-error);border-radius:4px;";
              fallback.innerHTML =
                `<div style="color:#ff6b6b;font-size:12px;font-weight:bold;margin-bottom:4px;">⚠️ 图片渲染失败 [${name}]</div>` +
                `<div style="color:var(--text-muted);font-size:11px;margin-bottom:4px;">源代码:</div>` +
                `<pre style="margin:0;padding:6px;background:var(--background-primary);border-radius:4px;max-height:150px;overflow:auto;white-space:pre-wrap;font-size:11px;">${escaped}</pre>`;
              pngWrapper.replaceChild(fallback, img);
            };
            pngWrapper.appendChild(img);
            // 绑定右键菜单 (不阻止其他插件的右键事件)
            this.bindSvgContextMenu(img, name, ctx.sourcePath, null);
            // 在代码块前插入 PNG
            preEl.parentNode.insertBefore(pngWrapper, preEl);
          } catch (e) {
            console.warn("[Chemfig-SVG] 插入PNG失败:", name, e.message);
          }
        }
      }
    }

    // 处理已转换为 ![[svg]] 嵌入的图片: 右键菜单(编辑+刷新) + 旁侧刷新按钮 + SVG标记
    // 同时匹配: 正常svg图片、blob残留图片(通过alt或父级上下文判断)、已有内联容器
    const allSvgElements = [];
    // 1. 正常 img (src 含 svg_out/ 或 png_out/)
    el.querySelectorAll("img[src*='svg_out/'], img[src*='png_out/']").forEach((img) =>
      allSvgElements.push({ el: img, type: "img" })
    );
    // 2. 已有内联 SVG 容器
    el.querySelectorAll(".miktex-svg-container").forEach((c) => {
      if (!c.querySelector(".chemfig-refresh-btn"))
        allSvgElements.push({ el: c, type: "container" });
    });
    // 3. blob 残留图片 (src 是 blob: 但在 svg 上下文中)
    el.querySelectorAll("img[src^='blob:']").forEach((img) => {
      const parent = img.closest("p, div, span");
      if (parent?.textContent?.includes("% NAME:")) allSvgElements.push({ el: img, type: "img" });
    });

    for (const { el: svgEl, type } of allSvgElements) {
      // 提取 svg 名称
      let svgName = "";
      if (type === "img") {
        const src = svgEl.getAttribute("src") || "";
        const m = src.match(/(?:svg_out|png_out)\/(.+?)\.(?:svg|png)/);
        svgName = m ? decodeURIComponent(m[1]) : svgEl.getAttribute("data-svg-name") || "";
      } else {
        svgName = svgEl.getAttribute("data-svg-name") || "";
        if (!svgName) {
          // 从附近代码块提取
          const parent = svgEl.closest("p, div");
          const codeMatch = parent?.textContent?.match(/% NAME:\s*(.+)/);
          if (codeMatch) svgName = codeMatch[1].trim();
        }
      }
      if (!svgName) continue;

      // 避免重复包裹
      if (svgEl.parentElement?.classList.contains("chemfig-img-wrapper")) continue;

      // 刷新逻辑: 找到下方代码块重新编译
      const doRefresh = async () => {
        let targetCode = null,
          targetMode = "chem";
        let sibling = svgEl.closest(".chemfig-img-wrapper")?.nextElementSibling;
        if (!sibling || !sibling.querySelector("pre > code")) {
          let parent = svgEl.parentElement;
          for (let i = 0; i < 5 && parent; i++) {
            const next = parent.nextElementSibling;
            if (next && next.querySelector("pre > code")) {
              sibling = next;
              break;
            }
            parent = parent.parentElement;
          }
        }
        if (sibling) {
          const codeEl = sibling.querySelector("pre > code");
          if (codeEl) {
            targetCode = codeEl.textContent.trim();
            const mm = codeEl.className.match(/language-(\w+)/);
            if (mm) targetMode = mm[1];
          }
        }
        // 兜底: 全局搜索含 % NAME: svgName 的代码块
        if (!targetCode) {
          const allPres = document.querySelectorAll(
            "pre > code.language-chem, pre > code.language-tikz, pre > code.language-miktex"
          );
          for (const c of allPres) {
            if (c.textContent.includes(`% NAME: ${svgName}`)) {
              targetCode = c.textContent.trim();
              const mm = c.className.match(/language-(\w+)/);
              if (mm) targetMode = mm[1];
              break;
            }
          }
        }
        if (!targetCode) {
          new Notice("未找到对应 code", 3000);
          return;
        }
        try {
          let svg;
          if (/%\s*GROUP:/.test(targetCode)) {
            svg = await this.compileFromGroups(targetCode);
          } else {
            svg = await this.compileTikz(targetMode, targetCode);
          }
          // 保存 SVG 源文件 + PNG 显示文件
          const file = this.app.vault.getFileByPath(ctx.sourcePath);
          if (file) {
            const noteDir = path.dirname(this.app.vault.adapter.getFullPath(file.path));
            await saveSvgAndPng(svg, svgName, noteDir);
            // 实时更新页面上的 PNG 图片
            const allPngImgs = document.querySelectorAll("img[src*='png_out/']");
            for (const pngImg of allPngImgs) {
              if (
                pngImg.src.includes(encodeURIComponent(svgName)) ||
                pngImg.src.includes(svgName)
              ) {
                const baseSrc = pngImg.src.split("?")[0];
                pngImg.src = baseSrc + "?t=" + Date.now();
              }
            }
          }
          new Notice(`✓ 已刷新: ${svgName}`, 2000);
        } catch (err) {
          new Notice(`刷新失败: ${err.message.slice(0, 50)}`, 3000);
        }
      };
      // 绑定旁侧浮动工具栏 (编辑/刷新/互转), 不阻止原生右键和左键放大
      this.bindSvgContextMenu(svgEl, svgName, ctx.sourcePath, doRefresh);
    }

    // 兼容旧 [code] details 格式: 添加转换按钮, 一键转为直接代码块格式
    const detailsEls = el.querySelectorAll("details");
    for (const detail of detailsEls) {
      const summary = detail.querySelector("summary");
      if (!summary || !summary.textContent.includes("[code]")) continue;
      if (summary.querySelector(".chemfig-convert-btn")) continue;
      const convertBtn = document.createElement("span");
      convertBtn.className = "chemfig-convert-btn";
      convertBtn.textContent = "📝 展开为代码";
      convertBtn.style.cssText =
        "margin-left:8px;padding:1px 6px;font-size:11px;cursor:pointer;background:var(--background-modifier-hover);border-radius:3px;color:var(--text-accent);";
      convertBtn.title = "取消 details 折叠, 直接展示源代码";
      convertBtn.onclick = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        // 提取代码
        const codeEl = detail.querySelector("pre > code");
        if (!codeEl) {
          new Notice("未找到代码", 3000);
          return;
        }
        const code = codeEl.textContent.replace(/\r\n/g, "\n").trim();
        const mm = codeEl.className.match(/language-(\w+)/);
        const mode = mm ? mm[1] : "chem";
        const nameMatch = summary.textContent.match(/\[code\]\s*(.+)/);
        const name = nameMatch ? nameMatch[1].trim() : "";
        // 更新笔记文件: 将 details 替换为直接代码块
        const file = this.app.vault.getFileByPath(ctx.sourcePath);
        if (!file) return;
        let content = await this.app.vault.read(file);
        const detailsStart = content.indexOf("<details>");
        if (detailsStart >= 0) {
          const afterDetails = content.substring(detailsStart);
          const detailsEnd = afterDetails.indexOf("</details>");
          if (detailsEnd >= 0) {
            const blockEnd = detailsStart + detailsEnd + "</details>".length;
            const codeBlock = `\`\`\`${mode}\n${code}\n\`\`\``;
            content = content.substring(0, detailsStart) + codeBlock + content.substring(blockEnd);
            await this.app.vault.modify(file, content);
            new Notice("已转换为直接代码展示", 2000);
          }
        }
      };
      summary.appendChild(convertBtn);
    }

    // 全局: 为所有 chemfig 相关图片添加 onerror + 超时机制, 渲染失败/超时时展示源代码
    const allChemImgs = el.querySelectorAll(
      "img[data-chemfig-svg='true'], img[src*='png_out/'], img[src*='svg_out/']"
    );
    for (const img of allChemImgs) {
      if (img.dataset.onerrorBound) continue;
      img.dataset.onerrorBound = "1";

      // 退化为代码模式的函数
      const fallbackToCode = (reason) => {
        if (img.dataset.fallbackDone) return;
        img.dataset.fallbackDone = "1";
        const name = img.getAttribute("data-svg-name") || img.alt || "unknown";
        // 查找下方代码块
        const wrapper = img.closest(".chemfig-png-wrapper, p, div");
        let codeText = "";
        if (wrapper) {
          const nextCode = wrapper.nextElementSibling?.querySelector("pre > code");
          if (nextCode) codeText = nextCode.textContent;
        }
        const escaped = codeText
          ? codeText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
          : "(未找到对应代码块)";
        const fallback = document.createElement("div");
        fallback.style.cssText =
          "text-align:left;margin:0.8em 0;padding:8px;background:var(--background-secondary);border:1px solid var(--background-modifier-error);border-radius:4px;";
        fallback.innerHTML =
          `<div style="color:#ff6b6b;font-size:12px;font-weight:bold;margin-bottom:4px;">⚠️ 图片${reason} [${name}]</div>` +
          `<div style="color:var(--text-muted);font-size:11px;margin-bottom:4px;">源代码 (点击工具栏按钮可重新编译):</div>` +
          `<pre style="margin:0;padding:6px;background:var(--background-primary);border-radius:4px;max-height:150px;overflow:auto;white-space:pre-wrap;font-size:11px;">${escaped}</pre>`;
        if (img.parentNode) img.parentNode.replaceChild(fallback, img);
      };

      // 加载失败
      img.addEventListener("error", () => fallbackToCode("渲染失败"));

      // 加载超时 (5秒未加载完成则取消并退化为代码模式)
      const timeoutId = setTimeout(() => {
        if (!img.complete || img.naturalWidth === 0) {
          // 取消加载
          img.src = "";
          fallbackToCode("加载超时");
        }
      }, 5000);

      // 加载成功时清除超时
      img.addEventListener("load", () => clearTimeout(timeoutId), { once: true });
    }
    perf.end("postProcessRender");
  }

  // 通用: 切换到目标笔记的编辑模式 (当前页面, 不新开标签)
  async switchToEditMode(sourcePath) {
    const file = this.app.vault.getFileByPath(sourcePath);
    if (!file) {
      new Notice("未找到笔记文件", 3000);
      return false;
    }
    // 获取当前活动 leaf
    const leaf = this.app.workspace.getLeaf(false);
    if (!leaf) {
      new Notice("无法获取活动标签页", 3000);
      return false;
    }
    // 如果当前文件不是目标文件, 打开它
    const currentFile = this.app.workspace.getActiveFile();
    if (!currentFile || currentFile.path !== file.path) {
      await leaf.openFile(file);
      await new Promise((r) => setTimeout(r, 200));
    }
    // 切换到编辑模式
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      if (activeView.getMode() !== "source") {
        await activeView.setState({ mode: "source", active: true }, { history: false });
        await new Promise((r) => setTimeout(r, 200));
      }
      return true;
    }
    // 兜底: 再次尝试获取 view
    await new Promise((r) => setTimeout(r, 300));
    const view2 = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view2 && view2.getMode() !== "source") {
      await view2.setState({ mode: "source", active: true }, { history: false });
    }
    return true;
  }

  // 从嵌入图片进入编辑: 设置信号A, 切换到编辑视图后自动定位并打开代码编译台
  async editEmbeddedSvg(ev, sourcePath, img) {
    const file = this.app.vault.getFileByPath(sourcePath);
    if (!file) {
      new Notice("未找到笔记文件", 3000);
      return;
    }
    // 从 img 的 data-svg-name 或 src 提取名称
    let name = img.getAttribute("data-svg-name") || "";
    if (!name) {
      const src = img.getAttribute("src") || "";
      const nameMatch = src.match(/(?:svg_out|png_out|svg_source)\/(.+?)\.(?:svg|png)/);
      if (nameMatch) name = decodeURIComponent(nameMatch[1]);
    }
    if (!name) {
      new Notice("无法识别结构式名称", 3000);
      return;
    }
    // 设置信号A: SVG编辑模式
    this.setSignalA(name, sourcePath);
    // 切换到编辑模式 (信号C触发后自动执行)
    await this.switchToEditMode(sourcePath);
  }

  // 从笔记直接打开组分调整 (编辑按钮行为) - 设置信号B
  async openGroupLayoutDirect(sourcePath, svgName) {
    const file = this.app.vault.getFileByPath(sourcePath);
    if (!file) return;
    // 设置信号B: 重构化学式(组分调整)
    this.setSignalB(svgName, sourcePath);
    // 切换到编辑模式 (信号C触发后自动执行)
    await this.switchToEditMode(sourcePath);
  }

  switchMode(editor, line, newMode) {
    const { start, end, mode, body } = this.extractBlock(editor, line);
    if (mode === newMode) return;
    // 代码自适应转换
    const converted = convertCode(body, mode, newMode);
    const newBlock =
      "```" + newMode + "\n" + converted + (converted.endsWith("\n") ? "" : "\n") + "```";
    editor.replaceRange(
      newBlock,
      { line: start, ch: 0 },
      { line: end, ch: editor.getLine(end).length }
    );
    new Notice(`已切换到 ${MODES[newMode].label} (代码已自动适配)`, 2000);
  }

  // ========== 编辑模态框 ==========
  // v0.1.0: 右键"编辑结构式"载入侧边栏代码编辑器, 与笔记建立双向同步
  async openBlockInSidebar(file, editor, line) {
    try {
      const info = this.extractBlock(editor, line);
      if (!info || info.start < 0) {
        new Notice("未找到代码块", 2000);
        return;
      }
      // 定位光标到代码块起始, 便于后续同步/定位
      editor.setCursor({ line: info.start, ch: 0 });
      editor.scrollIntoView({ from: { line: info.start, ch: 0 } }, 100);

      // 设置加载是异步的, 视图可能尚未注册; 这里兜底注册, 保证右键立即可用
      if (typeof ChemfigRightSidebarView !== "undefined") {
        try {
          if (this.registerView)
            this.registerView("chemfig-right-sidebar", (l) => new ChemfigRightSidebarView(l, this));
          else if (this.registerViewType)
            this.registerViewType(
              "chemfig-right-sidebar",
              (l) => new ChemfigRightSidebarView(l, this)
            );
        } catch (e) {
          /* 已注册则忽略 */
        }
      }

      // 优先复用已存在的侧边栏视图
      let leaf = this.app.workspace.getLeavesOfType("chemfig-right-sidebar")[0] || null;
      if (!leaf) {
        leaf = this.app.workspace.getRightLeaf(true);
        if (!leaf) {
          new Notice("无法打开侧边栏", 2000);
          return;
        }
        try {
          await leaf.open({ type: "chemfig-right-sidebar", active: true });
        } catch (e) {
          await leaf.setViewState({ type: "chemfig-right-sidebar", active: true });
        }
      }
      await this.app.workspace.revealLeaf(leaf);

      const view = leaf.view;
      if (view && typeof view.loadBlock === "function") {
        const apply = () =>
          view.loadBlock(editor, info.start, info.end, info.mode, info.body, file);
        if (view.codeTextarea) apply();
        else setTimeout(apply, 60); // 等 onOpen 完成 (代码编辑区就绪)
        new Notice("已在侧边栏载入代码块（编辑后自动同步回笔记）", 2500);
      } else {
        new Notice("侧边栏编辑器尚未就绪, 请重试", 2000);
      }
    } catch (e) {
      console.error("[Chemfig-SVG] 在侧边栏编辑失败:", e);
      new Notice("在侧边栏编辑失败: " + (e && e.message ? e.message : e), 4000);
    }
  }

  openEditorModal(file, editor, line) {
    const { start, end, mode, body } = this.extractBlock(editor, line);
    new ChemfigEditModal(this, file, editor, start, end, mode, body).open();
  }

  // ========== 调试 ==========
  async debugFirst(file) {
    const content = await this.app.vault.read(file);
    const m = TIKZ_BLOCK_REG.exec(content);
    if (!m) {
      new Notice("无结构式代码块");
      return;
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "chemfig-debug-"));
    const texPath = path.join(tmp, "draw.tex");
    fs.writeFileSync(texPath, buildTex(m[1], m[2]), "utf8");
    new Notice("调试编译中...", 3000);
    execFile(
      "pdflatex",
      ["-interaction=nonstopmode", "-output-directory", tmp, texPath],
      { timeout: 30000, cwd: tmp },
      () => {
        new Notice(`调试完成, 临时目录: ${tmp}`, 15000);
        console.log("[调试] tex:", texPath);
      }
    );
  }
};
