/**
 * Chem Studio - MikTeX 桥接服务
 *
 * 接收 chemfig LaTeX 代码，调用本地 MikTeX pdflatex 编译为 PDF，
 * 再通过 pdf2svg 转为矢量 SVG，返回给 Obsidian 插件。
 *
 * 优化点：
 *  - 跨域头（Obsidian Electron 渲染进程 fetch 到 127.0.0.1 需要 CORS + OPTIONS 预检）
 *  - pdflatex/pdf2svg 路径自动检测（含本机 D:\MiKTeX、默认 Program Files、用户名目录）
 *  - 渲染结果按 chemfig 哈希缓存，避免同一结构反复编译
 *  - 优先级任务队列（用户手动渲染 high 优先于自动渲染 normal；按 jobId 取消）
 *  - 进程约束：windowsHide + 超时 taskkill 整棵进程树 + 每任务独立编译目录
 *  - pdflatex 日志结构化解析（error/warning 行回传插件 UI）
 *  - /api/render-batch 批量渲染、/api/render-cancel 取消、/api/queue 队列状态
 *
 * 运行：node server.js
 * 依赖：MikTeX（pdflatex + chemfig/tikz）、pdf2svg、Node.js、express
 * 端口：9123（可通过环境变量 PORT 修改）
 */

const express = require("express");
const { execFile } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const app = express();
app.use(express.json({ limit: "4mb" }));

// ============ 跨域（Obsidian 渲染进程访问本地服务必需）============
app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
    }
    next();
});

// ============ 配置 ============
const PORT = process.env.PORT || 9123;

function resolvePdflatex() {
    const candidates = [];
    if (process.env.PDFLATEX_PATH) candidates.push(process.env.PDFLATEX_PATH);
    const user = (() => { try { return os.userInfo().username; } catch { return ""; } })();
    candidates.push(
        "D:\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe",
        "C:\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe",
        "C:\\Program Files\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe",
        `C:\\Users\\${user}\\AppData\\Local\\Programs\\MiKTeX\\miktex\\bin\\x64\\pdflatex.exe`,
        "pdflatex" // fall back to PATH
    );
    for (const c of candidates) {
        if (!c) continue;
        if (c === "pdflatex" || fs.existsSync(c)) return c;
    }
    return "pdflatex";
}

const PDFLATEX = resolvePdflatex();

// 从 pdflatex 路径推导 MiKTeX bin 目录，用于自动定位 pdftocairo/dvisvgm
function deriveBinDir(pdflatexPath) {
    if (!pdflatexPath || pdflatexPath === "pdflatex") return null;
    return path.dirname(pdflatexPath);
}
const MIKTEX_BIN = deriveBinDir(PDFLATEX);

function findInDirs(dirs, names) {
    for (const dir of dirs) {
        for (const n of names) {
            const p = path.join(dir, n);
            if (fs.existsSync(p)) return p;
        }
    }
    return null;
}

// Poppler 的 pdftocairo 是首选 PDF→SVG 转换器（用户下载的官网版优先于 MiKTeX 自带版）
const POPPLER_DIRS = [
    process.env.POPPLER_PATH,
    "D:\\download\\poppler-26.07.0\\Library\\bin",
    "D:\\poppler\\Library\\bin",
    "C:\\poppler\\Library\\bin",
    "C:\\Program Files\\poppler\\Library\\bin",
].filter((d) => d && fs.existsSync(d));

function resolvePdftocairo() {
    const envPath = process.env.PDFTOCAIRO_PATH;
    if (envPath && fs.existsSync(envPath)) return envPath;
    const inPoppler = findInDirs(POPPLER_DIRS, ["pdftocairo.exe", "pdftocairo"]);
    if (inPoppler) return inPoppler;
    if (MIKTEX_BIN) {
        const inMiktex = findInDirs([MIKTEX_BIN], ["pdftocairo.exe", "pdftocairo"]);
        if (inMiktex) return inMiktex;
    }
    return "pdftocairo";
}

function resolveDvisvgm() {
    const envPath = process.env.DVISVGM_PATH;
    if (envPath && fs.existsSync(envPath)) return envPath;
    if (MIKTEX_BIN) {
        const inMiktex = findInDirs([MIKTEX_BIN], ["dvisvgm.exe", "dvisvgm"]);
        if (inMiktex) return inMiktex;
    }
    return "dvisvgm";
}

