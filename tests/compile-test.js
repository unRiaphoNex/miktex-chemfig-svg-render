/**
 * 编译测试 (现行链路: pdflatex -> pdftocairo -svg)
 * 通过 vm 求值真实 src (core/compiler.ts buildTex + temp-file-helper.ts compileLatexLocal),
 * 取代旧版 require("../src/_unused/CompileService") (已废弃 latex -> dvisvgm 内核)。
 *
 * 用法: node tests/compile-test.js
 */

const { loadRealSrc } = require("./_load-real-src");

async function runTests() {
  const { get } = loadRealSrc();
  const buildTex = get("buildTex");
  const ensureSvgNamespace = get("ensureSvgNamespace");
  const getHash = get("getHash");
  const compileLatexLocal = get("compileLatexLocal");
  const checkLocalToolchain = get("checkLocalToolchain");

  const missing = [];
  for (const [n, fn] of [["buildTex", buildTex], ["ensureSvgNamespace", ensureSvgNamespace], ["getHash", getHash], ["compileLatexLocal", compileLatexLocal], ["checkLocalToolchain", checkLocalToolchain]]) {
    if (typeof fn !== "function") missing.push(n);
  }
  if (missing.length) {
    console.error("关键函数缺失: " + missing.join(", "));
    process.exit(1);
  }

  const results = [];
  let passed = 0;
  let failed = 0;

  async function run(name, fn) {
    try {
      const ok = await fn();
      if (ok) { console.log(`  ✓ ${name}`); passed++; }
      else { console.log(`  ✗ ${name} - 返回 false`); failed++; }
    } catch (e) {
      console.log(`  ✗ ${name} - 错误: ${(e.message || e).toString().substring(0, 120)}`);
      failed++;
    }
  }

  console.log("=".repeat(60));
  console.log("Chemfig SVG Renderer - 编译测试 (现行 pdflatex->pdftocairo 链路)");
  console.log("=".repeat(60));

  await run("getHash 稳定且 16 位", () => {
    const h1 = getHash("test");
    const h2 = getHash("test");
    return h1 === h2 && h1.length === 16;
  });

  await run("buildTex chem 自动包裹 schemestart/stop", () => {
    const tex = buildTex("chem", "\\chemfig{*6(-=-=-=)}");
    return tex.includes("\\schemestart") && tex.includes("\\schemestop");
  });

  await run("buildTex 提取额外包 circuitikz/pgfplots", () => {
    const tex = buildTex("chem", "% PACKAGES: circuitikz,pgfplots\n\\chemfig{*6(-=-=-=)}");
    return tex.includes("\\usepackage{circuitikz}") && tex.includes("\\usepackage{pgfplots}");
  });

  await run("buildTex 移除 PACKAGES 声明", () => {
    const tex = buildTex("chem", "% PACKAGES: mhchem\n\\chemfig{*6(-=-=-=)}");
    return !tex.includes("PACKAGES");
  });

  await run("ensureSvgNamespace 添加 xlink", () => {
    const svg = '<svg width="100" height="100"></svg>';
    return ensureSvgNamespace(svg).includes("xmlns:xlink");
  });

  await run("苯环编译", async () => {
    const svg = await compileLatexLocal("chem", "% NAME: 苯环\n\\chemfig{*6(-=-=-=)}");
    return svg.includes("<svg") && svg.includes("xmlns");
  });

  await run("反应式 chem 编译", async () => {
    const svg = await compileLatexLocal("chem", "% NAME: Birch还原\n\\chemfig{*6(-=-=-=)} \\arrow{->[Na, liq. NH$_3$][EtOH]} \\chemfig{*6(-=--=-)}");
    return svg.includes("<svg") && svg.includes("xmlns");
  });

  await run("无机化学式 \\ce{} 编译", async () => {
    const svg = await compileLatexLocal("chem", "\\ce{H2SO4 -> H2O + SO3}");
    return svg.includes("<svg") && svg.includes("xmlns");
  });

  await run("多包 mhchem 编译", async () => {
    const svg = await compileLatexLocal("chem", "% PACKAGES: mhchem\n% NAME: 碳酸钙\n\\ce{CaCO3 + 2HCl -> CaCl2 + H2O + CO2}");
    return svg.includes("<svg") && svg.includes("xmlns");
  });

  await run("tikz 模式编译", async () => {
    const svg = await compileLatexLocal("tikz", "% NAME: FC烷基化\n\\schemestart\n\\chemfig{*6(-=-=-=)} \\arrow{->[AlCl$_3$][CH$_3$Cl]} \\chemfig{*6(-=-=-(-CH_3)=)}\n\\schemestop");
    return svg.includes("<svg") && svg.includes("xmlns");
  });

  await run("checkLocalToolchain 返回数组", async () => {
    const missingTools = await checkLocalToolchain();
    if (!Array.isArray(missingTools)) return false;
    if (missingTools.length === 0) console.log("      (本机工具链就绪: pdflatex + pdftocairo)");
    else console.log("      (缺失工具: " + missingTools.join(", ") + ")");
    return true;
  });

  console.log("=".repeat(60));
  console.log(`结果: ${passed} 通过, ${failed} 失败, 共 ${passed + failed} 项`);
  console.log("=".repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error("测试运行失败:", e);
  process.exit(1);
});