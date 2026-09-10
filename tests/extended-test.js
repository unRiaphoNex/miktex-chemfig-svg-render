/**
 * 扩展测试 (现行链路: pdflatex -> pdftocairo -svg)
 * 覆盖模式转换、多包、无机式、标记清理、命名空间、hash、缓存、编译错误、实际编译。
 * 通过 vm 求值真实 src 取代旧版 require("../src/_unused/CompileService")。
 *
 * 用法: node tests/extended-test.js
 */

const path = require("path");
const os = require("os");
const { loadRealSrc } = require("./_load-real-src");

let passed = 0;
let failed = 0;

function assert(condition, name, detail = "") {
  if (condition) {
    console.log(`  ✓ ${name}`);
    passed++;
  } else {
    console.log(`  ✗ ${name} ${detail ? "- " + detail : ""}`);
    failed++;
  }
}

function assertContains(str, substr, name) {
  assert(str.includes(substr), name, `期望包含 "${substr}"`);
}

function assertNotContains(str, substr, name) {
  assert(!str.includes(substr), name, `期望不包含 "${substr}"`);
}

async function runTests() {
  const { get } = loadRealSrc();
  const buildTex = get("buildTex");
  const ensureSvgNamespace = get("ensureSvgNamespace");
  const getHash = get("getHash");
  const compileLatexLocal = get("compileLatexLocal");
  const parseLatexLog = get("parseLatexLog");
  const validateCode = get("validateCode");
  const SvgCacheManager = get("SvgCacheManager");

  if (typeof buildTex !== "function" || typeof compileLatexLocal !== "function" || typeof SvgCacheManager !== "function") {
    console.error("关键符号缺失 (buildTex/compileLatexLocal/SvgCacheManager)");
    process.exit(1);
  }

  // ========== 1. 模式转换 / 包裹测试 ==========
  console.log("\n=== 1. 模式转换 / 包裹测试 ===");

  const chemCode = "% NAME: test\n\\chemfig{*6(-=-=-=)} \\arrow{->[条件][]} \\chemfig{*6(-=--=-)}";
  const chemTex = buildTex("chem", chemCode);
  assertContains(chemTex, "\\schemestart", "chem模式自动包裹schemestart");
  assertContains(chemTex, "\\schemestop", "chem模式自动包裹schemestop");

  const tikzCode = "\\schemestart\n\\chemfig{A}\n\\schemestop";
  const tikzTex = buildTex("tikz", tikzCode);
  const schemestartCount = (tikzTex.match(/\\schemestart/g) || []).length;
  assert(schemestartCount === 1, `tikz模式不重复包裹schemestart (实际${schemestartCount}个)`);

  const miktexCode = "\\documentclass{article}\n\\begin{document}\ntest\n\\end{document}";
  const miktexTex = buildTex("miktex", miktexCode);
  assert(miktexTex === miktexCode, "miktex完整文档不修改");

  const miktexPartial = "\\chemfig{*6(-=-=-=)}";
  const miktexPartialTex = buildTex("miktex", miktexPartial);
  assertContains(miktexPartialTex, "\\documentclass", "miktex非完整文档自动补全documentclass");
  assertContains(miktexPartialTex, "\\schemestart", "miktex非完整文档自动包裹schemestart");

  // ========== 2. 多包支持测试 ==========
  console.log("\n=== 2. 多包支持测试 ===");

  const pkgCode = "% PACKAGES: circuitikz,pgfplots\n\\chemfig{*6(-=-=-=)}";
  const pkgTex = buildTex("chem", pkgCode);
  assertContains(pkgTex, "\\usepackage{circuitikz}", "提取circuitikz包");
  assertContains(pkgTex, "\\usepackage{pgfplots}", "提取pgfplots包");
  assertNotContains(pkgTex, "% PACKAGES:", "移除PACKAGES声明");

  const mhchemCode = "% PACKAGES: mhchem\n\\ce{H2O}";
  const mhchemTex = buildTex("chem", mhchemCode);
  const mhchemCount = (mhchemTex.match(/\\usepackage\{mhchem\}/g) || []).length;
  assert(mhchemCount === 1, `mhchem不重复导入 (实际${mhchemCount}个)`);

  const invalidPkgCode = "% PACKAGES: nonexistent,chemfig\n\\chemfig{A}";
  const invalidPkgTex = buildTex("chem", invalidPkgCode);
  assertNotContains(invalidPkgTex, "nonexistent", "无效包忽略");

  // ========== 3. 无机化学式测试 ==========
  console.log("\n=== 3. 无机化学式测试 ===");

  const ceCode = "\\ce{H2SO4 -> H2O + SO3}";
  const ceTex = buildTex("chem", ceCode);
  assertNotContains(ceTex, "\\schemestart", "纯\\ce{}不包裹schemestart");
  assertContains(ceTex, "\\usepackage{mhchem}", "无机化学式加载mhchem");

  const mixedCode = "\\chemfig{*6(-=-=-=)} + \\ce{H2O}";
  const mixedTex = buildTex("chem", mixedCode);
  assertContains(mixedTex, "\\schemestart", "混合chemfig+ce包裹schemestart");

  // ========== 4. 命名标记清理测试 ==========
  console.log("\n=== 4. 命名标记清理测试 ===");

  const nameCode = "%% name: test_reaction_001\n\\chemfig{A}";
  const nameTex = buildTex("chem", nameCode);
  assertNotContains(nameTex, "%% name:", "清理%% name:标记");

  const legacyNameCode = "% NAME: 旧格式名称\n\\chemfig{A}";
  const legacyNameTex = buildTex("chem", legacyNameCode);
  assertNotContains(legacyNameTex, "% NAME:", "清理% NAME:旧格式标记");

  const groupCode = "% GROUP: group1\n\\chemfig{A}";
  const groupTex = buildTex("chem", groupCode);
  assertNotContains(groupTex, "% GROUP:", "清理% GROUP:标记");

  // ========== 5. SVG 命名空间测试 ==========
  console.log("\n=== 5. SVG 命名空间测试 ===");

  const svgNoXlink = '<svg width="100" height="100"><use xlink:href="#g0"/></svg>';
  const fixedSvg = ensureSvgNamespace(svgNoXlink);
  assertContains(fixedSvg, 'xmlns:xlink="http://www.w3.org/1999/xlink"', "添加xlink命名空间");

  const svgHasXlink = '<svg xmlns:xlink="http://www.w3.org/1999/xlink" width="100"></svg>';
  const fixedSvg2 = ensureSvgNamespace(svgHasXlink);
  const xlinkCount = (fixedSvg2.match(/xmlns:xlink/g) || []).length;
  assert(xlinkCount === 1, `不重复添加xlink命名空间 (实际${xlinkCount}个)`);

  // ========== 6. Hash 稳定性测试 ==========
  console.log("\n=== 6. Hash 稳定性测试 ===");

  const h1 = getHash("test code");
  const h2 = getHash("test code");
  const h3 = getHash("different code");
  assert(h1 === h2, "相同输入hash相同");
  assert(h1 !== h3, "不同输入hash不同");
  assert(h1.length === 16, `hash长度为16 (实际${h1.length})`);

  // ========== 7. 缓存测试 (SvgCacheManager 双层: 内存 LRU + 磁盘) ==========
  console.log("\n=== 7. 缓存测试 ===");

  const cacheDir = path.join(os.tmpdir(), "chemfig-cache-test-" + Date.now());
  const cache = new SvgCacheManager(null, { enabled: true, folder: cacheDir, memMax: 5, version: "test" });
  const cacheKey = getHash("cache source code");
  const cacheSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="black"/></svg>';
  cache.set(cacheKey, cacheSvg);
  assert(cache.get(cacheKey) === cacheSvg, "缓存写入后读取命中");
  cache.clear();
  assert(cache.get(cacheKey) === undefined, "clear后缓存清空");

  // ========== 8. 编译错误测试 ==========
  console.log("\n=== 8. 编译错误测试 ===");

  // validateCode 检测花括号不匹配 (开 { 未闭 )
  const braceBroken = "\\chemfig{A";
  const vr = validateCode("chem", braceBroken);
  assert(vr.errors.length > 0, "validateCode 检测花括号不匹配");

  // 实际编译错误: 无效 chemfig (未闭合环括号) → pdflatex 报错
  const brokenCode = "\\chemfig{*6(-=-=-=}";
  let threw = false;
  let detail = null;
  try {
    await compileLatexLocal("chem", brokenCode);
  } catch (e) {
    threw = true;
    detail = e.detail;
  }
  assert(threw, "无效代码正确报错");
  assert(detail && Array.isArray(detail.errors) && detail.errors.length > 0, "错误detail包含errors列表");

  const parsed = parseLatexLog("! Undefined control sequence.\n! Foo\nLaTeX Warning: bar\nOverfull \\hbox (12pt)");
  assert(parsed.errors.length === 2, `parseLatexLog 提取2条error (实际${parsed.errors.length})`);
  assert(parsed.warnings.length >= 1, `parseLatexLog 提取warning (实际${parsed.warnings.length})`);

  // ========== 9. 支持的包列表测试 (基于真实 PKG_MAP) ==========
  console.log("\n=== 9. 支持的包列表测试 ===");

  const SUPPORTED = ["circuitikz", "pgfplots", "tikz-cd", "amssymb", "array", "chemformula", "siunitx"];
  const allPkgTex = buildTex("chem", "% PACKAGES: " + SUPPORTED.join(",") + "\n\\chemfig{A}");
  for (const p of SUPPORTED) {
    assertContains(allPkgTex, `\\usepackage{${p}}`, `支持包 ${p}`);
  }
  assertContains(allPkgTex, "\\usepackage{mhchem}", "基础包mhchem");
  assertContains(allPkgTex, "\\usepackage{chemfig}", "基础包chemfig");

  // ========== 10. 实际编译测试 (现行 pdflatex->pdftocairo) ==========
  console.log("\n=== 10. 实际编译测试 ===");

  const realTests = [
    { name: "苯环", code: "% NAME: benzene\n\\chemfig{*6(-=-=-=)}", mode: "chem" },
    { name: "反应式", code: "% NAME: reaction\n\\chemfig{A} \\arrow{->[cat][]} \\chemfig{B}", mode: "chem" },
    { name: "无机反应", code: "% NAME: inorganic\n\\ce{2H2 + O2 -> 2H2O}", mode: "chem" },
    { name: "tikz模式", code: "\\schemestart\n\\chemfig{A}\n\\arrow{->}\n\\chemfig{B}\n\\schemestop", mode: "tikz" },
  ];

  for (const t of realTests) {
    try {
      const svg = await compileLatexLocal(t.mode, t.code);
      assert(svg.includes("<svg"), `${t.name}编译成功`);
      assert(svg.includes("xmlns"), `${t.name}SVG有命名空间`);
    } catch (e) {
      assert(false, `${t.name}编译失败: ${(e.message || e).toString().substring(0, 60)}`);
    }
  }

  // ========== 总结 ==========
  console.log("\n" + "=".repeat(60));
  console.log(`扩展测试结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 项`);
  console.log("=".repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error("测试运行失败:", e);
  process.exit(1);
});