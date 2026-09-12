/**
 * 性能优化模块 - 学习 Spaced Repetition Plugin 的性能优化
 * 
 * 1. FSRS 算法缓存
 * 2. 化合物数据库查询优化
 * 3. SVG 渲染缓存
 * 参考: https://github.com/st3v3nmw/obsidian-spaced-repetition
 */

// 注意: LRUCache 已经在 services/cache.ts 中定义，这里直接使用

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
   * 缓存评级结果
   */
  cacheRating(stability: number, difficulty: number, rating: number, newStability: number): void {
    const key = `${stability.toFixed(4)}:${difficulty.toFixed(4)}:${rating}`;
    this.ratingCache.set(key, newStability);
  }

  /**
   * 获取缓存的评级结果
   */
  getCachedRating(stability: number, difficulty: number, rating: number): number | undefined {
    const key = `${stability.toFixed(4)}:${difficulty.toFixed(4)}:${rating}`;
    return this.ratingCache.get(key);
  }

  /**
   * 缓存间隔计算结果
   */
  cacheInterval(stability: number, targetRetention: number, interval: number): void {
    const key = `${stability.toFixed(4)}:${targetRetention.toFixed(2)}`;
    this.intervalCache.set(key, interval);
  }

  /**
   * 获取缓存的间隔计算结果
   */
  getCachedInterval(stability: number, targetRetention: number): number | undefined {
    const key = `${stability.toFixed(4)}:${targetRetention.toFixed(2)}`;
    return this.intervalCache.get(key);
  }

  /**
   * 清空缓存
   */
  clearCache(): void {
    this.ratingCache.clear();
    this.intervalCache.clear();
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
class CompoundDbOptimizer {
  private static instance: CompoundDbOptimizer;
  private smilesIndex: Map<string, any>;
  private nameIndex: Map<string, any>;
  private formulaIndex: Map<string, any[]>;
  private searchCache: LRUCache<string, any[]>;

  private constructor() {
    this.smilesIndex = new Map();
    this.nameIndex = new Map();
    this.formulaIndex = new Map();
    this.searchCache = new LRUCache(200);
  }

  static getInstance(): CompoundDbOptimizer {
    if (!this.instance) {
      this.instance = new CompoundDbOptimizer();
    }
    return this.instance;
  }

  /**
   * 构建索引
   */
  buildIndex(compounds: any[]): void {
    this.smilesIndex.clear();
    this.nameIndex.clear();
    this.formulaIndex.clear();

    compounds.forEach((compound) => {
      // SMILES 索引
      if (compound.smiles) {
        this.smilesIndex.set(compound.smiles, compound);
      }

      // 名称索引
      if (compound.name) {
        this.nameIndex.set(compound.name.toLowerCase(), compound);
      }

      // 分子式索引
      if (compound.formula) {
        if (!this.formulaIndex.has(compound.formula)) {
          this.formulaIndex.set(compound.formula, []);
        }
        this.formulaIndex.get(compound.formula)!.push(compound);
      }
    });

    console.log(`[CompoundDbOptimizer] 索引构建完成: ${compounds.length} 个化合物`);
  }

  /**
   * 按 SMILES 查询
   */
  getBySmiles(smiles: string): any | undefined {
    return this.smilesIndex.get(smiles);
  }

  /**
   * 按名称查询
   */
  getByName(name: string): any | undefined {
    return this.nameIndex.get(name.toLowerCase());
  }

  /**
   * 按分子式查询
   */
  getByFormula(formula: string): any[] {
    return this.formulaIndex.get(formula) || [];
  }

  /**
   * 搜索（带缓存）
   */
  search(query: string): any[] {
    // 检查缓存
    const cached = this.searchCache.get(query);
    if (cached) return cached;

    // 执行搜索
    const results: any[] = [];
    const lowerQuery = query.toLowerCase();

    // 遍历所有索引
    for (const compound of this.nameIndex.values()) {
      if (
        compound.name?.toLowerCase().includes(lowerQuery) ||
        compound.smiles?.toLowerCase().includes(lowerQuery) ||
        compound.formula?.toLowerCase().includes(lowerQuery)
      ) {
        results.push(compound);
      }
    }

    // 缓存结果
    this.searchCache.set(query, results);

    return results;
  }

  /**
   * 清空搜索缓存
   */
  clearSearchCache(): void {
    this.searchCache.clear();
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
  private getKey(smiles: string, width: number, height: number): string {
    return `${smiles}:${width}x${height}`;
  }

  /**
   * 获取缓存的 SVG
   */
  get(smiles: string, width: number, height: number): string | undefined {
    return this.cache.get(this.getKey(smiles, width, height));
  }

  /**
   * 缓存 SVG
   */
  set(smiles: string, width: number, height: number, svg: string): void {
    this.cache.set(this.getKey(smiles, width, height), svg);
  }

  /**
   * 清空缓存
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * 获取缓存大小
   */
  size(): number {
    return this.cache.size();
  }
}

// 导出全局变量
// FSRSCacheOptimizer, CompoundDbOptimizer, SVGRenderCache
