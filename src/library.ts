// ========== 结构式库模块 ==========
// 存储: IndexedDB (主) + localStorage (备份)
// 数据结构: {name, mode, code, category, createdAt}

class StructureLibrary {
  constructor(plugin) {
    this.plugin = plugin;
    this.items = [];
    this._loaded = false;
  }

  // 异步加载 (首次加载时从 localStorage 迁移到 IndexedDB)
  async load() {
    if (this._loaded) return this.items;
    try {
      const db = getStructureIndexDB();
      if (!db) {
        // IndexedDB 不可用, 回退到 localStorage
        const data = localStorage.getItem("chemfig-structure-library");
        this.items = data ? JSON.parse(data) : [];
      } else {
        const all = await db.getAll();
        if (all.length > 0) {
          this.items = all.map((s) => ({
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
            this.items = legacy;
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
            this.items = [];
          }
        }
      }
    } catch (e) {
      console.warn("[Chemfig-SVG] 结构式库加载失败:", e.message);
      const data = localStorage.getItem("chemfig-structure-library");
      // 这是 IndexedDB 失败后的兜底路径: 若此处再抛错 (localStorage 也被写坏),
      // load() 会整体 reject, 结构式库彻底不可用。降级为空数组更安全。
      const parsed = safeJsonParse(data, [], "chemfig-structure-library");
      this.items = Array.isArray(parsed) ? parsed : [];
    }
    this._loaded = true;
    return this.items;
  }

  // 保存 (IndexedDB + localStorage 备份)
  async save() {
    try {
      localStorage.setItem("chemfig-structure-library", JSON.stringify(this.items));
      const db = getStructureIndexDB();
      if (db) {
        await db.clear();
        for (const item of this.items) {
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

  // 添加或更新
  async add(name, mode, code, category = "未分类") {
    const existing = this.items.findIndex((s) => s.name === name);
    if (existing >= 0) {
      this.items[existing] = { name, mode, code, category, createdAt: Date.now() };
    } else {
      this.items.push({ name, mode, code, category, createdAt: Date.now() });
    }
    await this.save();
  }

  // 删除
  async remove(name) {
    this.items = this.items.filter((s) => s.name !== name);
    await this.save();
  }

  // 搜索
  search(keyword) {
    const q = keyword.toLowerCase();
    return this.items.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
  }

  // 按模式筛选
  filterByMode(mode) {
    return this.items.filter((s) => s.mode === mode);
  }

  // 按分类筛选
  filterByCategory(category) {
    return this.items.filter((s) => s.category === category);
  }

  // 获取所有分类
  getCategories() {
    return [...new Set(this.items.map((s) => s.category || "未分类"))];
  }

  // v10.15.12: 按字段排序
  sortBy(field = "name", ascending = true) {
    this.items.sort((a, b) => {
      const va = a[field] || "";
      const vb = b[field] || "";
      if (typeof va === "string" && typeof vb === "string") {
        return ascending ? va.localeCompare(vb, "zh") : vb.localeCompare(va, "zh");
      }
      return ascending ? va - vb : vb - va;
    });
    return this.items;
  }

  // v10.15.12: 分页查询
  paginate(page = 1, pageSize = 20) {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return {
      items: this.items.slice(start, end),
      total: this.items.length,
      page,
      pageSize,
      totalPages: Math.ceil(this.items.length / pageSize),
    };
  }

  // v10.15.12: 高级搜索 (多字段)
  advancedSearch(options = {}) {
    const { keyword = "", mode = "", category = "" } = options;
    return this.items.filter((s) => {
      if (mode && s.mode !== mode) return false;
      if (category && (s.category || "未分类") !== category) return false;
      if (keyword) {
        const q = keyword.toLowerCase();
        const matchName = (s.name || "").toLowerCase().includes(q);
        const matchCode = (s.code || "").toLowerCase().includes(q);
        if (!matchName && !matchCode) return false;
      }
      return true;
    });
  }

  // v10.15.12: 获取最近使用的条目
  getRecent(count = 10) {
    return [...this.items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, count);
  }

  // v10.15.11: 获取统计信息
  getStats() {
    const byMode = {};
    const byCategory = {};
    for (const item of this.items) {
      byMode[item.mode] = (byMode[item.mode] || 0) + 1;
      byCategory[item.category || "未分类"] = byCategory[item.category || "未分类"] + 1;
    }
    return {
      total: this.items.length,
      byMode,
      byCategory,
    };
  }

  // v10.15.11: 导出为 JSON
  export() {
    return JSON.stringify(this.items, null, 2);
  }

  // v10.15.11: 从 JSON 导入
  async import(jsonStr) {
    try {
      const newItems = JSON.parse(jsonStr);
      if (!Array.isArray(newItems)) throw new Error("格式错误");

      let added = 0,
        updated = 0;
      for (const item of newItems) {
        if (!item.name || !item.code) continue;
        const existing = this.items.findIndex((s) => s.name === item.name);
        if (existing >= 0) {
          this.items[existing] = { ...this.items[existing], ...item };
          updated++;
        } else {
          this.items.push({
            name: item.name,
            mode: item.mode || "chem",
            code: item.code,
            category: item.category || "未分类",
            createdAt: item.createdAt || Date.now(),
          });
          added++;
        }
      }
      await this.save();
      return { added, updated };
    } catch (e) {
      throw new Error("导入失败: " + e.message);
    }
  }

  // v10.15.11: 清空所有条目
  async clear() {
    this.items = [];
    await this.save();
  }
}

// 结构式库选择模态框 (FuzzySuggestModal)
class StructureLibraryModal extends FuzzySuggestModal {
  constructor(app, items, onSelect) {
    super(app);
    this.items = items;
    this.onSelectCallback = onSelect;
    this.setPlaceholder("搜索结构式...");
    this.setInstructions([
      { command: "↑↓", purpose: "选择" },
      { command: "↵", purpose: "插入" },
      { command: "esc", purpose: "关闭" },
    ]);
  }

  getItems() {
    return this.items;
  }

  getItemText(item) {
    return `${item.name} [${item.mode}] ${item.category || ""}`;
  }

  onChooseItem(item, evt) {
    this.onSelectCallback(item);
  }
}
