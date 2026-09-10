// ========== ui/TemplateBrowser.js - 模板浏览器 ==========
// 封装模板浏览、搜索、自定义模板管理
// 从 src/main.js 提取 (v10.14.0 架构重构)

class TemplateBrowser {
  constructor(plugin) {
    this.plugin = plugin;
    this.customTemplates = [];
  }

  /**
   * 加载自定义模板
   */
  async loadCustom() {
    try {
      const data = await this.plugin.loadData();
      this.customTemplates = (data && data.customTemplates) || [];
      console.log("[Chemfig-SVG] 已加载 " + this.customTemplates.length + " 个自定义模板");
    } catch (e) {
      this.customTemplates = [];
    }
    return this.customTemplates;
  }

  /**
   * 获取指定模式的所有模板 (内置 + 自定义)
   */
  getAll(mode) {
    const builtin = (MODES[mode] && MODES[mode].templates) || [];
    const custom = this.customTemplates.filter(function (t) {
      return t.mode === mode || t.mode === "all";
    });
    return builtin.concat(custom);
  }

  /**
   * 按分类获取模板
   */
  getByCategory(mode, category) {
    return this.getAll(mode).filter(function (t) {
      return t.category === category;
    });
  }

  /**
   * 搜索模板
   */
  search(mode, query) {
    const q = query.toLowerCase();
    return this.getAll(mode).filter(function (t) {
      return (
        (t.name && t.name.toLowerCase().indexOf(q) >= 0) ||
        (t.subcategory && t.subcategory.toLowerCase().indexOf(q) >= 0) ||
        (t.code && t.code.toLowerCase().indexOf(q) >= 0)
      );
    });
  }

  /**
   * 获取所有分类
   */
  getCategories(mode) {
    const cats = new Set();
    this.getAll(mode).forEach(function (t) {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats);
  }

  /**
   * 保存自定义模板 (同名更新)
   */
  async saveCustom(name, code, mode, category, subcategory) {
    category = category || "自定义";
    subcategory = subcategory || "我的块";
    const idx = this.customTemplates.findIndex(function (t) {
      return t.name === name && (t.mode === mode || t.mode === "all");
    });
    const tpl = {
      name: name,
      code: code,
      mode: mode,
      category: category,
      subcategory: subcategory,
      custom: true,
    };
    if (idx >= 0) {
      this.customTemplates[idx] = tpl;
    } else {
      this.customTemplates.push(tpl);
    }
    await this.plugin.saveData({ customTemplates: this.customTemplates });
    return tpl;
  }

  /**
   * 删除自定义模板
   */
  async deleteCustom(name) {
    this.customTemplates = this.customTemplates.filter(function (t) {
      return t.name !== name;
    });
    await this.plugin.saveData({ customTemplates: this.customTemplates });
  }

  /**
   * 打开模板选择器 (FuzzySuggestModal)
   */
  openPicker(app, mode, onSelect) {
    const templates = this.getAll(mode);
    if (templates.length === 0) {
      new Notice("该模式下暂无模板", 2000);
      return;
    }
    const modal = new TemplatePickerModal(app, templates, onSelect);
    modal.open();
  }
}

// 模板选择器模态框
class TemplatePickerModal extends FuzzySuggestModal {
  constructor(app, templates, onSelect) {
    super(app);
    this.templates = templates;
    this.onSelectCallback = onSelect;
    this.setPlaceholder("搜索模板...");
    this.setInstructions([
      { command: "↑↓", purpose: "导航" },
      { command: "↵", purpose: "选择插入" },
      { command: "esc", purpose: "关闭" },
    ]);
  }

  getItems() {
    return this.templates;
  }

  getItemText(item) {
    const prefix = item.custom ? "[自定义] " : "";
    const cat = item.subcategory ? " (" + item.subcategory + ")" : "";
    return prefix + item.name + cat;
  }

  onChooseItem(item) {
    if (this.onSelectCallback) this.onSelectCallback(item);
  }
}
