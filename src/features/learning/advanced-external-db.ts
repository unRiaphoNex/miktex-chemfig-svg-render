// ========== 深化外部数据库集成 (v17.2.0) ==========
// 支持更多外部数据库、更丰富的化合物信息
// 支持批量查询、高级搜索、化合物性质预测

class AdvancedExternalDBService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 24 * 60 * 60 * 1000; // 24小时缓存
  }

  /**
   * 从 PubChem 查询完整化合物信息
   * @param {string} query 化合物名称或分子式
   */
  async queryPubChemDetailed(query) {
    const cacheKey = `pubchem-detailed-${query.toLowerCase()}`;
    
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.data;
      }
    }

    try {
      // 获取更多属性
      const properties = [
        "IUPACName",
        "MolecularFormula",
        "MolecularWeight",
        "CanonicalSMILES",
        "IsomericSMILES",
        "XLogP",
        "HydrogenBondDonorCount",
        "HydrogenBondAcceptorCount",
        "RotatableBondCount",
        "ExactMass",
        "MonoisotopicMass",
        "TPSA",
        "Complexity",
        "Charge",
        "HeavyAtomCount",
        "NumberOfHydrogenBondDonors",
        "NumberOfHydrogenBondAcceptors",
        "NumberOfRotatableBonds",
        "NumberOfRings",
      ].join(",");

      const searchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/property/${properties}/JSON`;
      
      const response = await fetch(searchUrl);
      if (!response.ok) {
        throw new Error(`PubChem API 错误: ${response.status}`);
      }

      const data = await response.json();
      const props = data.PropertyTable?.Properties?.[0];
      
      if (!props) {
        throw new Error("未找到化合物信息");
      }

      const result = {
        // 基本信息
        name: props.IUPACName || query,
        formula: props.MolecularFormula,
        molecularWeight: props.MolecularWeight,
        exactMass: props.ExactMass,
        monoisotopicMass: props.MonoisotopicMass,
        
        // 结构信息
        canonicalSmiles: props.CanonicalSMILES,
        isomericSmiles: props.IsomericSMILES,
        
        // 药物性质
        xLogP: props.XLogP,
        tpsa: props.TPSA,
        hbd: props.HydrogenBondDonorCount || props.NumberOfHydrogenBondDonors,
        hba: props.HydrogenBondAcceptorCount || props.NumberOfHydrogenBondAcceptors,
        rotatableBonds: props.RotatableBondCount || props.NumberOfRotatableBonds,
        rings: props.NumberOfRings,
        heavyAtoms: props.HeavyAtomCount,
        complexity: props.Complexity,
        charge: props.Charge,
        
        source: "PubChem",
      };

      // 计算 Lipinski 规则
      result.lipinski = this.checkLipinskiRules(result);

      this.cache.set(cacheKey, {
        data: result,
        timestamp: Date.now(),
      });

      return result;
    } catch (e) {
      console.error("[AdvancedDB] PubChem 详细查询失败:", e);
      throw e;
    }
  }

  /**
   * 检查 Lipinski 五规则
   */
  checkLipinskiRules(props) {
    const violations = [];
    
    // 分子量 < 500
    if (props.molecularWeight && props.molecularWeight > 500) {
      violations.push("分子量 > 500");
    }
    
    // LogP < 5
    if (props.xLogP && props.xLogP > 5) {
      violations.push("LogP > 5");
    }
    
    // 氢键供体 < 5
    if (props.hbd && props.hbd > 5) {
      violations.push("氢键供体 > 5");
    }
    
    // 氢键受体 < 10
    if (props.hba && props.hba > 10) {
      violations.push("氢键受体 > 10");
    }
    
    return {
      passes: violations.length === 0,
      violations: violations,
      description: violations.length === 0 
        ? "符合 Lipinski 五规则，具有良好的口服生物利用度" 
        : `违反 ${violations.length} 条规则: ${violations.join(", ")}`,
    };
  }

  /**
   * 从 PubChem 搜索相似化合物
   */
  async searchSimilar(query, limit = 10) {
    try {
      // 先获取基础信息
      const base = await this.queryPubChemDetailed(query);
      
      if (!base.canonicalSmiles) {
        throw new Error("未获取到 SMILES");
      }

      // 使用 PubChem 相似性搜索
      const searchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/similarity/${encodeURIComponent(base.canonicalSmiles)}/JSON?Threshold=90&MaxRecords=${limit}`;
      
      const response = await fetch(searchUrl);
      if (!response.ok) {
        throw new Error(`相似性搜索 API 错误: ${response.status}`);
      }

      const data = await response.json();
      const cids = data.IdentifierList?.CID || [];
      
      // 获取这些 CID 的详细信息
      const results = [];
      for (const cid of cids.slice(0, limit)) {
        try {
          const propsUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/property/IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES/JSON`;
          const propsResponse = await fetch(propsUrl);
          const propsData = await propsResponse.json();
          const props = propsData.PropertyTable?.Properties?.[0];
          
          if (props) {
            results.push({
              cid: cid,
              name: props.IUPACName,
              formula: props.MolecularFormula,
              molecularWeight: props.MolecularWeight,
              smiles: props.CanonicalSMILES,
              similarity: "90%+",
            });
          }
        } catch (e) {
          console.warn(`获取 CID ${cid} 详情失败:`, e);
        }
      }

      return results;
    } catch (e) {
      console.error("[AdvancedDB] 相似性搜索失败:", e);
      throw e;
    }
  }

  /**
   * 批量查询化合物
   */
  async batchSearch(queries) {
    const results = [];
    const errors = [];

    for (const query of queries) {
      try {
        const result = await this.queryPubChemDetailed(query);
        results.push({ query: query, data: result, error: null });
      } catch (e) {
        errors.push({ query: query, error: e.message });
        results.push({ query: query, data: null, error: e.message });
      }
    }

    return {
      results: results,
      errors: errors,
      successCount: results.filter((r) => r.data).length,
      errorCount: errors.length,
    };
  }

  /**
   * 预测化合物性质（基于规则）
   */
  predictProperties(smiles) {
    if (typeof OCL === "undefined") {
      throw new Error("OCL 未加载");
    }

    try {
      const mol = OCL.Molecule.fromSmiles(smiles);
      
      // 计算基本性质
      const mw = mol.getMolWeight();
      const formula = mol.getMolecularFormula();
      
      // 计算 TPSA
      const tpsa = mol.getTpsa();
      
      // 计算 LogP (简化版)
      const logp = this.calculateLogP(smiles);
      
      // 计算氢键供体/受体
      const hbd = this.countHBD(smiles);
      const hba = this.countHBA(smiles);
      
      // 计算可旋转键
      const rotBonds = this.countRotatableBonds(smiles);
      
      const properties = {
        molecularWeight: mw,
        formula: formula,
        tpsa: tpsa,
        xLogP: logp,
        hbd: hbd,
        hba: hba,
        rotatableBonds: rotBonds,
      };

      // 检查 Lipinski 规则
      properties.lipinski = this.checkLipinskiRules(properties);

      return properties;
    } catch (e) {
      console.error("[AdvancedDB] 性质预测失败:", e);
      throw e;
    }
  }

  /**
   * 简化 LogP 计算
   */
  calculateLogP(smiles) {
    // 简化版 LogP 计算（基于原子贡献）
    let logp = 0;
    
    // 碳原子贡献
    const carbonCount = (smiles.match(/C/g) || []).length;
    logp += carbonCount * 0.5;
    
    // 氧原子减少 LogP
    const oxygenCount = (smiles.match(/O/g) || []).length;
    logp -= oxygenCount * 1.0;
    
    // 氮原子减少 LogP
    const nitrogenCount = (smiles.match(/N/g) || []).length;
    logp -= nitrogenCount * 0.8;
    
    // 卤素增加 LogP
    const halogens = (smiles.match(/F|Cl|Br|I/g) || []).length;
    logp += halogens * 0.5;
    
    return parseFloat(logp.toFixed(2));
  }

  /**
   * 计算氢键供体数量
   */
  countHBD(smiles) {
    // 简化版：-OH, -NH2, -NH-
    let hbd = 0;
    
    // -OH
    hbd += (smiles.match(/O[H]/g) || []).length;
    
    // -NH2, -NH-
    hbd += (smiles.match(/N[H2]/g) || []).length;
    hbd += (smiles.match(/N[H]/g) || []).length;
    
    return hbd;
  }

  /**
   * 计算氢键受体数量
   */
  countHBA(smiles) {
    // 简化版：O, N, S, P
    let hba = 0;
    hba += (smiles.match(/O/g) || []).length;
    hba += (smiles.match(/N/g) || []).length;
    hba += (smiles.match(/S/g) || []).length;
    hba += (smiles.match(/P/g) || []).length;
    return hba;
  }

  /**
   * 计算可旋转键数量
   */
  countRotatableBonds(smiles) {
    // 简化版：非环、非双键的单键
    // 这里只是粗略估计
    const singleBonds = (smiles.match(/-/g) || []).length;
    return Math.floor(singleBonds / 2);
  }

  /**
   * 获取化合物的 3D 结构
   */
  async get3DStructure(smiles) {
    if (typeof OCL === "undefined") {
      throw new Error("OCL 未加载");
    }

    try {
      const mol = OCL.Molecule.fromSmiles(smiles);
      
      // 生成 3D 坐标
      mol.add3DCoordinates();
      
      // 导出为 MOL 文件
      const molFile = mol.toMolfile();
      
      return {
        smiles: smiles,
        molFile: molFile,
      };
    } catch (e) {
      console.error("[AdvancedDB] 3D 结构生成失败:", e);
      throw e;
    }
  }

  /**
   * 清空缓存
   */
  clearCache() {
    this.cache.clear();
    new Notice("外部数据库缓存已清空", 2000);
  }
}

/**
 * 高级化合物详情模态框
 */
class CompoundDetailModal extends Modal {
  constructor(app, compoundData) {
    super(app);
    this.compound = compoundData;
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("compound-detail-modal");

    // 标题
    contentEl.createEl("h2", { text: this.compound.name });

    // 基本信息
    const basicInfo = contentEl.createDiv({ cls: "compound-basic-info" });
    basicInfo.createH3({ text: "基本信息" });
    
    const infoTable = basicInfo.createDiv({ cls: "info-table" });
    
    const rows = [
      { label: "分子式", value: this.compound.formula },
      { label: "分子量", value: this.compound.molecularWeight },
      { label: "精确质量", value: this.compound.exactMass },
      { label: "SMILES", value: this.compound.canonicalSmiles },
    ];
    
    rows.forEach(({ label, value }) => {
      const row = infoTable.createDiv({ cls: "info-row" });
      row.createSpan({ text: label + ":", cls: "info-label" });
      row.createSpan({ text: value, cls: "info-value" });
    });

    // 药物性质
    if (this.compound.xLogP || this.compound.tpsa) {
      const properties = contentEl.createDiv({ cls: "compound-properties" });
      properties.createH3({ text: "药物性质" });
      
      const propTable = properties.createDiv({ cls: "info-table" });
      
      const propRows = [
        { label: "LogP", value: this.compound.xLogP },
        { label: "TPSA", value: this.compound.tpsa },
        { label: "氢键供体", value: this.compound.hbd },
        { label: "氢键受体", value: this.compound.hba },
        { label: "可旋转键", value: this.compound.rotatableBonds },
        { label: "环数", value: this.compound.rings },
        { label: "复杂度", value: this.compound.complexity },
      ];
      
      propRows.forEach(({ label, value }) => {
        if (value !== undefined && value !== null) {
          const row = propTable.createDiv({ cls: "info-row" });
          row.createSpan({ text: label + ":", cls: "info-label" });
          row.createSpan({ text: value, cls: "info-value" });
        }
      });
    }

    // Lipinski 规则
    if (this.compound.lipinski) {
      const lipinskiEl = contentEl.createDiv({ cls: "lipinski-check" });
      lipinskiEl.createH3({ text: "Lipinski 五规则检查" });
      
      const status = this.compound.lipinski.passes ? "✅ 通过" : "⚠️ 不通过";
      lipinskiEl.createDiv({ text: status, cls: "lipinski-status" });
      lipinskiEl.createP({ text: this.compound.lipinski.description });
      
      if (this.compound.lipinski.violations.length > 0) {
        const violationsList = lipinskiEl.createUl();
        this.compound.lipinski.violations.forEach((v) => {
          violationsList.createEl("li", { text: v });
        });
      }
    }

    // 来源
    contentEl.createP({ text: `数据来源: ${this.compound.source || "PubChem"}` });
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// 导出全局变量
// AdvancedExternalDBService, CompoundDetailModal
