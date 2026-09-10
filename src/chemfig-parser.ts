// ========== chemfig-parser.js - 手写 chemfig → 分子图 (原子/键/2D坐标) ==========
// 支持子集: 外层 \chemfig[...]{...} ; 键 - = ~ ; 角度 [:θ] [::θ] [θ] ;
// 原子 元素符号 + 下标 _n(显式氢) + 上标 ^+/^-/^2+/^{2+}(电荷) ;
// \chemabove{<原子>}{<电荷>} ; 分支 (...) ; 环闭合 ?[id](首次标记/再次闭合) ;
// 环 *n(...) 扁平「键+原子」序列(默认 C) ; 分隔符 \quad \arrow \ce 等触发停止。
//
// 输出 { atoms:[{el,h,charge,x,y}], bonds:[{a,b,order}] }，供 chemfigToMolecule
// 构建 OCL Molecule 后载入 CanvasEditor 或生成 SMILES。

const CHEMFIG_BOND_LEN = 1.0;

function chemfigParseCharge(s) {
  s = String(s || "").trim();
  s = s
    .replace(/\\scriptstyle/g, "")
    .replace(/[${}]/g, "")
    .trim();
  if (!s) return 0;
  let sign = 1,
    mag = "";
  if (s[0] === "-") {
    sign = -1;
    s = s.slice(1);
  } else if (s[0] === "+") {
    sign = 1;
    s = s.slice(1);
  }
  for (const ch of s) {
    if (/\d/.test(ch)) mag += ch;
    else break;
  }
  return sign * (parseInt(mag || "1", 10) || 1);
}

class ChemfigParser {
  constructor(src) {
    this.src = String(src || "");
    this.pos = 0;
    this.atoms = [];
    this.bonds = [];
    this.hooks = {};
  }

  eof() {
    return this.pos >= this.src.length;
  }
  peek(o) {
    return this.src[this.pos + (o || 0)];
  }
  ws() {
    while (!this.eof() && /\s/.test(this.peek())) this.pos++;
  }
  err(m) {
    throw new Error(
      "[chemfig-parser] " +
        m +
        " @ " +
        this.pos +
        " «" +
        this.src.slice(this.pos, this.pos + 14) +
        "»"
    );
  }

  addAtom(el, h, charge, x, y) {
    const id = this.atoms.length;
    this.atoms.push({ el, h: h || 0, charge: charge || 0, x, y });
    return id;
  }
  addBond(a, b, order) {
    this.bonds.push({ a, b, order: order || 1 });
  }

  parse() {
    this.pos = 0;
    this.ws();
    if (this.src.startsWith("\\chemfig", this.pos)) {
      this.pos += "\\chemfig".length;
      this.ws();
      if (this.peek() === "[") {
        const e = this.src.indexOf("]", this.pos);
        if (e >= 0) this.pos = e + 1;
        this.ws();
      }
      if (this.peek() === "{") this.pos++;
    }
    this.chain(null, 0, 0, 0);
    return { atoms: this.atoms, bonds: this.bonds };
  }

  chain(prev, x, y, angle) {
    let cur = prev,
      cx = x,
      cy = y,
      ca = angle;
    while (!this.eof()) {
      this.ws();
      if (this.eof()) break;
      const c = this.peek();
      if (c === "}" || c === ")") break;
      if (c === "+" || c === ";") break;
      if (c === "\\") {
        if (
          this.src.startsWith("\\quad", this.pos) ||
          this.src.startsWith("\\arrow", this.pos) ||
          this.src.startsWith("\\ce", this.pos) ||
          this.src.startsWith("\\schemestart", this.pos) ||
          this.src.startsWith("\\hspace", this.pos) ||
          this.src.startsWith("\\par", this.pos)
        )
          break;
        this.pos += 2;
        continue;
      }
      if (c === "?") {
        this.pos++;
        this.handleHook(cur);
        continue;
      }
      if (c === "(") {
        this.pos++;
        this.chain(cur, cx, cy, ca);
        if (this.peek() === ")") this.pos++;
        continue;
      }

      let order = 1,
        hasBond = false;
      if (c === "-") {
        order = 1;
        hasBond = true;
        this.pos++;
      } else if (c === "=") {
        order = 2;
        hasBond = true;
        this.pos++;
      } else if (c === "~") {
        order = 3;
        hasBond = true;
        this.pos++;
      }

      if (this.peek() === "*") {
        const r = this.readRing(cur, cx, cy, ca, hasBond, order);
        cur = r.lastId;
        cx = r.lastX;
        cy = r.lastY;
        continue;
      }

      if (!this.eof() && this.peek() === "[") ca = this.readAngle(ca);

      const at = this.readAtom();
      let nx = cx,
        ny = cy;
      if (hasBond) {
        nx = cx + CHEMFIG_BOND_LEN * Math.cos((ca * Math.PI) / 180);
        ny = cy + CHEMFIG_BOND_LEN * Math.sin((ca * Math.PI) / 180);
      }
      const id = this.addAtom(at.el, at.h, at.charge, nx, ny);
      if (cur !== null && hasBond) this.addBond(cur, id, order);
      cur = id;
      cx = nx;
      cy = ny;
    }
    return cur;
  }

