// ========== 组分调整模块 ==========
// 从 main.js 自动提取

class GroupLayoutModal extends Modal {
  constructor(app, plugin, mode, nameLine, groups, onSave, initialLayout) {
    super(app);
    this.plugin = plugin;
    this.mode = mode;
    this.nameLine = nameLine;
    this.groups = groups;
    this.onSave = onSave;
    this.initialLayout = initialLayout || null; // v10.9.4: 从 .info.txt 读取的保存布局
    this.groupSvgs = [];
    this.cachedCanvases = []; // 离屏Canvas缓存: SVG预渲染为Canvas, 避免异步Image加载问题
    this.layout = [];
    this.canvasW = 600;
    this.canvasH = 300;
    this.bgColor = "#ffffff";
    this.dragIndex = -1;
    this.dragOffset = { x: 0, y: 0 };
    this.selectedIndex = -1;
    // Excalidraw 深度集成 (v10.6.0)
    this.excalidrawAvailable =
      typeof isExcalidrawAvailable === "function" && isExcalidrawAvailable(app);
    this.useExcalidraw = false;
    this.excalidrawCanvas = null;
    this.excalidrawExportPath = null; // v10.15.x: 最近导出的 .excalidraw.md 路径 (双向同步用)
    this.canvasMode = "canvas2d"; // v10.15.12: 画布模式 canvas2d / excalidraw-temp / excalidraw-embedded
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("group-layout-modal");

    // v10.9.6: 画布尺寸校验, 超过2000自动重置为默认值
    if (this.canvasW > 2000 || this.canvasW < 100) {
      console.warn("[Chemfig-SVG] 画布宽异常:", this.canvasW, "已重置为600");
      this.canvasW = 600;
    }
    if (this.canvasH > 2000 || this.canvasH < 100) {
      console.warn("[Chemfig-SVG] 画布高异常:", this.canvasH, "已重置为300");
      this.canvasH = 300;
    }
    // v10.9.6: initialLayout坐标校验, 超过5000视为异常, 回退到自动布局
    if (this.initialLayout) {
      for (const p of this.initialLayout) {
        if (Math.abs(p.x) > 5000 || Math.abs(p.y) > 5000) {
          console.warn("[Chemfig-SVG] 保存的布局坐标异常, 回退到自动布局:", p);
          this.initialLayout = null;
          break;
        }
      }
    }

    // ===== 模态框头部 =====
    const header = contentEl.createDiv({ cls: "chemfig-modal-header" });
    const title = header.createDiv({ cls: "chemfig-modal-title", text: "组分间距调整" });
    title.createSpan({
      text: "拖拽移动, 滚轮缩放",
      cls: "chemfig-status-badge info",
    }).style.marginLeft = "8px";

    // ===== 画布控制栏 =====
    const sizeBar = contentEl.createDiv({ cls: "group-layout-toolbar" });
    sizeBar.style.cssText =
      "display:flex;gap:16px;margin:12px 20px;align-items:center;font-size:12px;flex-wrap:wrap;padding:10px 12px;background:var(--background-secondary);border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);";

    // 第一组: 画布尺寸
    const sizeGroup = sizeBar.createDiv({ cls: "toolbar-group" });
    sizeGroup.style.cssText = "display:flex;gap:8px;align-items:center;";
    sizeGroup.createSpan({ text: "📐 画布:", cls: "toolbar-label" }).style.cssText =
      "font-weight:600;color:var(--text-normal);";
    sizeGroup.createSpan({ text: "宽" });
    this.wInput = sizeGroup.createEl("input", { type: "number", value: this.canvasW });
    this.wInput.style.cssText =
      "width:70px;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;font-family:var(--font-monospace);font-size:12px;";
    this.wInput.onchange = () => {
      this.canvasW = Math.min(2000, Math.max(100, parseInt(this.wInput.value) || 600));
      this.wInput.value = this.canvasW;
      this.canvas.width = this.canvasW;
      this.canvas.style.width = this.canvasW + "px";
      this.render();
    };
    sizeGroup.createSpan({ text: "高" });
    this.hInput = sizeGroup.createEl("input", { type: "number", value: this.canvasH });
    this.hInput.style.cssText =
      "width:70px;padding:4px 8px;border:1px solid var(--background-modifier-border);border-radius:4px;font-family:var(--font-monospace);font-size:12px;";
    this.hInput.onchange = () => {
      this.canvasH = Math.min(2000, Math.max(100, parseInt(this.hInput.value) || 300));
      this.hInput.value = this.canvasH;
      this.canvas.height = this.canvasH;
      this.canvas.style.height = this.canvasH + "px";
      this.render();
    };

    // 分隔线
    const sep1 = sizeBar.createDiv({ cls: "toolbar-separator" });
    sep1.style.cssText = "width:1px;height:24px;background:var(--background-modifier-border);";

    // 第二组: 背景设置
    const bgGroup = sizeBar.createDiv({ cls: "toolbar-group" });
    bgGroup.style.cssText = "display:flex;gap:8px;align-items:center;";
    bgGroup.createSpan({ text: "🎨 背景:", cls: "toolbar-label" }).style.cssText =
      "font-weight:600;color:var(--text-normal);";
    this.bgInput = bgGroup.createEl("input", { type: "color", value: this.bgColor });
    this.bgInput.style.cssText =
      "width:32px;height:24px;padding:0;border:none;cursor:pointer;border-radius:4px;";
    this.bgInput.oninput = () => {
      this.bgColor = this.bgInput.value;
      this.render();
    };
    const transparentBtn = UI.button("透明", () => {
      this.bgColor = "transparent";
      this.bgInput.value = "#ffffff";
      this.render();
    });
    transparentBtn.style.cssText =
      "padding:4px 10px;font-size:11px;border-radius:4px;transition:all 0.15s ease;";
    bgGroup.appendChild(transparentBtn);

    // 分隔线
    const sep2 = sizeBar.createDiv({ cls: "toolbar-separator" });
    sep2.style.cssText = "width:1px;height:24px;background:var(--background-modifier-border);";

    // 第三组: 画布模式
    const modeGroup = sizeBar.createDiv({ cls: "toolbar-group" });
    modeGroup.style.cssText = "display:flex;gap:8px;align-items:center;";
    modeGroup.createSpan({ text: "🖼️ 模式:", cls: "toolbar-label" }).style.cssText =
      "font-weight:600;color:var(--text-normal);";
    this.canvasModeSelect = modeGroup.createEl("select");
    this.canvasModeSelect.style.cssText =
      "padding:4px 8px;font-size:11px;border:1px solid var(--background-modifier-border);border-radius:4px;background:var(--background-primary);";
    this.canvasModeSelect.createEl("option", { text: "Canvas 2D (推荐)", value: "canvas2d" });
    this.canvasModeSelect.createEl("option", {
      text: "Excalidraw 独立视图",
      value: "excalidraw-standalone",
    });
    this.canvasModeSelect.value = this.canvasMode || "canvas2d";
    this.canvasModeSelect.onchange = () => {
      this.canvasMode = this.canvasModeSelect.value;
      this.switchCanvasMode();
    };

    // 分隔线
    const sep3 = sizeBar.createDiv({ cls: "toolbar-separator" });
    sep3.style.cssText = "width:1px;height:24px;background:var(--background-modifier-border);";

    // 第四组: 全局缩放
    const zoomGroup = sizeBar.createDiv({ cls: "toolbar-group" });
    zoomGroup.style.cssText = "display:flex;gap:8px;align-items:center;";
    zoomGroup.createSpan({ text: "🔍 缩放:", cls: "toolbar-label" }).style.cssText =
      "font-weight:600;color:var(--text-normal);";
    this.globalScale = zoomGroup.createEl("input", {
      type: "range",
      min: "10",
      max: "500",
      value: "100",
    });
    this.globalScale.style.width = "100px";
    this.globalScaleLabel = zoomGroup.createSpan({ text: "100%" });
    this.globalScaleLabel.style.cssText =
      "font-size:11px;min-width:40px;font-family:var(--font-monospace);color:var(--text-accent);";
    this.globalScale.oninput = () => {
      const ratio = parseInt(this.globalScale.value) / 100;
      this.globalScaleLabel.textContent = this.globalScale.value + "%";
      for (let i = 0; i < this.layout.length; i++) {
        if (this.layout[i].locked) continue;
        if (!this.layout[i].scaleX) {
          this.layout[i].scaleX = this.layout[i].scale || 1;
          this.layout[i].scaleY = this.layout[i].scale || 1;
        }
        this.layout[i].scaleX = Math.max(
          0.1,
          Math.min(5, (this.layout[i].scaleX * ratio) / (this.lastGlobalRatio || 1))
        );
        this.layout[i].scaleY = Math.max(
          0.1,
          Math.min(5, (this.layout[i].scaleY * ratio) / (this.lastGlobalRatio || 1))
        );
      }
      this.lastGlobalRatio = ratio;
      this.buildControls();
      this.render();
    };

    // 第五组: 操作按钮
    const actionGroup = sizeBar.createDiv({ cls: "toolbar-group", style: "margin-left:auto;" });
    actionGroup.style.cssText = "display:flex;gap:8px;align-items:center;margin-left:auto;";

    const resetBtn = UI.button("↺ 重置", () => {
      const baselineY = this.canvasH / 2;
      let curX = 30;
      const gap = 12;
      for (let i = 0; i < this.groups.length; i++) {
        const vb = this.getViewBox(i);
        const w = vb[2],
          h = vb[3];
        const offsetY = this.groups[i].offsetY || 0;
        const y = baselineY - h / 2 + offsetY;
        this.layout[i] = { x: curX, y: Math.max(10, y), scaleX: 1.0, scaleY: 1.0, locked: false };
        curX += w + gap;
      }
      this.globalScale.value = "100";
      this.globalScaleLabel.textContent = "100%";
      this.lastGlobalRatio = 1;
      this.selectedIndex = -1;
      this.buildControls();
      this.render();
    });
    resetBtn.style.cssText = "padding:2px 10px;font-size:11px;margin-left:8px;";
    sizeBar.appendChild(resetBtn);

    // 清理缓存按钮 (v10.9.2): 清理离屏Canvas缓存并重新预渲染
    const clearCacheBtn = UI.button("🗑 清理缓存", async () => {
      try {
        // 清理离屏Canvas缓存
        this.cachedCanvases = [];
        // 清理编译缓存 (如果插件有)
        if (this.plugin._compileCache) {
          this.plugin._compileCache.clear();
        }
        // 重新预渲染所有组分
        await this.preRenderAllCanvases();
        this.render();
        new Notice("已清理缓存并重新渲染");
      } catch (e) {
        new Notice("清理缓存失败: " + e.message);
      }
    });
    clearCacheBtn.style.cssText =
      "padding:2px 10px;font-size:11px;margin-left:8px;background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3);";
    clearCacheBtn.title = "清理离屏Canvas缓存和编译缓存，重新渲染所有组分";
    sizeBar.appendChild(clearCacheBtn);

    // ===== 画布区域 (双模式: Canvas / Excalidraw) =====
    this.canvasContainer = contentEl.createDiv({ cls: "chemfig-canvas-container" });
    this.canvasContainer.style.cssText =
      "margin:0 16px;border-radius:8px;overflow:hidden;position:relative;min-height:" +
      this.canvasH +
      "px;";
    // Canvas 模式
    this.canvas = this.canvasContainer.createEl("canvas");
    this.canvas.width = this.canvasW;
    this.canvas.height = this.canvasH;
    this.canvas.style.cssText =
      "border:1px solid var(--background-modifier-border);background:white;cursor:move;display:block;margin:8px auto;width:" +
      this.canvasW +
      "px;height:" +
      this.canvasH +
      "px;max-width:100%;max-height:65vh;box-sizing:content-box;flex-shrink:0;";
    // Excalidraw 模式容器 (默认隐藏)
    this.excalidrawContainer = contentEl.createDiv();
    this.excalidrawContainer.style.cssText =
      "margin:0 16px;border-radius:8px;overflow:hidden;display:none;height:65vh;border:1px solid var(--background-modifier-border);";

    // ===== 组分控制面板 =====
    this.ctrlPanel = contentEl.createDiv();
    this.ctrlPanel.style.cssText =
      "margin:8px 16px;max-height:200px;overflow:auto;padding:8px;background:var(--background-secondary);border-radius:8px;";

    // ===== 底部按钮栏 =====
    const footer = contentEl.createDiv({ cls: "chemfig-modal-footer" });
    const leftBtns = footer.createDiv({ cls: "chemfig-actions" });
    const addBtn = UI.button("➕ 增加组件", () => this.showAddComponentMenu(addBtn));
    leftBtns.appendChild(addBtn);
    // Excalidraw 桥接: 检测 Excalidraw 插件是否安装
    const excalidrawPlugin = this.plugin.app.plugins.plugins["obsidian-excalidraw-plugin"];
    if (excalidrawPlugin) {
      const importBtn = UI.button("↩️ 从 Excalidraw 读回布局", () => this.importFromExcalidraw());
      importBtn.style.cssText =
        "padding:4px 10px;font-size:11px;background:var(--interactive-normal);";
      leftBtns.appendChild(importBtn);
    }
    const rightBtns = footer.createDiv({ cls: "chemfig-actions" });
    const cancelBtn = UI.button("取消", () => this.close());
    const saveBtn = UI.button("✓ 应用布局", () => this.doSave(), { primary: true });
    rightBtns.appendChild(cancelBtn);
    rightBtns.appendChild(saveBtn);

    // 编译所有组分
    new Notice("正在编译各组分...", 2000);
    this.compileErrors = [];
    try {
      // 第一步: 编译所有组分 (逐个编译, 失败时使用占位符)
      for (let i = 0; i < this.groups.length; i++) {
        if (this.groups[i].type === "imported" && this.groups[i].importedSvg) {
          // 导入的SVG组分直接使用, 不编译
          this.groupSvgs.push(this.groups[i].importedSvg);
        } else {
          try {
            const wrapped = wrapGroupCode(this.groups[i].code);
            // v10.12.0: Canvas画布下使用适配的渲染模式, 失败时自动重试
            // chemfig/arrow组分使用chem模式(自动包裹schemestart), \ce{}使用ce模式
            let compileMode = "chem";
            if (/\\ce\{/.test(wrapped) && !/\\chemfig|\\arrow/.test(wrapped)) {
              compileMode = "ce";
            }
            let svg = null;
            let lastError = null;
            // 按优先级尝试编译: 当前模式 → chem → tikz → ce
            const tryModes = [compileMode, "chem", "tikz", "ce"].filter(
              (v, idx, arr) => arr.indexOf(v) === idx
            );
            for (const mode of tryModes) {
              try {
                svg = await this.plugin.compileTikz(mode, wrapped);
                if (svg && svg.length > 100) break; // 编译成功且SVG有效
              } catch (e) {
                lastError = e;
                console.warn(
                  "[Chemfig-SVG] 组分 " + i + " 使用 " + mode + " 模式编译失败, 尝试下一个模式:",
                  e.message
                );
              }
            }
            if (svg && svg.length > 100) {
              this.groupSvgs.push(svg);
            } else {
              throw lastError || new Error("所有模式编译均失败");
            }
          } catch (compileErr) {
            // 单个组分编译失败, 使用占位符 SVG
            console.warn(
              "[Chemfig-SVG] 组分 " + i + " 编译失败:",
              compileErr.message,
              "\n代码:",
              this.groups[i].code
            );
            this.compileErrors.push({
              index: i,
              name: this.groups[i].name,
              error: compileErr.message,
              code: this.groups[i].code,
            });
            const placeholderSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60" viewBox="0 0 120 60">
              <rect width="120" height="60" fill="#fee2e2" stroke="#ef4444" stroke-width="1"/>
              <text x="60" y="25" text-anchor="middle" font-size="10" fill="#991b1b">编译失败</text>
              <text x="60" y="42" text-anchor="middle" font-size="8" fill="#991b1b">${this.groups[i].name || "组分" + (i + 1)}</text>
            </svg>`;
            this.groupSvgs.push(placeholderSvg);
          }
        }
      }
      // 第二步: 根据各组分实际尺寸和 offsetY 计算初始布局, 保持原始相对位置
      // v10.9.4: 如果有从 .info.txt 读取的保存布局, 优先使用
      if (this.initialLayout && this.initialLayout.length === this.groups.length) {
        for (const p of this.initialLayout) {
          this.layout.push({
            x: p.x,
            y: p.y,
            scaleX: p.scaleX || 1,
            scaleY: p.scaleY || 1,
            locked: p.locked || false,
          });
        }
        console.log("[Chemfig-SVG] 使用保存的布局:", this.layout.length, "个组分");
      } else {
        const baselineY = this.canvasH / 2;
        let curX = 30;
        const gap = 12; // 组分间距
        for (let i = 0; i < this.groups.length; i++) {
          const vb = this.groupSvgs[i].match(/viewBox="([^"]+)"/);
          const v = vb ? vb[1].split(/\s+/).map(Number) : [0, 0, 100, 60];
          const w = v[2],
            h = v[3];
          const offsetY = this.groups[i].offsetY || 0;
          // 基线对齐: 结构式/箭头中心在基线, 条件文字在基线上下偏移
          const y = baselineY - h / 2 + offsetY;
          this.layout.push({
            x: curX,
            y: Math.max(10, y),
            scaleX: 1.0,
            scaleY: 1.0,
            locked: false,
          });
          curX += w + gap;
        }
        // 调整画布宽度以适应内容
        if (curX + 20 > this.canvasW) {
          this.canvasW = Math.ceil(curX + 30);
          this.wInput.value = this.canvasW;
          if (this.canvas) {
            this.canvas.width = this.canvasW;
            this.canvas.style.width = this.canvasW + "px";
          }
        }
      }
      // 预渲染所有组分为离屏 Canvas (v10.9.0 画布修复)
      await this.preRenderAllCanvases();
      this.buildControls();
      this.bindCanvas();
      this.render();
      // v10.9.10: 单个组分编译失败时显示错误信息 (插入到画布之前, 确保可见)
      if (this.compileErrors && this.compileErrors.length > 0) {
        try {
          const warnDiv = contentEl.createDiv();
          warnDiv.style.cssText =
            "color:#92400e;margin:4px 16px;padding:6px 10px;background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.3);border-radius:4px;font-size:11px;white-space:pre-wrap;max-height:120px;overflow:auto;order:2;";
          let envReady = "未知";
          try {
            envReady = this.plugin.envReady ? "是" : "否";
          } catch (e) {}
          let warnText =
            "⚠ " + this.compileErrors.length + " 个组分编译失败 (环境就绪: " + envReady + ")\n";
          for (const err of this.compileErrors) {
            warnText += "  • " + (err.name || "组分" + (err.index + 1)) + ": " + err.error + "\n";
            try {
              warnText += "    代码: " + err.code.substring(0, 60) + "\n";
            } catch (e) {}
          }
          try {
            if (this.plugin._lastCompileError) {
              const le = this.plugin._lastCompileError;
              if (le.fullLog) warnText += "\n📋 编译日志:\n" + le.fullLog.substring(0, 300);
              if (le.texContent) warnText += "\n📝 生成的TeX:\n" + le.texContent.substring(0, 300);
            }
          } catch (e) {}
          warnDiv.textContent = warnText;
          // 插入到画布之前
          if (this.canvasContainer && this.canvasContainer.parentNode) {
            this.canvasContainer.parentNode.insertBefore(warnDiv, this.canvasContainer);
          }
        } catch (e) {
          console.warn("[Chemfig-SVG] 显示错误信息失败:", e.message);
        }
      }
    } catch (e) {
      // 编译失败时也显示空画布, 并显示错误信息
      const errorDiv = contentEl.createDiv();
      errorDiv.style.cssText =
        "color:red;margin:8px 16px;padding:8px;background:rgba(239,68,68,0.1);border-radius:4px;font-size:12px;";
      let errorText = "编译失败: " + e.message;
      if (this.compileErrors && this.compileErrors.length > 0) {
        errorText += "\n\n失败组分:\n";
        for (const err of this.compileErrors) {
          errorText += "  - " + (err.name || "组分" + (err.index + 1)) + ": " + err.error + "\n";
          errorText += "    代码: " + err.code.substring(0, 80) + "\n";
        }
      }
      errorDiv.textContent = errorText;
      errorDiv.style.whiteSpace = "pre-wrap";
      this.buildControls();
      this.bindCanvas();
      this.render();
    }
  }

  buildControls() {
    this.ctrlPanel.empty();
    for (let i = 0; i < this.groups.length; i++) {
      const row = this.ctrlPanel.createDiv();
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "6px";
      row.style.padding = "3px 0";
      row.style.borderBottom = "1px solid var(--background-modifier-border)";
      const nameLabel = row.createEl("span", { text: this.groups[i].name });
      nameLabel.style.minWidth = "60px";
      nameLabel.style.fontSize = "12px";
      nameLabel.style.cursor = "pointer";
      nameLabel.onclick = () => {
        this.selectedIndex = i;
        this.render();
      };
      const p = this.layout[i];
      if (!p.scaleX) {
        p.scaleX = p.scale || 1;
        p.scaleY = p.scale || 1;
      }
      if (p.locked === undefined) p.locked = false;
      // 宽百分比
      row.createSpan({ text: "宽:" }).style.fontSize = "11px";
      const wInput = row.createEl("input", {
        type: "number",
        value: Math.round(p.scaleX * 100),
        step: "5",
        min: "10",
        max: "500",
      });
      wInput.style.width = "46px";
      wInput.style.fontSize = "11px";
      wInput.title = "滚轮调节";
      const applyW = () => {
        p.scaleX = Math.max(0.1, Math.min(5, (parseFloat(wInput.value) || 100) / 100));
        if (p.lockAspect && p.aspectRatio) {
          p.scaleY = p.scaleX / p.aspectRatio;
          hInput.value = Math.round(p.scaleY * 100);
        }
        this.render();
      };
      wInput.onchange = applyW;
      wInput.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -5 : 5;
          wInput.value = Math.max(10, Math.min(500, parseInt(wInput.value) + delta));
          applyW();
        },
        { passive: false }
      );
      row.createSpan({ text: "%" }).style.fontSize = "10px";
      // 高百分比
      row.createSpan({ text: "高:" }).style.fontSize = "11px";
      const hInput = row.createEl("input", {
        type: "number",
        value: Math.round(p.scaleY * 100),
        step: "5",
        min: "10",
        max: "500",
      });
      hInput.style.width = "46px";
      hInput.style.fontSize = "11px";
      hInput.title = "滚轮调节";
      const applyH = () => {
        p.scaleY = Math.max(0.1, Math.min(5, (parseFloat(hInput.value) || 100) / 100));
        if (p.lockAspect && p.aspectRatio) {
          p.scaleX = p.scaleY * p.aspectRatio;
          wInput.value = Math.round(p.scaleX * 100);
        }
        this.render();
      };
      hInput.onchange = applyH;
      hInput.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -5 : 5;
          hInput.value = Math.max(10, Math.min(500, parseInt(hInput.value) + delta));
          applyH();
        },
        { passive: false }
      );
      row.createSpan({ text: "%" }).style.fontSize = "10px";
      // 长宽比预设
      const aspectSel = row.createEl("select");
      aspectSel.style.fontSize = "10px";
      aspectSel.style.padding = "1px 2px";
      aspectSel.title = "长宽比预设";
      const aspectOpts = [
        { label: "比例", value: "" },
        { label: "1:1", value: "1" },
        { label: "4:3", value: "1.333" },
        { label: "3:4", value: "0.75" },
        { label: "16:9", value: "1.778" },
        { label: "9:16", value: "0.563" },
        { label: "2:1", value: "2" },
        { label: "1:2", value: "0.5" },
      ];
      for (const ao of aspectOpts) {
        aspectSel.createEl("option", { text: ao.label, value: ao.value });
      }
      aspectSel.onchange = () => {
        if (!aspectSel.value) return;
        const ratio = parseFloat(aspectSel.value);
        // 以当前宽度为基准, 高度 = 宽度 / 比例
        p.scaleY = p.scaleX / ratio;
        aspectSel.value = "";
        this.buildControls();
        this.render();
      };
      // 位置
      row.createSpan({ text: "x:" }).style.fontSize = "11px";
      const xInput = row.createEl("input", { type: "number", value: Math.round(p.x) });
      xInput.style.width = "42px";
      xInput.style.fontSize = "11px";
      xInput.onchange = () => {
        p.x = parseInt(xInput.value) || 0;
        this.render();
      };
      row.createSpan({ text: "y:" }).style.fontSize = "11px";
      const yInput = row.createEl("input", { type: "number", value: Math.round(p.y) });
      yInput.style.width = "42px";
      yInput.style.fontSize = "11px";
      yInput.onchange = () => {
        p.y = parseInt(yInput.value) || 0;
        this.render();
      };
      // 锁定复选框
      const lockWrap = row.createEl("label");
      lockWrap.style.display = "flex";
      lockWrap.style.alignItems = "center";
      lockWrap.style.gap = "3px";
      lockWrap.style.marginLeft = "4px";
      lockWrap.style.cursor = "pointer";
      const lockCheck = lockWrap.createEl("input", { type: "checkbox" });
      lockCheck.checked = p.locked;
      lockCheck.onchange = () => {
        p.locked = lockCheck.checked;
        this.render();
      };
      lockWrap.createSpan({ text: "锁定" }).style.fontSize = "11px";
      // v10.15.x: 真实长宽比锁定 (缩放宽或高时保持 scaleX/scaleY 比例)
      const arWrap = row.createEl("label");
      arWrap.style.display = "flex";
      arWrap.style.alignItems = "center";
      arWrap.style.gap = "3px";
      arWrap.style.marginLeft = "4px";
      arWrap.style.cursor = "pointer";
      const arCheck = arWrap.createEl("input", { type: "checkbox" });
      arCheck.checked = !!p.lockAspect;
      arCheck.title = "锁定长宽比 (缩放宽或高时保持比例)";
      arCheck.onchange = () => {
        p.lockAspect = arCheck.checked;
        if (p.lockAspect) p.aspectRatio = (p.scaleX || 1) / (p.scaleY || 1);
        this.render();
      };
      arWrap.createSpan({ text: "锁比例" }).style.fontSize = "11px";
      // 导入SVG按钮
      const importBtn = row.createEl("button", { text: "导入SVG" });
      importBtn.style.padding = "1px 6px";
      importBtn.style.fontSize = "10px";
      importBtn.style.cursor = "pointer";
      importBtn.style.marginLeft = "4px";
      importBtn.title = "导入外部SVG替换该组分";
      importBtn.onclick = () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".svg,image/svg+xml";
        fileInput.onchange = async (ev) => {
          const file = ev.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = async (e) => {
            let svgText = e.target.result;
            // 确保有 viewBox
            if (!/viewBox=/.test(svgText)) {
              const wm = svgText.match(/width="([\d.]+)/);
              const hm = svgText.match(/height="([\d.]+)/);
              if (wm && hm) {
                svgText = svgText.replace("<svg", `<svg viewBox="0 0 ${wm[1]} ${hm[1]}"`);
              }
            }
            svgText = ensureSvgNamespace(svgText);
            this.groupSvgs[i] = svgText;
            // 预渲染新 SVG 为离屏 Canvas (v10.9.0)
            const newCanvas = await this.svgToOffscreenCanvas(svgText, i);
            this.cachedCanvases[i] = newCanvas;
            this.render();
            new Notice("已导入SVG替换组分: " + (this.groups[i]?.name || "组分" + (i + 1)));
          };
          reader.readAsText(file);
        };
        fileInput.click();
      };
    }
  }

  bindCanvas() {
    const c = this.canvas;
    c.addEventListener("mousedown", (e) => {
      const rect = c.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (c.width / rect.width);
      const my = (e.clientY - rect.top) * (c.height / rect.height);
      // 从上到下检测点击了哪个组分 (后绘制的在上层)
      for (let i = this.cachedCanvases.length - 1; i >= 0; i--) {
        const p = this.layout[i];
        if (!p) continue;
        const offCanvas = this.cachedCanvases[i];
        if (!offCanvas) continue;
        const baseW = offCanvas._origWidth || 100;
        const baseH = offCanvas._origHeight || 60;
        const w = baseW * (p.scaleX || p.scale || 1);
        const h = baseH * (p.scaleY || p.scale || 1);
        if (mx >= p.x && mx <= p.x + w && my >= p.y && my <= p.y + h) {
          this.dragIndex = i;
          this.selectedIndex = i;
          this.dragOffset = { x: mx - p.x, y: my - p.y };
          this.buildControls();
          this.render();
          return;
        }
      }
      this.selectedIndex = -1;
      this.render();
    });
    c.addEventListener("mousemove", (e) => {
      if (this.dragIndex < 0) return;
      const rect = c.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (c.width / rect.width);
      const my = (e.clientY - rect.top) * (c.height / rect.height);
      this.layout[this.dragIndex].x = mx - this.dragOffset.x;
      this.layout[this.dragIndex].y = my - this.dragOffset.y;
      this.render();
    });
    c.addEventListener("mouseup", () => {
      this.dragIndex = -1;
      this.buildControls();
    });
    c.addEventListener("mouseleave", () => {
      this.dragIndex = -1;
    });
    c.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const deltaPct = e.deltaY > 0 ? -5 : 5; // 每次5%
        const targets = [];
        if (this.selectedIndex >= 0) {
          // 选中组分: 只调整该组分
          targets.push(this.selectedIndex);
        } else {
          // 未选中: 调整所有未锁定组分
          for (let i = 0; i < this.layout.length; i++) {
            if (!this.layout[i].locked) targets.push(i);
          }
        }
        for (const idx of targets) {
          const p = this.layout[idx];
          if (!p.scaleX) {
            p.scaleX = p.scale || 1;
            p.scaleY = p.scale || 1;
          }
          const newW = Math.max(10, Math.min(500, Math.round(p.scaleX * 100) + deltaPct));
          const newH = Math.max(10, Math.min(500, Math.round(p.scaleY * 100) + deltaPct));
          p.scaleX = newW / 100;
          p.scaleY = newH / 100;
        }
        this.buildControls();
        this.render();
      },
      { passive: false }
    );
  }

  getViewBox(i) {
    const m = this.groupSvgs[i].match(/viewBox="([^"]+)"/);
    if (m) return m[1].split(/\s+/).map(Number);
    return [0, 0, 100, 60];
  }

  render() {
    const c = this.canvas;
    if (!c) return;
    // v10.9.6: 如果离屏Canvas缓存为空但groupSvgs不为空, 自动重新预渲染
    if (this.cachedCanvases.length === 0 && this.groupSvgs.length > 0) {
      console.warn("[Chemfig-SVG] 离屏Canvas缓存为空, 自动重新预渲染");
      this.preRenderAllCanvases().then(() => this.render());
      return;
    }
    c.width = this.canvasW;
    c.height = this.canvasH;
    const ctx = c.getContext("2d");
    // 背景
    if (this.bgColor === "transparent") {
      const size = 10;
      for (let y = 0; y < c.height; y += size) {
        for (let x = 0; x < c.width; x += size) {
          ctx.fillStyle = (x / size + y / size) % 2 === 0 ? "#fff" : "#ddd";
          ctx.fillRect(x, y, size, size);
        }
      }
    } else {
      ctx.fillStyle = this.bgColor;
      ctx.fillRect(0, 0, c.width, c.height);
    }
    // 网格
    ctx.strokeStyle = "rgba(128,128,128,0.3)";
    ctx.lineWidth = 0.5;
    for (let x = 0; x < c.width; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, c.height);
      ctx.stroke();
    }
    for (let y = 0; y < c.height; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(c.width, y);
      ctx.stroke();
    }

    // 使用缓存的离屏 Canvas 绘制 (v10.9.0 画布修复)
    for (let i = 0; i < this.cachedCanvases.length; i++) {
      const p = this.layout[i] || { x: 30 + i * 150, y: 50, scaleX: 1, scaleY: 1 };
      const offCanvas = this.cachedCanvases[i];
      if (!offCanvas) continue;
      const baseW = offCanvas._origWidth || 100;
      const baseH = offCanvas._origHeight || 60;
      if (!p.scaleX) {
        p.scaleX = p.scale || 1;
        p.scaleY = p.scale || 1;
      }
      const w = baseW * p.scaleX;
      const h = baseH * p.scaleY;
      const px = p.x,
        py = p.y;
      const groupName = this.groups[i]?.name || "组分" + (i + 1);

      // 选中框
      if (i === this.selectedIndex) {
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(px - 2, py - 2, w + 4, h + 4);
        ctx.setLineDash([]);
      }
      // 锁定标识
      if (p.locked) {
        ctx.fillStyle = "rgba(239,68,68,0.85)";
        ctx.font = "bold 11px sans-serif";
        ctx.fillText("🔒", px + w - 14, py + 12);
        ctx.strokeStyle = "rgba(239,68,68,0.5)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.strokeRect(px - 1, py - 1, w + 2, h + 2);
        ctx.setLineDash([]);
      }
      // 直接绘制离屏 Canvas (同步, 无异步问题)
      ctx.drawImage(offCanvas, px, py, w, h);
      // 标签
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.font = "11px sans-serif";
      ctx.fillText(groupName, px, py - 4);
    }
  }

  // 显示增加组件菜单
  showAddComponentMenu(anchorEl) {
    const menu = document.createElement("div");
    menu.style.position = "fixed";
    menu.style.zIndex = "9999";
    menu.style.background = "var(--background-primary)";
    menu.style.border = "1px solid var(--background-modifier-border)";
    menu.style.borderRadius = "6px";
    menu.style.padding = "4px";
    menu.style.boxShadow = "0 4px 12px rgba(0,0,0,0.3)";
    menu.style.minWidth = "180px";
    const rect = anchorEl.getBoundingClientRect();
    menu.style.left = rect.left + "px";
    menu.style.top = rect.bottom + 4 + "px";

    const opt1 = menu.createEl("div", { text: "🔣 添加 chemfig 代码块" });
    opt1.style.padding = "6px 10px";
    opt1.style.cursor = "pointer";
    opt1.style.fontSize = "12px";
    opt1.style.borderRadius = "4px";
    opt1.onmouseenter = () => {
      opt1.style.background = "var(--background-modifier-hover)";
    };
    opt1.onmouseleave = () => {
      opt1.style.background = "transparent";
    };
    opt1.onclick = () => {
      menu.remove();
      this.addComponentByCode("chemfig");
    };

    const opt2 = menu.createEl("div", { text: "🖼️ 粘贴 SVG 代码" });
    opt2.style.padding = "6px 10px";
    opt2.style.cursor = "pointer";
    opt2.style.fontSize = "12px";
    opt2.style.borderRadius = "4px";
    opt2.onmouseenter = () => {
      opt2.style.background = "var(--background-modifier-hover)";
    };
    opt2.onmouseleave = () => {
      opt2.style.background = "transparent";
    };
    opt2.onclick = () => {
      menu.remove();
      this.addComponentByCode("svg");
    };

    document.body.appendChild(menu);
    // 点击外部关闭
    const closeHandler = (e) => {
      if (!menu.contains(e.target)) {
        menu.remove();
        document.removeEventListener("mousedown", closeHandler);
      }
    };
    setTimeout(() => document.addEventListener("mousedown", closeHandler), 0);
  }

  // 通过代码添加新组分
  addComponentByCode(type) {
    const modal = new AddComponentModal(
      this.app,
      this.plugin,
      this.mode,
      type,
      async (name, code) => {
        try {
          let svg;
          if (type === "chemfig") {
            const wrapped = wrapGroupCode(code);
            svg = await this.plugin.compileTikz(this.mode, wrapped);
          } else {
            svg = code;
            if (!/viewBox=/.test(svg)) {
              const wm = svg.match(/width="([\d.]+)/);
              const hm = svg.match(/height="([\d.]+)/);
              if (wm && hm) svg = svg.replace("<svg", `<svg viewBox="0 0 ${wm[1]} ${hm[1]}"`);
            }
            svg = ensureSvgNamespace(svg);
          }
          // 添加为新组分
          const idx = this.groups.length;
          this.groups.push({
            name,
            code: type === "chemfig" ? code : "% SVG_PASTE",
            type: type === "svg" ? "imported" : "custom",
            offsetY: 0,
            importedSvg: type === "svg" ? svg : null,
          });
          this.groupSvgs.push(svg);
          // 预渲染新组分为离屏 Canvas (v10.9.0)
          const newCanvas = await this.svgToOffscreenCanvas(svg, idx);
          this.cachedCanvases.push(newCanvas);
          // 计算新组分位置 (放在最后)
          const vb = this.getViewBox(idx);
          const lastP = this.layout[this.layout.length - 1];
          let newX = 30;
          if (lastP) {
            const lastVb = this.getViewBox(idx - 1);
            newX = lastP.x + lastVb[2] * (lastP.scaleX || 1) + 12;
          }
          const baselineY = this.canvasH / 2;
          this.layout.push({
            x: newX,
            y: Math.max(10, baselineY - vb[3] / 2),
            scaleX: 1.0,
            scaleY: 1.0,
            locked: false,
          });
          // 扩展画布
          if (newX + vb[2] + 20 > this.canvasW) {
            this.canvasW = Math.ceil(newX + vb[2] + 30);
            this.canvas.width = this.canvasW;
            this.canvas.style.width = this.canvasW + "px";
            this.wInput.value = this.canvasW;
          }
          this.buildControls();
          this.render();
          new Notice("已添加组分: " + name);
        } catch (e) {
          new Notice("添加失败: " + e.message);
        }
      }
    );
    modal.open();
  }

  // ===== SVG 预渲染为离屏 Canvas (v10.9.0 画布修复) =====
  // 将 SVG 字符串渲染为离屏 Canvas 并缓存, 避免异步 Image 加载导致的画布空白
  async svgToOffscreenCanvas(svgText, index) {
    return new Promise((resolve) => {
      let svg = String(svgText || "").trim();
      // 去掉 XML 声明 / DOCTYPE, 浏览器 <img> 光栅化 SVG 时这些可能导致加载失败
      svg = svg.replace(/^\s*<\?xml[^>]*\?>/i, "").replace(/^\s*<!DOCTYPE[^>]*>/i, "");
      // 确保 SVG 有正确的 XML 命名空间
      if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) {
        svg = svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
      }
      // 解析 viewBox 获取尺寸
      const vbMatch = svg.match(/viewBox="([^"]+)"/);
      const vb = vbMatch ? vbMatch[1].split(/\s+/).map(Number) : [0, 0, 200, 100];
      const w = Math.max(1, Math.ceil(vb[2] || 200));
      const h = Math.max(1, Math.ceil(vb[3] || 100));
      // 若首标签缺 width/height, 注入 viewBox 尺寸, 保证 <img> 可靠光栅化
      const openTagMatch = svg.match(/<svg[^>]*>/i);
      if (openTagMatch && !/width=/i.test(openTagMatch[0])) {
        svg = svg.replace(/<svg/i, '<svg width="' + w + '" height="' + h + '"');
      }

      const img = new Image();
      let settled = false;
      const finish = (offCanvas) => {
        if (settled) return;
        settled = true;
        resolve(offCanvas);
      };

      img.onload = () => {
        // 创建离屏 Canvas, 使用 2x 分辨率保证清晰度
        const scale = 2;
        const offCanvas = document.createElement("canvas");
        offCanvas.width = w * scale;
        offCanvas.height = h * scale;
        const offCtx = offCanvas.getContext("2d");
        offCtx.scale(scale, scale);
        try {
          offCtx.drawImage(img, 0, 0, w, h);
        } catch (e) {
          console.warn("[Chemfig-SVG] drawImage 失败:", e.message);
        }
        // 存储原始尺寸信息
        offCanvas._origWidth = w;
        offCanvas._origHeight = h;
        finish(offCanvas);
      };
      img.onerror = () => {
        console.warn("[Chemfig-SVG] SVG 渲染失败, 使用占位 Canvas:", index);
        finish(this.makeOffscreenPlaceholder(index));
      };
      // 超时兜底: onload/onerror 均未触发时不挂死预渲染
      setTimeout(() => {
        if (!settled) {
          console.warn("[Chemfig-SVG] SVG 光栅化超时, 使用占位:", index);
          finish(this.makeOffscreenPlaceholder(index));
        }
      }, 5000);

      // 用 data URL (比 blob URL 更稳) 加载
      img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    });
  }

  makeOffscreenPlaceholder(index) {
    const offCanvas = document.createElement("canvas");
    offCanvas.width = 120;
    offCanvas.height = 60;
    const offCtx = offCanvas.getContext("2d");
    offCtx.fillStyle = "#fee2e2";
    offCtx.fillRect(0, 0, 120, 60);
    offCtx.strokeStyle = "#ef4444";
    offCtx.strokeRect(0, 0, 120, 60);
    offCtx.fillStyle = "#991b1b";
    offCtx.font = "10px sans-serif";
    offCtx.textAlign = "center";
    offCtx.fillText("渲染失败", 60, 25);
    offCtx.fillText("组分" + (index + 1), 60, 42);
    offCanvas._origWidth = 120;
    offCanvas._origHeight = 60;
    return offCanvas;
  }

  // 预渲染所有组分为离屏 Canvas
  async preRenderAllCanvases() {
    this.cachedCanvases = [];
    for (let i = 0; i < this.groupSvgs.length; i++) {
      const canvas = await this.svgToOffscreenCanvas(this.groupSvgs[i], i);
      this.cachedCanvases.push(canvas);
    }
    console.log("[Chemfig-SVG] 预渲染完成:", this.cachedCanvases.length, "个组分");
  }

  // ===== Excalidraw 深度集成 (v10.6.0) =====

  // 切换 Excalidraw 模式
  async toggleExcalidrawMode() {
    this.useExcalidraw = !this.useExcalidraw;
    this.updateExcalidrawButton();

    if (this.useExcalidraw) {
      // 切换到 Excalidraw 模式
      this.canvasContainer.style.display = "none";
      this.excalidrawContainer.style.display = "block";
      await this.initExcalidraw();
    } else {
      // 切换回 Canvas 模式
      if (this.excalidrawCanvas) {
        // 从 Excalidraw 同步布局到 Canvas
        try {
          this.syncFromExcalidraw();
          await this.excalidrawCanvas.destroy();
        } catch (e) {
          console.warn("[Chemfig-SVG] 销毁 Excalidraw 失败:", e.message);
        }
        this.excalidrawCanvas = null;
      }
      this.excalidrawContainer.style.display = "none";
      this.canvasContainer.style.display = "block";
      this.render();
    }
  }

  // 初始化 Excalidraw 画布
  async initExcalidraw() {
    if (typeof ExcalidrawCanvas === "undefined") {
      new Notice("Excalidraw 集成模块未加载", 3000);
      this.useExcalidraw = false;
      this.updateExcalidrawButton();
      this.canvasContainer.style.display = "block";
      this.excalidrawContainer.style.display = "none";
      this.render();
      return;
    }

    this.excalidrawContainer.empty();
    // 确保容器有背景和高度
    this.excalidrawContainer.style.background =
      this.bgColor === "transparent" ? "#ffffff" : this.bgColor;
    this.excalidrawCanvas = new ExcalidrawCanvas(this.excalidrawContainer, this.plugin, {
      onChange: (elements) => this.onExcalidrawChange(elements),
    });

    const success = await this.excalidrawCanvas.init();
    if (!success) {
      new Notice("Excalidraw 初始化失败, 已返回 Canvas 模式", 3000);
      this.useExcalidraw = false;
      this.updateExcalidrawButton();
      this.canvasContainer.style.display = "block";
      this.excalidrawContainer.style.display = "none";
      this.render();
      return;
    }

    // 将当前组分加载到 Excalidraw
    new Notice("正在加载组分到 Excalidraw...", 2000);
    for (let i = 0; i < this.groupSvgs.length; i++) {
      const p = this.layout[i] || { x: 30 + i * 150, y: 50, scaleX: 1, scaleY: 1 };
      const vb = this.getViewBox(i);
      const sx = p.scaleX || p.scale || 1;
      const sy = p.scaleY || p.scale || 1;
      try {
        await this.excalidrawCanvas.addComponent(
          this.groupSvgs[i],
          p.x,
          p.y,
          vb[2] * sx,
          vb[3] * sy,
          this.groups[i]?.name || "组分" + (i + 1)
        );
      } catch (e) {
        console.warn("[Chemfig-SVG] 加载组分 " + i + " 到 Excalidraw 失败:", e.message);
      }
    }
    new Notice("已加载 " + this.groupSvgs.length + " 个组分到 Excalidraw", 2000);
  }

  // 更新 Excalidraw 模式按钮文本
  updateExcalidrawButton() {
    const btn = document.getElementById("excalidraw-mode-btn");
    if (btn) {
      btn.textContent = this.useExcalidraw ? "↩️ 返回Canvas模式" : "🎨 Excalidraw模式";
      btn.style.background = this.useExcalidraw
        ? "var(--interactive-accent)"
        : "var(--interactive-normal)";
      btn.style.color = this.useExcalidraw ? "white" : "";
    }
  }

  // v10.15.12: 切换画布模式
  async switchCanvasMode() {
    const mode = this.canvasMode;
    console.log("[Chemfig-SVG] 切换画布模式:", mode);

    // 先销毁现有 Excalidraw
    if (this.excalidrawCanvas) {
      try {
        await this.excalidrawCanvas.destroy();
      } catch (e) {}
      this.excalidrawCanvas = null;
    }

    if (mode === "canvas2d") {
      // Canvas 2D 自绘模式
      this.useExcalidraw = false;
      this.excalidrawContainer.style.display = "none";
      this.canvasContainer.style.display = "block";
      this.render();
      new Notice("已切换到 Canvas 2D 模式", 1500);
    } else if (mode === "excalidraw-temp") {
      // Excalidraw 临时文件模式
      if (!this.excalidrawAvailable) {
        new Notice("Excalidraw 插件未安装", 3000);
        this.canvasMode = "canvas2d";
        if (this.canvasModeSelect) this.canvasModeSelect.value = "canvas2d";
        return;
      }
      await this.initExcalidraw();
      new Notice("已切换到 Excalidraw 临时文件模式", 1500);
    } else if (mode === "excalidraw-embedded") {
      // Excalidraw 嵌入式模式
      if (!this.excalidrawAvailable) {
        new Notice("Excalidraw 插件未安装", 3000);
        this.canvasMode = "canvas2d";
        if (this.canvasModeSelect) this.canvasModeSelect.value = "canvas2d";
        return;
      }
      await this.initExcalidraw();
      new Notice("已切换到 Excalidraw 嵌入式模式", 1500);
    }

    this.updateExcalidrawButton();
  }

  // Excalidraw 变化回调
  onExcalidrawChange(elements) {
    // 实时同步布局信息 (可选)
    // console.log("[Chemfig-SVG] Excalidraw changed:", elements.length, "elements");
  }

  // 从 Excalidraw 同步布局到 Canvas
  syncFromExcalidraw() {
    if (!this.excalidrawCanvas) return;
    const layout = this.excalidrawCanvas.getLayout();
    for (let i = 0; i < layout.length && i < this.layout.length; i++) {
      const el = layout[i];
      const vb = this.getViewBox(i);
      const baseW = vb[2],
        baseH = vb[3];
      // 计算缩放比例
      this.layout[i].x = el.x;
      this.layout[i].y = el.y;
      this.layout[i].scaleX = baseW > 0 ? el.width / baseW : 1;
      this.layout[i].scaleY = baseH > 0 ? el.height / baseH : 1;
    }
    this.buildControls();
  }

  doSave() {
    // Excalidraw 模式: 先从 Excalidraw 同步布局
    if (this.useExcalidraw && this.excalidrawCanvas) {
      this.syncFromExcalidraw();
    }
    // 计算内容边界并居中到画布
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (let i = 0; i < this.groupSvgs.length; i++) {
      const p = this.layout[i];
      const vb = this.getViewBox(i);
      const sx = p.scaleX || p.scale || 1;
      const sy = p.scaleY || p.scale || 1;
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + vb[2] * sx);
      maxY = Math.max(maxY, p.y + vb[3] * sy);
    }
    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const offsetX = (this.canvasW - contentW) / 2 - minX;
    const offsetY = (this.canvasH - contentH) / 2 - minY;
    // 应用居中偏移
    for (const p of this.layout) {
      p.x += offsetX;
      p.y += offsetY;
    }
    const merged = mergeSvgs(this.groupSvgs, this.layout, this.canvasW, this.canvasH, this.bgColor);
    this.onSave(merged, this.layout, this.bgColor);
    this.close();
  }

  // 导出到 Excalidraw: 将各组分作为 image 元素创建 .excalidraw 文件
  async exportToExcalidraw() {
    try {
      new Notice("正在导出到 Excalidraw...", 2000);
      const elements = [];
      const files = {};
      let seed = 1;
      for (let i = 0; i < this.groupSvgs.length; i++) {
        const svgText = this.groupSvgs[i];
        // 跳过编译失败的占位符 SVG
        if (svgText.includes("编译失败") || svgText.includes("placeholder")) {
          console.warn("[Chemfig-SVG] 跳过编译失败的组分 " + i);
          continue;
        }
        const p = this.layout[i] || { x: 30 + i * 150, y: 50, scaleX: 1, scaleY: 1 };
        const vb = this.getViewBox(i);
        const sx = p.scaleX || p.scale || 1;
        const sy = p.scaleY || p.scale || 1;
        const w = vb[2] * sx;
        const h = vb[3] * sy;
        // SVG 转 data URL (FileReader, 避免 Buffer 在渲染进程不可用)
        const dataURL = await svgToDataURL(svgText);
        const fileId = "chemfig_" + i + "_" + Date.now();
        files[fileId] = {
          mimeType: "image/svg+xml",
          id: fileId,
          dataURL: dataURL,
          created: Date.now(),
          lastRetrieved: Date.now(),
        };
        const id = "el_" + i + "_" + Math.random().toString(36).substr(2, 9);
        elements.push({
          id: id,
          type: "image",
          x: p.x,
          y: p.y,
          width: w,
          height: h,
          angle: 0,
          strokeColor: "transparent",
          backgroundColor: "transparent",
          fillStyle: "solid",
          strokeWidth: 1,
          strokeStyle: "solid",
          roughness: 0,
          opacity: 100,
          groupIds: [],
          frameId: null,
          roundness: null,
          seed: seed++,
          version: 1,
          versionNonce: Math.floor(Math.random() * 1000000),
          isDeleted: false,
          boundElements: null,
          updated: Date.now(),
          link: null,
          locked: false,
          status: "saved",
          fileId: fileId,
        });
      }
      // Excalidraw 文件格式
      const excalidrawData = {
        type: "excalidraw",
        version: 2,
        source: "miktex-chemfig-svg-render",
        elements: elements,
        appState: {
          viewBackgroundColor: this.bgColor === "transparent" ? "#ffffff" : this.bgColor,
          gridSize: null,
        },
        files: files,
      };
      // 保存文件 (使用当前笔记所在目录)
      // v10.9.7: 使用新版 .excalidraw.md 格式 (Excalidraw插件推荐格式)
      const fileName = "chemfig_layout_" + Date.now() + ".excalidraw.md";
      let dirPath = "";
      try {
        const activeFile = this.plugin.app.workspace.getActiveFile();
        if (activeFile) {
          dirPath = activeFile.parent ? activeFile.parent.path + "/" : "";
        }
      } catch (e) {
        dirPath = "";
      }
      const filePath = dirPath + fileName;
      // 新版 Excalidraw Markdown 格式
      const mdContent = `---
excalidraw-plugin: parsed
tags: [excalidraw]
---
==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==


# Text Elements


%%
# Drawing
\`\`\`json
${JSON.stringify(excalidrawData, null, 2)}
\`\`\`
%%`;
      await this.plugin.app.vault.create(filePath, mdContent);
      new Notice("已导出到 Excalidraw: " + fileName, 3000);
      // 打开文件
      this.excalidrawExportPath = filePath; // v10.15.x: 记录导出路径, 供读回布局
      if (this.plugin) this.plugin.lastExcalidrawExportPath = filePath; // 跨模态框会话保留 (Modal 关闭后再次打开仍可读回)
      const file = this.plugin.app.vault.getFileByPath(filePath);
      if (file) {
        await this.plugin.app.workspace.openLinkText(filePath, "", true);
      }
      this.close();
    } catch (e) {
      new Notice("导出 Excalidraw 失败: " + e.message, 4000);
      console.error("[Chemfig-SVG] Excalidraw export error:", e);
    }
  }

  // v10.15.x: 从导出的 .excalidraw.md 读回组分布局 (Excalidraw → Canvas 双向同步)
  async importFromExcalidraw() {
    try {
      let exportPath =
        this.excalidrawExportPath || (this.plugin && this.plugin.lastExcalidrawExportPath) || null;
      if (!exportPath) exportPath = this._findLatestExcalidrawExport();
      if (!exportPath) {
        new Notice("未找到导出的 Excalidraw 文件，请先『导出到 Excalidraw』", 3000);
        return;
      }
      const file = this.plugin.app.vault.getFileByPath(exportPath);
      if (!file) {
        new Notice("找不到导出的 .excalidraw.md 文件: " + exportPath, 3000);
        return;
      }
      const mdText = await this.plugin.app.vault.read(file);
      const parsed = typeof parseExcalidrawFile === "function" ? parseExcalidrawFile(mdText) : null;
      if (!parsed || !Array.isArray(parsed.elements)) {
        new Notice("无法解析 Excalidraw 文件中的绘图数据", 3000);
        return;
      }
      const images = parsed.elements.filter((el) => el && el.type === "image" && !el.isDeleted);
      if (images.length === 0) {
        new Notice("Excalidraw 中无可读回的组分图像", 3000);
        return;
      }
      let synced = 0;
      for (let i = 0; i < this.layout.length && i < images.length; i++) {
        const el = images[i];
        const vb = this.getViewBox(i);
        if (typeof el.x === "number") this.layout[i].x = Math.round(el.x);
        if (typeof el.y === "number") this.layout[i].y = Math.round(el.y);
        if (vb && vb[2] > 0 && typeof el.width === "number")
          this.layout[i].scaleX = el.width / vb[2];
        if (vb && vb[3] > 0 && typeof el.height === "number")
          this.layout[i].scaleY = el.height / vb[3];
        this.layout[i].locked = !!el.locked;
        synced++;
      }
      this.buildControls();
      this.render();
      new Notice("已从 Excalidraw 读回 " + synced + " 个组分的布局", 3000);
    } catch (e) {
      new Notice("读回 Excalidraw 布局失败: " + e.message, 4000);
      console.error("[Chemfig-SVG] importFromExcalidraw error:", e);
    }
  }

  // v10.15.x: 兜底 — 在活动笔记目录下查找最新导出的 chemfig_layout_*.excalidraw.md
  _findLatestExcalidrawExport() {
    try {
      const activeFile = this.plugin.app.workspace.getActiveFile();
      const dir = activeFile && activeFile.parent ? activeFile.parent.path : "";
      const all = this.plugin.app.vault.getFiles();
      const candidates = all
        .filter((f) => f.name.startsWith("chemfig_layout_") && f.name.endsWith(".excalidraw.md"))
        .filter((f) => !dir || (f.parent && f.parent.path === dir))
        .sort((a, b) => b.name.localeCompare(a.name));
      return candidates.length ? candidates[0].path : null;
    } catch (e) {
      return null;
    }
  }

  async onClose() {
    // 清理 Excalidraw 资源
    if (this.excalidrawCanvas) {
      try {
        await this.excalidrawCanvas.destroy();
      } catch (e) {
        // 忽略清理错误
      }
      this.excalidrawCanvas = null;
    }
    this.contentEl.empty();
  }
}
