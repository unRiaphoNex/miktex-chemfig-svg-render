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

// 安全解析 JSON。localStorage / 网络响应里的损坏数据不应让整个功能崩溃:
// 多处写成 `JSON.parse(localStorage.getItem(k) || "{}")` 而无保护, 一旦该键被写坏
// (升级中断、手动编辑、配额截断), 对应界面在打开时就会直接抛错。
// 本文件在 build.js 的 FILES 顺序中早于 library.ts / learning.ts / main.ts。
function safeJsonParse(text, fallback = null, label = "") {
  if (text === null || text === undefined || text === "") return fallback;
  if (typeof text !== "string") return text; // 已是对象则原样返回
  try {
    const v = JSON.parse(text);
    return v === null || v === undefined ? fallback : v;
  } catch (e) {
    console.warn(`[Chemfig-SVG] JSON 解析失败${label ? " (" + label + ")" : ""}:`, e.message);
    return fallback;
  }
}

// 读取 localStorage 中的 JSON 值 (最常见的用法, 直接给默认值)
function readLocalStorageJson(key, fallback = null) {
  try {
    return safeJsonParse(localStorage.getItem(key), fallback, key);
  } catch (e) {
    // localStorage 本身可能被禁用或在隐私模式下抛 SecurityError
    console.warn(`[Chemfig-SVG] 读取 localStorage 失败 (${key}):`, e.message);
    return fallback;
  }
}

// 安全写入 localStorage。配额耗尽 (QuotaExceededError) 或隐私模式 (SecurityError)
// 都不应让调用方功能崩溃 —— 复习数据、已学分子等是只增不减的集合, 写满后
// 若不捕获, 间隔重复与右键标记会直接抛错中断。返回是否写入成功。
function safeLocalStorageSet(key, value, notify = true) {
  try {
    localStorage.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
    return true;
  } catch (e) {
    console.warn(`[Chemfig-SVG] 写入 localStorage 失败 (${key}):`, e.message);
    if (notify) {
      try {
        new Notice("⚠️ 本地存储空间不足, 本次数据未能保存", 5000);
      } catch (_) {
        /* Notice 在纯测试环境可能不可用 */
      }
    }
    return false;
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
