/**
 * 配置驱动 UI - 学习 Commander Plugin 的配置驱动设计
 * 
 * 允许用户自定义工具栏按钮的位置和显示
 * 参考: https://github.com/jsmorabito/obsidian-commander
 */

/**
 * UI 位置枚举
 */
enum UILocation {
  // Obsidian 原生位置
  Ribbon = 'ribbon',           // 左侧边栏图标
  TitleBar = 'title-bar',      // 标题栏
  StatusBar = 'status-bar',    // 底部状态栏
  CommandPalette = 'command-palette', // 命令面板
  
  // 分子编辑器内部位置
  EditorToolbar = 'editor-toolbar',     // 编辑器顶部工具栏
  EditorSidebarLeft = 'editor-sidebar-left',  // 编辑器左侧边栏
  EditorSidebarRight = 'editor-sidebar-right', // 编辑器右侧边栏
  EditorFloating = 'editor-floating',   // 编辑器浮动工具栏
}

/**
 * 工具栏按钮配置
 */
interface ToolbarButtonConfig {
  /** 唯一标识 */
  id: string;
  /** 按钮名称 */
  name: string;
  /** 图标 */
  icon: string;
  /** 提示文字 */
  tooltip: string;
  /** 所在位置 */
  location: UILocation;
  /** 是否显示 */
  visible: boolean;
  /** 排序 */
  order: number;
  /** 命令 ID */
  commandId?: string;
}

/**
 * 工具栏配置管理器
 */
class ToolbarConfigManager {
  private static instance: ToolbarConfigManager;
  private buttonConfigs: Map<string, ToolbarButtonConfig> = new Map();
  private defaultConfigs: ToolbarButtonConfig[] = [];

  private constructor() {
    this.initDefaultConfigs();
  }

  /**
   * 获取单例
   */
  static getInstance(): ToolbarConfigManager {
    if (!this.instance) {
      this.instance = new ToolbarConfigManager();
    }
    return this.instance;
  }

  /**
   * 初始化默认配置
   */
  private initDefaultConfigs(): void {
    const defaults: ToolbarButtonConfig[] = [
      // 撤销/重做
      {
        id: 'undo',
        name: '撤销',
        icon: '↩️',
        tooltip: '撤销上一步',
        location: UILocation.EditorToolbar,
        visible: true,
        order: 1,
        commandId: 'molecule-editor:undo',
      },
      {
        id: 'redo',
        name: '重做',
        icon: '↪️',
        tooltip: '重做下一步',
        location: UILocation.EditorToolbar,
        visible: true,
        order: 2,
        commandId: 'molecule-editor:redo',
      },
      
      // 删除
      {
        id: 'clear',
        name: '清空',
        icon: '🗑️',
        tooltip: '清空画布',
        location: UILocation.EditorToolbar,
        visible: true,
        order: 3,
        commandId: 'molecule-editor:clear',
      },
      
      // 搜索
      {
        id: 'search',
        name: '搜索',
        icon: '🔍',
        tooltip: '搜索化合物',
        location: UILocation.EditorToolbar,
        visible: true,
        order: 4,
        commandId: 'molecule-editor:search',
      },
      
      // 工具
      {
        id: 'select',
        name: '选择',
        icon: '👆',
        tooltip: '选择工具',
        location: UILocation.EditorToolbar,
        visible: true,
        order: 10,
        commandId: 'molecule-editor:select',
      },
      {
        id: 'delete-tool',
        name: '删除',
        icon: '🗑️',
        tooltip: '删除工具',
        location: UILocation.EditorToolbar,
        visible: true,
        order: 11,
        commandId: 'molecule-editor:delete',
      },
      
      // 化学工具
      {
        id: 'naming',
        name: '命名',
        icon: '🔤',
        tooltip: '化学命名',
        location: UILocation.EditorToolbar,
        visible: true,
        order: 20,
        commandId: 'molecule-editor:naming',
      },
      {
        id: 'properties',
        name: '性质',
        icon: '🧮',
        tooltip: '理化性质',
        location: UILocation.EditorToolbar,
        visible: true,
        order: 21,
        commandId: 'molecule-editor:properties',
      },
      {
        id: 'functional-group',
        name: '官能团',
        icon: '⚗️',
        tooltip: '官能团分析',
        location: UILocation.EditorToolbar,
        visible: true,
        order: 22,
        commandId: 'molecule-editor:functional-group',
      },
      
      // 学习工具
      {
        id: 'flashcard',
        name: '卡片',
        icon: '📇',
        tooltip: '翻转卡片',
        location: UILocation.EditorSidebarLeft,
        visible: true,
        order: 1,
        commandId: 'molecule-editor:flashcard',
      },
      {
        id: 'quiz',
        name: '默写',
        icon: '✍️',
        tooltip: '默写练习',
        location: UILocation.EditorSidebarLeft,
        visible: true,
        order: 2,
        commandId: 'molecule-editor:quiz',
      },
      {
        id: 'daily',
        name: '每日',
        icon: '📅',
        tooltip: '每日一题',
        location: UILocation.EditorSidebarLeft,
        visible: true,
        order: 3,
        commandId: 'molecule-editor:daily',
      },
    ];

    this.defaultConfigs = defaults;
    for (const config of defaults) {
      this.buttonConfigs.set(config.id, { ...config });
    }
  }