const PDF2SVG = process.env.PDF2SVG_PATH || "pdf2svg";
const PDFTOCAIRO = resolvePdftocairo();
const DVISVGM = resolveDvisvgm();

const TMP_DIR = path.join(os.tmpdir(), "chem-studio-miktex");
const VERSION = "1.2.0";

// 并发与缓存
const MAX_CONCURRENCY = parseInt(process.env.MAX_CONCURRENCY || "3", 10);
const CACHE_MAX = 200;
const renderCache = new Map(); // key -> Buffer

if (!fs.existsSync(TMP_DIR)) {
    fs.mkdirSync(TMP_DIR, { recursive: true });
}

// ============ 优先级任务队列 (并发限流 + 取消 + 进程树回收) ============
// 语义: high (用户手动渲染) 优先于 normal (保存自动渲染); 支持按 jobId 取消排队/运行中任务。
const PRIORITY_RANK = { high: 0, normal: 1, low: 2 };

function killProcessTree(pid) {
    if (!pid) return;
    if (process.platform === "win32") {
        execFile("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true }, () => {});
    } else {
        try { process.kill(-pid, "SIGKILL"); } catch (e) { /* ignore */ }
    }
}

function createRenderQueue(limit) {
    let active = 0;
    const queue = []; // { jobId, priority, fn, resolve, reject, cancelFn, cancelled }
    const running = new Map(); // jobId -> cancelFn

    const next = () => {
        while (active < limit && queue.length > 0) {
            // 稳定排序: 高优先级 (rank 小) 排在前面, 同级按入队顺序
            queue.sort((a, b) => (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1));
            const item = queue.shift();
            if (item.cancelled) {
                item.reject(Object.assign(new Error("任务已取消"), { code: "CANCELLED" }));
                continue;
            }
            active++;
            running.set(item.jobId, item.cancelFn);
            Promise.resolve()
                .then(() => item.fn(item.jobId))
                .then((v) => item.resolve(v), (e) => item.reject(e))
                .finally(() => {
                    active--;
                    running.delete(item.jobId);
                    next();
                });
        }
    };

    return {
        submit(fn, opts = {}) {
            const jobId = opts.jobId || crypto.randomBytes(8).toString("hex");
            const priority = opts.priority || "normal";
            const cancelFn = opts.cancelFn || (() => {});
            const promise = new Promise((resolve, reject) => {
                queue.push({ jobId, priority, fn, resolve, reject, cancelFn, cancelled: false });
                next();
            });
            return { jobId, promise };
        },
        cancel(jobId) {
            for (const item of queue) {
                if (item.jobId === jobId) { item.cancelled = true; return true; }
            }
            const cancelFn = running.get(jobId);
            if (cancelFn) { try { cancelFn(); } catch (e) { /* ignore */ } return true; }
            return false;
        },
        cancelAll() {
            for (const item of queue) item.cancelled = true;
            for (const [, cancelFn] of running) { try { cancelFn(); } catch (e) { /* ignore */ } }
        },
        status() {
            return { active, queued: queue.length };
        },
    };
}
const renderQueue = createRenderQueue(MAX_CONCURRENCY);

// ============ LaTeX 模板 ============
const TEX_TEMPLATE = String.raw`
\documentclass[border=2pt]{standalone}
\usepackage{chemfig}
\usepackage{tikz}
\usepackage{amsmath}
\usepackage{textcomp}
\usepackage{mhchem}
\usetikzlibrary{arrows.meta}
\begin{document}
%%CHEMFIG_CONTENT%%
\end{document}
`;

// ============ 安全过滤 ============
const DANGEROUS_PATTERNS = [
    /\\write\d+/g,
    /\\input\{/g,
    /\\include\{/g,
    /\\read\d+/g,
    /\\openout/g,
    /\\closeout/g,
    /\\immediate/g,
    /\\write18/g,
    /\\shellescape/g,
    /\\usepackage/g,
    /\\documentclass/g,
    /\\begin\{document\}/g,
    /\\end\{document\}/g,
    /\\newread/g,
    /\\newwrite/g,
    /\\catcode/g,
];

function sanitizeChemfig(input) {
    let sanitized = input;
    for (const pattern of DANGEROUS_PATTERNS) {
        sanitized = sanitized.replace(pattern, "");
    }
    return sanitized.trim();
}

function cacheKey(chemfig) {
    return crypto.createHash("sha1").update(chemfig, "utf-8").digest("hex");
}

function cacheGet(key) {
    const buf = renderCache.get(key);
    if (buf) {
        // 简单 LRU：命中后移到末尾
        renderCache.delete(key);
        renderCache.set(key, buf);
    }
    return buf || null;
}

function cacheSet(key, buf) {
    renderCache.set(key, buf);
    if (renderCache.size > CACHE_MAX) {
        const oldest = renderCache.keys().next().value;
        renderCache.delete(oldest);
    }
}

// ============ 工具函数 ============
function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const timeout = options.timeout || 15000;
        const child = execFile(
            command,
            args,
            { timeout, maxBuffer: 20 * 1024 * 1024, windowsHide: true, cwd: options.cwd },
            (error, stdout, stderr) => {
                if (error) {
                    // 超时/被信号终止时, 强制回收整棵进程树 (pdflatex 可能派生 miktex 子进程)
                    if (error.killed || error.signal || error.code === "ETIMEDOUT") {
                        killProcessTree(child.pid);
                    }
                    reject(
                        new Error(
                            `命令执行失败: ${error.message}\n` +
                            `命令: ${command} ${args.join(" ")}\n` +
                            `stderr: ${stderr || "(无)"}\n` +
                            `stdout: ${stdout || "(无)"}`
                        )
                    );
                } else {
                    resolve({ stdout, stderr });
                }
            }
        );
        child.on("error", (e) => reject(e));
        if (options.onSpawn) options.onSpawn(child);
    });
}

