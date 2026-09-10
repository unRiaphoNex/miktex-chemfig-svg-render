// 组分调整与模式转换测试
// 运行: node tests/group-layout-test.js

const path = require("path");
const fs = require("fs");
const vm = require("vm");

// 模拟 obsidian 模块
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

// 读取 core/ 模块和 constants.js 并在沙箱中按顺序执行 (模拟 build.js 合并)
const srcDir = path.join(__dirname, "..", "src");
const loadOrder = [
  "core/templates.ts",
  "core/parser.ts",
  "core/converter.ts",
  "core/svg-utils.ts",
  "core/compiler.ts",
  "constants.ts",
];

let combinedCode = "";
for (const file of loadOrder) {
  const filePath = path.join(srcDir, file);
  if (fs.existsSync(filePath)) {
    combinedCode += fs.readFileSync(filePath, "utf8") + "\n";
  }
}

// 移除 require("obsidian") 行
combinedCode = combinedCode.replace(/const\s*\{[^}]*\}\s*=\s*require\(["']obsidian["']\);?/g, "");

// 创建沙箱上下文
const sandbox = {
  require: (id) => {
    if (id === "obsidian") return mockObsidian;
    return require(id);
  },
  console,
  module: { exports: {} },
  exports: {},
  __dirname: path.join(__dirname, "..", "src"),
};
sandbox.global = sandbox;

try {
  vm.runInNewContext(combinedCode, sandbox, { filename: "combined.js" });
} catch (e) {
  console.error("执行合并代码失败:", e.message);
  process.exit(1);
}

// 从沙箱中获取函数
const { cleanBody, wrapGroupCode, fixArrowSubscripts, convertCode, parseGroups } = sandbox;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ ${message}`);
  }
}

console.log("=== 组分调整与模式转换测试 ===\n");

// 1. cleanBody 测试
console.log("1. cleanBody 代码清理");
{
  const input = `% NAME: test
\\documentclass{standalone}
\\usepackage{chemfig}
\\begin{document}
\\chemfig{*6(-=-=-=)}
\\end{document}`;
  const result = cleanBody(input);
  assert(!result.includes("\\documentclass"), "移除 \\documentclass");
  assert(!result.includes("\\usepackage"), "移除 \\usepackage");
  assert(!result.includes("\\begin{document}"), "移除 \\begin{document}");
  assert(!result.includes("\\end{document}"), "移除 \\end{document}");
  assert(result.includes("\\chemfig"), "保留 \\chemfig 代码");
  assert(!result.includes("% NAME:"), "移除元数据注释");
}

// 2. fixArrowSubscripts 测试
console.log("\n2. fixArrowSubscripts 箭头下标修复");
{
  const input = "\\arrow{->[Na, liq. NH_3][EtOH]}";
  const result = fixArrowSubscripts(input);
  assert(result.includes("NH$_3$"), "NH_3 转为 NH$_3$");
}
{
  const input = "\\arrow{->[H_2SO_4][]}";
  const result = fixArrowSubscripts(input);
  assert(result.includes("H$_2$"), "H_2 正确转换");
  assert(result.includes("SO$_4$"), "SO_4 正确转换");
}

// 3. wrapGroupCode 测试
console.log("\n3. wrapGroupCode 组分代码包装");
{
  const input = "\\arrow{->[Na][EtOH]}";
  const result = wrapGroupCode(input);
  assert(result.includes("\\chemfig{}"), "箭头前后补空结构式");
  assert(result.includes("\\arrow"), "保留箭头代码");
}
{
  const input = "\\chemfig{*6(-=-=-=)}";
  const result = wrapGroupCode(input);
  assert(!result.includes("\\chemfig{}"), "chemfig组分不补空结构式");
}
{
  const input = `% NAME: test
\\chemfig{*6(-=-=-=)}`;
  const result = wrapGroupCode(input);
  assert(!result.includes("% NAME:"), "清理元数据注释");
}

// 4. convertCode 模式转换测试
console.log("\n4. convertCode 模式转换");
{
  const input = "\\chemfig{*6(-=-=-=)}\n\\arrow{->}\n\\chemfig{*6(-=--=-)}";
  const result = convertCode(input, "chem", "tikz");
  assert(result.includes("\\schemestart"), "chem转tikz添加schemestart");
  assert(result.includes("\\schemestop"), "chem转tikz添加schemestop");
}
{
  const input = "\\schemestart\n\\chemfig{*6(-=-=-=)}\n\\schemestop";
  const result = convertCode(input, "tikz", "chem");
  assert(!result.includes("\\schemestart"), "tikz转chem移除schemestart");
}
{
  const input = "\\chemfig{*6(-=-=-=)}";
  const result = convertCode(input, "chem", "miktex");
  assert(result.includes("\\documentclass"), "添加documentclass");
  assert(result.includes("\\usepackage{chemfig}"), "添加usepackage");
}
{
  const input = `\\documentclass{standalone}
\\usepackage{chemfig}
\\begin{document}
\\schemestart
\\chemfig{*6(-=-=-=)}
\\schemestop
\\end{document}`;
  const result = convertCode(input, "miktex", "chem");
  assert(!result.includes("\\documentclass"), "移除documentclass");
  assert(!result.includes("\\schemestart"), "移除schemestart");
}
{
  const input = "\\chemfig{*6(-=-=-=)}";
  const result = convertCode(input, "chem", "chem");
  assert(result === input, "相同模式返回原代码");
}
{
  const input = "\\ce{H2 + O2 -> H2O}";
  const result = convertCode(input, "ce", "chem");
  assert(result.includes("\\ce{"), "ce转chem保留\\ce{}命令");
}
{
  const input = `% NAME: test
\\chemfig{*6(-=-=-=)}`;
  const result = convertCode(input, "chem", "tikz");
  assert(result.includes("% NAME: test"), "保留元数据注释");
}

// 5. parseGroups 组分提取测试
console.log("\n5. parseGroups 组分提取");
{
  const input = `% NAME: Birch还原
\\schemestart
\\chemfig{*6(-=-=-=)}
\\arrow{->[Na, liq. NH_3][EtOH]}
\\chemfig{*6(-=--=-)}
\\schemestop`;
  const result = parseGroups(input);
  assert(result.nameLine.includes("Birch还原"), "提取nameLine");
  assert(result.groups.length === 3, "提取3个组分 (2结构式+1箭头)");
  assert(result.groups[0].type === "molecule", "第一个组分为molecule");
  assert(result.groups[1].type === "arrow", "第二个组分为arrow");
  assert(result.groups[2].type === "molecule", "第三个组分为molecule");
}
{
  const input = `% NAME: test
% GROUP: 苯环
\\chemfig{*6(-=-=-=)}
% GROUP: 箭头
\\arrow{->}
% GROUP: 产物
\\chemfig{*6(-=--=-)}`;
  const result = parseGroups(input);
  assert(result.groups.length === 3, "GROUP标记提取3个组分");
  assert(result.groups[0].name === "苯环", "第一个组分名称为苯环");
}
{
  const input = `\\schemestart
\\chemfig{A}
\\schemestop`;
  const result = parseGroups(input);
  assert(result.groups.length === 1, "schemestart/schemestop不作为组分");
}

// 6. 综合测试
console.log("\n6. 综合测试: 组分提取→包装");
{
  const input = `% NAME: Friedel-Crafts
\\chemfig{*6(-=-=-=)}
\\arrow{->[AlCl_3][CH_3Cl]}
\\chemfig{*6(-=-=-=)-CH_3}`;
  const { groups } = parseGroups(input);
  assert(groups.length === 3, "提取3个组分");
  const wrapped = groups.map(g => wrapGroupCode(g.code));
  assert(wrapped[1].includes("\\chemfig{}"), "箭头组分补空结构式");
  assert(wrapped[1].includes("AlCl$_3$"), "箭头下标修复");
}

console.log(`\n=== 测试结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 项 ===`);
process.exit(failed > 0 ? 1 : 0);