  readAngle(ca) {
    if (this.peek() !== "[") this.err("期望 [");
    this.pos++;
    let rel = false;
    if (this.peek() === ":") {
      this.pos++;
      if (this.peek() === ":") {
        rel = true;
        this.pos++;
      }
    }
    let sign = 1;
    if (this.peek() === "-") {
      sign = -1;
      this.pos++;
    }
    let num = "";
    while (!this.eof() && /[0-9.]/.test(this.peek())) {
      num += this.peek();
      this.pos++;
    }
    while (!this.eof() && this.peek() !== "]") this.pos++;
    if (this.peek() === "]") this.pos++;
    const deg = sign * (parseFloat(num) || 0);
    return rel ? ca + deg : deg;
  }

  readAtom() {
    this.ws();
    if (this.src.startsWith("\\chemabove", this.pos)) {
      this.pos += "\\chemabove".length;
      this.ws();
      if (this.peek() === "{") this.pos++;
      const inner = this.readAtom();
      this.ws();
      if (this.peek() === "}") this.pos++;
      this.ws();
      let charge = 0;
      if (this.peek() === "{") {
        const e = this.src.indexOf("}", this.pos);
        if (e >= 0) {
          charge = chemfigParseCharge(this.src.slice(this.pos + 1, e));
          this.pos = e + 1;
        }
      }
      inner.charge = charge;
      return inner;
    }
    let el = "";
    if (!/[A-Za-z]/.test(this.peek() || "")) return { el: "C", h: 0, charge: 0 }; // 隐式碳
    el += this.peek();
    this.pos++;
    if (/[a-z]/.test(this.peek() || "")) {
      el += this.peek();
      this.pos++;
    }
    let h = 0,
      charge = 0;
    if (el !== "H") {
      while (this.peek() === "H") {
        this.pos++;
        let n = 1;
        if (this.peek() === "_") {
          this.pos++;
          n = this.readCount();
        }
        h += n;
      }
    }
    while (this.peek() === "^") {
      this.pos++;
      charge = this.readSuperscript();
    }
    return { el, h, charge };
  }

  readCount() {
    if (this.peek() === "{") {
      const e = this.src.indexOf("}", this.pos);
      const s = this.src.slice(this.pos + 1, e >= 0 ? e : undefined);
      this.pos = e >= 0 ? e + 1 : this.pos;
      return parseInt(s, 10) || 0;
    }
    let n = "";
    while (!this.eof() && /\d/.test(this.peek())) {
      n += this.peek();
      this.pos++;
    }
    return parseInt(n, 10) || 0;
  }

  readSuperscript() {
    if (this.peek() === "{") {
      const e = this.src.indexOf("}", this.pos);
      const s = this.src.slice(this.pos + 1, e >= 0 ? e : undefined);
      this.pos = e >= 0 ? e + 1 : this.pos;
      return chemfigParseCharge(s);
    }
    let sign = 1,
      mag = "";
    if (this.peek() === "-") {
      sign = -1;
      this.pos++;
    } else if (this.peek() === "+") {
      this.pos++;
    }
    while (!this.eof() && /\d/.test(this.peek())) {
      mag += this.peek();
      this.pos++;
    }
    return sign * (parseInt(mag || "1", 10) || 1);
  }

