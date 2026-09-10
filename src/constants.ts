// ========== constants.js - 工具类与正则常量 (核心逻辑已拆分到 core/) ==========

const {
  Plugin,
  Notice,
  Modal,
  Menu,
  FuzzySuggestModal,
  Setting,
  PluginSettingTab,
  ItemView,
  WorkspaceLeaf,
  requestUrl,
} = require("obsidian");

const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

// 正则常量
const TIKZ_BLOCK_REG = /```(chem|tikz|miktex|ce)\s*\n([\s\S]*?)\n```/g;
const NAME_REG_STRICT = /^\s*%%\s*name\s*:\s*([\w-]+)\s*$/m;
const NAME_REG_LEGACY = /^\s*%\s*NAME\s*:\s*(.+?)\s*$/m;

function getCm6Modules() {
  if (_cm6Modules) return _cm6Modules;
  try {
    const cmView = require("@codemirror/view");
    const cmState = require("@codemirror/state");
    _cm6Modules = {
      EditorView: cmView.EditorView,
      WidgetType: cmView.WidgetType,
      ViewPlugin: cmView.ViewPlugin,
      Decoration: cmView.Decoration,
      RangeSetBuilder: cmState.RangeSetBuilder,
    };
    return _cm6Modules;
  } catch (e) {
    console.warn("[Chemfig-SVG] CM6 模块不可用:", e.message);
    return null;
  }
}

class PerfMonitor {
  constructor(enabled = false) {
    this.enabled = enabled;
    this.metrics = new Map();
    this.startTimes = new Map();
  }

  start(label) {
    if (!this.enabled) return;
    this.startTimes.set(label, performance.now());
  }

  end(label) {
    if (!this.enabled) return;
    const start = this.startTimes.get(label);
    if (start === undefined) return;
    const duration = performance.now() - start;
    const existing = this.metrics.get(label) || { count: 0, total: 0, max: 0 };
    existing.count++;
    existing.total += duration;
    existing.max = Math.max(existing.max, duration);
    this.metrics.set(label, existing);
    this.startTimes.delete(label);
    if (duration > 100) {
      console.warn(`[Perf] ${label}: ${duration.toFixed(1)}ms (慢操作)`);
    }
  }

  getReport() {
    const report = [];
    for (const [label, m] of this.metrics) {
      report.push({
        label,
        count: m.count,
        avg: (m.total / m.count).toFixed(2),
        max: m.max.toFixed(2),
        total: m.total.toFixed(2),
      });
    }
    return report;
  }

  reset() {
    this.metrics.clear();
    this.startTimes.clear();
  }
}

// 全局性能监控实例 (默认关闭, 可通过设置开启)

const perf = new PerfMonitor(false);

// ========== 虚拟滚动列表 (学习自 obsidian-dataview, 用于大量模板渲染) ==========

class VirtualList {
  constructor(container, options = {}) {
    this.container = container;
    this.itemHeight = options.itemHeight || 36;
    this.buffer = options.buffer || 5;
    this.items = [];
    this.renderItem = options.renderItem || (() => document.createElement("div"));
    this._scrollHandler = null;
    this._spacer = null;
    this._content = null;
    this._savedScrollTop = 0; // v10.15.13: 保存滚动位置
    this._init();
  }

  _init() {
    this.container.style.position = "relative";
    this.container.style.overflow = "auto";
    // 清除现有内容
    this.container.empty();
    // 创建 spacer (模拟完整高度)
    this._spacer = document.createElement("div");
    this._spacer.style.position = "relative";
    this._spacer.style.width = "100%";
    this.container.appendChild(this._spacer);
    // 创建 content (可见区域内容)
    this._content = document.createElement("div");
    this._content.style.position = "absolute";
    this._content.style.top = "0";
    this._content.style.left = "0";
    this._content.style.width = "100%";
    this._spacer.appendChild(this._content);
    // 滚动监听
    this._scrollHandler = UI.throttle(() => this._render(), 16);
    this.container.addEventListener("scroll", this._scrollHandler);
  }