  /**
   * 获取所有按钮配置
   */
  getAllButtons(): ToolbarButtonConfig[] {
    return Array.from(this.buttonConfigs.values());
  }

  /**
   * 按位置获取按钮
   */
  getButtonsByLocation(location: UILocation): ToolbarButtonConfig[] {
    return this.getAllButtons()
      .filter(b => b.location === location && b.visible)
      .sort((a, b) => a.order - b.order);
  }

  /**
   * 获取按钮配置
   */
  getButton(id: string): ToolbarButtonConfig | undefined {
    return this.buttonConfigs.get(id);
  }

  /**
   * 更新按钮配置
   */
  updateButton(id: string, updates: Partial<ToolbarButtonConfig>): void {
    const button = this.buttonConfigs.get(id);
    if (button) {
      Object.assign(button, updates);
      console.log(`[ToolbarConfigManager] Updated button: ${id}`);
    }
  }

  /**
   * 添加按钮
   */
  addButton(config: Omit<ToolbarButtonConfig, 'order'>): void {
    const maxOrder = Math.max(
      ...this.getAllButtons().map(b => b.order),
      0
    );
    
    this.buttonConfigs.set(config.id, {
      ...config,
      order: maxOrder + 1,
    });
    
    console.log(`[ToolbarConfigManager] Added button: ${config.name}`);
  }

  /**
   * 删除按钮
   */
  removeButton(id: string): void {
    this.buttonConfigs.delete(id);
    console.log(`[ToolbarConfigManager] Removed button: ${id}`);
  }

  /**
   * 重置为默认配置
   */
  resetToDefaults(): void {
    this.buttonConfigs.clear();
    for (const config of this.defaultConfigs) {
      this.buttonConfigs.set(config.id, { ...config });
    }
    console.log('[ToolbarConfigManager] Reset to defaults');
  }

  /**
   * 导出配置
   */
  exportConfig(): ToolbarButtonConfig[] {
    return Array.from(this.buttonConfigs.values());
  }

  /**
   * 导入配置
   */
  importConfig(configs: ToolbarButtonConfig[]): void {
    this.buttonConfigs.clear();
    for (const config of configs) {
      this.buttonConfigs.set(config.id, config);
    }
    console.log(`[ToolbarConfigManager] Imported ${configs.length} button configs`);
  }
}

// 导出
export {
  UILocation,
  ToolbarButtonConfig,
  ToolbarConfigManager,
};

// 全局变量（兼容旧代码）
(globalThis as any).UILocation = UILocation;
(globalThis as any).ToolbarConfigManager = ToolbarConfigManager;
