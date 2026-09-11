// Excalidraw 深度集成模块
// 功能: 在组分调整窗口中嵌入 Excalidraw 画布, 实现双向同步

const EXCALIDRAW_PLUGIN_ID = "obsidian-excalidraw-plugin";

// 检测 Excalidraw 插件是否安装并启用
function isExcalidrawAvailable(app) {
  return !!(app.plugins && app.plugins.plugins && app.plugins.plugins[EXCALIDRAW_PLUGIN_ID]);
}

// 获取 Excalidraw 插件实例
function getExcalidrawPlugin(app) {
  return app.plugins.plugins[EXCALIDRAW_PLUGIN_ID] || null;
}

// 获取 Excalidraw API (如果存在)
function getExcalidrawAPI(app) {
  const plugin = getExcalidrawPlugin(app);
  if (!plugin) return null;
  try {
    if (typeof plugin.getAPI === "function") {
      return plugin.getAPI();
    }
  } catch (e) {
    console.warn("[Chemfig-SVG] Excalidraw getAPI failed:", e);
  }
  return null;
}

// 获取 Excalidraw Automate 脚本引擎实例 (真实深度集成的官方入口)。
// 注意: 该 API 主要面向 Excalidraw 脚本引擎; 第三方插件侧通过 window 全局或 plugin.api 探测。
function getExcalidrawAutomate(app) {
  try {
    if (typeof window !== "undefined" && window.ExcalidrawAutomate) {
      return window.ExcalidrawAutomate;
    }
  } catch (e) {
    /* window 不可用时忽略 */
  }
  const plugin = getExcalidrawPlugin(app);
  if (!plugin) return null;
  try {
    if (plugin.api && typeof plugin.api.addElements === "function") return plugin.api;
    if (typeof plugin.getAPI === "function") {
      const api = plugin.getAPI();
      if (api && typeof api.addElements === "function") return api;
    }
  } catch (e) {
    /* ignore */
  }
  return null;
}