  setItems(items, preserveScroll = false) {
    this.items = items;
    this._spacer.style.height = `${items.length * this.itemHeight}px`;

    // v10.15.13: 滚动位置保持
    if (preserveScroll && this._savedScrollTop > 0) {
      this.container.scrollTop = this._savedScrollTop;
    } else {
      this.container.scrollTop = 0;
    }

    this._render();
  }

  // v10.15.13: 保存当前滚动位置
  saveScrollPosition() {
    this._savedScrollTop = this.container.scrollTop;
  }

  // v10.15.13: 滚动到指定索引
  scrollToIndex(index, smooth = false) {
    if (index < 0 || index >= this.items.length) return;
    const targetScrollTop = index * this.itemHeight;
    if (smooth) {
      this.container.scrollTo({ top: targetScrollTop, behavior: "smooth" });
    } else {
      this.container.scrollTop = targetScrollTop;
    }
  }

  // v10.15.13: 滚动到指定 key（通过 item 匹配）
  scrollToKey(key, keyFn = (item) => item) {
    for (let i = 0; i < this.items.length; i++) {
      if (keyFn(this.items[i]) === key) {
        this.scrollToIndex(i, true);
        return i;
      }
    }
    return -1;
  }

  _render() {
    const scrollTop = this.container.scrollTop;
    const containerHeight = this.container.clientHeight;
    const startIdx = Math.max(0, Math.floor(scrollTop / this.itemHeight) - this.buffer);
    const endIdx = Math.min(
      this.items.length,
      Math.ceil((scrollTop + containerHeight) / this.itemHeight) + this.buffer
    );
    // 清空内容
    this._content.innerHTML = "";
    this._content.style.transform = `translateY(${startIdx * this.itemHeight}px)`;
    // 渲染可见区域
    for (let i = startIdx; i < endIdx; i++) {
      const item = this.items[i];
      const el = this.renderItem(item, i);
      if (el) {
        el.style.height = `${this.itemHeight}px`;
        el.style.boxSizing = "border-box";
        this._content.appendChild(el);
      }
    }
  }

  destroy() {
    if (this._scrollHandler) {
      this.container.removeEventListener("scroll", this._scrollHandler);
    }
    this.container.empty();
  }
}

// ========== UI 工具函数 (统一设计系统) ==========

const UI = {
  // 创建元素
  el(tag, className = "", text = "") {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
  },

  // 创建按钮
  button(text, onClick, options = {}) {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.className =
      "chemfig-btn" +
      (options.primary ? " chemfig-btn-primary" : "") +
      (options.danger ? " chemfig-btn-danger" : "") +
      (options.className ? " " + options.className : "");
    if (onClick) btn.addEventListener("click", onClick);
    if (options.title) btn.title = options.title;
    return btn;
  },

  // 创建状态徽章
  badge(text, type = "info") {
    const badge = document.createElement("span");
    badge.className = `chemfig-status-badge ${type}`;
    badge.textContent = text;
    return badge;
  },

  // 创建错误提示框
  errorBox(title, content) {
    const box = document.createElement("div");
    box.className = "chemfig-error-box";
    const titleEl = document.createElement("div");
    titleEl.className = "chemfig-error-title";
    titleEl.innerHTML = `⚠️ ${title}`;
    const contentEl = document.createElement("div");
    contentEl.className = "chemfig-error-content";
    contentEl.textContent = content;
    box.appendChild(titleEl);
    box.appendChild(contentEl);
    return box;
  },

  // 创建加载指示器
  loading(text = "编译中...") {
    const loading = document.createElement("div");
    loading.className = "chemfig-loading";
    const spinner = document.createElement("div");
    spinner.className = "chemfig-loading-spinner";
    const textEl = document.createElement("span");
    textEl.textContent = text;
    loading.appendChild(spinner);
    loading.appendChild(textEl);
    return loading;
  },

  // 创建模态框头部
  modalHeader(title, mode = "") {
    const header = document.createElement("div");
    header.className = "chemfig-modal-header";
    const titleEl = document.createElement("div");
    titleEl.className = "chemfig-modal-title";
    titleEl.textContent = title;
    if (mode) {
      const badge = document.createElement("span");
      badge.className = "chemfig-mode-badge";
      badge.textContent = mode.toUpperCase();
      titleEl.appendChild(badge);
    }
    header.appendChild(titleEl);
    return header;
  },

  // 创建面板头部
  panelHeader(title, extra = null) {
    const header = document.createElement("div");
    header.className = "chemfig-panel-header";
    const titleEl = document.createElement("span");
    titleEl.textContent = title;
    header.appendChild(titleEl);
    if (extra) header.appendChild(extra);
    return header;
  },

  // 防抖
  debounce(fn, delay = 300) {
    let timer = null;
    return function (...args) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // 节流
  throttle(fn, limit = 100) {
    let inThrottle = false;
    return function (...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => (inThrottle = false), limit);
      }
    };
  },

  // 安全移除元素
  safeRemove(el) {
    if (el && el.parentNode) el.parentNode.removeChild(el);
  },

  // 批量设置样式
  setStyles(el, styles) {
    Object.assign(el.style, styles);
  },
};