function cleanupFiles(files) {
    for (const file of files) {
        fs.unlink(file, (err) => {
            if (err && err.code !== "ENOENT") {
                console.warn(`清理文件失败: ${file}`, err.message);
            }
        });
    }
}

/** 从 pdflatex 日志结构化提取 error 行与 warning 行 */
function parsePdflatexLog(log) {
    const lines = String(log || "").split("\n");
    const errors = lines.filter((l) => l.startsWith("!")).map((l) => l.slice(0, 300));
    const warnings = lines
        .filter((l) => /Warning|Overfull|Underfull|LaTeX Warning/.test(l))
        .map((l) => l.slice(0, 300));
    return { errors, warnings };
}

/**
 * PDF → SVG 转换，多级回退：
 *   1. pdf2svg（经典工具）
 *   2. pdftocairo -svg（MiKTeX 自带）
 *   3. dvisvgm --pdf（MiKTeX 自带）
 * 返回实际使用的转换器名称。
 */
async function convertPdfToSvg(pdfFile, svgFile) {
    const attempts = [
        { name: "pdftocairo", cmd: PDFTOCAIRO, args: ["-svg", pdfFile, svgFile] },
        { name: "pdf2svg", cmd: PDF2SVG, args: [pdfFile, svgFile] },
        { name: "dvisvgm", cmd: DVISVGM, args: ["--pdf", pdfFile, "-o", svgFile] },
    ];
    for (const a of attempts) {
        try {
            await runCommand(a.cmd, a.args, { timeout: 20000 });
            if (fs.existsSync(svgFile) && fs.statSync(svgFile).size > 0) {
                return a.name;
            }
        } catch (e) {
            // 尝试下一个转换器
        }
    }
    throw new Error("PDF→SVG转换失败（已尝试 pdftocairo / pdf2svg / dvisvgm）");
}

/**
 * 核心渲染：chemfig -> SVG Buffer（带缓存、限流、临时文件清理）
 */
