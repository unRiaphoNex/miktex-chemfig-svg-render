// ========== 分子性质计算器 (v17.3.0) ==========
// 基于 OCL 计算分子理化性质
// 支持: 分子量、LogP、TPSA、HBD/HBA、Lipinski 规则

/**
 * 分子性质计算器类
 */
class MolecularPropertiesCalculator {
  /**
   * 从 SMILES 计算所有性质
   */
  static async calculateFromSmiles(smiles) {
    if (typeof OCL === "undefined") {
      throw new Error("OCL 未加载");
    }

    const mol = OCL.Molecule.fromSmiles(smiles);
    return this.calculateFromMolecule(mol);
  }

  /**
   * 从 OCL Molecule 对象计算性质
   */
  static calculateFromMolecule(mol) {
    if (!mol) {
      throw new Error("无效的分子对象");
    }

    const properties = {
      // 基本信息
      smiles: this.getCanonicalSmiles(mol),
      formula: this.getMolecularFormula(mol),
      molecularWeight: this.getMolecularWeight(mol),
      
      // 理化性质
      logP: this.calculateLogP(mol),
      tpsa: this.calculateTPSA(mol),
      
      // 氢键
      hbd: this.countHBD(mol), // 氢键供体
      hba: this.countHBA(mol), // 氢键受体
      
      // 其他
      rotatableBonds: this.countRotatableBonds(mol),
      aromaticRings: this.countAromaticRings(mol),
      heavyAtoms: mol.getAllAtoms(),
      
      // Lipinski 规则
      lipinski: this.checkLipinskiRules(mol),
    };

    return properties;
  }

  /**
   * 获取规范 SMILES
   */
  static getCanonicalSmiles(mol) {
    try {
      return mol.toSmiles();
    } catch (e) {
      return "N/A";
    }
  }

  /**
   * 获取分子式
   */
  static getMolecularFormula(mol) {
    try {
      // 从 OCL 获取原子计数
      const atoms = mol.getAtoms();
      const elementCounts = {};
      
      for (const atom of atoms) {
        const elem = atom.getAtomicNo();
        const symbol = this.atomicNumberToSymbol(elem);
        elementCounts[symbol] = (elementCounts[symbol] || 0) + 1;
      }

      // 构建分子式字符串
      let formula = "";
      const order = ["C", "H", "N", "O", "S", "P", "F", "Cl", "Br", "I"];
      
      for (const elem of order) {
        if (elementCounts[elem]) {
          formula += elem;
          if (elementCounts[elem] > 1) {
            formula += elementCounts[elem];
          }
          delete elementCounts[elem];
        }
      }
      
      // 剩余元素按字母排序
      const remaining = Object.keys(elementCounts).sort();
      for (const elem of remaining) {
        formula += elem;
        if (elementCounts[elem] > 1) {
          formula += elementCounts[elem];
        }
      }

      return formula || "N/A";
    } catch (e) {
      return "N/A";
    }
  }

  /**
   * 计算分子量
   */
  static getMolecularWeight(mol) {
    try {
      return mol.getMolweight().toFixed(2);
    } catch (e) {
      return "N/A";
    }
  }

  /**
   * 计算 LogP (辛醇/水分配系数)
   * 使用 Crippen 方法近似计算
   */
  static calculateLogP(mol) {
    try {
      if (mol.getLogP) {
        return mol.getLogP().toFixed(2);
      }
      // 简化的 LogP 估算
      const heavyAtoms = mol.getAllAtoms();
      const aromaticRings = this.countAromaticRings(mol);
      return (heavyAtoms * 0.3 - aromaticRings * 0.5).toFixed(2);
    } catch (e) {
      return "N/A";
    }
  }

  /**
   * 计算 TPSA (拓扑极性表面积)
   */
  static calculateTPSA(mol) {
    try {
      if (mol.getTPSA) {
        return mol.getTPSA().toFixed(2);
      }
      // 简化的 TPSA 估算
      const hba = this.countHBA(mol);
      return (hba * 20).toFixed(2); // 每个受体约 20 Å²
    } catch (e) {
      return "N/A";
    }
  }

  /**
   * 计算氢键供体数 (HBD)
   */
  static countHBD(mol) {
    try {
      if (mol.getHBD) {
        return mol.getHBD();
      }
      // 简化估算: N-H 和 O-H
      const atoms = mol.getAtoms();
      let count = 0;
      for (const atom of atoms) {
        const elem = atom.getAtomicNo();
        if (elem === 7 || elem === 8) { // N 或 O
          const implicitH = atom.getImplicitHcount();
          count += implicitH;
        }
      }
      return count;
    } catch (e) {
      return 0;
    }
  }