// IndexedDB 侧车索引 (延迟初始化, 避免模块加载时访问 indexedDB)
let _structureIndexDB = null;

function getStructureIndexDB() {
  if (_structureIndexDB) return _structureIndexDB;
  try {
    if (typeof indexedDB === "undefined") {
      console.warn("[Chemfig-SVG] indexedDB 不可用, 禁用结构式索引");
      return null;
    }
    _structureIndexDB = new StructureIndexDB();
    return _structureIndexDB;
  } catch (e) {
    console.warn("[Chemfig-SVG] StructureIndexDB 初始化失败:", e.message);
    return null;
  }
}

// ========== 优化工具: requestAnimationFrame 合并 (学习自热门插件性能优化) ==========

class RafScheduler {
  constructor() {
    this.pending = new Map();
    this.scheduled = false;
  }

  schedule(key, callback) {
    this.pending.set(key, callback);
    if (!this.scheduled) {
      this.scheduled = true;
      requestAnimationFrame(() => this.flush());
    }
  }

  flush() {
    const callbacks = Array.from(this.pending.values());
    this.pending.clear();
    this.scheduled = false;
    for (const cb of callbacks) {
      try {
        cb();
      } catch (e) {
        console.error("[RafScheduler]", e);
      }
    }
  }

  cancel(key) {
    this.pending.delete(key);
  }
}

const rafScheduler = new RafScheduler();

// ========== 优化工具: 批量 DOM 插入 (DocumentFragment) ==========

function batchInsert(parent, elements, referenceNode = null) {
  const fragment = document.createDocumentFragment();
  for (const el of elements) {
    if (el) fragment.appendChild(el);
  }
  if (referenceNode) {
    parent.insertBefore(fragment, referenceNode);
  } else {
    parent.appendChild(fragment);
  }
}

// ========== 优化工具: 懒加载初始化 (学习自 Lazy Plugin Loader) ==========

class LazyInitializer {
  constructor(initFn) {
    this.initFn = initFn;
    this.instance = null;
    this.initializing = false;
    this.waiters = [];
  }

  async get() {
    if (this.instance) return this.instance;
    if (this.initializing) {
      return new Promise((resolve) => this.waiters.push(resolve));
    }
    this.initializing = true;
    try {
      this.instance = await this.initFn();
      this.initializing = false;
      for (const resolve of this.waiters) resolve(this.instance);
      this.waiters = [];
      return this.instance;
    } catch (e) {
      this.initializing = false;
      throw e;
    }
  }

  reset() {
    this.instance = null;
    this.initializing = false;
    this.waiters = [];
  }
}

// ========== 优化工具: IndexedDB 侧车索引 (替代 SQLite, Obsidian 兼容) ==========