async function renderChemfigToSvg(chemfig, opts = {}) {
    const key = cacheKey(chemfig);
    const cached = cacheGet(key);
    if (cached) {
        return { buffer: cached, cacheHit: true };
    }

    const priority = opts.priority === "high" ? "high" : "normal";
    // 取消句柄: 由 pdflatex 进程 spawn 后更新, 供队列 cancel() 调用杀掉进程树
    const cancelRef = { fn: () => {} };

    const { jobId, promise } = renderQueue.submit(async () => {
        // 每个任务独立子目录, 实现编译目录隔离 (tex/pdf/log 互不干扰)
        const jobDir = path.join(TMP_DIR, `job-${crypto.randomBytes(8).toString("hex")}`);
        fs.mkdirSync(jobDir, { recursive: true });
        const texFile = path.join(jobDir, "draw.tex");
        const pdfFile = path.join(jobDir, "draw.pdf");
        const svgFile = path.join(jobDir, "draw.svg");
        const logFile = path.join(jobDir, "draw.log");

        try {
            const texContent = TEX_TEMPLATE.replace("%%CHEMFIG_CONTENT%%", () => chemfig);
            fs.writeFileSync(texFile, texContent, "utf-8");

            await runCommand(
                PDFLATEX,
                ["-interaction=nonstopmode", "-halt-on-error", "-no-shell-escape", `-output-directory=${jobDir}`, texFile],
                { timeout: 30000, onSpawn: (child) => { cancelRef.fn = () => killProcessTree(child.pid); } }
            ).catch((e) => {
                // pdflatex 非零退出时 (halt-on-error), 结构化解析日志回传
                const logContent = fs.existsSync(logFile) ? fs.readFileSync(logFile, "utf-8") : "";
                const parsed = parsePdflatexLog(logContent || String(e.message));
                const err = new Error("pdflatex 编译失败: " + (parsed.errors[0] || String(e.message).split("\n")[0]));
                err.detail = { errors: parsed.errors, warnings: parsed.warnings, log: logContent.slice(0, 2000) };
                throw err;
            });

            if (!fs.existsSync(pdfFile)) {
                const err = new Error("pdflatex 未产出 PDF 文件");
                err.detail = { errors: [], warnings: [], log: "" };
                throw err;
            }

            await convertPdfToSvg(pdfFile, svgFile);

            if (!fs.existsSync(svgFile)) {
                throw new Error("SVG生成失败: 转换器未输出文件");
            }

            const svgBuffer = fs.readFileSync(svgFile);
            console.log(`[${jobId}] 渲染成功 (${svgBuffer.length} bytes, 优先级=${priority})`);
            return svgBuffer;
        } finally {
            try { fs.rmSync(jobDir, { recursive: true, force: true }); } catch (e) { /* ignore */ }
        }
    }, { priority, jobId: null, cancelFn: () => cancelRef.fn() });

    const buffer = await promise;
    cacheSet(key, buffer);
    return { buffer, cacheHit: false, jobId };
}

// ============ API 路由 ============

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        service: "chem-studio-miktex-bridge",
        version: VERSION,
        cacheSize: renderCache.size,
        concurrency: MAX_CONCURRENCY,
        queue: renderQueue.status(),
        timestamp: new Date().toISOString(),
    });
});

app.get("/api/queue", (req, res) => {
    res.json(renderQueue.status());
});

app.get("/api/config", (req, res) => {
    res.json({
        pdflatexPath: PDFLATEX,
        pdf2svgPath: PDF2SVG,
        pdftocairoPath: PDFTOCAIRO,
        dvisvgmPath: DVISVGM,
        tempDir: TMP_DIR,
        port: PORT,
        version: VERSION,
    });
});

/**
 * 渲染 chemfig 代码为 SVG
 * POST /api/render-chemfig
 * Body: { chemfigCode: "\\chemfig{C*6(-=-=-=)}" }
 * Response: image/svg+xml
 */
app.post("/api/render-chemfig", async (req, res) => {
    const { chemfigCode, priority } = req.body || {};

    if (!chemfigCode || typeof chemfigCode !== "string") {
        return res.status(400).json({
            error: "缺少 chemfigCode 参数",
            detail: "请求体应包含 chemfigCode 字符串字段",
        });
    }
    if (chemfigCode.length > 50000) {
        return res.status(413).json({ error: "chemfig代码过长" });
    }

    const sanitized = sanitizeChemfig(chemfigCode);
    if (!sanitized) {
        return res.status(400).json({
            error: "chemfig代码为空或包含非法命令",
        });
    }

    try {
        const { buffer, jobId } = await renderChemfigToSvg(sanitized, { priority });
        res.setHeader("Content-Type", "image/svg+xml");
        res.setHeader("Content-Length", buffer.length);
        res.setHeader("Cache-Control", "no-cache");
        if (jobId) res.setHeader("X-Job-Id", jobId);
        res.send(buffer);
    } catch (error) {
        console.error(`渲染失败:`, error.message);
        res.status(500).json({
            error: "渲染失败",
            detail: error.message,
            errors: (error.detail && error.detail.errors) || [],
            warnings: (error.detail && error.detail.warnings) || [],
        });
    }
});

