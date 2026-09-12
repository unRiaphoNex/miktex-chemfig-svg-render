/**
 * 事件钩子系统 - 学习 Excalidraw Plugin 的 onSceneChangeHook
 * 
 * 提供事件驱动的钩子系统，解耦模块间的依赖
 * 参考: https://github.com/zsviczian/obsidian-excalidraw-plugin
 */

/**
 * 事件类型枚举
 */
enum EventType {
  // 分子结构相关事件
  StructureChange = 'structure:change',
  StructureLoad = 'structure:load',
  StructureDelete = 'structure:delete',
  
  // 画布相关事件
  CanvasInit = 'canvas:init',
  CanvasResize = 'canvas:resize',
  CanvasClear = 'canvas:clear',
  
  // 工具相关事件
  ToolChange = 'tool:change',
  ModeChange = 'mode:change',
  
  // 学习相关事件
  CardReview = 'card:review',
  CardLearn = 'card:learn',
  ProgressUpdate = 'progress:update',
  
  // 数据库相关事件
  DatabaseUpdate = 'database:update',
  CompoundLoad = 'compound:load',
  Search = 'search',
}

/**
 * 事件监听器类型
 */
type EventListener = (data: any) => void | Promise<void>;

/**
 * 事件钩子选项
 */
interface EventHookOptions {
  /** 是否只触发一次 */
  once?: boolean;
  /** 过滤器，只有满足条件才触发 */
  filter?: (data: any) => boolean;
  /** 优先级，数字越小越先执行 */
  priority?: number;
}

/**
 * 事件钩子系统类
 */
class EventHooks {
  private static instance: EventHooks;
  private listeners: Map<EventType, Array<{
    listener: EventListener;
    options: EventHookOptions;
  }>> = new Map();

  private constructor() {}

  /**
   * 获取单例
   */
  static getInstance(): EventHooks {
    if (!this.instance) {
      this.instance = new EventHooks();
    }
    return this.instance;
  }

