// ========== temp-file-helper.ts - local 模式进程 / 临时文件管控 ==========
// V2.0-iter: 渲染内核统一为 MikTeX pdflatex + pdftocairo(-svg), 与桥接服务一致。
//   pdflatex -> PDF -> pdftocairo -svg -> SVG  (poppler, 避开 dvisvgm --pdf 的 Ghostscript API error 87)
// 回退链: pdftocairo -> pdf2svg -> dvisvgm --pdf。
// 最大超时 12000ms (超时强制 kill), 全部临时文件 (tex/pdf/aux/log) 强制删除。
// 并发限制由调用方使用 CompileQueue 保证 (见 src/main.ts _doCompile)。

const LOCAL_COMPILE_TIMEOUT = 12000;

/** 执行外部命令, 超时由 execFile timeout 强制 kill 子进程 */
function execWithKill(cmd, args, opts) {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, opts, (err, stdout, stderr) => {
      if (err) {
        const e = new Error(err.message);
        e.stdout = stdout;
        e.stderr = stderr;
        e.code = err.code;
        e.signal = err.signal;
        reject(e);
      } else {
        resolve({ stdout, stderr });
      }
    });
    child.on("error", (e) => reject(e));
  });
}

/** 探测可用的 PDF->SVG 转换工具 (按优先级: pdftocairo > pdf2svg > dvisvgm --pdf) */
async function resolvePdfToSvgTool() {
  if (await checkCommandExists("pdftocairo")) return "pdftocairo";
  if (await checkCommandExists("pdf2svg")) return "pdf2svg";
  if (await checkCommandExists("dvisvgm")) return "dvisvgm";
  return null;
}

/** PDF -> SVG 转换 (带工具回退链) */
async function convertPdfToSvg(pdfPath, svgPath, tmp) {
  const tool = await resolvePdfToSvgTool();
  if (!tool) {
    throw new Error("缺少 PDF->SVG 转换工具 (pdftocairo / pdf2svg / dvisvgm)");
  }
  if (tool === "pdftocairo") {
    await execWithKill("pdftocairo", ["-svg", "-f", "1", "-l", "1", pdfPath, svgPath], {
      timeout: LOCAL_COMPILE_TIMEOUT,
      maxBuffer: 10 * 1024 * 1024,
      cwd: tmp,
    });
  } else if (tool === "pdf2svg") {
    await execWithKill("pdf2svg", [pdfPath, svgPath], {
      timeout: LOCAL_COMPILE_TIMEOUT,
      maxBuffer: 10 * 1024 * 1024,
      cwd: tmp,
    });
  } else {
    await execWithKill("dvisvgm", ["--pdf", "--no-fonts", "-o", svgPath, pdfPath], {
      timeout: LOCAL_COMPILE_TIMEOUT,
      maxBuffer: 10 * 1024 * 1024,
      cwd: tmp,
    });
  }
}

/** 从 pdflatex 日志提取结构化错误 (error 行 + warning 行) */
function parseLatexLog(fullLog) {
  const lines = String(fullLog || "").split("\n");
  const errors = lines.filter((l) => l.startsWith("!")).map((l) => l.slice(0, 300));
  const warnings = lines
    .filter((l) => /Warning|Overfull|Underfull/.test(l))
    .map((l) => l.slice(0, 300));
  return { errors, warnings };
}

/**
 * local 模式编译: pdflatex -> PDF -> pdftocairo -svg -> SVG, 返回 SVG 文本。
 * 失败时抛出带 .detail = { summary, fullLog, texContent, errors, warnings } 的 Error, 供 UI 展示。
 * @param {string} mode chem / tikz / miktex / ce
 * @param {string} body 已清洗的代码
 * @returns {Promise<string>} SVG 文本
 */
async function compileLatexLocal(mode, body) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "chemfig-"));
  const texPath = path.join(tmp, "draw.tex");
  const dviPath = path.join(tmp, "draw.dvi");
  const svgPath = path.join(tmp, "draw.svg");

  const makeDetail = (summary, fullLog) => {
    const parsed = parseLatexLog(fullLog);
    return {
      summary,
      fullLog,
      errors: parsed.errors,
      warnings: parsed.warnings,
      texContent: fs.existsSync(texPath) ? fs.readFileSync(texPath, "utf8") : buildTex(mode, body),
    };
  };

  try {
    fs.writeFileSync(texPath, buildTex(mode, body), "utf8");

    // 第一步: latex -> DVI (v10.16.0: 修复编译链路，使用 latex 而非 pdflatex)
    try {
      await execWithKill(
        "latex",
        [
          "-interaction=nonstopmode",
          "-halt-on-error",
          "-no-shell-escape",
          "-output-directory",
          tmp,
          texPath,
        ],
        { timeout: LOCAL_COMPILE_TIMEOUT, maxBuffer: 10 * 1024 * 1024, cwd: tmp }
      );
    } catch (e) {
      const logPath = path.join(tmp, "draw.log");
      let fullLog = "";
      let summary = e.message;
      if (fs.existsSync(logPath)) {
        fullLog = fs.readFileSync(logPath, "utf8");
        const errs = fullLog.split("\n").filter((l) => l.startsWith("!"));
        if (errs.length) summary = errs.slice(0, 3).join(" | ");
      }
      const err = new Error(summary);
      err.detail = makeDetail(summary, fullLog);
      throw err;
    }

    if (!fs.existsSync(dviPath)) {
      const err = new Error("latex 未生成 DVI 文件");
      err.detail = makeDetail("latex 未生成 DVI 文件", "");
      throw err;
    }

    // 第二步: DVI -> SVG (使用 dvisvgm --no-fonts)
    try {
      await execWithKill("dvisvgm", ["--no-fonts", "-o", svgPath, dviPath], {
        timeout: LOCAL_COMPILE_TIMEOUT,
        maxBuffer: 10 * 1024 * 1024,
        cwd: tmp,
      });
    } catch (e) {
      const detail = (e.stderr || e.message || "").slice(0, 200);
      const err = new Error("DVI->SVG: " + detail);
      err.detail = makeDetail("DVI->SVG: " + detail, e.stderr || e.message || "");
      throw err;
    }

    if (!fs.existsSync(svgPath)) {
      const err = new Error("DVI->SVG 未生成 SVG 文件");
      err.detail = makeDetail("DVI->SVG 未生成 SVG 文件", "");
      throw err;
    }

    return fs.readFileSync(svgPath, "utf8");
  } finally {
    // 强制删除全部临时文件, 杜绝残留
    try {
      fs.rmSync(tmp, { recursive: true, force: true });
    } catch (e) {
      /* ignore */
    }
  }
}

/** local 模式安全状态检查: 返回缺失的工具列表, 空数组表示就绪 */
async function checkLocalToolchain() {
  const missing = [];
  if (!(await checkCommandExists("latex"))) missing.push("latex");
  if (!(await checkCommandExists("dvisvgm"))) missing.push("dvisvgm");
  return missing;
}
