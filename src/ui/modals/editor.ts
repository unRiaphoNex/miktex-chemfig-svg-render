// ========== 结构式编辑器模块 ==========
// 从 main.js 自动提取

class ChemfigEditModal extends Modal {
  constructor(plugin, file, editor, startLine, endLine, mode, body) {
    super(plugin.app);
    this.plugin = plugin;
    this.file = file;
    this.editor = editor;
    this.startLine = startLine;
    this.endLine = endLine;
    this.mode = mode;
    this.body = body;
    this.currentSvg = null;
    // 撤销/重做历史栈
    this.history = [body];
    this.historyIndex = 0;
    this.isRestoring = false;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("chemfig-edit-modal");

    // ===== 模态框头部 =====
    const header = contentEl.createDiv({ cls: "chemfig-modal-header" });
    const titleWrap = header.createDiv({ cls: "chemfig-modal-title" });
    titleWrap.textContent = "结构式编辑器";
    const modeBadge = titleWrap.createSpan({ cls: "chemfig-mode-badge" });
    modeBadge.textContent = this.mode.toUpperCase();

    // 模式选择栏 (放在头部右侧)
    const modeBar = header.createDiv({ cls: "chemfig-mode-bar" });
    this.modeButtons = {};
    for (const [key, m] of Object.entries(MODES)) {
      const btn = modeBar.createEl("button", { text: m.label });
      if (key === this.mode) btn.addClass("active");
      btn.onclick = () => this.switchMode(key);
      this.modeButtons[key] = btn;
    }

    // ===== 代码功能解析 (默认折叠) =====
    const details = contentEl.createEl("details");
    details.open = false;
    details.style.margin = "8px 16px";
    const summary = details.createEl("summary", { text: "📖 代码写法说明 (点击展开, 逐组分解析)" });
    summary.style.cursor = "pointer";
    summary.style.fontWeight = "bold";
    summary.style.fontSize = "13px";
    this.descEl = details.createEl("pre", { text: MODES[this.mode].desc });
    this.descEl.style.cssText =
      "background:var(--background-secondary);padding:8px;border-radius:4px;font-size:11.5px;white-space:pre-wrap;max-height:180px;overflow:auto;margin-top:4px;";

    // 多包支持提示
    const pkgHint = details.createEl("div");
    pkgHint.style.cssText =
      "margin-top:6px;padding:6px 8px;background:var(--background-secondary);border-radius:4px;font-size:11px;color:var(--text-muted);";
    pkgHint.innerHTML =
      "<b>📦 多包支持:</b> 首行写入 <code>% PACKAGES: circuitikz,pgfplots</code> 可加载额外包<br>" +
      "支持: circuitikz(电路) / pgfplots(图表) / tikz-cd(交换图) / amssymb / array / chemformula / siunitx<br>" +
      "默认已加载: chemfig, tikz, amsmath, textcomp, mhchem(无机化学式)";

    // ===== 模态框主体: 模板面板 + 编辑区 + 预览区 =====
    const body = contentEl.createDiv({ cls: "chemfig-modal-body" });

    // 左侧: 便捷模板面板
    const tplPanel = body.createDiv({ cls: "chemfig-template-panel" });
    const tplHeader = tplPanel.createDiv({ cls: "chemfig-panel-header", text: "便捷模板" });
    // 搜索框
    const searchWrap = tplPanel.createDiv({ cls: "chemfig-template-search" });
    this.tplSearch = searchWrap.createEl("input", { type: "text", placeholder: "搜索模板..." });
    this.tplSearch.addEventListener("input", () => {
      this.tplNav = [];
      this.refreshTemplates();
    });
    // 保存为自定义模板按钮
    const saveTplBtn = tplPanel.createEl("button", {
      text: "💾 保存当前代码为模板",
      cls: "chemfig-btn",
    });
    saveTplBtn.style.cssText = "width:calc(100% - 24px);margin:8px 12px;font-size:11px;";
    saveTplBtn.onclick = async () => {
      const name = prompt("输入模板名称:");
      if (!name) return;
      const code = this.textarea.value.trim();
      if (!code) {
        new Notice("代码为空");
        return;
      }
      await this.plugin.saveCustomTemplate(name, code, this.mode);
      this.tplNav = ["自定义"];
      this.refreshTemplates();
      new Notice("已保存模板: " + name);
    };
    // 面包屑导航栏
    this.tplCrumb = tplPanel.createDiv({ cls: "chemfig-template-breadcrumb" });
    this.tplNav = [];
    // 模板列表
    this.tplList = tplPanel.createDiv({ cls: "chemfig-template-list" });
    this.refreshTemplates();

    // 中间: 代码编辑器
    const editorPanel = body.createDiv({ cls: "chemfig-editor-panel" });
    editorPanel.createDiv({ cls: "chemfig-panel-header", text: "代码编辑区" });
    const codeArea = editorPanel.createDiv({ cls: "chemfig-code-area" });
    this.textarea = codeArea.createEl("textarea");
    this.textarea.value = this.body;
    this.textarea.spellcheck = false;
    // 撤销/重做: 记录输入历史 + 实时预览
    this.textarea.addEventListener("input", () => {
      if (this.isRestoring) return;
      const val = this.textarea.value;
      if (this.history[this.historyIndex] === val) return;
      this.history = this.history.slice(0, this.historyIndex + 1);
      this.history.push(val);
      this.historyIndex = this.history.length - 1;
      if (this.history.length > 100) {
        this.history.shift();
        this.historyIndex--;
      }
      this.updateUndoRedoButtons();
      // SVG 渲染确认: 手动确认模式下不自动实时预览, 由「输出预览 / 确认生成」按钮触发
      if (!(this.plugin && this.plugin.manualPreviewEnabled === true)) {
        if (this._previewTimer) clearTimeout(this._previewTimer);
        this._previewTimer = setTimeout(() => this.doLivePreview(), 500);
      }
    });

    // 右侧: 预览区
    const previewPanel = body.createDiv({ cls: "chemfig-preview-panel" });
    previewPanel.createDiv({ cls: "chemfig-panel-header", text: "SVG 预览区" });
    this.previewEl = previewPanel.createDiv({ cls: "chemfig-preview-area" });
    this.previewEl.innerHTML =
      '<span style="color:var(--text-muted);font-size:12px">点击「输出预览」查看渲染效果</span>';

    // ===== 模态框底部: 按钮栏 =====
    const footer = contentEl.createDiv({ cls: "chemfig-modal-footer" });
    const leftBtns = footer.createDiv({ cls: "chemfig-actions" });

    const previewBtn = UI.button("🔄 输出预览", () => this.doPreview());
    const historyBtn = UI.button("📜 历史版本", () => this.showHistory());
    const layoutBtn = UI.button("🎨 组分调整", () => this.openGroupLayout());
    const importSvgBtn = UI.button(
      "📥 导入SVG",
      () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".svg,image/svg+xml";
        fileInput.onchange = (ev) => {
          const file = ev.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (e) => {
            let svgText = e.target.result;
            if (!/viewBox=/.test(svgText)) {
              const wm = svgText.match(/width="([\d.]+)/);
              const hm = svgText.match(/height="([\d.]+)/);
              if (wm && hm) {
                svgText = svgText.replace("<svg", `<svg viewBox="0 0 ${wm[1]} ${hm[1]}"`);
              }
            }
            svgText = ensureSvgNamespace(svgText);
            this.importedSvg = svgText;
            this.importedSvgName = file.name.replace(/\.svg$/i, "");
            new Notice("已导入SVG: " + file.name + "，点击组分调整可使用");
          };
          reader.readAsText(file);
        };
        fileInput.click();
      },
      { title: "导入外部SVG到组分调整中作为新组分" }
    );

    this.undoBtn = UI.button("↶ 撤销", () => this.undo(), { title: "返回上一步修改 (Ctrl+Z)" });
    this.redoBtn = UI.button("↷ 重做", () => this.redo(), { title: "返回下一步修改 (Ctrl+Y)" });
    this.updateUndoRedoButtons();

    leftBtns.appendChild(previewBtn);
    leftBtns.appendChild(historyBtn);
    leftBtns.appendChild(layoutBtn);
    leftBtns.appendChild(importSvgBtn);
    leftBtns.appendChild(this.undoBtn);
    leftBtns.appendChild(this.redoBtn);

    const rightBtns = footer.createDiv({ cls: "chemfig-actions" });
    const cancelBtn = UI.button("取消", () => this.close());
    const confirmBtn = UI.button("✓ 确认生成", () => this.doConfirm(), { primary: true });
    rightBtns.appendChild(cancelBtn);
    rightBtns.appendChild(confirmBtn);
  }

  switchMode(key) {
    if (key === this.mode) return;
    const oldMode = this.mode;
    this.mode = key;
    this.descEl.textContent = MODES[key].desc;
    // 更新模式按钮激活状态
    for (const [k, btn] of Object.entries(this.modeButtons)) {
      if (k === key) btn.addClass("active");
      else btn.removeClass("active");
    }
    // 更新模式徽章
    const badge = this.contentEl.querySelector(".chemfig-mode-badge");
    if (badge) badge.textContent = key.toUpperCase();
    // 代码自适应转换
    this.textarea.value = convertCode(this.textarea.value, oldMode, key);
    // 更新代码块第一行的语言标记
    const newFirst = "```" + key;
    this.editor.replaceRange(
      newFirst,
      { line: this.startLine, ch: 0 },
      { line: this.startLine, ch: this.editor.getLine(this.startLine).length }
    );
    // 刷新便捷模板列表 (重置导航到首页)
    this.tplNav = [];
    this.tplSearch.value = "";
    this.refreshTemplates();
    // SVG 渲染确认: 手动确认模式下切换模式后也不自动预览
    if (!(this.plugin && this.plugin.manualPreviewEnabled === true)) {
      if (this._previewTimer) clearTimeout(this._previewTimer);
      this._previewTimer = setTimeout(() => this.doLivePreview(), 300);
    }
  }

  // 刷新便捷模板列表 (面包屑导航 + 搜索)
  refreshTemplates() {
    if (!this.tplList) return;
    // 销毁旧的虚拟滚动列表
    if (this._virtualList) {
      this._virtualList.destroy();
      this._virtualList = null;
    }
    this.tplList.empty();
    const templates = this.plugin.getAllTemplates(this.mode);
    const keyword = (this.tplSearch?.value || "").trim().toLowerCase();

    // 渲染面包屑
    this.renderCrumb();

    // 搜索模式: 使用虚拟滚动 (可能显示大量模板)
    if (keyword) {
      const filtered = templates.filter(
        (t) => t.name.toLowerCase().includes(keyword) || t.code.toLowerCase().includes(keyword)
      );
      if (filtered.length === 0) {
        this.showEmpty("无匹配模板");
        return;
      }
      // 超过 20 个结果时启用虚拟滚动
      if (filtered.length > 20) {
        this._virtualList = new VirtualList(this.tplList, {
          itemHeight: 40,
          buffer: 3,
          renderItem: (tpl) => {
            const wrap = document.createElement("div");
            wrap.style.cssText = "display:flex;align-items:center;gap:4px;padding:4px 6px;";
            const btn = document.createElement("button");
            btn.textContent = tpl.name;
            btn.style.cssText =
              "flex:1;text-align:left;padding:6px 10px;font-size:12.5px;cursor:pointer;background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
            btn.onmouseenter = () => {
              btn.style.background = "var(--background-modifier-hover)";
            };
            btn.onmouseleave = () => {
              btn.style.background = "var(--background-primary)";
            };
            btn.onclick = () => this.insertTemplate(tpl.code);
            wrap.appendChild(btn);
            if (tpl.custom) {
              const delBtn = document.createElement("button");
              delBtn.textContent = "✕";
              delBtn.style.cssText =
                "padding:4px 6px;font-size:11px;cursor:pointer;background:var(--background-primary);color:var(--text-muted);border:1px solid var(--background-modifier-border);border-radius:3px;flex-shrink:0;";
              delBtn.title = "删除此自定义模板";
              delBtn.onclick = async (e) => {
                e.stopPropagation();
                if (confirm(`删除自定义模板「${tpl.name}」?`)) {
                  await this.plugin.deleteCustomTemplate(tpl.name);
                  this.refreshTemplates();
                }
              };
              wrap.appendChild(delBtn);
            }
            return wrap;
          },
        });
        this._virtualList.setItems(filtered);
        return;
      }
      for (const tpl of filtered) this.addTplButton(tpl);
      return;
    }

    const nav = this.tplNav;
    if (nav.length === 0) {
      // 首页: 一级分类
      const catOrder = ["自定义", "框架", "结构", "符号", "条件"];
      for (const cat of catOrder) {
        const count = templates.filter((t) => t.category === cat).length;
        if (count === 0) continue;
        const btn = this.tplList.createEl("button");
        btn.style.cssText =
          "width:100%;text-align:left;padding:10px 12px;font-size:13px;font-weight:bold;cursor:pointer;background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:4px;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center;";
        btn.innerHTML = `<span>${cat}</span><span style="font-size:11px;color:var(--text-muted);font-weight:normal">${count} 项 ›</span>`;
        btn.onmouseenter = () => {
          btn.style.background = "var(--background-modifier-hover)";
        };
        btn.onmouseleave = () => {
          btn.style.background = "var(--background-primary)";
        };
        btn.onclick = () => {
          this.tplNav = [cat];
          this.refreshTemplates();
        };
      }
      return;
    }

    if (nav.length === 1) {
      // 一级分类: 二级分类
      const cat = nav[0];
      const subCats = {};
      for (const tpl of templates) {
        if (tpl.category !== cat) continue;
        const sub = tpl.subcategory || "全部";
        if (!subCats[sub]) subCats[sub] = [];
        subCats[sub].push(tpl);
      }
      const subNames = Object.keys(subCats).sort();
      if (subNames.length <= 1) {
        const items =
          subNames.length === 1
            ? subCats[subNames[0]]
            : templates.filter((t) => t.category === cat);
        for (const tpl of items) this.addTplButton(tpl);
        return;
      }
      for (const sub of subNames) {
        const count = subCats[sub].length;
        const btn = this.tplList.createEl("button");
        btn.style.cssText =
          "width:100%;text-align:left;padding:8px 12px;font-size:12.5px;cursor:pointer;background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:4px;margin-bottom:3px;display:flex;justify-content:space-between;align-items:center;";
        btn.innerHTML = `<span>${sub}</span><span style="font-size:11px;color:var(--text-muted)">${count} 项 ›</span>`;
        btn.onmouseenter = () => {
          btn.style.background = "var(--background-modifier-hover)";
        };
        btn.onmouseleave = () => {
          btn.style.background = "var(--background-primary)";
        };
        btn.onclick = () => {
          this.tplNav = [cat, sub];
          this.refreshTemplates();
        };
      }
      return;
    }

    // 二级分类: 具体模板
    const [cat, sub] = nav;
    const items = templates.filter((t) => t.category === cat && (t.subcategory || "全部") === sub);
    if (items.length === 0) {
      this.showEmpty("该分类暂无模板");
      return;
    }
    for (const tpl of items) this.addTplButton(tpl);
  }

  // 渲染面包屑导航
  renderCrumb() {
    if (!this.tplCrumb) return;
    this.tplCrumb.empty();
    const keyword = (this.tplSearch?.value || "").trim();

    const makeCrumb = (text, navPath) => {
      const span = this.tplCrumb.createEl("span");
      span.textContent = text;
      span.style.cssText =
        "cursor:pointer;color:var(--text-accent);padding:1px 3px;border-radius:2px;";
      span.onmouseenter = () => {
        span.style.background = "var(--background-modifier-hover)";
      };
      span.onmouseleave = () => {
        span.style.background = "transparent";
      };
      span.onclick = () => {
        this.tplNav = navPath;
        this.tplSearch.value = "";
        this.refreshTemplates();
      };
    };
    const makeSep = () => {
      const sep = this.tplCrumb.createEl("span");
      sep.textContent = "›";
      sep.style.cssText = "color:var(--text-muted);padding:0 2px;";
    };

    if (keyword) {
      makeCrumb("🔍 搜索结果", []);
      return;
    }
    makeCrumb("全部模板", []);
    for (let i = 0; i < this.tplNav.length; i++) {
      makeSep();
      makeCrumb(this.tplNav[i], this.tplNav.slice(0, i + 1));
    }
  }

  // 添加模板按钮
  addTplButton(tpl) {
    const wrap = this.tplList.createDiv();
    wrap.style.cssText = "display:flex;align-items:center;gap:2px;margin-bottom:2px;";
    const btn = wrap.createEl("button", { text: tpl.name });
    btn.style.cssText =
      "flex:1;text-align:left;padding:6px 10px;font-size:12.5px;cursor:pointer;background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    btn.onmouseenter = () => {
      btn.style.background = "var(--background-modifier-hover)";
    };
    btn.onmouseleave = () => {
      btn.style.background = "var(--background-primary)";
    };
    btn.onclick = () => this.insertTemplate(tpl.code);
    if (tpl.custom) {
      const delBtn = wrap.createEl("button", { text: "✕" });
      delBtn.style.cssText =
        "padding:4px 6px;font-size:11px;cursor:pointer;background:var(--background-primary);color:var(--text-muted);border:1px solid var(--background-modifier-border);border-radius:3px;flex-shrink:0;";
      delBtn.title = "删除此自定义模板";
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm(`删除自定义模板「${tpl.name}」?`)) {
          await this.plugin.deleteCustomTemplate(tpl.name);
          this.refreshTemplates();
        }
      };
    }
  }

  // 显示空状态
  showEmpty(text) {
    const empty = this.tplList.createEl("div", { text });
    empty.style.cssText =
      "color:var(--text-muted);font-size:12px;text-align:center;padding:20px 0;";
  }

  // 检测光标是否在 \arrow{->[...][...]} 的条件方括号内
  detectArrowContext() {
    const ta = this.textarea;
    const pos = ta.selectionStart;
    const before = ta.value.substring(0, pos);
    // 查找最近的 \arrow{ (从光标向前找)
    const lastArrowIdx = before.lastIndexOf("\\arrow{");
    if (lastArrowIdx === -1) return null;
    // 检查这个 \arrow{ 是否已经闭合 (在 lastArrowIdx 到 pos 之间没有未匹配的 })
    const arrowContent = before.substring(lastArrowIdx + 7); // 去掉 \arrow{
    let braceDepth = 0;
    for (const ch of arrowContent) {
      if (ch === "{") braceDepth++;
      else if (ch === "}") braceDepth--;
      if (braceDepth < 0) return null; // 已闭合, 光标不在这个 arrow 内
    }
    if (braceDepth < 0) return null;
    // 光标在 \arrow{...} 内, 分析方括号
    // 箭头格式: ->[上条件][下条件]
    let bracketDepth = 0;
    let upperStart = -1,
      upperEnd = -1;
    let lowerStart = -1,
      lowerEnd = -1;
    for (let i = 0; i < arrowContent.length; i++) {
      const ch = arrowContent[i];
      if (ch === "[") {
        if (bracketDepth === 0) {
          if (upperStart === -1) upperStart = i;
          else if (lowerStart === -1) lowerStart = i;
        }
        bracketDepth++;
      } else if (ch === "]") {
        bracketDepth--;
        if (bracketDepth === 0) {
          if (upperEnd === -1 && upperStart !== -1) upperEnd = i;
          else if (lowerEnd === -1 && lowerStart !== -1) lowerEnd = i;
        }
      }
    }
    const cursorInContent = pos - (lastArrowIdx + 7);
    // 检查光标是否在上条件 [] 内
    if (
      upperStart !== -1 &&
      cursorInContent > upperStart &&
      (upperEnd === -1 || cursorInContent < upperEnd + 1)
    ) {
      return { position: "upper", arrowStart: lastArrowIdx };
    }
    // 检查光标是否在下条件 [] 内
    if (
      lowerStart !== -1 &&
      cursorInContent > lowerStart &&
      (lowerEnd === -1 || cursorInContent < lowerEnd + 1)
    ) {
      return { position: "lower", arrowStart: lastArrowIdx };
    }
    return null;
  }

  // 从箭头模板代码中提取条件内容
  extractArrowConditions(code) {
    // 匹配 \arrow{->[上条件][下条件]} 或 \arrow{->[上条件]}
    const m = code.match(/\\arrow\{[^[]*\[([^\]]*)\](?:\[([^\]]*)\])?/);
    if (m) return { upper: m[1] || "", lower: m[2] || "" };
    return null;
  }

  // 撤销
  undo() {
    if (this.historyIndex <= 0) return;
    this.historyIndex--;
    this.isRestoring = true;
    this.textarea.value = this.history[this.historyIndex];
    this.isRestoring = false;
    this.updateUndoRedoButtons();
  }

  // 重做
  redo() {
    if (this.historyIndex >= this.history.length - 1) return;
    this.historyIndex++;
    this.isRestoring = true;
    this.textarea.value = this.history[this.historyIndex];
    this.isRestoring = false;
    this.updateUndoRedoButtons();
  }

  // 更新撤销/重做按钮状态
  updateUndoRedoButtons() {
    if (this.undoBtn) {
      this.undoBtn.disabled = this.historyIndex <= 0;
      this.undoBtn.style.opacity = this.historyIndex <= 0 ? "0.4" : "1";
    }
    if (this.redoBtn) {
      this.redoBtn.disabled = this.historyIndex >= this.history.length - 1;
      this.redoBtn.style.opacity = this.historyIndex >= this.history.length - 1 ? "0.4" : "1";
    }
  }

  // 在光标位置插入模板代码 (带环境检测)
  insertTemplate(code) {
    const ta = this.textarea;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;

    // 环境检测: 光标在 \arrow 的条件方括号内, 且插入的是箭头模板
    const ctx = this.detectArrowContext();
    if (ctx) {
      const conds = this.extractArrowConditions(code);
      if (conds) {
        // 只插入条件内容, 不嵌套完整箭头
        const insertText = ctx.position === "upper" ? conds.upper : conds.lower || conds.upper;
        const before = ta.value.substring(0, start);
        const after = ta.value.substring(end);
        ta.value = before + insertText + after;
        const newPos = start + insertText.length;
        ta.setSelectionRange(newPos, newPos);
        ta.focus();
        return;
      }
    }

    // v10.15.3: miktex 模式智能插入 —— 避免重复文档结构
    let insertCode = code;
    if (this.mode === "miktex") {
      const currentCode = ta.value;
      // 如果当前代码已经有 \documentclass 或 \begin{document}
      const hasDocClass = /\\documentclass/.test(currentCode);
      const hasBeginDoc = /\\begin\{document\}/.test(currentCode);

      if (hasDocClass || hasBeginDoc) {
        // 从模板代码中提取 \begin{document} 和 \end{document} 之间的内容
        const beginMatch = code.match(/\\begin\{document\}/);
        const endMatch = code.match(/\\end\{document\}/);
        if (beginMatch && endMatch) {
          const beginIdx = beginMatch.index + beginMatch[0].length;
          const endIdx = endMatch.index;
          insertCode = code.substring(beginIdx, endIdx).trim();
        } else if (beginMatch) {
          // 模板只有 begin 没有 end，取 begin 之后的全部内容
          const beginIdx = beginMatch.index + beginMatch[0].length;
          insertCode = code.substring(beginIdx).trim();
        }
        // 如果当前代码没有 \end{document}，在插入内容后加上
        if (!/\\end\{document\}/.test(currentCode)) {
          insertCode = insertCode + "\n\\end{document}";
        }
      }
    }

    // 原有逻辑: 正常插入完整模板
    const before = ta.value.substring(0, start);
    const after = ta.value.substring(end);
    // 如果光标不在行首, 先换行
    const needNewline = before.length > 0 && !before.endsWith("\n");
    const insertText = (needNewline ? "\n" : "") + insertCode + "\n";
    ta.value = before + insertText + after;
    // 移动光标到插入内容之后
    const newPos = start + insertText.length;
    ta.setSelectionRange(newPos, newPos);
    ta.focus();
  }

  async doPreview() {
    const code = this.textarea.value;
    this.previewEl.innerHTML = '<span style="color:var(--text-muted)">编译中...</span>';
    try {
      // 手动预览 -> 桥接队列 high 优先级
      const svg = await this.plugin.compileTikz(this.mode, code, "high");
      this.currentSvg = svg;
      this.previewEl.innerHTML = svg;
      this.previewEl.style.textAlign = "center";
      this.previewEl.style.padding = "16px";
      const svgEl = this.previewEl.querySelector("svg");
      if (svgEl) {
        svgEl.style.maxWidth = "calc(100% - 32px)";
        svgEl.style.maxHeight = "calc(100% - 32px)";
        svgEl.style.height = "auto";
        svgEl.style.display = "inline-block";
        svgEl.style.margin = "0 auto";
      }
    } catch (e) {
      const errInfo = this.plugin._lastCompileError || { summary: e.message, fullLog: "" };
      const escapedCode = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      this.previewEl.innerHTML = `
        <div style="width:100%;text-align:left;">
          <div style="color:#ff6b6b;font-size:12px;font-weight:bold;margin-bottom:4px;">⚠️ 编译错误</div>
          <div style="color:#ff6b6b;font-size:11px;white-space:pre-wrap;margin-bottom:6px;">${errInfo.summary}</div>
          <details style="font-size:11px;margin-bottom:6px;">
            <summary style="cursor:pointer;color:var(--text-muted);">查看完整错误日志</summary>
            <pre style="background:var(--background-primary);padding:6px;border-radius:4px;max-height:100px;overflow:auto;white-space:pre-wrap;color:var(--text-muted);">${errInfo.fullLog?.slice(0, 2000) || e.message}</pre>
          </details>
          <div style="color:var(--text-muted);font-size:11px;font-weight:bold;margin-bottom:2px;">📝 源代码:</div>
          <pre style="background:var(--background-primary);padding:6px;border-radius:4px;max-height:150px;overflow:auto;white-space:pre-wrap;font-size:11px;color:var(--text-normal);border:1px solid var(--background-modifier-border);">${escapedCode}</pre>
        </div>`;
    }
  }

  // 实时预览: 代码修改后防抖自动编译, 显示错误日志
  async doLivePreview() {
    const code = this.textarea.value;
    if (!code || code.trim().length < 5) return;
    // 编译前校验
    const validation = validateCode(this.mode, code);
    if (validation.errors.length > 0) {
      this.previewEl.innerHTML = `
        <div style="width:100%;text-align:left;">
          <div style="color:#ff6b6b;font-size:12px;font-weight:bold;margin-bottom:4px;">⚠️ 语法错误</div>
          <div style="color:#ff6b6b;font-size:11px;white-space:pre-wrap;">${validation.errors.join("\n")}</div>
        </div>`;
      return;
    }
    // 显示编译中状态
    const warningHtml =
      validation.warnings.length > 0
        ? `<div style="color:#ffa500;font-size:11px;margin-bottom:4px;">⚠️ ${validation.warnings.join("; ")}</div>`
        : "";
    this.previewEl.innerHTML =
      warningHtml + '<span style="color:var(--text-muted);font-size:11px;">实时编译中...</span>';
    try {
      const svg = await this.plugin.compileTikz(this.mode, code);
      this.currentSvg = svg;
      this.previewEl.innerHTML = warningHtml + svg;
      this.previewEl.style.textAlign = "center";
      this.previewEl.style.padding = "16px";
      const svgEl = this.previewEl.querySelector("svg");
      if (svgEl) {
        svgEl.style.maxWidth = "calc(100% - 32px)";
        svgEl.style.maxHeight = "calc(100% - 32px)";
        svgEl.style.height = "auto";
        svgEl.style.display = "inline-block";
        svgEl.style.margin = "0 auto";
      }
    } catch (e) {
      // 错误预览: 显示错误摘要 + 可展开的完整日志 + 源代码
      const errInfo = this.plugin._lastCompileError || { summary: e.message, fullLog: "" };
      const escapedCode = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      this.previewEl.innerHTML = `
        <div style="width:100%;text-align:left;">
          ${warningHtml}
          <div style="color:#ff6b6b;font-size:12px;font-weight:bold;margin-bottom:4px;">⚠️ 编译错误</div>
          <div style="color:#ff6b6b;font-size:11px;white-space:pre-wrap;margin-bottom:6px;">${errInfo.summary}</div>
          <details style="font-size:11px;margin-bottom:6px;">
            <summary style="cursor:pointer;color:var(--text-muted);">查看完整错误日志</summary>
            <pre style="background:var(--background-primary);padding:6px;border-radius:4px;max-height:100px;overflow:auto;white-space:pre-wrap;color:var(--text-muted);">${errInfo.fullLog?.slice(0, 2000) || e.message}</pre>
          </details>
          <div style="color:var(--text-muted);font-size:11px;font-weight:bold;margin-bottom:2px;">📝 源代码:</div>
          <pre style="background:var(--background-primary);padding:6px;border-radius:4px;max-height:150px;overflow:auto;white-space:pre-wrap;font-size:11px;color:var(--text-normal);border:1px solid var(--background-modifier-border);">${escapedCode}</pre>
        </div>`;
    }
  }

  async doConfirm() {
    const code = this.textarea.value.trim().replace(/\r\n/g, "\n");
    const name = getBlockName(code);
    if (!name || name === getHash(code)) {
      new Notice("请先在代码第一行写 % NAME: 名称", 4000);
      return;
    }
    try {
      // 保存历史版本
      this.saveHistory(name, code);
      // 检测是否含组分标记 (% GROUP:), 有则合并组分 SVG
      let svg;
      if (/%\s*GROUP:/.test(code)) {
        svg = await this.compileFromGroups(code);
      } else {
        // 确认生成 -> 桥接队列 high 优先级
        svg = await this.plugin.compileTikz(this.mode, code, "high");
      }
      this.currentSvg = svg;
      // 写入 SVG 源文件 + PNG 显示文件
      const adapter = this.app.vault.adapter;
      const noteDir = path.dirname(adapter.getFullPath(this.file.path));
      await saveSvgAndPng(svg, name, noteDir);
      // 保存反应信息文件 (v10.8.0)
      try {
        const reactionInfo = extractReactionInfo(code, this.mode, name);
        const infoText = reactionInfoToText(reactionInfo);
        const infoPath = path.join(noteDir, "svg_source", `${name}.info.txt`).replace(/\\/g, "/");
        const infoFile = this.app.vault.getFileByPath(infoPath);
        if (infoFile) {
          await this.app.vault.modify(infoFile, infoText);
        } else {
          await this.app.vault.create(infoPath, infoText);
        }
      } catch (infoErr) {
        console.warn("[Chemfig-SVG] 保存反应信息失败:", infoErr.message);
      }
      // PNG 的 vault 相对路径 (用于 ![[...]] 嵌入)
      const noteRelDir = path.dirname(this.file.path).replace(/\\/g, "/");
      const pngVaultRel = (noteRelDir ? noteRelDir + "/" : "") + "png_out/" + name + ".png";
      // 替换代码块为: PNG反向链接 + 源代码块 (PNG展示结果, 代码展示逻辑)
      const embedLine = `![[${pngVaultRel}]]`;
      const codeBlock = `\`\`\`${this.mode}\n${code}\n\`\`\``;
      const newContent = embedLine + "\n" + codeBlock;
      // 环境检测: 向上清除已有的 <details>/<summary>/旧![svg/png], 向下清除已有的 </details>
      let realStart = this.startLine;
      let realEnd = this.endLine;
      const totalLines = this.editor.lineCount();
      // 向上找: 旧 ![[svg/png]] / <details> / <summary>[code]
      for (let i = this.startLine - 1; i >= 0 && i >= this.startLine - 10; i--) {
        const l = this.editor.getLine(i);
        if (l.includes("![[") && (l.includes("svg_out/") || l.includes("png_out/"))) {
          realStart = i;
          continue;
        }
        if (l.includes("<details>")) {
          realStart = i;
          continue;
        }
        if (l.includes("<summary>") && l.includes("[code]")) {
          realStart = i;
          continue;
        }
        break;
      }
      // 向下找: </details>
      for (let i = this.endLine + 1; i < totalLines && i <= this.endLine + 10; i++) {
        const l = this.editor.getLine(i);
        if (l.trim() === "" || l.includes("</details>")) {
          realEnd = i;
          if (l.includes("</details>")) break;
        } else {
          break;
        }
      }
      this.editor.replaceRange(
        newContent,
        { line: realStart, ch: 0 },
        { line: realEnd, ch: this.editor.getLine(realEnd).length }
      );
      // 页面更新: 将内联 SVG 编辑模式替换为 PNG 显示
      const editingContainers = document.querySelectorAll(".chemfig-svg-editing");
      for (const c of editingContainers) {
        if (
          c.querySelector("svg")?.getAttribute("data-svg-name") === name ||
          c.textContent?.includes(`% NAME: ${name}`)
        ) {
          const noteDir = path.dirname(this.file.path);
          const pngPath = path.join(noteDir, "png_out", `${name}.png`).replace(/\\/g, "/");
          const pngFile = this.app.vault.getFileByPath(pngPath);
          if (pngFile) {
            const img = document.createElement("img");
            img.src = this.app.vault.getResourcePath(pngFile);
            img.alt = name;
            img.style.cssText = "max-width:500px;width:100%;height:auto;display:inline-block;";
            img.setAttribute("data-chemfig-svg", "true");
            img.setAttribute("data-svg-name", name);
            c.parentNode.replaceChild(img, c);
            this.plugin.bindSvgContextMenu(img, name, this.file.path, null);
          }
        }
      }
      new Notice(`✓ 已生成: ${name} (SVG源文件+PNG显示)`, 4000);
      this.close();
    } catch (e) {
      new Notice(`生成失败: ${e.message.slice(0, 60)}`, 5000);
    }
  }

  // 从含 % GROUP: 标记的代码编译合并 SVG
  async compileFromGroups(code) {
    const { nameLine, groups } = parseGroups(code);
    if (groups.length === 0) throw new Error("无组分");
    // 解析 % BG: 背景色
    const bgMatch = code.match(/%\s*BG:\s*(.+)/);
    const bgColor = bgMatch ? bgMatch[1].trim() : "#ffffff";
    // 解析 % LAYOUT: 注释 (兼容新格式 scaleX/scaleY/locked 和旧格式 scale)
    const layout = [];
    const layoutMatches = code.match(
      /%\s*LAYOUT:\s*(.+?)\s+x=(\d+)\s+y=(\d+)(?:\s+scaleX=([\d.]+)\s+scaleY=([\d.]+)|\s+scale=([\d.]+))(\s+locked)?/g
    );
    if (layoutMatches) {
      for (const lm of layoutMatches) {
        const m = lm.match(
          /%\s*LAYOUT:\s*(.+?)\s+x=(\d+)\s+y=(\d+)(?:\s+scaleX=([\d.]+)\s+scaleY=([\d.]+)|\s+scale=([\d.]+))(\s+locked)?/
        );
        if (m) {
          const sx = m[4] ? parseFloat(m[4]) : m[5] ? parseFloat(m[5]) : 1;
          const sy = m[5] ? parseFloat(m[5]) : m[6] ? parseFloat(m[6]) : 1;
          layout.push({
            name: m[1].trim(),
            x: parseInt(m[2]),
            y: parseInt(m[3]),
            scaleX: sx,
            scaleY: sy,
            locked: !!m[7],
          });
        }
      }
    }
    // 编译每个组分 (箭头组分添加占位保持比例)
    const groupSvgs = [];
    for (const g of groups) {
      const wrapped = wrapGroupCode(g.code);
      const s = await this.plugin.compileTikz(this.mode, wrapped);
      groupSvgs.push(s);
    }
    // 匹配布局 (按名称或顺序)
    const finalLayout = groups.map((g, i) => {
      const found = layout.find((l) => l.name === g.name);
      return found || { x: 20 + i * 160, y: 100, scaleX: 1.0, scaleY: 1.0, locked: false };
    });
    // 画布大小: 取布局中最大的 x+w, y+h
    let cw = 600,
      ch = 300;
    for (let i = 0; i < groupSvgs.length; i++) {
      const vb = groupSvgs[i].match(/viewBox="([^"]+)"/);
      if (vb) {
        const v = vb[1].split(/\s+/).map(Number);
        const sx = finalLayout[i].scaleX || finalLayout[i].scale || 1;
        const sy = finalLayout[i].scaleY || finalLayout[i].scale || 1;
        cw = Math.max(cw, finalLayout[i].x + v[2] * sx + 20);
        ch = Math.max(ch, finalLayout[i].y + v[3] * sy + 20);
      }
    }
    return mergeSvgs(groupSvgs, finalLayout, Math.round(cw), Math.round(ch), bgColor);
  }

  saveHistory(name, code) {
    try {
      const adapter = this.app.vault.adapter;
      const noteDir = path.dirname(adapter.getFullPath(this.file.path));
      const historyDir = path.join(noteDir, "svg_out", "_history");
      if (!fs.existsSync(historyDir)) fs.mkdirSync(historyDir, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      const histFile = path.join(historyDir, `${name}_${ts}.code.txt`);
      fs.writeFileSync(
        histFile,
        `% MODE: ${this.mode}\n% TIME: ${new Date().toLocaleString()}\n\n${code}`,
        "utf8"
      );
      console.log(`[Chemfig-SVG] 历史已保存: ${histFile}`);
    } catch (e) {
      console.warn("[Chemfig-SVG] 历史保存失败:", e.message);
    }
  }

  showHistory() {
    const code = this.textarea.value;
    const name = getBlockName(code);
    if (!name) {
      new Notice("先写 % NAME: 名称", 3000);
      return;
    }
    const adapter = this.app.vault.adapter;
    const noteDir = path.dirname(adapter.getFullPath(this.file.path));
    const historyDir = path.join(noteDir, "svg_out", "_history");
    if (!fs.existsSync(historyDir)) {
      new Notice("暂无历史版本", 3000);
      return;
    }
    const files = fs
      .readdirSync(historyDir)
      .filter((f) => f.startsWith(name + "_") && f.endsWith(".code.txt"))
      .sort()
      .reverse();
    if (files.length === 0) {
      new Notice("暂无历史版本", 3000);
      return;
    }

    // 简单历史列表 Modal
    const modal = new Modal(this.app);
    modal.contentEl.empty();
    modal.contentEl.createEl("h3", { text: `历史版本: ${name}` });
    const list = modal.contentEl.createDiv();
    list.style.maxHeight = "400px";
    list.style.overflow = "auto";
    for (const f of files) {
      const timeStr = f
        .replace(name + "_", "")
        .replace(".code.txt", "")
        .replace(/-/g, ":")
        .replace("T", " ");
      const item = list.createEl("div", { text: timeStr });
      item.style.padding = "8px";
      item.style.cursor = "pointer";
      item.style.borderBottom = "1px solid var(--background-modifier-border)";
      item.onmouseenter = () => {
        item.style.background = "var(--background-secondary)";
      };
      item.onmouseleave = () => {
        item.style.background = "transparent";
      };
      item.onclick = () => {
        const content = fs.readFileSync(path.join(historyDir, f), "utf8");
        const lines = content.split("\n");
        const codeLines = [];
        let skipHeader = true;
        for (const l of lines) {
          if (
            skipHeader &&
            (l.startsWith("% MODE:") || l.startsWith("% TIME:") || l.trim() === "")
          ) {
            if (l.startsWith("% TIME:")) skipHeader = false;
            continue;
          }
          skipHeader = false;
          codeLines.push(l);
        }
        this.textarea.value = codeLines.join("\n").replace(/^\n+/, "");
        new Notice("已载入历史版本, 可继续编辑", 3000);
        modal.close();
      };
    }
    modal.open();
  }

  // 打开组分调整可视化编辑器
  async openGroupLayout() {
    const code = this.textarea.value;
    const { nameLine, groups } = parseGroups(code);
    // 如果有导入的SVG, 作为新组分添加
    if (this.importedSvg) {
      const importName = this.importedSvgName || "导入的SVG";
      groups.push({
        name: importName,
        code: "% IMPORTED_SVG",
        type: "imported",
        offsetY: 0,
        importedSvg: this.importedSvg,
      });
      this.importedSvg = null;
      this.importedSvgName = null;
    }
    if (groups.length < 2) {
      new Notice(
        "需要至少2个组分才能调整间距。用 % GROUP: 名称 标记组分，或写多个 \\chemfig{}",
        5000
      );
      return;
    }
    // v10.9.4: 尝试从 .info.txt 读取保存的布局信息
    let savedLayout = null;
    try {
      const name = getBlockName(nameLine + "\n" + groups.map((g) => g.code).join("\n"));
      if (name && name !== getHash(nameLine)) {
        const adapter = this.app.vault.adapter;
        const noteDir = path.dirname(adapter.getFullPath(this.file.path));
        const infoPath = path.join(noteDir, "svg_source", name + ".info.txt").replace(/\\/g, "/");
        if (await adapter.exists(infoPath)) {
          const infoText = await adapter.read(infoPath);
          const info = parseReactionInfo(infoText);
          if (info.layout && info.layout.length > 0) {
            savedLayout = info.layout.map((l) => ({
              x: l.x,
              y: l.y,
              scaleX: l.scaleX,
              scaleY: l.scaleY,
              locked: l.locked,
            }));
            console.log("[Chemfig-SVG] 从信息文件读取布局:", savedLayout.length, "个组分");
          }
        }
      }
    } catch (e) {
      console.warn("[Chemfig-SVG] 读取布局信息失败:", e);
    }
    const layoutModal = new GroupLayoutModal(
      this.app,
      this.plugin,
      this.mode,
      nameLine,
      groups,
      async (mergedSvg, layout, bgColor) => {
        // 回调: 用户保存布局后直接生成SVG并替换为反向链接
        this.currentSvg = mergedSvg;
        const name = getBlockName(nameLine + "\n" + groups.map((g) => g.code).join("\n"));
        if (!name || name === getHash(nameLine)) {
          new Notice("请先在代码第一行写 % NAME: 名称", 4000);
          return;
        }
        try {
          // 保存历史版本
          const bgLine = bgColor && bgColor !== "#ffffff" ? `% BG: ${bgColor}\n` : "";
          // v10.9.4: 代码块只保留纯LaTeX代码, 布局和组分信息写入 .info.txt
          // 拼接各组分代码 (按顺序), 不含 % LAYOUT: 和 % GROUP: 标记
          const cleanCodeLines = [nameLine];
          if (bgLine) cleanCodeLines.push(bgLine.trim());
          for (const g of groups) {
            cleanCodeLines.push(g.code);
          }
          const fullCode = cleanCodeLines.join("\n") + "\n";
          this.saveHistory(name, fullCode);
          // 写入 SVG 文件
          const adapter = this.app.vault.adapter;
          const noteDir = path.dirname(adapter.getFullPath(this.file.path));
          await saveSvgAndPng(mergedSvg, name, noteDir);
          // v10.9.4: 写入反应信息文件 (含布局信息)
          try {
            const info = extractReactionInfo(fullCode, this.mode, name);
            const infoText = reactionInfoToText(info, layout);
            const infoPath = path
              .join(noteDir, "svg_source", name + ".info.txt")
              .replace(/\\/g, "/");
            if (await adapter.exists(infoPath)) {
              await adapter.write(infoPath, infoText);
            } else {
              await adapter.mkdir(path.dirname(infoPath)).catch(() => {});
              await adapter.write(infoPath, infoText);
            }
          } catch (infoErr) {
            console.warn("[Chemfig-SVG] 写入信息文件失败:", infoErr);
          }
          // 替换代码块为: PNG反向链接 + 源代码块
          const noteRelDir = path.dirname(this.file.path).replace(/\\/g, "/");
          const pngVaultRel = (noteRelDir ? noteRelDir + "/" : "") + "png_out/" + name + ".png";
          const embedLine = `![[${pngVaultRel}]]`;
          const codeBlock = `\`\`\`${this.mode}\n${fullCode}\n\`\`\``;
          const newContent = embedLine + "\n" + codeBlock;
          // 环境检测: 清除已有的 details/summary/旧图片链接
          let realStart = this.startLine;
          let realEnd = this.endLine;
          const totalLines = this.editor.lineCount();
          for (let i = this.startLine - 1; i >= 0 && i >= this.startLine - 10; i--) {
            const l = this.editor.getLine(i);
            if (l.includes("![[") && (l.includes("svg_out/") || l.includes("png_out/"))) {
              realStart = i;
              continue;
            }
            if (l.includes("<details>")) {
              realStart = i;
              continue;
            }
            if (l.includes("<summary>") && l.includes("[code]")) {
              realStart = i;
              continue;
            }
            break;
          }
          for (let i = this.endLine + 1; i < totalLines && i <= this.endLine + 10; i++) {
            const l = this.editor.getLine(i);
            if (l.trim() === "" || l.includes("</details>")) {
              realEnd = i;
              if (l.includes("</details>")) break;
            } else {
              break;
            }
          }
          this.editor.replaceRange(
            newContent,
            { line: realStart, ch: 0 },
            { line: realEnd, ch: this.editor.getLine(realEnd).length }
          );
          new Notice(`✓ 布局已应用并生成: ${name}.svg`, 4000);
          this.close();
        } catch (e) {
          new Notice(`生成失败: ${e.message.slice(0, 60)}`, 5000);
        }
      },
      savedLayout
    );
    layoutModal.open();
  }

  onClose() {
    this.contentEl.empty();
  }
}