  /**
   * 注册事件监听器
   * @param eventType 事件类型
   * @param listener 监听器
   * @param options 选项
   */
  on(eventType: EventType, listener: EventListener, options: EventHookOptions = {}): void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }

    const listeners = this.listeners.get(eventType)!;
    listeners.push({ listener, options });

    // 按优先级排序
    listeners.sort((a, b) => (a.options.priority || 0) - (b.options.priority || 0));
  }

  /**
   * 注册一次性事件监听器
   * @param eventType 事件类型
   * @param listener 监听器
   * @param options 选项
   */
  once(eventType: EventType, listener: EventListener, options: EventHookOptions = {}): void {
    this.on(eventType, listener, { ...options, once: true });
  }

  /**
   * 移除事件监听器
   * @param eventType 事件类型
   * @param listener 监听器
   */
  off(eventType: EventType, listener: EventListener): void {
    if (!this.listeners.has(eventType)) return;

    const listeners = this.listeners.get(eventType)!;
    const index = listeners.findIndex(l => l.listener === listener);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  /**
   * 触发事件
   * @param eventType 事件类型
   * @param data 事件数据
   */
  async emit(eventType: EventType, data: any = {}): Promise<void> {
    if (!this.listeners.has(eventType)) return;

    const listeners = this.listeners.get(eventType)!;
    const toRemove: number[] = [];

    for (let i = 0; i < listeners.length; i++) {
      const { listener, options } = listeners[i];

      // 检查过滤器
      if (options.filter && !options.filter(data)) {
        continue;
      }

      try {
        await listener(data);
      } catch (error) {
        console.error(`[EventHooks] Error in ${eventType} listener:`, error);
      }

      // 标记一次性监听器
      if (options.once) {
        toRemove.push(i);
      }
    }

    // 移除一次性监听器（从后往前移除，避免索引问题）
    for (let i = toRemove.length - 1; i >= 0; i--) {
      listeners.splice(toRemove[i], 1);
    }
  }

  /**
   * 移除所有事件监听器
   * @param eventType 事件类型，如果不提供则移除所有
   */
  clear(eventType?: EventType): void {
    if (eventType) {
      this.listeners.delete(eventType);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * 获取事件监听器数量
   * @param eventType 事件类型
   */
  getListenerCount(eventType: EventType): number {
    return this.listeners.get(eventType)?.length || 0;
  }
}

/**
 * 事件钩子管理器 - 提供更友好的 API
 */
class EventHookManager {
  private hooks: EventHooks;

  constructor() {
    this.hooks = EventHooks.getInstance();
  }

  // ========== 分子结构相关钩子 ==========

  /**
   * 监听结构变化
   */
  onStructureChange(listener: (data: { structure: any; action: string }) => void): void {
    this.hooks.on(EventType.StructureChange, listener);
  }

  /**
   * 触发结构变化
   */
  emitStructureChange(structure: any, action: string): void {
    this.hooks.emit(EventType.StructureChange, { structure, action });
  }

  /**
   * 监听结构加载
   */
  onStructureLoad(listener: (data: { structure: any; source: string }) => void): void {
    this.hooks.on(EventType.StructureLoad, listener);
  }

  /**
   * 触发结构加载
   */
  emitStructureLoad(structure: any, source: string): void {
    this.hooks.emit(EventType.StructureLoad, { structure, source });
  }

  // ========== 画布相关钩子 ==========

  /**
   * 监听画布初始化
   */
  onCanvasInit(listener: (data: { canvas: any }) => void): void {
    this.hooks.on(EventType.CanvasInit, listener);
  }

  /**
   * 触发画布初始化
   */
  emitCanvasInit(canvas: any): void {
    this.hooks.emit(EventType.CanvasInit, { canvas });
  }

  /**
   * 监听画布清空
   */
  onCanvasClear(listener: (data: {}) => void): void {
    this.hooks.on(EventType.CanvasClear, listener);
  }

  /**
   * 触发画布清空
   */
  emitCanvasClear(): void {
    this.hooks.emit(EventType.CanvasClear, {});
  }

  // ========== 工具相关钩子 ==========

  /**
   * 监听工具切换
   */
  onToolChange(listener: (data: { tool: string; previousTool: string }) => void): void {
    this.hooks.on(EventType.ToolChange, listener);
  }

  /**
   * 触发工具切换
   */
  emitToolChange(tool: string, previousTool: string): void {
    this.hooks.emit(EventType.ToolChange, { tool, previousTool });
  }

  // ========== 学习相关钩子 ==========

  /**
   * 监听卡片复习
   */
  onCardReview(listener: (data: { card: any; rating: number }) => void): void {
    this.hooks.on(EventType.CardReview, listener);
  }

  /**
   * 触发卡片复习
   */
  emitCardReview(card: any, rating: number): void {
    this.hooks.emit(EventType.CardReview, { card, rating });
  }

  /**
   * 监听进度更新
   */
  onProgressUpdate(listener: (data: { progress: any }) => void): void {
    this.hooks.on(EventType.ProgressUpdate, listener);
  }

  /**
   * 触发进度更新
   */
  emitProgressUpdate(progress: any): void {
    this.hooks.emit(EventType.ProgressUpdate, { progress });
  }

  // ========== 数据库相关钩子 ==========

  /**
   * 监听化合物加载
   */
  onCompoundLoad(listener: (data: { compound: any; source: string }) => void): void {
    this.hooks.on(EventType.CompoundLoad, listener);
  }

  /**
   * 触发化合物加载
   */
  emitCompoundLoad(compound: any, source: string): void {
    this.hooks.emit(EventType.CompoundLoad, { compound, source });
  }

  /**
   * 监听搜索
   */
  onSearch(listener: (data: { query: string; results: any[] }) => void): void {
    this.hooks.on(EventType.Search, listener);
  }

  /**
   * 触发搜索
   */
  emitSearch(query: string, results: any[]): void {
    this.hooks.emit(EventType.Search, { query, results });
  }
}

// 导出
export {
  EventType,
  EventHooks,
  EventHookManager,
};

// 全局变量（兼容旧代码）
(globalThis as any).EventType = EventType;
(globalThis as any).EventHooks = EventHooks;
(globalThis as any).EventHookManager = EventHookManager;
