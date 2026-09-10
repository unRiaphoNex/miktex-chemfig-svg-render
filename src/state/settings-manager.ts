// ========== state/SettingsManager.js - 设置管理器 ==========
// 封装插件设置的加载、保存、默认值和类型安全
// 从 src/main.js 提取 (v10.14.0 架构重构)
// 注意: 本文件通过 build.js 合并到 main.js，所有声明全局共享

const DEFAULT_SETTINGS = {
  manualPreviewEnabled: true,
  defaultMode: "chem",
  pngScale: 1.5,
  compileCacheEnabled: true,
  livePreviewEnabled: true,
  cm6LivePreviewEnabled: false,
  perfMonitorEnabled: false,
  leftSidebarEnabled: true,
  rightSidebarEnabled: true,
  sidebarSyncEnabled: true,
  customTemplates: [],
  // V2.0-iter: 双后端 / 缓存 / OCL
  renderBackend: "local",
  bridgeUrl: "http://127.0.0.1:9123",
  enableCache: true,
  cacheFolder: "",
  cacheVersion: "2",
  svgOutputFolder: "",
  enableChemEditor: true,
  enableTemplateLibrary: true,
};

class SettingsManager {
  constructor(plugin) {
    this.plugin = plugin;
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
    this._loaded = false;
    this._listeners = new Set();
  }

  async load() {
    try {
      const data = (await this.plugin.loadData()) || {};
      this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
      this._loaded = true;
      this._notify("load");
      return this.settings;
    } catch (e) {
      console.warn("[Chemfig-SVG] 设置加载失败:", e.message);
      this.settings = Object.assign({}, DEFAULT_SETTINGS);
      this._loaded = true;
      return this.settings;
    }
  }

  async save() {
    try {
      await this.plugin.saveData(this.settings);
      this._notify("save");
      return true;
    } catch (e) {
      console.warn("[Chemfig-SVG] 设置保存失败:", e.message);
      return false;
    }
  }

  get(key) {
    return this.settings[key];
  }

  async set(key, value) {
    this.settings[key] = value;
    await this.save();
    this._notify("change", key, value);
  }

  async update(partial) {
    Object.assign(this.settings, partial);
    await this.save();
    this._notify("batch", partial);
  }

  async reset() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
    await this.save();
    this._notify("reset");
  }

  getAll() {
    return Object.assign({}, this.settings);
  }

  isLoaded() {
    return this._loaded;
  }

  onChange(listener) {
    this._listeners.add(listener);
    const self = this;
    return function () {
      self._listeners.delete(listener);
    };
  }

  _notify(event) {
    const args = Array.prototype.slice.call(arguments, 1);
    for (var it = this._listeners.values(), listener; !(listener = it.next()).done;) {
      try {
        listener.value.apply(null, [event].concat(args));
      } catch (e) {
        console.warn("[Chemfig-SVG] 设置监听器错误:", e.message);
      }
    }
  }
}