  handleHook(cur) {
    this.ws();
    if (this.peek() === "[") this.pos++;
    let id = "";
    while (!this.eof() && this.peek() !== "]" && this.peek() !== "," && this.peek() !== ")") {
      id += this.peek();
      this.pos++;
    }
    let order = 1;
    if (this.peek() === ",") {
      this.pos++;
      if (this.peek() === "{") {
        this.pos++;
        const c = this.peek();
        if (c === "=") order = 2;
        else if (c === "~") order = 3;
        else order = 1;
        while (!this.eof() && this.peek() !== "}") this.pos++;
        if (this.peek() === "}") this.pos++;
      } else {
        const c0 = this.peek();
        if (c0 === "=") order = 2;
        else if (c0 === "~") order = 3;
        while (!this.eof() && this.peek() !== "]" && this.peek() !== ",") this.pos++;
      }
    }
    while (!this.eof() && this.peek() !== "]") this.pos++;
    if (this.peek() === "]") this.pos++;
    if (cur === null) return;
    if (id in this.hooks) this.addBond(cur, this.hooks[id], order);
    else this.hooks[id] = cur;
  }

  readRing(cur, cx, cy, ca, hasBond, bondOrder) {
    if (this.peek() !== "*") this.err("期望 *");
    this.pos++;
    let n = "";
    while (!this.eof() && /\d/.test(this.peek())) {
      n += this.peek();
      this.pos++;
    }
    n = parseInt(n, 10) || 6;
    if (this.peek() !== "(") this.err("期望 (");
    this.pos++;

    const step = -360 / n;
    const ids = []; // 顶点 id 列表
    const bondOrd = []; // bondOrd[k] = token k 的键序, 连接顶点 k -> 顶点 (k+1) mod N

    // 逐个读取顶点: 键 + 原子 + (可多个)取代基分支
    let k = 0;
    while (k < n && !this.eof() && this.peek() !== ")" && this.peek() !== "}") {
      this.ws();
      if (this.peek() === ")" || this.peek() === "}") break;
      let order = 1;
      if (this.peek() === "-") {
        order = 1;
        this.pos++;
      } else if (this.peek() === "=") {
        order = 2;
        this.pos++;
      } else if (this.peek() === "~") {
        order = 3;
        this.pos++;
      }
      const at = this.readAtom();
      const ang = ca + k * step;
      let nx, ny;
      if (cur === null && k === 0) {
        nx = cx;
        ny = cy;
      } else {
        nx = cx + CHEMFIG_BOND_LEN * Math.cos((ang * Math.PI) / 180);
        ny = cy + CHEMFIG_BOND_LEN * Math.sin((ang * Math.PI) / 180);
      }
      const id = this.addAtom(at.el, at.h, at.charge, nx, ny);
      ids.push(id);
      bondOrd.push(order);
      // 该顶点后的取代基分支 (如 *6(-=-=(-OH)-=-) 中的 (-OH))
      this.ws();
      while (!this.eof() && this.peek() === "(") {
        this.pos++;
        this.chain(id, nx, ny, ang);
        this.ws();
        if (this.peek() === ")") this.pos++;
        this.ws();
      }
      k++;
    }
    if (this.peek() === ")") this.pos++;

    // 不足 n 个顶点时用隐式碳补齐
    while (k < n) {
      const ang = ca + k * step;
      const nx = cx + CHEMFIG_BOND_LEN * Math.cos((ang * Math.PI) / 180);
      const ny = cy + CHEMFIG_BOND_LEN * Math.sin((ang * Math.PI) / 180);
      ids.push(this.addAtom("C", 0, 0, nx, ny));
      bondOrd.push(1);
      k++;
    }

    if (ids.length === 0) return { lastId: cur, lastX: cx, lastY: cy };
    const N = ids.length;

    // 锚点连接: 前一原子 -> 环首顶点
    if (cur !== null && hasBond) this.addBond(cur, ids[0], bondOrder || 1);
    // 环内键: token k 连接顶点 k -> 顶点 (k+1) mod N
    for (let i = 0; i < N; i++) this.addBond(ids[i], ids[(i + 1) % N], bondOrd[i] || 1);

    const lastId = ids[N - 1];
    const lastX = this.atoms[ids[N - 1]].x;
    const lastY = this.atoms[ids[N - 1]].y;
    return { lastId, lastX, lastY };
  }
}

function parseChemfig(src) {
  return new ChemfigParser(src).parse();
}
