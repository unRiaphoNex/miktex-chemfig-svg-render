/**
 * 性能优化模块 - 学习 Spaced Repetition Plugin 的性能优化
 * 
 * 1. FSRS 算法缓存
 * 2. 化合物数据库查询优化
 * 3. SVG 渲染缓存
 * 参考: https://github.com/st3v3nmw/obsidian-spaced-repetition
 */

/**
 * LRU 缓存实现
 */
class LRUCache<K, V> {
  private cache: Map<K, V>;
  private maxSize: number;

  constructor(maxSize: number = 1000) {
    this.cache = new Map();
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    if (!this.cache.has(key)) return undefined;
    
    // 重新插入到末尾（最近使用）
    const value = this.cache.get(key)!;
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  set(key: K, value: V): void {
    // 如果已存在，先删除
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    
    // 如果超过最大大小，删除最久未使用的
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
    
    this.cache.set(key, value);
  }

  has(key: K): boolean {
    return this.cache.has(key);
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  keys(): IterableIterator<K> {
    return this.cache.keys();
  }
}

/**
 * FSRS 算法缓存优化
 */
class FSRSCacheOptimizer {
  private static instance: FSRSCacheOptimizer;
  private ratingCache: LRUCache<string, number>;
  private intervalCache: LRUCache<string, number>;

  private constructor() {
    this.ratingCache = new LRUCache(500);
    this.intervalCache = new LRUCache(500);
  }

  static getInstance(): FSRSCacheOptimizer {
    if (!this.instance) {
      this.instance = new FSRSCacheOptimizer();
    }
    return this.instance;
  }

  /**
   * 生成缓存键
   */
  private makeCacheKey(...args: any[]): string {
    return args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join('|');
  }

  /**
   * 获取评级缓存
   */
  getCachedRating(difficulty: number, stability: number, hoursElapsed: number): number | undefined {
    const key = this.makeCacheKey('rating', difficulty, stability, hoursElapsed);
    return this.ratingCache.get(key);
  }

  /**
   * 缓存评级结果
   */
  cacheRating(difficulty: number, stability: number, hoursElapsed: number, rating: number): void {
    const key = this.makeCacheKey('rating', difficulty, stability, hoursElapsed);
    this.ratingCache.set(key, rating);
  }

  /**
   * 获取间隔缓存
   */
  getCachedInterval(difficulty: number, stability: number, targetRetention: number): number | undefined {
    const key = this.makeCacheKey('interval', difficulty, stability, targetRetention);
    return this.intervalCache.get(key);
  }

  /**
   * 缓存间隔结果
   */
  cacheInterval(difficulty: number, stability: number, targetRetention: number, interval: number): void {
    const key = this.makeCacheKey('interval', difficulty, stability, targetRetention);
    this.intervalCache.set(key, interval);
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.ratingCache.clear();
    this.intervalCache.clear();
    console.log('[FSRSCacheOptimizer] Cache cleared');
  }

  /**
   * 获取缓存统计
   */
  getStats(): { ratingCacheSize: number; intervalCacheSize: number } {
    return {
      ratingCacheSize: this.ratingCache.size(),
      intervalCacheSize: this.intervalCache.size(),
    };
  }
}

/**
 * 化合物数据库查询优化器
 */
class CompoundDBOptimizer {
  private static instance: CompoundDBOptimizer;
  private searchIndex: Map<string, any[]>;
  private smilesIndex: Map<string, any>;
  private nameIndex: Map<string, any>;
  private formulaIndex: Map<string, any[]>;
  private searchCache: LRUCache<string, any[]>;

  private constructor() {
    this.searchIndex = new Map();
    this.smilesIndex = new Map();
    this.nameIndex = new Map();
    this.formulaIndex = new Map();
    this.searchCache = new LRUCache(200);
  }

  static getInstance(): CompoundDBOptimizer {
    if (!this.instance) {
      this.instance = new CompoundDBOptimizer();
    }
    return this.instance;
  }

  /**
   * 构建索引
   * @param compounds 化合物数组
   */
  buildIndex(compounds: any[]): void {
    console.log(`[CompoundDBOptimizer] Building index for ${compounds.length} compounds...`);
    
    this.searchIndex.clear();
    this.smilesIndex.clear();
    this.nameIndex.clear();
    this.formulaIndex.clear();
    this.searchCache.clear();

    for (const compound of compounds) {
      // SMILES 索引
      if (compound.smiles) {
        this.smilesIndex.set(compound.smiles, compound);
      }

      // 名称索引
      if (compound.name) {
        const lowerName = compound.name.toLowerCase();
        this.nameIndex.set(lowerName, compound);
        
        // 分词索引
        const words = lowerName.split(/\s+/);
        for (const word of words) {
          if (!this.searchIndex.has(word)) {
            this.searchIndex.set(word, []);
          }
          this.searchIndex.get(word)!.push(compound);
        }
      }

      // 分子式索引
      if (compound.molecularFormula) {
        const formula = compound.molecularFormula.toUpperCase();
        if (!this.formulaIndex.has(formula)) {
          this.formulaIndex.set(formula, []);
        }
        this.formulaIndex.get(formula)!.push(compound);
      }
    }

    console.log(`[CompoundDBOptimizer] Index built: ${this.smilesIndex.size} SMILES, ${this.nameIndex.size} names, ${this.formulaIndex.size} formulas`);
  }

  /**
   * 按 SMILES 查找
   */
  findBySmiles(smiles: string): any | undefined {
    return this.smilesIndex.get(smiles);
  }

  /**
   * 按名称查找
   */
  findByName(name: string): any | undefined {
    return this.nameIndex.get(name.toLowerCase());
  }

  /**
   * 按分子式查找
   */
  findByFormula(formula: string): any[] {
    return this.formulaIndex.get(formula.toUpperCase()) || [];
  }

  /**
   * 搜索化合物
   * @param query 搜索查询
   */
  search(query: string): any[] {
    // 检查缓存
    const cached = this.searchCache.get(query);
    if (cached) {
      return cached;
    }

    const lowerQuery = query.toLowerCase();
    const results = new Set<any>();

    // 精确匹配名称
    const exactMatch = this.findByName(lowerQuery);
    if (exactMatch) {
      results.add(exactMatch);
    }

    // 精确匹配分子式
    const formulaMatches = this.findByFormula(query);
    for (const match of formulaMatches) {
      results.add(match);
    }

    // 模糊搜索
    for (const [keyword, compounds] of this.searchIndex.entries()) {
      if (keyword.includes(lowerQuery) || lowerQuery.includes(keyword)) {
        for (const compound of compounds) {
          results.add(compound);
        }
      }
    }

    const resultArray = Array.from(results);
    
    // 缓存结果
    this.searchCache.set(query, resultArray);

    return resultArray;
  }

  /**
   * 清空搜索缓存
   */
  clearSearchCache(): void {
    this.searchCache.clear();
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    smilesIndexSize: number;
    nameIndexSize: number;
    formulaIndexSize: number;
    searchCacheSize: number;
  } {
    return {
      smilesIndexSize: this.smilesIndex.size,
      nameIndexSize: this.nameIndex.size,
      formulaIndexSize: this.formulaIndex.size,
      searchCacheSize: this.searchCache.size(),
    };
  }
}

/**
 * SVG 渲染缓存
 */
class SVGRenderCache {
  private static instance: SVGRenderCache;
  private cache: LRUCache<string, string>;

  private constructor() {
    this.cache = new LRUCache(500);
  }

  static getInstance(): SVGRenderCache {
    if (!this.instance) {
      this.instance = new SVGRenderCache();
    }
    return this.instance;
  }

  /**
   * 生成缓存键
   */
  private makeCacheKey(smiles: string, width: number, height: number): string {
    return `${smiles}|${width}|${height}`;
  }

  /**
   * 获取缓存的 SVG
   */
  getCachedSVG(smiles: string, width: number, height: number): string | undefined {
    const key = this.makeCacheKey(smiles, width, height);
    return this.cache.get(key);
  }

  /**
   * 缓存 SVG
   */
  cacheSVG(smiles: string, width: number, height: number, svg: string): void {
    const key = this.makeCacheKey(smiles, width, height);
    this.cache.set(key, svg);
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.cache.clear();
    console.log('[SVGRenderCache] Cache cleared');
  }

  /**
   * 获取缓存统计
   */
  getStats(): { cacheSize: number } {
    return {
      cacheSize: this.cache.size(),
    };
  }
}

// 导出
export {
  LRUCache,
  FSRSCacheOptimizer,
  CompoundDBOptimizer,
  SVGRenderCache,
};

// 全局变量（兼容旧代码）
(globalThis as any).LRUCache = LRUCache;
(globalThis as any).FSRSCacheOptimizer = FSRSCacheOptimizer;
(globalThis as any).CompoundDBOptimizer = CompoundDBOptimizer;
(globalThis as any).SVGRenderCache = SVGRenderCache;
