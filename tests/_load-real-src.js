/**
 * 共享测试 harness: vm 求值真实 src 模块 (模拟 build.js 顺序合并)。
 * 覆盖现行渲染内核: core/compiler.ts (buildTex) + temp-file-helper.ts (compileLatexLocal,
 * pdflatex -> pdftocairo -svg) + cache-manager.ts (SvgCacheManager)。
 * 取代旧的 require("../src/_unused/CompileService") (已废弃的 latex -> dvisvgm 内核)。
 *
 * 用法:
 *   const { loadRealSrc } = require("./_load-real-src");
 *   const { get } = loadRealSrc();
 *   const buildTex = get("buildTex");           // function 声明 → 全局属性
 *   const compileLatexLocal = get("compileLatexLocal");
 *   const SvgCacheManager = get("SvgCacheManager"); // class 声明 → 词法绑定, 通过 runInContext 取
 */

const path = require("path");
const fs = require("fs");
const vm = require("vm");
const os = require("os");
const { execFile } = require("child_process");

const mockObsidian = {
  Plugin: class { constructor() {} },
  Notice: class { constructor() {} },
  Modal: class { constructor() {} open() {} close() {} },
  Menu: class { addItem() { return this; } setSubmenu() { return this; } },
  FuzzySuggestModal: class { constructor() {} open() {} },
  Setting: class { constructor() {} setName() { return this; } setDesc() { return this; } addToggle() { return this; } addText() { return this; } addDropdown() { return this; } },
  PluginSettingTab: class { constructor() {} display() {} },
  ItemView: class { constructor() {} },
  WorkspaceLeaf: class { constructor() {} },
};

const srcDir = path.join(__dirname, "..", "src");

// 顺序必须与 build.js 一致 (构建产物 main.js 正是按此合并)
const LOAD_ORDER = [
  "core/templates.ts",
  "core/parser.ts",
  "core/converter.ts",
  "core/svg-utils.ts",
  "core/compiler.ts",
  "constants.ts",
  "cache.ts",               // LRUCache / CompileQueue / PerformanceReporter (cache-manager 依赖)
  "temp-file-helper.ts",
  "cache-manager.ts",
];

function loadRealSrc() {
  let combined = "";
  for (const f of LOAD_ORDER) {
    const p = path.join(srcDir, f);
    if (!fs.existsSync(p)) throw new Error("缺少源文件: " + f);
    combined += fs.readFileSync(p, "utf8") + "\n";
  }
  // 移除 require("obsidian") (沙箱中以 mock 提供)
  combined = combined.replace(/const\s*\{[^}]*\}\s*=\s*require\(["']obsidian["']\);?/g, "");

  const sandbox = {
    require: (id) => (id === "obsidian" ? mockObsidian : require(id)),
    console,
    module: { exports: {} },
    exports: {},
    __dirname: srcDir,
    __filename: path.join(srcDir, "combined-real.js"),
    // 供 temp-file-helper / cache-manager / core 使用的 Node 依赖
    fs,
    path,
    os,
    execFile,
    crypto: require("crypto"),
    Buffer,
    process,
    setTimeout,
    clearTimeout,
  };

  const context = vm.createContext(sandbox);
  vm.runInContext(combined, context, { filename: "combined-real.js" });

  // 统一取值: 对 function 声明取全局属性, 对 class/const 词法绑定取 runInContext 求值
  const get = (name) => {
    try {
      return vm.runInContext(name, context);
    } catch (_) {
      return undefined;
    }
  };

  return { get, sandbox, context, LOAD_ORDER };
}

module.exports = { loadRealSrc, LOAD_ORDER, mockObsidian };