/**
 * 取消渲染任务 (排队中直接移除, 运行中杀死进程树)
 * POST /api/render-cancel  Body: { jobId }
 */
app.post("/api/render-cancel", (req, res) => {
    const { jobId } = req.body || {};
    if (!jobId) return res.status(400).json({ error: "缺少 jobId" });
    const cancelled = renderQueue.cancel(jobId);
    res.json({ cancelled });
});

/**
 * 批量渲染
 * POST /api/render-batch
 * Body: { items: [{ id, chemfigCode }] }
 * Response: { results: [{ id, svg: <base64>, error? }] }
 */
app.post("/api/render-batch", async (req, res) => {
    const { items } = req.body || {};
    if (!Array.isArray(items)) {
        return res.status(400).json({ error: "items 应为数组" });
    }
    if (items.length > 50) {
        return res.status(413).json({ error: "单次批量最多50项" });
    }

    const results = [];
    for (const item of items) {
        const id = item && item.id != null ? item.id : null;
        try {
            if (!item || typeof item.chemfigCode !== "string") {
                throw new Error("缺少 chemfigCode");
            }
            const sanitized = sanitizeChemfig(item.chemfigCode);
            if (!sanitized) throw new Error("chemfig代码为空");
            const r = await renderChemfigToSvg(sanitized, { priority: item.priority });
            results.push({ id, svg: r.buffer.toString("base64") });
        } catch (e) {
            results.push({
                id,
                error: e.message,
                errors: (e.detail && e.detail.errors) || [],
                warnings: (e.detail && e.detail.warnings) || [],
            });
        }
    }
    res.json({ results });
});

// ============ 启动服务 ============
async function checkDependencies() {
    console.log("========================================");
    console.log("  Chem Studio - MikTeX 桥接服务 v" + VERSION);
    console.log("========================================");
    console.log(`端口: ${PORT}`);
    console.log(`pdflatex: ${PDFLATEX}`);
    console.log(`PDF→SVG: pdf2svg=${PDF2SVG}, pdftocairo=${PDFTOCAIRO}, dvisvgm=${DVISVGM}`);
    console.log(`临时目录: ${TMP_DIR}`);
    console.log(`并发上限: ${MAX_CONCURRENCY}`);
    console.log("========================================");

    try {
        await runCommand(PDFLATEX, ["--version"], { timeout: 8000 });
        console.log("[OK] pdflatex 可用");
    } catch (e) {
        console.warn("[WARN] pdflatex 不可用，请检查MikTeX安装路径");
        console.warn("       设置环境变量 PDFLATEX_PATH，或在 server.js 的 resolvePdflatex() 中加路径");
    }

    // 提示可用转换器（优先 pdf2svg，其次 pdftocairo / dvisvgm）
    let converterAvailable = false;
    for (const [name, cmd, args] of [
        ["pdf2svg", PDF2SVG, ["--help"]],
        ["pdftocairo", PDFTOCAIRO, ["-v"]],
        ["dvisvgm", DVISVGM, ["--version"]],
    ]) {
        try {
            await runCommand(cmd, args, { timeout: 8000 });
            console.log(`[OK] ${name} 可用`);
            converterAvailable = true;
        } catch (e) {
            console.log(`[--] ${name} 不可用`);
        }
    }
    if (!converterAvailable) {
        console.warn("[WARN] 未找到任何 PDF→SVG 转换器，渲染将失败");
        console.warn("       请安装 pdf2svg，或确保 MiKTeX 的 pdftocairo / dvisvgm 可用");
    }
}

checkDependencies().then(() => {
    app.listen(PORT, "127.0.0.1", () => {
        console.log("");
        console.log(`服务已启动: http://127.0.0.1:${PORT}`);
        console.log(`健康检查: http://127.0.0.1:${PORT}/api/health`);
        console.log("");
        console.log("保持此窗口运行，Obsidian插件将通过此服务渲染化学结构式");
        console.log("按 Ctrl+C 停止服务");
        console.log("");
    });
});

process.on("SIGINT", () => {
    console.log("\n正在停止服务...");
    // 善后: 终止正在运行/排队中的渲染任务
    renderQueue.cancelAll();
    for (const id of renderCache.keys()) { renderCache.delete(id); }
    fs.rm(TMP_DIR, { recursive: true, force: true }, () => {
        console.log("临时文件已清理");
        process.exit(0);
    });
});