// ========== 增加组件输入弹窗 ==========
class AddComponentModal extends Modal {
  constructor(app, plugin, mode, type, onSubmit) {
    super(app);
    this.plugin = plugin;
    this.mode = mode;
    this.type = type; // "chemfig" or "svg"
    this.onSubmit = onSubmit;
    this.tplNav = [];
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.style.width = "720px";
    contentEl.createEl("h3", {
      text: this.type === "chemfig" ? "添加 chemfig 代码块" : "粘贴 SVG 代码",
    }).style.margin = "0 0 10px 0";

    // 主区域: 左模板面板 + 右输入区
    const main = contentEl.createDiv();
    main.style.display = "flex";
    main.style.gap = "10px";
    main.style.height = "340px";

    // 左侧: 模板面板 (仅 chemfig 模式显示)
    if (this.type === "chemfig") {
      const tplPanel = main.createDiv();
      tplPanel.style.width = "240px";
      tplPanel.style.flexShrink = "0";
      tplPanel.style.display = "flex";
      tplPanel.style.flexDirection = "column";
      // 搜索框
      this.tplSearch = tplPanel.createEl("input", { type: "text", placeholder: "搜索模板..." });
      this.tplSearch.style.cssText =
        "width:100%;padding:5px 8px;font-size:12px;margin-bottom:4px;box-sizing:border-box;background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:3px;";
      this.tplSearch.addEventListener("input", () => {
        this.tplNav = [];
        this.refreshTplList();
      });
      // 面包屑
      this.tplCrumb = tplPanel.createDiv();
      this.tplCrumb.style.cssText =
        "display:flex;flex-wrap:wrap;align-items:center;gap:2px;font-size:11px;margin-bottom:4px;padding:3px 4px;background:var(--background-primary);border:1px solid var(--background-modifier-border);border-radius:3px;min-height:20px;";
      // 保存为模板按钮
      const saveTplBtn = tplPanel.createEl("button", { text: "💾 保存代码为模板" });
      saveTplBtn.style.cssText =
        "width:100%;padding:3px 8px;font-size:11px;cursor:pointer;background:var(--background-primary);color:var(--text-accent);border:1px solid var(--background-modifier-border);border-radius:3px;margin-bottom:4px;";
      saveTplBtn.onclick = async () => {
        const name = prompt("输入模板名称:");
        if (!name) return;
        const code = this.codeInput.value.trim();
        if (!code) {
          new Notice("代码为空");
          return;
        }
        await this.plugin.saveCustomTemplate(name, code, this.mode);
        this.tplNav = ["自定义"];
        this.refreshTplList();
        new Notice("已保存模板: " + name);
      };
      // 模板列表
      this.tplList = tplPanel.createDiv();
      this.tplList.style.cssText =
        "flex:1;overflow-y:auto;background:var(--background-secondary);border:1px solid var(--background-modifier-border);border-radius:4px;padding:4px;display:flex;flex-direction:column;gap:2px;";
      this.refreshTplList();
    }

    // 右侧: 输入区
    const right = main.createDiv();
    right.style.flex = "1";
    right.style.display = "flex";
    right.style.flexDirection = "column";
    right.style.minWidth = "0";
    // 名称输入
    const nameRow = right.createDiv();
    nameRow.style.display = "flex";
    nameRow.style.alignItems = "center";
    nameRow.style.gap = "8px";
    nameRow.style.marginBottom = "8px";
    nameRow.createSpan({ text: "组分名称:" }).style.fontSize = "13px";
    this.nameInput = nameRow.createEl("input", {
      type: "text",
      placeholder: "如: 结构式3 / 催化剂",
    });
    this.nameInput.style.flex = "1";
    this.nameInput.style.padding = "6px";
    // 代码输入
    right.createSpan({
      text: this.type === "chemfig" ? "chemfig 代码 (点击左侧模板自动填充):" : "SVG 代码:",
    }).style.fontSize = "13px";
    this.codeInput = right.createEl("textarea");
    this.codeInput.style.cssText =
      "flex:1;width:100%;padding:6px;font-family:monospace;font-size:12px;box-sizing:border-box;margin-top:4px;background:var(--background-secondary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:4px;resize:none;";
    this.codeInput.placeholder =
      this.type === "chemfig" ? "\\chemfig{*6(-=-=-=)} 或 \\arrow{->[条件]}" : "<svg ...>...</svg>";

    // 按钮
    const btnRow = contentEl.createDiv();
    btnRow.style.display = "flex";
    btnRow.style.justifyContent = "flex-end";
    btnRow.style.gap = "8px";
    btnRow.style.marginTop = "10px";
    const cancelBtn = btnRow.createEl("button", { text: "取消" });
    cancelBtn.style.padding = "6px 16px";
    cancelBtn.style.cursor = "pointer";
    cancelBtn.onclick = () => this.close();
    const okBtn = btnRow.createEl("button", { text: "✓ 添加" });
    okBtn.style.padding = "6px 16px";
    okBtn.style.cursor = "pointer";
    okBtn.style.background = "var(--interactive-accent)";
    okBtn.style.color = "white";
    okBtn.style.border = "none";
    okBtn.style.borderRadius = "4px";
    okBtn.onclick = () => {
      const name = this.nameInput.value.trim();
      const code = this.codeInput.value.trim();
      if (!name || !code) {
        new Notice("请填写名称和代码");
        return;
      }
      this.onSubmit(name, code);
      this.close();
    };
    if (this.type === "chemfig") {
      this.codeInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) okBtn.click();
      });
    }
    setTimeout(() => this.nameInput.focus(), 50);
  }

  // 刷新模板列表
  refreshTplList() {
    if (!this.tplList) return;
    this.tplList.empty();
    const templates = this.plugin.getAllTemplates(this.mode);
    const keyword = (this.tplSearch?.value || "").trim().toLowerCase();
    this.renderTplCrumb();
    if (keyword) {
      const filtered = templates.filter(
        (t) => t.name.toLowerCase().includes(keyword) || t.code.toLowerCase().includes(keyword)
      );
      if (filtered.length === 0) {
        this.showTplEmpty("无匹配模板");
        return;
      }
      for (const tpl of filtered) this.addTplItem(tpl);
      return;
    }
    const nav = this.tplNav;
    if (nav.length === 0) {
      const catOrder = ["自定义", "框架", "结构", "符号", "条件"];
      for (const cat of catOrder) {
        const count = templates.filter((t) => t.category === cat).length;
        if (count === 0) continue;
        const btn = this.tplList.createEl("button");
        btn.style.cssText =
          "width:100%;text-align:left;padding:8px 10px;font-size:12px;font-weight:bold;cursor:pointer;background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:3px;margin-bottom:2px;display:flex;justify-content:space-between;align-items:center;";
        btn.innerHTML = `<span>${cat}</span><span style="font-size:10px;color:var(--text-muted);font-weight:normal">${count}项 ›</span>`;
        btn.onmouseenter = () => {
          btn.style.background = "var(--background-modifier-hover)";
        };
        btn.onmouseleave = () => {
          btn.style.background = "var(--background-primary)";
        };
        btn.onclick = () => {
          this.tplNav = [cat];
          this.refreshTplList();
        };
      }
      return;
    }
    if (nav.length === 1) {
      const cat = nav[0];
      const subCats = {};
      for (const tpl of templates) {
        if (tpl.category !== cat) continue;
        const sub = tpl.subcategory || "全部";
        if (!subCats[sub]) subCats[sub] = [];
        subCats[sub].push(tpl);
      }
      const subNames = Object.keys(subCats).sort();
      if (subNames.length <= 1) {
        const items =
          subNames.length === 1
            ? subCats[subNames[0]]
            : templates.filter((t) => t.category === cat);
        for (const tpl of items) this.addTplItem(tpl);
        return;
      }
      for (const sub of subNames) {
        const count = subCats[sub].length;
        const btn = this.tplList.createEl("button");
        btn.style.cssText =
          "width:100%;text-align:left;padding:6px 10px;font-size:11.5px;cursor:pointer;background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:3px;margin-bottom:2px;display:flex;justify-content:space-between;align-items:center;";
        btn.innerHTML = `<span>${sub}</span><span style="font-size:10px;color:var(--text-muted)">${count}项 ›</span>`;
        btn.onmouseenter = () => {
          btn.style.background = "var(--background-modifier-hover)";
        };
        btn.onmouseleave = () => {
          btn.style.background = "var(--background-primary)";
        };
        btn.onclick = () => {
          this.tplNav = [cat, sub];
          this.refreshTplList();
        };
      }
      return;
    }
    const [cat, sub] = nav;
    const items = templates.filter((t) => t.category === cat && (t.subcategory || "全部") === sub);
    if (items.length === 0) {
      this.showTplEmpty("该分类暂无模板");
      return;
    }
    for (const tpl of items) this.addTplItem(tpl);
  }

  renderTplCrumb() {
    if (!this.tplCrumb) return;
    this.tplCrumb.empty();
    const keyword = (this.tplSearch?.value || "").trim();
    const makeCrumb = (text, navPath) => {
      const span = this.tplCrumb.createEl("span");
      span.textContent = text;
      span.style.cssText =
        "cursor:pointer;color:var(--text-accent);padding:1px 3px;border-radius:2px;";
      span.onmouseenter = () => {
        span.style.background = "var(--background-modifier-hover)";
      };
      span.onmouseleave = () => {
        span.style.background = "transparent";
      };
      span.onclick = () => {
        this.tplNav = navPath;
        this.tplSearch.value = "";
        this.refreshTplList();
      };
    };
    const makeSep = () => {
      const sep = this.tplCrumb.createEl("span");
      sep.textContent = "›";
      sep.style.cssText = "color:var(--text-muted);padding:0 2px;";
    };
    if (keyword) {
      makeCrumb("🔍 搜索结果", []);
      return;
    }
    makeCrumb("全部模板", []);
    for (let i = 0; i < this.tplNav.length; i++) {
      makeSep();
      makeCrumb(this.tplNav[i], this.tplNav.slice(0, i + 1));
    }
  }

  addTplItem(tpl) {
    const wrap = this.tplList.createDiv();
    wrap.style.cssText = "display:flex;align-items:center;gap:2px;margin-bottom:2px;";
    const btn = wrap.createEl("button", { text: tpl.name });
    btn.style.cssText =
      "flex:1;text-align:left;padding:5px 8px;font-size:11.5px;cursor:pointer;background:var(--background-primary);color:var(--text-normal);border:1px solid var(--background-modifier-border);border-radius:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;";
    btn.onmouseenter = () => {
      btn.style.background = "var(--background-modifier-hover)";
    };
    btn.onmouseleave = () => {
      btn.style.background = "var(--background-primary)";
    };
    btn.onclick = () => {
      // 自动填充代码
      this.codeInput.value = tpl.code;
      // 自动填充名称(如果为空)
      if (!this.nameInput.value.trim()) this.nameInput.value = tpl.name;
    };
    if (tpl.custom) {
      const delBtn = wrap.createEl("button", { text: "✕" });
      delBtn.style.cssText =
        "padding:3px 5px;font-size:10px;cursor:pointer;background:var(--background-primary);color:var(--text-muted);border:1px solid var(--background-modifier-border);border-radius:3px;flex-shrink:0;";
      delBtn.title = "删除此自定义模板";
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm(`删除自定义模板「${tpl.name}」?`)) {
          await this.plugin.deleteCustomTemplate(tpl.name);
          this.refreshTplList();
        }
      };
    }
  }

  showTplEmpty(text) {
    const empty = this.tplList.createEl("div", { text });
    empty.style.cssText =
      "color:var(--text-muted);font-size:11px;text-align:center;padding:16px 0;";
  }

  onClose() {
    this.contentEl.empty();
  }
}
