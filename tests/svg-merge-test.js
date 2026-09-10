// SVG 合并 (mergeSvgs) 与命名空间 (ensureSvgNamespace) 测试
// 运行: node tests/svg-merge-test.js

const path = require("path");
const fs = require("fs");
const vm = require("vm");

const srcDir = path.join(__dirname, "..", "src");
const code = fs.readFileSync(path.join(srcDir, "core", "svg-utils.ts"), "utf8");

const sandbox = {
  require: (id) => require(id),
  console,
  module: { exports: {} },
  exports: {},
};
sandbox.global = sandbox;

try {
  vm.runInNewContext(code, sandbox, { filename: "svg-utils.js" });
} catch (e) {
  console.error("加载 svg-utils 失败:", e.message);
  process.exit(1);
}

const { mergeSvgs, ensureSvgNamespace } = sandbox;

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; console.log(`  ✅ ${msg}`); }
  else { failed++; console.error(`  ❌ ${msg}`); }
}

console.log("=== SVG 合并与命名空间测试 ===\n");

const svgA = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="20"/></svg>';
const svgB = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect x="10" y="10" width="60" height="60"/></svg>';

// 1. mergeSvgs 基础合并
console.log("1. mergeSvgs 基础合并");
{
  const merged = mergeSvgs([svgA, svgB], [{ x: 10, y: 10, scaleX: 1, scaleY: 1 }, { x: 200, y: 50, scaleX: 2, scaleY: 2 }], 600, 300, "#ffffff");
  assert(merged.includes('<svg xmlns="http://www.w3.org/2000/svg"'), "根节点含 XML 命名空间");
  assert(merged.includes('translate(10,10) scale(1,1)'), "第1组分 translate/scale 正确");
  assert(merged.includes('translate(200,50) scale(2,2)'), "第2组分 translate/scale 正确");
  assert(merged.includes('<circle cx="50" cy="50" r="20"/>'), "保留第1组分内容");
  assert(merged.includes('<rect x="10" y="10" width="60" height="60"/>'), "保留第2组分内容");
  assert(merged.includes('width="600" height="300"'), "画布宽高正确");
  assert(merged.includes('viewBox="0 0 600 300"'), "viewBox 正确");
  assert(merged.includes('<rect width="600" height="300" fill="#ffffff"/>'), "含背景矩形");
}

// 2. 透明背景
console.log("\n2. 透明背景");
{
  const merged = mergeSvgs([svgA], [{ x: 0, y: 0 }], 200, 100, "transparent");
  assert(!merged.includes("<rect width="), "transparent 背景不含矩形");
}

// 3. 自定义背景色
console.log("\n3. 自定义背景色");
{
  const merged = mergeSvgs([svgA], [{ x: 0, y: 0 }], 200, 100, "#ff0000");
  assert(merged.includes('fill="#ff0000"'), "自定义红色背景");
}

// 4. layout 缺省值
console.log("\n4. layout 缺省值");
{
  const merged = mergeSvgs([svgA, svgB], [{ x: 5, y: 5 }], 400, 200, "#fff");
  // 第2组分 layout 缺失 -> 使用默认 { x: 50 + 1*150, y: 50 }
  assert(merged.includes('translate(5,5)'), "第1组分自定义位置");
  assert(merged.includes('translate(200,50)'), "第2组分默认位置 50+1*150=200");
}

// 5. scale 简写 (scale 替代 scaleX/scaleY)
console.log("\n5. scale 简写兼容");
{
  const merged = mergeSvgs([svgA], [{ x: 0, y: 0, scale: 3 }], 200, 100, "#fff");
  assert(merged.includes('scale(3,3)'), "scale:3 映射为 scale(3,3)");
}

// 6. ensureSvgNamespace
console.log("\n6. ensureSvgNamespace");
{
  const out = ensureSvgNamespace('<svg width="10"><g/></svg>');
  assert(out.includes('xmlns:xlink="http://www.w3.org/1999/xlink"'), "补 xlink 命名空间");
}
{
  const already = '<svg xmlns:xlink="http://www.w3.org/1999/xlink"><g/></svg>';
  assert(ensureSvgNamespace(already) === already, "已有 xlink 时保持原样 (幂等)");
}
{
  assert(ensureSvgNamespace(null) === null, "null 输入返回 null");
  assert(ensureSvgNamespace("") === "", "空串输入返回空串");
}

console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 项 ===`);
process.exit(failed > 0 ? 1 : 0);