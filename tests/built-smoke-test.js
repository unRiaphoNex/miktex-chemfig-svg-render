// 冒烟测试: 验证 esbuild 构建后的 main.js 能整体 eval, 且共享作用域未被模块包装破坏。
// 通过 require 桩 + vm 加载完整 main.js, 断言关键符号可见性与插件类方法齐全。
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const mainPath = path.join(__dirname, "..", "main.js");
const src = fs.readFileSync(mainPath, "utf8");

// require 桩
class Plugin {}
class Notice { constructor(m) { this.m = m; } }
class Modal { constructor() { this.contentEl = documentStub(); } }
class Menu { addItem() { return this; } setTitle() { return this; } setIcon() { return this; } onClick() { return this; } showAtMouseEvent() {} }
class FuzzySuggestModal extends Modal {}
class Setting { constructor() { return this; } setName(){return this;} setDesc(){return this;} addText(){return this;} addButton(){return this;} addToggle(){return this;} addDropdown(){return this;} addSlider(){return this;} onChange(){return this;} onClick(){return this;} setPlaceholder(){return this;} setButtonText(){return this;} setCta(){return this;} setValue(){return this;} setLimits(){return this;} setDynamicTooltip(){return this;} addOption(){return this;} addExtraButton(){return this;} }
class PluginSettingTab {}
class ItemView {}
class WorkspaceLeaf {}
function documentStub() { return { createEl(){return documentStubEl();}, addClass(){return this;}, appendChild(){return this;}, }; }
function documentStubEl() { return new Proxy({}, { get: (t, k) => { if (k === "style") return {}; return () => documentStubEl(); }, set: () => true, }); }

const stubMods = {
  obsidian: { Plugin, Notice, Modal, Menu, FuzzySuggestModal, Setting, PluginSettingTab, ItemView, WorkspaceLeaf, requestUrl: async () => ({ status: 200, text: "<svg/>", json: null, arrayBuffer: new ArrayBuffer(0) }), TFile: class {}, TFolder: class {}, Vault: class {}, normalizePath: (s) => s, Platform: {}, MarkdownView: class {} },
  child_process: { execFile: () => ({ on: () => {}, kill: () => {} }), spawn: () => ({ on: () => {}, kill: () => {} }) },
  fs: { writeFileSync: () => {}, readFileSync: () => "", existsSync: () => false, mkdtempSync: () => "", mkdirSync: () => {}, rmSync: () => {}, readdirSync: () => [], statSync: () => ({ isDirectory: () => false }) },
  path: path,
  os: require("os"),
  crypto: require("crypto"),
  "@codemirror/view": {},
  "@codemirror/state": {},
};

const sandbox = {
  module: { exports: {} },
  exports: {},
  require: (name) => {
    if (name in stubMods) return stubMods[name];
    return {};
  },
  console,
  globalThis: null,
  document: { createElement: () => documentStubEl(), body: documentStubEl(), querySelector: () => null, addEventListener: () => {} },
  window: {},
  navigator: {},
  URL: URL,
  FileReader: class { readAsDataURL() {} },
  Blob: class {},
  Image: class {},
  setTimeout, clearTimeout, setInterval, clearInterval,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

vm.runInContext(src, sandbox, { filename: "main.js" });
const PluginClass = sandbox.module.exports;

let failed = 0;
const assert = (cond, msg) => { if (cond) console.log("PASS  " + msg); else { console.log("FAIL  " + msg); failed++; } };

assert(typeof PluginClass === "function", "module.exports 是类");
assert(typeof PluginClass.prototype.onload === "function", "有 onload 方法");
assert(typeof PluginClass.prototype.compileTikz === "function", "有 compileTikz");
assert(typeof PluginClass.prototype._doCompile === "function", "有 _doCompile");
assert(typeof PluginClass.prototype._compileViaLocal === "function", "有 _compileViaLocal (共享作用域 compileLatexLocal 可达)");
assert(typeof PluginClass.prototype._compileViaBridge === "function", "有 _compileViaBridge");
assert(typeof PluginClass.prototype._renderReady === "function", "有 _renderReady");
assert(typeof PluginClass.prototype.openMoleculeEditor === "function", "有 openMoleculeEditor");

// 跨文件共享作用域: 需在 vm 内解析 (class/const/let 是词法绑定, 不是 sandbox 对象属性)
const typeOf = (expr) => vm.runInContext("typeof " + expr, sandbox);
assert(typeOf("SvgCacheManager") === "function", "SvgCacheManager 全局可见 (跨文件共享作用域)");
assert(typeOf("CompileBridgeClient") === "function", "CompileBridgeClient 全局可见");
assert(typeOf("sanitizeLatex") === "function", "sanitizeLatex 全局可见 (latex-sanitizer.ts)");
assert(typeOf("compileLatexLocal") === "function", "compileLatexLocal 全局可见 (temp-file-helper.ts)");

// 校验内置片段库所有 SMILES 可被 OpenChemLib 解析 (防止手写 SMILES 笔误)
const lib = vm.runInContext("MOLECULE_FRAGMENT_LIBRARY", sandbox);
const badSmiles = [];
if (Array.isArray(lib)) {
  for (const cat of lib) {
    for (const it of (cat.items || [])) {
      const smi = (it && it[1]) || "";
      if (!smi) { badSmiles.push((cat.cat) + " / " + (it && it[0]) + " = (空)"); continue; }
      const ok = vm.runInContext(
        "(function(){ try { const m = OpenChemLib.Molecule.fromSmiles(" + JSON.stringify(smi) + "); return !!(m && m.getAllAtoms && m.getAllAtoms() > 0); } catch (e) { return false; } })()",
        sandbox
      );
      if (!ok) badSmiles.push(cat.cat + " / " + it[0] + " = " + smi);
    }
  }
} else {
  badSmiles.push("MOLECULE_FRAGMENT_LIBRARY 不是数组");
}
assert(badSmiles.length === 0, "内置片段库 SMILES 全部可解析 (" + (Array.isArray(lib) ? lib.reduce((n, c) => n + (c.items || []).length, 0) : 0) + " 项)" + (badSmiles.length ? "，失败: " + badSmiles.join(" | ") : ""));

// 校验 molToFormula: 结构 → 分子式 与库内已知分子式一致 (Hill 记法)
const formBad = [];
if (Array.isArray(lib)) {
  for (const cat of lib) {
    for (const it of (cat.items || [])) {
      const smi = (it && it[1]) || "";
      const expect = (it && it[2]) || "";
      if (!smi || !expect) continue;
      const got = vm.runInContext(
        "(function(){ try { const m = OpenChemLib.Molecule.fromSmiles(" + JSON.stringify(smi) + "); return molToFormula(m); } catch (e) { return 'ERROR'; } })()",
        sandbox
      );
      if (got !== expect) formBad.push(it[0] + " = " + smi + " → " + got + " (期望 " + expect + ")");
    }
  }
}
assert(formBad.length === 0, "molToFormula 结构→分子式 与内置库一致 (" + (Array.isArray(lib) ? lib.reduce((n, c) => n + (c.items || []).filter((i) => i[2]).length, 0) : 0) + " 项有公式)" + (formBad.length ? "，不符: " + formBad.join(" | ") : ""));

console.log(failed === 0 ? "\n冒烟测试全部通过" : `\n${failed} 项失败`);
process.exit(failed === 0 ? 0 : 1);