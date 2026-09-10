// ========== bridge-client.ts - 桥接服务 HTTP 客户端 ==========
// V2.0-iter: bridge 模式下插件不再 spawn 任何 exe, 仅发送 HTTP 请求获取 SVG。
// MikTeX 全部调用逻辑转移至外部 Node 桥接服务 (D:\code\chem-studio\miktex-bridge\server.js)。
// 含: HTTP 请求超时 + 手动渲染优先级 (high) + 结构化错误 (errors/warnings) 透传。

const BRIDGE_TIMEOUT = 20000; // 单次 HTTP 请求超时上限 (ms)

class CompileBridgeClient {
  /**
   * @param {object} plugin Obsidian 插件实例
   * @param {object} opts { url: string, timeout: number }
   */
  constructor(plugin, opts = {}) {
    this.plugin = plugin;
    this.baseUrl = (opts.url || "http://127.0.0.1:9123").replace(/\/+$/, "");
    this.timeout = opts.timeout || BRIDGE_TIMEOUT;
  }

  /** 给 Promise 加超时 (requestUrl 无原生超时, 用竞态实现有界等待) */
  _withTimeout(promise, label) {
    const self = this;
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error(`${label} 超时 (${self.timeout}ms)`));
        }
      }, self.timeout);
      promise.then(
        (v) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(v);
          }
        },
        (e) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(e);
          }
        }
      );
    });
  }

  /** 健康检查 */
  async health() {
    try {
      const r = await this._withTimeout(
        requestUrl({ url: this.baseUrl + "/api/health", method: "GET" }),
        "桥接服务健康检查"
      );
      if (r.status < 200 || r.status >= 300) {
        return { ok: false, error: "HTTP " + r.status };
      }
      let data = {};
      try {
        data = JSON.parse(r.text);
      } catch (e) {
        /* ignore */
      }
      return { ok: true, data };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  /**
   * 渲染 chemfig 代码为 SVG。
   * @param {string} body 已清洗的 chemfig 代码
   * @param {string} priority "high"(手动) | "normal"(自动)
   * @returns {Promise<string>} SVG 文本
   */
  async render(body, priority = "normal") {
    const r = await this._withTimeout(
      requestUrl({
        url: this.baseUrl + "/api/render-chemfig",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chemfigCode: body, priority }),
      }),
      "桥接服务渲染"
    );
    if (r.status < 200 || r.status >= 300) {
      let detail = "";
      let errors = [];
      let warnings = [];
      try {
        const j = JSON.parse(r.text);
        detail = j.error || j.detail || r.text;
        errors = j.errors || [];
        warnings = j.warnings || [];
      } catch (e) {
        detail = r.text;
      }
      const err = new Error("桥接服务返回 " + r.status + ": " + String(detail || "").slice(0, 500));
      if (errors.length) err.errors = errors;
      if (warnings.length) err.warnings = warnings;
      throw err;
    }
    const svg = r.text;
    if (!svg || !svg.includes("<svg")) {
      throw new Error("桥接服务返回内容无效 (非 SVG)");
    }
    return svg;
  }
}
