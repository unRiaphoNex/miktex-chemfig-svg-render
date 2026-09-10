// ========== state/EnvironmentManager.js - 编译环境管理器 ==========
// 封装 MiKTeX 环境检测、命令可用性、懒加载初始化
// 从 src/main.js onload 中的环境检查逻辑提取 (v10.14.0 架构重构)

class EnvironmentManager {
  constructor() {
    this.ready = false;
    this.checked = false;
    this._initializer = null;
    this._missingCommands = [];
  }

  /**
   * 初始化懒加载检查器
   * 调用后不会立即执行检查，首次调用 check() 时才执行
   */
  initLazy() {
    const self = this;
    this._initializer = new LazyInitializer(async function () {
      perf.start("env-check");
      // V2.0-iter: 内核统一为 pdflatex + pdftocairo(-svg), 与桥接服务一致
      const hasPdflatex = await checkCommandExists("pdflatex");
      const hasConverter =
        (await checkCommandExists("pdftocairo")) ||
        (await checkCommandExists("pdf2svg")) ||
        (await checkCommandExists("dvisvgm"));
      perf.end("env-check");

      self._missingCommands = [];
      if (!hasPdflatex) self._missingCommands.push("pdflatex");
      if (!hasConverter) self._missingCommands.push("pdftocairo/pdf2svg/dvisvgm");

      if (self._missingCommands.length > 0) {
        new Notice(
          "[Chemfig-SVG] 缺失命令: " + self._missingCommands.join(", ") + "，编译功能不可用",
          10000
        );
        self.ready = false;
        return { ready: false, missing: self._missingCommands };
      }

      self.ready = true;
      self.checked = true;
      console.log("[Chemfig-SVG] 编译环境就绪 (懒加载初始化完成)");
      return { ready: true };
    });
    return this;
  }

  /**
   * 触发环境检查（异步，不阻塞）
   */
  async check() {
    if (!this._initializer) this.initLazy();
    try {
      return await this._initializer.get();
    } catch (e) {
      console.warn("[Chemfig-SVG] 环境初始化失败:", e.message);
      return { ready: false, error: e.message };
    }
  }

  /**
   * 环境是否就绪
   */
  isReady() {
    return this.ready;
  }

  /**
   * 是否已执行过检查
   */
  isChecked() {
    return this.checked;
  }

  /**
   * 获取缺失的命令列表
   */
  getMissingCommands() {
    return this._missingCommands.slice();
  }

  /**
   * 重置状态（用于调试）
   */
  reset() {
    this.ready = false;
    this.checked = false;
    this._initializer = null;
    this._missingCommands = [];
  }
}
