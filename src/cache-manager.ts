// ========== cache-manager.ts - SHA256 源码缓存管理器 ==========
// V2.0-iter: 以 chemfig 源码 sha256-16 作为缓存 key, 源码不变直接读缓存 SVG, 跳过编译。
// 双层: 内存 LRU (快速) + 磁盘持久化 (跨会话, 路径由 cacheFolder 配置)。
// 附带: 缓存索引 (index) 记录 SVG -> 引用关系、孤儿文件清理、缓存版本标记 (升版自动失效)。

const CACHE_INDEX_FILE = "cache-index.json";

class SvgCacheManager {
  /**
   * @param {object} plugin Obsidian 插件实例
   * @param {object} opts { enabled, folder, memMax, version }
   */
  constructor(plugin, opts = {}) {
    this.plugin = plugin;
    this.enabled = opts.enabled !== false;
    this.folder = opts.folder || "";
    this.memMax = opts.memMax || 200;
    this.version = opts.version || "2";
    this.mem = new LRUCache(this.memMax, 0); // 内存层不设 TTL, 由磁盘层负责持久化
    this._index = null;
  }

  _baseDir() {
    if (this.folder) return this.folder;
    try {
      if (this.plugin && this.plugin.manifest && this.plugin.manifest.dir) {
        return path.join(this.plugin.manifest.dir, "svg-cache");
      }
    } catch (e) {
      /* ignore */
    }
    return path.join(os.tmpdir(), "chemfig-svg-cache");
  }

  _filePath(key) {
    return path.join(this._baseDir(), key + ".svg");
  }

  _indexPath() {
    return path.join(this._baseDir(), CACHE_INDEX_FILE);
  }

  _loadIndex() {
    if (this._index) return this._index;
    let idx = { version: this.version, entries: {} };
    try {
      const raw = fs.readFileSync(this._indexPath(), "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        idx = { version: parsed.version || this.version, entries: parsed.entries || {} };
      }
    } catch (e) {
      /* 不存在或损坏, 使用空索引 */
    }
    this._index = idx;
    return idx;
  }

  _saveIndex() {
    try {
      if (!this._index) return;
      const dir = this._baseDir();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this._indexPath(), JSON.stringify(this._index), "utf8");
    } catch (e) {
      console.warn("[Chemfig-SVG] 缓存索引写入失败:", e.message);
    }
  }

  /** 版本检查: 缓存版本标记不一致时自动失效旧缓存 (产物不兼容自动重建) */
  checkVersion() {
    if (!this.enabled) return;
    const idx = this._loadIndex();
    if (idx.version !== this.version) {
      console.log(`[Chemfig-SVG] 缓存版本变更 (${idx.version} -> ${this.version}), 清空旧缓存`);
      this.clear();
      this._index = { version: this.version, entries: {} };
      this._saveIndex();
    }
  }

  get(key) {
    const memVal = this.mem.get(key);
    if (memVal !== undefined) return memVal;
    if (!this.enabled) return undefined;
    try {
      const fp = this._filePath(key);
      if (fs.existsSync(fp)) {
        const svg = fs.readFileSync(fp, "utf8");
        if (svg && svg.length > 100) {
          this.mem.set(key, svg);
          // 更新引用时间 (内存态, 落盘在 set 时统一写)
          const idx = this._loadIndex();
          idx.entries[key] = idx.entries[key] || { lastUsed: 0 };
          idx.entries[key].lastUsed = Date.now();
          return svg;
        }
      }
    } catch (e) {
      /* 读取失败视为未命中 */
    }
    return undefined;
  }

  set(key, svg) {
    if (!svg) return;
    this.mem.set(key, svg);
    if (!this.enabled) return;
    try {
      const dir = this._baseDir();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this._filePath(key), svg, "utf8");
      const idx = this._loadIndex();
      idx.entries[key] = { lastUsed: Date.now(), size: svg.length };
      this._saveIndex();
    } catch (e) {
      console.warn("[Chemfig-SVG] SVG 缓存写入失败:", e.message);
    }
  }

  /** 一键清空全部缓存 (内存 + 磁盘 + 索引) */
  clear() {
    this.mem.clear();
    try {
      fs.rmSync(this._baseDir(), { recursive: true, force: true });
    } catch (e) {
      /* ignore */
    }
    this._index = null;
  }

  /** 清理孤儿缓存文件 (磁盘上存在但索引无记录的 .svg), 返回清理数量 */
  removeOrphans() {
    if (!this.enabled) return 0;
    const idx = this._loadIndex();
    let removed = 0;
    try {
      const dir = this._baseDir();
      if (!fs.existsSync(dir)) return 0;
      for (const f of fs.readdirSync(dir)) {
        if (!f.endsWith(".svg")) continue;
        const key = f.slice(0, -4);
        if (!idx.entries[key]) {
          try {
            fs.rmSync(path.join(dir, f), { force: true });
            removed++;
          } catch (e) {
            /* ignore */
          }
        }
      }
    } catch (e) {
      console.warn("[Chemfig-SVG] 清理孤儿缓存失败:", e.message);
    }
    this._index = null;
    return removed;
  }

  stats() {
    return this.mem.getStats();
  }
}
