/**
 * 代码片段系统 - 学习 Latex Suite Plugin 的 Snippet 系统
 * 
 * 允许用户自定义化学代码片段，提高编辑效率
 * 参考: https://github.com/artisticat1/obsidian-latex-suite
 */

/**
 * 代码片段类型
 */
interface Snippet {
  /** 唯一标识 */
  id: string;
  /** 名称 */
  name: string;
  /** 触发词 */
  trigger: string;
  /** 代码内容 */
  content: string;
  /** 描述 */
  description?: string;
  /** 分类 */
  category?: string;
  /** 是否启用 */
  enabled: boolean;
  /** 创建时间 */
  createdAt: number;
  /** 更新时间 */
  updatedAt: number;
}

/**
 * 代码片段分类
 */
enum SnippetCategory {
  // 基础结构
  BasicStructure = '基础结构',
  // 官能团
  FunctionalGroup = '官能团',
  // 反应
  Reaction = '反应',
  // 药物
  Drug = '药物',
  // 天然产物
  NaturalProduct = '天然产物',
  // 自定义
  Custom = '自定义',
}

/**
 * 内置代码片段
 */
const BUILTIN_SNIPPETS: Snippet[] = [
  // 基础结构
  {
    id: 'benzene',
    name: '苯环',
    trigger: 'benzene',
    content: '\\chemfig{*6(-=-=-=)}',
    description: '苯环结构',
    category: SnippetCategory.BasicStructure,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'cyclohexane',
    name: '环己烷',
    trigger: 'cyclohexane',
    content: '\\chemfig{*6(-=-=-=)}',
    description: '环己烷结构',
    category: SnippetCategory.BasicStructure,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'cyclopentane',
    name: '环戊烷',
    trigger: 'cyclopentane',
    content: '\\chemfig{*5(-=-=-)}',
    description: '环戊烷结构',
    category: SnippetCategory.BasicStructure,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  
  // 官能团
  {
    id: 'hydroxyl',
    name: '羟基',
    trigger: 'oh',
    content: '-OH',
    description: '羟基官能团',
    category: SnippetCategory.FunctionalGroup,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'carboxyl',
    name: '羧基',
    trigger: 'cooh',
    content: '-COOH',
    description: '羧基官能团',
    category: SnippetCategory.FunctionalGroup,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'amino',
    name: '氨基',
    trigger: 'nh2',
    content: '-NH2',
    description: '氨基官能团',
    category: SnippetCategory.FunctionalGroup,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  
  // 反应
  {
    id: 'esterification',
    name: '酯化反应',
    trigger: 'ester',
    content: '\\chemfig{R-COOH + R\'-OH -> R-COOR\' + H2O}',
    description: '酯化反应方程式',
    category: SnippetCategory.Reaction,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
  {
    id: 'hydrogenation',
    name: '加氢反应',
    trigger: 'hydrogenation',
    content: '\\chemfig{R-CH=CH-R\' + H2 -> R-CH2-CH2-R\'}',
    description: '加氢反应方程式',
    category: SnippetCategory.Reaction,
    enabled: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
];

/**
 * 代码片段管理器类
 */
class SnippetManager {
  private static instance: SnippetManager;
  private snippets: Map<string, Snippet> = new Map();
  private userSnippets: Map<string, Snippet> = new Map();

  private constructor() {
    // 初始化内置片段
    this.initBuiltinSnippets();
  }

  /**
   * 获取单例
   */
  static getInstance(): SnippetManager {
    if (!this.instance) {
      this.instance = new SnippetManager();
    }
    return this.instance;
  }

  /**
   * 初始化内置片段
   */
  private initBuiltinSnippets(): void {
    for (const snippet of BUILTIN_SNIPPETS) {
      this.snippets.set(snippet.id, snippet);
    }
    console.log(`[SnippetManager] Initialized ${BUILTIN_SNIPPETS.length} built-in snippets`);
  }

  /**
   * 加载用户片段
   * @param snippets 用户片段数组
   */
  loadUserSnippets(snippets: Snippet[]): void {
    this.userSnippets.clear();
    for (const snippet of snippets) {
      this.userSnippets.set(snippet.id, snippet);
    }
    console.log(`[SnippetManager] Loaded ${snippets.length} user snippets`);
  }

  /**
   * 获取所有片段
   */
  getAllSnippets(): Snippet[] {
    return [...this.snippets.values(), ...this.userSnippets.values()];
  }

  /**
   * 按分类获取片段
   * @param category 分类
   */
  getSnippetsByCategory(category: SnippetCategory): Snippet[] {
    return this.getAllSnippets().filter(s => s.category === category && s.enabled);
  }

  /**
   * 按触发词搜索片段
   * @param trigger 触发词
   */
  searchSnippets(trigger: string): Snippet[] {
    const lowerTrigger = trigger.toLowerCase();
    return this.getAllSnippets().filter(s => 
      s.enabled && 
      (s.trigger.toLowerCase().includes(lowerTrigger) ||
       s.name.toLowerCase().includes(lowerTrigger))
    );
  }

  /**
   * 添加片段
   * @param snippet 片段
   */
  addSnippet(snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>): Snippet {
    const newSnippet: Snippet = {
      ...snippet,
      id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.userSnippets.set(newSnippet.id, newSnippet);
    console.log(`[SnippetManager] Added snippet: ${newSnippet.name}`);
    return newSnippet;
  }

  /**
   * 更新片段
   * @param id 片段 ID
   * @param updates 更新内容
   */
  updateSnippet(id: string, updates: Partial<Snippet>): Snippet | null {
    const snippet = this.userSnippets.get(id) || this.snippets.get(id);
    if (!snippet) return null;

    const updatedSnippet = { ...snippet, ...updates, updatedAt: Date.now() };
    
    if (this.userSnippets.has(id)) {
      this.userSnippets.set(id, updatedSnippet);
    } else {
      this.snippets.set(id, updatedSnippet);
    }

    console.log(`[SnippetManager] Updated snippet: ${snippet.name}`);
    return updatedSnippet;
  }

  /**
   * 删除片段
   * @param id 片段 ID
   */
  deleteSnippet(id: string): boolean {
    if (this.userSnippets.has(id)) {
      this.userSnippets.delete(id);
      console.log(`[SnippetManager] Deleted user snippet: ${id}`);
      return true;
    }
    // 内置片段不能删除，只能禁用
    if (this.snippets.has(id)) {
      const snippet = this.snippets.get(id)!;
      snippet.enabled = false;
      console.log(`[SnippetManager] Disabled built-in snippet: ${snippet.name}`);
      return true;
    }
    return false;
  }

  /**
   * 启用/禁用片段
   * @param id 片段 ID
   * @param enabled 是否启用
   */
  toggleSnippet(id: string, enabled: boolean): void {
    const snippet = this.userSnippets.get(id) || this.snippets.get(id);
    if (snippet) {
      snippet.enabled = enabled;
      console.log(`[SnippetManager] ${enabled ? 'Enabled' : 'Disabled'} snippet: ${snippet.name}`);
    }
  }

  /**
   * 获取所有分类
   */
  getCategories(): SnippetCategory[] {
    return Object.values(SnippetCategory);
  }

  /**
   * 导出用户片段
   */
  exportUserSnippets(): Snippet[] {
    return Array.from(this.userSnippets.values());
  }

  /**
   * 导入用户片段
   * @param snippets 用户片段
   */
  importUserSnippets(snippets: Snippet[]): void {
    for (const snippet of snippets) {
      this.userSnippets.set(snippet.id, snippet);
    }
    console.log(`[SnippetManager] Imported ${snippets.length} user snippets`);
  }
}

// 导出
export {
  Snippet,
  SnippetCategory,
  SnippetManager,
  BUILTIN_SNIPPETS,
};

// 全局变量（兼容旧代码）
(globalThis as any).SnippetManager = SnippetManager;
(globalThis as any).SnippetCategory = SnippetCategory;
