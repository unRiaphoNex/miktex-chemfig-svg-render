// ========== CM6 Live Preview 模块 ==========
// 实验性功能: 在 Live Preview 模式下内联渲染 chemfig 代码块
// 学习自 obsidian-cm6-attributes, chem 插件
// 使用 ViewPlugin + WidgetType + StateField

// 注意: path 模块在 constants.js 中已导入, 这里直接使用全局 path
let _cm6ViewPlugin = null;
let _cm6PluginInstance = null;

/**
 * 设置插件实例 (通过 StateField 传递, 解决 view.plugin 无法获取的问题)
 * @param {Object} plugin - 插件实例
 */
function setPluginInstance(plugin) {
  _cm6PluginInstance = plugin;
}

/**
 * 获取插件实例
 * @returns {Object} 插件实例
 */
function getPluginInstance() {
  return _cm6PluginInstance;
}

/**
 * 延迟加载 CM6 模块 (v2版本, 避免与 constants.js 中的版本冲突)
 * 必须从 @codemirror/view 和 @codemirror/state 导入, 不能从 obsidian 导入
 * @returns {Object|null} CM6 模块对象
 */
function getCm6ModulesV2() {
  try {
    const cmView = require("@codemirror/view");
    const cmState = require("@codemirror/state");
    const cmLanguage = require("@codemirror/language");
    if (!cmView || !cmState) return null;

    // v10.15.13: 尝试加载 LaTeX 语法高亮
    let latexLanguage = null;
    try {
      latexLanguage = require("codemirror-lang-latex");
    } catch (e) {
      console.warn("[Chemfig-SVG] LaTeX 语法高亮未安装:", e.message);
    }

    return {
      EditorView: cmView.EditorView,
      WidgetType: cmView.WidgetType,
      ViewPlugin: cmView.ViewPlugin,
      Decoration: cmView.Decoration,
      RangeSetBuilder: cmState.RangeSetBuilder,
      StateField: cmState.StateField,
      syntaxHighlighting: cmLanguage ? cmLanguage.syntaxHighlighting : null,
      HighlightStyle: cmLanguage ? cmLanguage.HighlightStyle : null,
      latexLanguage: latexLanguage,
    };
  } catch (e) {
    console.warn("[Chemfig-SVG] CM6 模块加载失败:", e.message);
    return null;
  }
}

/**
 * 创建 Chemfig ViewPlugin (v2版本, 避免与 constants.js 中的版本冲突)
 * @returns {Object|null} ViewPlugin 实例
 */
