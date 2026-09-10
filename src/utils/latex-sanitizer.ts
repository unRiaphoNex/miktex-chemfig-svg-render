// ========== latex-sanitizer.js - LaTeX 输入清洗 (防注入) ==========
// V2.0-iter: 黑名单过滤高危 LaTeX 命令, 阻止文件读写 / shell 执行 / 任意文件包含。
// local 模式: 插件侧清洗; bridge 模式: 插件侧清洗 + 桥接服务二次清洗 (双重防护)。

const LATEX_DANGEROUS_PATTERNS = [
  // shell 执行 (TeX Live \write18 / MiKTeX --enable-write18)
  { re: /\\write18/g, desc: "write18" },
  { re: /\\write\s*\d+/g, desc: "write<N>" },
  { re: /\\shellescape/g, desc: "shellescape" },
  { re: /\\ShellEscape/g, desc: "ShellEscape" },
  { re: /\\syscall/g, desc: "syscall" },
  { re: /\\system\b/g, desc: "system" },
  { re: /\\immediate/g, desc: "immediate" },
  // 文件包含 / 读写原语
  { re: /\\input\s*\{/g, desc: "input" },
  { re: /\\include\s*\{/g, desc: "include" },
  { re: /\\openin/g, desc: "openin" },
  { re: /\\openout/g, desc: "openout" },
  { re: /\\closein/g, desc: "closein" },
  { re: /\\closeout/g, desc: "closeout" },
  { re: /\\newread/g, desc: "newread" },
  { re: /\\newwrite/g, desc: "newwrite" },
  { re: /\\read\s*\d+/g, desc: "read<N>" },
  { re: /\\verbatiminput\s*\{/g, desc: "verbatiminput" },
  { re: /\\lstinputlisting\s*\{?/g, desc: "lstinputlisting" },
  // 类别码改动 (可被利用绕过过滤)
  { re: /\\catcode/g, desc: "catcode" },
];

/**
 * 清洗一段 LaTeX/chemfig 输入, 移除高危命令。
 * @param {string} code 用户输入的 LaTeX 代码
 * @returns {{ code: string, removed: string[] }} 清洗后的代码 + 被移除的命令列表
 */
function sanitizeLatex(code) {
  if (typeof code !== "string" || !code) return { code: "", removed: [] };
  let out = code;
  const removed = [];
  for (const p of LATEX_DANGEROUS_PATTERNS) {
    if (p.re.test(out)) {
      out = out.replace(p.re, "");
      removed.push(p.desc);
    }
    // 正则带 g 标志, test 后 lastIndex 需重置
    p.re.lastIndex = 0;
  }
  return { code: out, removed };
}

// 供 bridge 端二次清洗复用的同一黑名单 (仅用于日志/提示, 桥接服务另有自己的过滤)
function hasDangerousCommand(code) {
  return LATEX_DANGEROUS_PATTERNS.some((p) => {
    p.re.lastIndex = 0;
    return p.re.test(code);
  });
}