  /**
   * 计算氢键受体数 (HBA)
   */
  static countHBA(mol) {
    try {
      if (mol.getHBA) {
        return mol.getHBA();
      }
      // 简化估算: N 和 O 原子
      const atoms = mol.getAtoms();
      let count = 0;
      for (const atom of atoms) {
        const elem = atom.getAtomicNo();
        if (elem === 7 || elem === 8) { // N 或 O
          count++;
        }
      }
      return count;
    } catch (e) {
      return 0;
    }
  }

  /**
   * 计算可旋转键数
   */
  static countRotatableBonds(mol) {
    try {
      if (mol.getRotatableBonds) {
        return mol.getRotatableBonds();
      }
      // 简化估算
      return Math.floor(mol.getAllBonds() / 3);
    } catch (e) {
      return 0;
    }
  }

  /**
   * 计算芳香环数
   */
  static countAromaticRings(mol) {
    try {
      if (mol.getAromaticRings) {
        return mol.getAromaticRings();
      }
      // 简化估算: 检查原子是否芳香
      const atoms = mol.getAtoms();
      let aromaticAtoms = 0;
      for (const atom of atoms) {
        if (atom.isAromatic()) {
          aromaticAtoms++;
        }
      }
      return Math.floor(aromaticAtoms / 6); // 每个环约 6 个原子
    } catch (e) {
      return 0;
    }
  }

  /**
   * 检查 Lipinski 规则
   * 口服生物利用度预测:
   * - MW < 500
   * - LogP < 5
   * - HBD < 5
   * - HBA < 10
   */
  static checkLipinskiRules(mol) {
    const mw = parseFloat(this.getMolecularWeight(mol));
    const logP = parseFloat(this.calculateLogP(mol));
    const hbd = this.countHBD(mol);
    const hba = this.countHBA(mol);

    const violations = [];
    
    if (mw > 500) violations.push("分子量 > 500");
    if (logP > 5) violations.push("LogP > 5");
    if (hbd > 5) violations.push("HBD > 5");
    if (hba > 10) violations.push("HBA > 10");

    return {
      passed: violations.length === 0,
      violations: violations,
      score: 4 - violations.length, // 0-4 分
    };
  }

  /**
   * 原子序数转元素符号
   */
  static atomicNumberToSymbol(atomicNo) {
    const elements = {
      1: "H", 2: "He", 3: "Li", 4: "Be", 5: "B", 6: "C", 7: "N", 8: "O",
      9: "F", 10: "Ne", 11: "Na", 12: "Mg", 13: "Al", 14: "Si", 15: "P",
      16: "S", 17: "Cl", 18: "Ar", 19: "K", 20: "Ca", 26: "Fe", 29: "Cu",
      30: "Zn", 35: "Br", 47: "Ag", 53: "I", 78: "Pt", 79: "Au", 80: "Hg",
    };
    return elements[atomicNo] || `X${atomicNo}`;
  }

  /**
   * 生成性质报告 HTML
   */
  static generateReportHTML(properties) {
    const lipinskiColor = properties.lipinski.passed ? "#4caf50" : "#ff9800";
    const lipinskiText = properties.lipinski.passed ? "✅ 通过" : `⚠️ ${properties.lipinski.violations.length} 项违规`;

    return `
      <div class="mol-properties-report">
        <h3>🧪 分子性质报告</h3>
        
        <div class="properties-grid">
          <div class="property-item">
            <span class="label">分子式:</span>
            <span class="value">${properties.formula}</span>
          </div>
          <div class="property-item">
            <span class="label">分子量:</span>
            <span class="value">${properties.molecularWeight} Da</span>
          </div>
          <div class="property-item">
            <span class="label">LogP:</span>
            <span class="value">${properties.logP}</span>
          </div>
          <div class="property-item">
            <span class="label">TPSA:</span>
            <span class="value">${properties.tpsa} Å²</span>
          </div>
          <div class="property-item">
            <span class="label">HBD:</span>
            <span class="value">${properties.hbd}</span>
          </div>
          <div class="property-item">
            <span class="label">HBA:</span>
            <span class="value">${properties.hba}</span>
          </div>
          <div class="property-item">
            <span class="label">可旋转键:</span>
            <span class="value">${properties.rotatableBonds}</span>
          </div>
          <div class="property-item">
            <span class="label">芳香环:</span>
            <span class="value">${properties.aromaticRings}</span>
          </div>
          <div class="property-item">
            <span class="label">重原子:</span>
            <span class="value">${properties.heavyAtoms}</span>
          </div>
        </div>

        <div class="lipinski-check" style="border-left: 4px solid ${lipinskiColor}; padding-left: 12px; margin-top: 16px;">
          <strong>Lipinski 规则:</strong> ${lipinskiText}<br>
          <small>得分: ${properties.lipinski.score}/4</small>
          ${properties.lipinski.violations.length > 0 ? `
            <br><small>违规项: ${properties.lipinski.violations.join(", ")}</small>
          ` : ""}
        </div>
      </div>
    `;
  }
}

// 导出全局变量
window.MolecularPropertiesCalculator = MolecularPropertiesCalculator;