function createChemfigViewPluginV2() {
  if (_cm6ViewPlugin) return _cm6ViewPlugin;
  const cm6 = getCm6ModulesV2();
  if (!cm6) return null;
  const { WidgetType, ViewPlugin, Decoration, RangeSetBuilder } = cm6;

  // ChemfigWidget 必须定义在函数内部, 才能访问 WidgetType
  class ChemfigWidget extends WidgetType {
    constructor(mode, body, name, plugin) {
      super();
      this.mode = mode;
      this.body = body;
      this.name = name;
      this.plugin = plugin;
      this._img = null;
      this._error = null;
    }

    toDOM(view) {
      const wrapper = document.createElement("div");
      wrapper.className = "chemfig-cm6-widget";
      wrapper.style.cssText = "text-align:center;margin:0.5em 0;cursor:pointer;position:relative;";

      // 点击编辑: 跳转到代码块位置
      wrapper.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.plugin && typeof this.plugin.editCodeBlockByName === "function") {
          this.plugin.editCodeBlockByName(this.name);
        }
      });

      // 右键刷新: 重新编译
      wrapper.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (this.plugin && typeof this.plugin.recompileBlockByName === "function") {
          this.plugin.recompileBlockByName(this.name);
          this._showPlaceholder(wrapper, "编译中...");
        }
      });

      // 尝试加载 PNG 图片
      const plugin = this.plugin || getPluginInstance();
      if (plugin && plugin.app && plugin.app.vault) {
        try {
          // 修复: view.state.field?.("file") 是无效调用 (StateField 需传 Field 对象而非字符串),
          // 导致 notePath 恒为空、PNG 永远找不到。改为从当前活动文件取路径。
          const activeFile =
            plugin.app.workspace && typeof plugin.app.workspace.getActiveFile === "function"
              ? plugin.app.workspace.getActiveFile()
              : null;
          const notePath = activeFile ? activeFile.path : "";
          const noteDir = path.dirname(notePath);
          const pngRelPath = path.join(noteDir, "png_out", `${this.name}.png`).replace(/\\/g, "/");
          const pngFile = plugin.app.vault.getFileByPath(pngRelPath);

          if (pngFile) {
            const img = document.createElement("img");
            img.src = plugin.app.vault.getResourcePath(pngFile);
            img.alt = this.name || "chemfig";
            img.style.cssText = "max-width:500px;width:100%;height:auto;display:inline-block;";
            img.loading = "lazy";
            img.setAttribute("data-chemfig-svg", "true");
            img.setAttribute("data-svg-name", this.name);
            img.setAttribute("data-chemfig-mode", this.mode);

            img.onerror = () => {
              this._error = "图片加载失败";
              this._showPlaceholder(wrapper, "图片加载失败, 右键重新编译");
            };

            this._img = img;
            wrapper.appendChild(img);

            // v10.15.12: 添加模式标签小角标
            const badge = document.createElement("span");
            badge.textContent = this.mode;
            badge.style.cssText = `
              position: absolute;
              top: 4px;
              left: 4px;
              padding: 2px 6px;
              font-size: 10px;
              font-weight: 600;
              border-radius: 4px;
              background: var(--interactive-accent);
              color: white;
              opacity: 0.8;
              pointer-events: none;
            `;
            wrapper.appendChild(badge);

            wrapper.title = `[${this.mode}] ${this.name || "未命名"} - 点击编辑 / 右键刷新`;
          } else {
            this._showPlaceholder(
              wrapper,
              `[${this.mode}] ${this.name || "未命名"} - 保存后编译 (右键刷新)`
            );
          }
        } catch (e) {
          console.error("[Chemfig-SVG] CM6 Widget 渲染错误:", e);
          this._showPlaceholder(wrapper, "渲染错误: " + e.message);
        }
      } else {
        this._showPlaceholder(wrapper, "插件实例未就绪");
      }

      return wrapper;
    }

    _showPlaceholder(wrapper, text) {
      wrapper.empty();
      const placeholder = document.createElement("div");
      placeholder.style.cssText =
        "padding:12px;color:var(--text-muted);font-size:12px;border:1px dashed var(--background-modifier-border);border-radius:4px;background:var(--background-secondary);";
      placeholder.textContent = text;
      wrapper.appendChild(placeholder);
    }

    eq(other) {
      return (
        other instanceof ChemfigWidget &&
        other.mode === this.mode &&
        other.body === this.body &&
        other.name === this.name
      );
    }
  }

  _cm6ViewPlugin = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.view = view;
        this.decorations = this.buildDecorations(view);
      }

      update(update) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(this.view);
        }
      }

      buildDecorations(view) {
        const builder = new RangeSetBuilder();
        const doc = view.state.doc;
        const text = doc.toString();
        const plugin = getPluginInstance();

        const regex = /```(chem|chemfig|tikz|miktex|ce|mhchem)\n([\s\S]*?)```/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const start = match.index;
          const end = start + match[0].length;
          const mode = match[1];
          const body = match[2];

          const nameMatch =
            body.match(/^\s*%%\s*name\s*:\s*([\w-]+)\s*$/m) ||
            body.match(/^\s*%\s*NAME\s*:\s*(.+?)\s*$/m);
          const name = nameMatch ? nameMatch[1].trim() : null;

          if (name) {
            try {
              const widget = new ChemfigWidget(mode, body, name, plugin);
              builder.add(start, end, Decoration.replace({ widget }));
            } catch (e) {
              console.error("[Chemfig-SVG] CM6 Widget 创建失败:", e);
            }
          }
        }
        return builder.finish();
      }
    },
    {
      decorations: (v) => v.decorations,
    }
  );

  return _cm6ViewPlugin;
}

/**
 * 重置 ViewPlugin (用于插件重载时)
 */
function resetChemfigViewPlugin() {
  _cm6ViewPlugin = null;
}

// 注意: 在合并后的 main.js 中, 这些函数是全局可用的, 不需要 module.exports
