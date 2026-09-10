// ========== 缓存与性能模块 ==========
// LRU 缓存、编译并发控制、性能报告

/**
 * LRU (最近最少使用) 缓存实现
 * 基于 Map 的有序特性，访问时重新插入到末尾
 */
class LRUCache {
  /**
   * @param {number} maxSize - 最大缓存条目数
   * @param {number} ttl - 缓存有效期 (毫秒), 0 表示永不过期
   */
  constructor(maxSize = 100, ttl = 300000) {
    this.maxSize = maxSize;
    this.ttl = ttl;
    this.cache = new Map();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * 获取缓存值
   * @param {string} key - 缓存键
   * @returns {*} 缓存值或 undefined
   */
  get(key) {
    if (!this.cache.has(key)) {
      this.misses++;
      return undefined;
    }
    const entry = this.cache.get(key);
    // 检查是否过期
    if (this.ttl > 0 && Date.now() - entry.time > this.ttl) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }
    // LRU: 删除并重新插入到末尾
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;
    return entry.value;
  }

  /**
   * 设置缓存值
   * @param {string} key - 缓存键
   * @param {*} value - 缓存值
   */
  set(key, value) {
    // 如果已存在，先删除 (用于更新位置)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }
    this.cache.set(key, { value, time: Date.now() });
    // 超过最大大小，删除最旧的 (第一个)
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.evictions++;
    }
  }

  /**
   * 删除缓存值
   * @param {string} key - 缓存键
   * @returns {boolean} 是否删除成功
   */
  delete(key) {
    return this.cache.delete(key);
  }

  /**
   * 检查缓存是否存在
   * @param {string} key - 缓存键
   * @returns {boolean} 是否存在
   */
  has(key) {
    if (!this.cache.has(key)) return false;
    const entry = this.cache.get(key);
    if (this.ttl > 0 && Date.now() - entry.time > this.ttl) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }

  /**
   * 清空缓存
   */
  clear() {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * 获取缓存大小
   * @returns {number} 缓存条目数
   */
  get size() {
    return this.cache.size;
  }

  /**
   * 获取缓存统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: total > 0 ? ((this.hits / total) * 100).toFixed(1) + "%" : "N/A",
    };
  }
}

/**
 * 编译并发控制器
 * 限制同时进行的编译任务数量，避免系统资源耗尽
 */
class CompileQueue {
  /**
   * @param {number} concurrency - 最大并发数
   */
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.active = 0;
    this.queue = [];
  }

  /**
   * 添加编译任务
   * @param {Function} task - 异步任务函数
   * @returns {Promise} 任务结果
   */
  async add(task) {
    if (this.active >= this.concurrency) {
      await new Promise((resolve) => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await task();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }

  /**
   * 获取队列状态
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      active: this.active,
      queued: this.queue.length,
      concurrency: this.concurrency,
    };
  }
}

/**
 * 性能报告生成器
 * 收集 PerfMonitor 数据并生成可读报告
 */
class PerformanceReporter {
  constructor() {
    this.records = [];
  }

  /**
   * 添加性能记录
   * @param {string} name - 操作名称
   * @param {number} duration - 耗时 (毫秒)
   */
  record(name, duration) {
    this.records.push({ name, duration, timestamp: Date.now() });
  }

  /**
   * 生成性能报告
   * @returns {string} 报告文本
   */
  generateReport() {
    if (this.records.length === 0) {
      return "暂无性能记录";
    }
    // 按操作名称分组统计
    const groups = {};
    for (const r of this.records) {
      if (!groups[r.name]) {
        groups[r.name] = { count: 0, total: 0, min: Infinity, max: 0 };
      }
      const g = groups[r.name];
      g.count++;
      g.total += r.duration;
      g.min = Math.min(g.min, r.duration);
      g.max = Math.max(g.max, r.duration);
    }
    // 生成报告
    let report = "=== 性能报告 ===\n\n";
    report += `总记录数: ${this.records.length}\n`;
    report += `操作类型数: ${Object.keys(groups).length}\n\n`;
    report += "操作名称 | 次数 | 平均(ms) | 最小(ms) | 最大(ms) | 总计(ms)\n";
    report += "-".repeat(70) + "\n";
    for (const [name, g] of Object.entries(groups)) {
      const avg = (g.total / g.count).toFixed(1);
      report += `${name} | ${g.count} | ${avg} | ${g.min} | ${g.max} | ${g.total.toFixed(1)}\n`;
    }
    // 慢操作警告
    const slowOps = Object.entries(groups)
      .filter(([, g]) => g.total / g.count > 100)
      .map(([name, g]) => `${name} (平均${(g.total / g.count).toFixed(1)}ms)`);
    if (slowOps.length > 0) {
      report += "\n⚠️  慢操作 (>100ms):\n";
      for (const op of slowOps) {
        report += `  - ${op}\n`;
      }
    }
    return report;
  }

  /**
   * 清空记录
   */
  clear() {
    this.records = [];
  }
}

// 注意: 在合并后的 main.js 中, 这些类是全局可用的, 不需要 module.exports
// module.exports = { LRUCache, CompileQueue, PerformanceReporter };