// 将 SVG 文本转换为 data URL (供 Excalidraw image 元素使用)
// 不用 Buffer (渲染进程 contextIsolation 下 Buffer 可能不可用, 是「编译失败」的根因),
// 改用 FileReader.readAsDataURL 可靠转换, 兼容中文/unicode 内容。
function svgToDataURL(svgText) {
  return new Promise((resolve, reject) => {
    let svg = String(svgText || "").trim();
    if (!svg.includes('xmlns="http://www.w3.org/2000/svg"')) {
      svg = svg.replace(/<svg/i, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(e || new Error("FileReader 转换 SVG 失败"));
    reader.readAsDataURL(blob);
  });
}

// 创建 Excalidraw 集成画布
// 在指定容器中嵌入 Excalidraw 编辑界面
class ExcalidrawCanvas {
  constructor(container, plugin, options = {}) {
    this.container = container;
    this.plugin = plugin;
    this.app = plugin.app;
    this.options = options;
    this.excalidrawPlugin = getExcalidrawPlugin(this.app);
    this.api = getExcalidrawAPI(this.app);
    this.elements = [];
    this.files = {};
    this.onChange = options.onChange || (() => {});
    this.initialized = false;
    this.tempFile = null;
  }

  // 初始化: 创建临时 Excalidraw 文件并打开独立视图
  async init() {
    if (!this.excalidrawPlugin) {
      this.showFallback("Excalidraw 插件未安装");
      return false;
    }

    try {
      // v10.15.14: 改用独立视图方式 (不再尝试嵌入式 API)
      return await this.openAsStandaloneView();
    } catch (e) {
      console.error("[Chemfig-SVG] Excalidraw init failed:", e);
      this.showFallback(e.message);
      return false;
    }
  }

  // v10.15.14: 打开独立 Excalidraw 视图
  async openAsStandaloneView() {
    // 创建临时 Excalidraw 数据
    const data = {
      type: "excalidraw",
      version: 2,
      source: "miktex-chemfig-svg-render",
      elements: this.elements,
      appState: {
        viewBackgroundColor: "#ffffff",
        gridSize: null,
      },
      files: this.files,
    };

    // 创建临时文件路径
    const activeFile =
      this.app.workspace && typeof this.app.workspace.getActiveFile === "function"
        ? this.app.workspace.getActiveFile()
        : null;
    const basePath = activeFile ? activeFile.path : "chemfig-temp";
    const tempPath =
      basePath.replace(/[^/\\]+\.md$/, "") + ".chemfig_excalidraw_temp.excalidraw.md";

    try {
      // 如果文件已存在, 删除
      const existing = this.app.vault.getFileByPath(tempPath);
      if (existing) await this.app.vault.delete(existing);

      // 创建新文件
      this.tempFile = await this.app.vault.create(tempPath, JSON.stringify(data, null, 2));

      // 在当前标签页打开 Excalidraw 文件
      // workspace.activeLeaf 已废弃且在无活动标签页时为 null, 直接 .openFile 会抛
      // TypeError 并被下面的 catch 吞成「无法打开视图」。改用现行的 getLeaf()。
      const ws = this.app.workspace;
      const leaf =
        typeof ws.getLeaf === "function" ? ws.getLeaf(false) : ws.activeLeaf;
      if (!leaf) throw new Error("无法获取工作区标签页");
      await leaf.openFile(this.tempFile);

      this.initialized = true;
      this.standaloneMode = true;

      // 提示用户
      new Notice("已在新标签页打开 Excalidraw 视图", 3000);

      return true;
    } catch (e) {
      console.error("[Chemfig-SVG] Failed to open Excalidraw view:", e);
      this.showFallback("无法打开 Excalidraw 视图: " + e.message);
      return false;
    }
  }

  // 显示降级界面 (当 Excalidraw 不可用时)
  showFallback(message) {
    this.container.empty();
    const fallback = document.createElement("div");
    fallback.style.cssText = "padding:20px;text-align:center;color:var(--text-muted);";
    fallback.innerHTML = `
      <div style="font-size:32px;margin-bottom:10px;">🎨</div>
      <div style="font-weight:600;margin-bottom:8px;">Excalidraw 深度集成</div>
      <div style="font-size:12px;">${message || "正在加载 Excalidraw 画布..."}</div>
      <div style="font-size:11px;margin-top:8px;color:var(--text-faint);">
        提示: 确保已安装并启用 Excalidraw 插件
      </div>
    `;
    this.container.appendChild(fallback);
  }

  // 添加组分 (SVG 转 image 元素)
  async addComponent(svgText, x, y, width, height, name = "") {
    // SVG 转 data URL (FileReader, 避免 Buffer 在渲染进程不可用导致编译失败)
    const dataURL = await svgToDataURL(svgText);
    const fileId = "comp_" + Date.now() + "_" + Math.random().toString(36).substr(2, 6);
    this.files[fileId] = {
      mimeType: "image/svg+xml",
      id: fileId,
      dataURL: dataURL,
      created: Date.now(),
      lastRetrieved: Date.now(),
    };

    const element = {
      id: "el_" + fileId,
      type: "image",
      x: x,
      y: y,
      width: width,
      height: height,
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
      seed: Math.floor(Math.random() * 1000000),
      version: 1,
      versionNonce: Math.floor(Math.random() * 1000000),
      isDeleted: false,
      boundElements: null,
      updated: Date.now(),
      link: null,
      locked: false,
      status: "saved",
      fileId: fileId,
      // 自定义属性: 组分名称
      customData: { chemfigName: name },
    };
    this.elements.push(element);
    this.updateView();
    return element;
  }

  // 更新视图 (移动 / 增删组分后同步回 Excalidraw 画布)
  updateView() {
    if (this.view) {
      try {
        // 兼容 Excalidraw API 不同版本的方法名
        if (typeof this.view.setElements === "function") {
          this.view.setElements(this.elements);
          return;
        }
        if (typeof this.view.updateScene === "function") {
          this.view.updateScene({ elements: this.elements, files: this.files });
          return;
        }
      } catch (e) {
        console.warn("[Chemfig-SVG] Excalidraw updateView:", e.message);
      }
    }
    if (this.iframe && this.iframe.contentWindow) {
      this.iframe.contentWindow.postMessage(
        {
          type: "excalidraw-update",
          elements: this.elements,
          files: this.files,
        },
        "*"
      );
      return;
    }
    // v10.15.14 起改用「独立视图」架构: 不再有嵌入式 view / iframe 句柄,
    // 正确的同步方式是把最新 elements/files 写回本插件自己创建的临时 .excalidraw.md。
    // 此前这里只判断 this.iframe (该架构下从未被赋值), 于是 addComponent 之后
    // 组分虽被 push 进 this.elements, 却永远不会出现在画布上 —— 且无任何日志。
    if (this.standaloneMode && this.tempFile) {
      const data = {
        type: "excalidraw",
        version: 2,
        source: "miktex-chemfig-svg-render",
        elements: this.elements,
        appState: { viewBackgroundColor: "#ffffff", gridSize: null },
        files: this.files,
      };
      // 不 await: 调用方 (addComponent) 是同步语义; 用 catch 避免 unhandled rejection
      Promise.resolve(this.app.vault.modify(this.tempFile, JSON.stringify(data, null, 2))).catch(
        (e) => console.warn("[Chemfig-SVG] Excalidraw updateView 写回临时文件失败:", e.message)
      );
      return;
    }
    console.warn(
      "[Chemfig-SVG] Excalidraw updateView: 无可用同步通道 (view / iframe / tempFile 均未就绪)"
    );
  }

  // 获取所有组分的布局
  getLayout() {
    return this.elements
      .filter((el) => el.type === "image" && !el.isDeleted)
      .map((el) => ({
        id: el.id,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        name: el.customData?.chemfigName || "",
        fileId: el.fileId,
      }));
  }

  // 导出为 SVG (合并所有元素)
  async exportSVG() {
    if (this.view && typeof this.view.exportSVG === "function") {
      return await this.view.exportSVG();
    }
    // 降级: 独立视图模式下无嵌入式句柄, 明确返回 null 并记录原因
    // (此前静默返回 null, 调用方无法区分「导出为空」与「功能不可用」)
    console.warn("[Chemfig-SVG] Excalidraw exportSVG: 当前模式不支持导出 (无 view 句柄)");
    return null;
  }

  // 清理
  async destroy() {
    // 删除临时文件
    if (this.tempFile) {
      try {
        await this.app.vault.delete(this.tempFile);
      } catch (e) {
        // 忽略删除错误
      }
    }
    this.container.empty();
  }
}

// 从 .excalidraw.md 文本中解析 drawing JSON (elements/files/appState)
function parseExcalidrawFile(mdText) {
  if (!mdText) return null;
  // 提取 ```json ... ``` 代码块 (新版 .excalidraw.md 的 drawing 数据)
  const m = String(mdText).match(/```json\s*\n([\s\S]*?)\n```/);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch (e) {
    console.warn("[Chemfig-SVG] parseExcalidrawFile JSON 解析失败:", e.message);
    return null;
  }
}

// 从 Excalidraw 元素提取组分布局
function extractLayoutFromExcalidraw(elements) {
  return elements
    .filter((el) => el.type === "image" && !el.isDeleted)
    .map((el) => ({
      x: el.x,
      y: el.y,
      scaleX: 1.0,
      scaleY: 1.0,
      locked: el.locked || false,
      name: el.customData?.chemfigName || "组分",
    }));
}

// 注意: 本插件由 build.js 把所有 .ts 逐文件转译后「拼接进同一个 CJS 作用域」,
// 顶层 function / class 跨文件直接可见, 无需也不应再写 module.exports。
// 此前这里有一段 `module.exports = { ExcalidrawCanvas, ... }`, 它对本模块毫无作用
// (没有任何文件 require 它), 却会在拼接顺序中「临时覆盖」module.exports ——
// 插件最终能正确导出 ChemfigSvgPlugin 仅仅因为 main.ts 恰好排在 FILES 顺序最后。
// 一旦有人调整顺序或在其后新增带 module.exports 的文件, 插件会静默加载失败。
