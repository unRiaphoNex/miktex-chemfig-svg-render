/**
 * Obsidian 插件构建脚本 (V2.0: esbuild 转译 + 拼接)
 * 使用 esbuild 将 src/**\/*.ts 转译为 CJS, 再按依赖顺序拼接为单文件 main.js。
 * 保留共享作用域语义 (各模块顶层变量/函数/类在拼接后互相可见)。
 * 用法: node build.js            -> 一次性构建
 *       node build.js --watch    -> 监听 src 变化自动重建
 */
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const SRC_DIR = path.join(__dirname, "src");
const OUTPUT = path.join(__dirname, "main.js");

// 合并顺序 (依赖关系)。.ts 走 esbuild 转译; .js (如 ocl.bundle.js 生成产物) 原样拷贝。
const FILES = [
  "header.ts",                  // 文件头注释
  "core/templates.ts",          // 模板库定义 (TPL_*, MODES)
  "core/parser.ts",             // 代码解析 (parseGroups, extractReactionInfo, getHash等)
  "core/converter.ts",          // 模式转换与代码清理 (convertCode, cleanBody等)
  "core/svg-utils.ts",          // SVG处理工具 (mergeSvgs, ensureSvgNamespace)
  "core/compiler.ts",           // 编译逻辑 (buildTex, svgToPng, checkCommandExists)
  "constants.ts",               // 工具类与正则常量 (PerfMonitor, UI, VirtualList等)
  "state/SettingsManager.ts",   // 设置管理器
  "state/EnvironmentManager.ts",// 编译环境管理器
  "ui/TemplateBrowser.ts",      // 模板浏览器
  "cache.ts",                   // LRU缓存、编译队列、性能报告
  "cm6.ts",                     // CM6 Live Preview (实验性)
  "settings.ts",                // 设置面板 (ChemfigSettingTab)
  "excalidraw-integration.ts",  // Excalidraw 深度集成
  "library.ts",                 // 结构式库
  "editor.ts",                  // 编辑器模态框
  "group-layout.ts",            // 组分调整模态框
  "sidebar.ts",                 // 左右侧边栏视图
  "ocl-tooltips.ts",            // OpenChemLib 工具栏图标 -> 工具名映射
  "ocl.bundle.js",              // OpenChemLib (IIFE 全局, 生成产物, 原样拷贝)
  "chemfig-parser.ts",          // 手写 chemfig → 分子图 解析器
  "molecule-editor.ts",         // 分子画布编辑器
  "latex-sanitizer.ts",         // LaTeX 输入清洗 (安全层)
  "temp-file-helper.ts",        // local 模式进程/临时文件管控
  "cache-manager.ts",           // SHA256 源码缓存管理器
  "bridge-client.ts",           // 桥接服务 HTTP 客户端
  "main.ts",                    // 主入口 (插件类)
];

function buildOnce() {
  let output = "";
  for (const file of FILES) {
    const filePath = path.join(SRC_DIR, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`  跳过(不存在): ${file}`);
      continue;
    }
    const content = fs.readFileSync(filePath, "utf8");
    let code = content;
    if (file.endsWith(".ts")) {
      try {
        code = esbuild.transformSync(content, {
          loader: "ts",
          format: "cjs",
          platform: "node",
          target: "esnext", // 不做语法降级, 仅剥离 TS 类型
          sourcefile: file,
        }).code;
      } catch (e) {
        console.error(`  esbuild 转译失败: ${file}\n${e.message}`);
        process.exit(1);
      }
    }
    output += `\n// ========== ${file} ==========\n${code}\n`;
    console.log(`  合并: ${file} (${code.length} chars)`);
  }

  fs.writeFileSync(OUTPUT, output, "utf8");
  console.log(`\n构建完成: ${OUTPUT} (${output.length} bytes, ${output.split("\n").length} 行)`);
}

if (process.argv.includes("--watch")) {
  // 简易监听: 任何 src 变化后全量重建
  let building = false;
  const rebuild = () => {
    if (building) return;
    building = true;
    try { buildOnce(); } finally { building = false; }
  };
  const filesToWatch = FILES.filter((f) => fs.existsSync(path.join(SRC_DIR, f)));
  for (const f of filesToWatch) {
    fs.watchFile(path.join(SRC_DIR, f), { interval: 300 }, rebuild);
  }
  console.log(`[watch] 监听 ${filesToWatch.length} 个文件, 修改后自动重建...`);
  rebuild();
} else {
  buildOnce();
}