class StructureIndexDB {
  constructor(dbName = "chemfig-structure-index") {
    this.dbName = dbName;
    this.db = null;
  }

  async init() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains("structures")) {
          const store = db.createObjectStore("structures", { keyPath: "id" });
          store.createIndex("name", "name", { unique: false });
          store.createIndex("mode", "mode", { unique: false });
          store.createIndex("category", "category", { unique: false });
          store.createIndex("notePath", "notePath", { unique: false });
        }
      };
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve(this.db);
      };
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async put(structure) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("structures", "readwrite");
      tx.objectStore("structures").put(structure);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async get(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("structures", "readonly");
      const request = tx.objectStore("structures").get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async getAll() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("structures", "readonly");
      const request = tx.objectStore("structures").getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async delete(id) {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("structures", "readwrite");
      tx.objectStore("structures").delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  async search(query) {
    const all = await this.getAll();
    const q = query.toLowerCase();
    return all.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.code?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q)
    );
  }

  async clear() {
    await this.init();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction("structures", "readwrite");
      tx.objectStore("structures").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }
}
// structureIndexDB 已改为延迟加载, 使用 getStructureIndexDB() 获取

// ========== CM6 Widget: Live Preview 模式下的内联渲染 (学习自 obsidian-cm6-attributes, chem 插件) ==========
// 延迟创建: 仅在启用 Live Preview 渲染时才创建, 避免模块不可用导致插件加载失败
let _chemfigViewPlugin = null;

function createChemfigViewPlugin() {
  if (_chemfigViewPlugin) return _chemfigViewPlugin;
  const cm6 = getCm6Modules();
  if (!cm6) return null;
  const { WidgetType, ViewPlugin, Decoration, RangeSetBuilder } = cm6;

  class ChemfigWidget extends WidgetType {
    constructor(mode, body, name, plugin) {
      super();
      this.mode = mode;
      this.body = body;
      this.name = name;
      this.plugin = plugin;
    }

    toDOM(view) {
      const wrapper = document.createElement("div");
      wrapper.className = "chemfig-cm6-widget";
      wrapper.style.cssText = "text-align:center;margin:0.5em 0;cursor:pointer;";
      const notePath = view.state.field?.("file")?.path || "";
      const noteDir = path.dirname(notePath);
      const pngRelPath = path.join(noteDir, "png_out", `${this.name}.png`).replace(/\\/g, "/");
      const pngFile = this.plugin?.app?.vault?.getFileByPath(pngRelPath);
      if (pngFile) {
        const img = document.createElement("img");
        img.src = this.plugin.app.vault.getResourcePath(pngFile);
        img.alt = this.name;
        img.style.cssText = "max-width:500px;width:100%;height:auto;display:inline-block;";
        img.setAttribute("data-chemfig-svg", "true");
        img.setAttribute("data-svg-name", this.name);
        wrapper.appendChild(img);
      } else {
        const placeholder = document.createElement("div");
        placeholder.style.cssText =
          "padding:12px;color:var(--text-muted);font-size:12px;border:1px dashed var(--background-modifier-border);border-radius:4px;";
        placeholder.textContent = `[${this.mode}] ${this.name || "未命名"} - 保存后编译`;
        wrapper.appendChild(placeholder);
      }
      return wrapper;
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

  _chemfigViewPlugin = ViewPlugin.fromClass(
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
        const regex = /```(chem|tikz|miktex)\n([\s\S]*?)```/g;
        let match;
        while ((match = regex.exec(text)) !== null) {
          const start = match.index;
          const end = start + match[0].length;
          const mode = match[1];
          const body = match[2];
          const name = getBlockName(body);
          if (name) {
            const widget = new ChemfigWidget(mode, body, name, view.plugin || {});
            builder.add(start, end, Decoration.replace({ widget }));
          }
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations }
  );

  return _chemfigViewPlugin;
}

// ========== 共享模板 (结构/符号/条件) ==========
