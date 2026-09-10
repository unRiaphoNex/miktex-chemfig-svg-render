"use strict";
// 回归测试: loadMolecule 必须「setMolecule → moleculeChanged()」强制重绘，
// 否则片段库 / SMILES 加载后 OCL 画布不刷新、结构式“没有载入画布上”。
// 本测试直接 eval 真实 src/molecule-editor.ts。
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const srcPath = path.join(__dirname, "..", "src", "molecule-editor.ts");
const src = fs.readFileSync(srcPath, "utf8");

// Obsidian 最小桩
class Modal { constructor(app) { this.app = app; this.contentEl = null; } close() {} }
class Notice { constructor(msg) { this.msg = msg; } }
class Setting { constructor() { return this; } setName(){return this;} setDesc(){return this;} addText(){return this;} addButton(){return this;} onChange(){return this;} onClick(){return this;} setPlaceholder(){return this;} setButtonText(){return this;} setCta(){return this;} }

const sandbox = { Modal, Notice, Setting, console };
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const MoleculeEditorModal = vm.runInContext(src + "\nMoleculeEditorModal;", sandbox, { filename: "molecule-editor.ts" });

let failed = 0;
function assert(cond, msg) {
  if (cond) { console.log("PASS  " + msg); }
  else { console.log("FAIL  " + msg); failed++; }
}

// 静态回归: onOpen 内 nameBar 必须先声明再使用。
// 此前 nameBar 未声明即 nameBar.createEl(...), 在 onOpen 中途抛 ReferenceError,
// 导致命名/子结构/示例/片段库全部中断渲染(片段库无法载入的根因)。
const _decl = src.indexOf("const nameBar = mainCol.createDiv");
const _use = src.indexOf("= nameBar.createEl");
assert(_decl !== -1, "源文件声明了 nameBar 容器");
assert(_use !== -1, "源文件使用了 nameBar.createEl");
assert(_decl < _use, "nameBar 声明在首次使用之前 (decl=" + _decl + ", use=" + _use + ")");

const modal = new MoleculeEditorModal({}, "", () => {}, "");
const order = [];
modal.editor = {
  isDestroyed: false,
  setMolecule(mol) { order.push("setMolecule"); },
  moleculeChanged() { order.push("moleculeChanged"); },
};
modal.statusEl = { textContent: "" };

const fakeMol = { getAllAtoms: () => 3 };
modal.loadMolecule(fakeMol, "已加载片段: 苯 (c1ccccc1)");

assert(order.length === 2, "调用次数为 2 (setMolecule/moleculeChanged), 实际: " + JSON.stringify(order));
assert(order[0] === "setMolecule", "第 1 步 setMolecule: " + order[0]);
assert(order[1] === "moleculeChanged", "第 2 步强制重绘 moleculeChanged: " + order[1]);
assert(modal.statusEl.textContent === "已加载片段: 苯 (c1ccccc1)", "状态文本正确: " + modal.statusEl.textContent);

// 画布未初始化时应提示而不抛异常
const modal2 = new MoleculeEditorModal({}, "", () => {}, "");
modal2.editor = null;
let noticeCount = 0;
sandbox.Notice = class { constructor() { noticeCount++; } };
try { modal2.loadMolecule(fakeMol, "x"); assert(noticeCount === 1, "画布未初始化时弹出提示且不抛异常"); }
catch (e) { assert(false, "画布未初始化时不应抛异常: " + e.message); }

console.log(failed === 0 ? "\n全部通过" : "\n有 " + failed + " 项失败");
process.exit(failed === 0 ? 0 : 1);