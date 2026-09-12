// ========== 外部化学数据库服务 (v17.5.0) ==========
// 支持：PubChem / OPSIN / ChemSpider 查询
// 功能：化合物名称 → SMILES / 分子式 / 性质

class ExternalChemDatabase {
  constructor() {
    this.cache = new Map(); // 本地缓存
    this.cacheExpiry = 24 * 60 * 60 * 1000; // 24小时缓存
  }

  /**
   * 从 PubChem 查询化合物
   */
  async queryPubChem(name) {
    // 检查缓存
    const cacheKey = `pubchem:${name}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }
    }

    try {
      // 第一步：搜索 CID
      const searchUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/property/MolecularFormula,CanonicalSMILES,MolecularWeight/JSON`;
      
      const response = await fetch(searchUrl, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`PubChem 查询失败: ${response.status}`);
      }

      const data = await response.json();
      const properties = data.PropertyTable?.Properties?.[0];

      if (!properties) {
        throw new Error("未找到化合物");
      }

      const result = {
        source: "PubChem",
        name: name,
        cid: properties.CID,
        formula: properties.MolecularFormula,
        smiles: properties.CanonicalSMILES,
        molecularWeight: properties.MolecularWeight,
      };

      // 保存缓存
      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });

      return result;
    } catch (e) {
      console.error("PubChem 查询错误:", e);
      throw e;
    }
  }

  /**
   * 从 OPSIN 查询（名称 → IUPAC → SMILES）
   */
  async queryOPSIN(iupacName) {
    const cacheKey = `opsin:${iupacName}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }
    }

    try {
      const url = `https://opsin.ch.cam.ac.uk/opsin/${encodeURIComponent(iupacName)}.json`;
      
      const response = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`OPSIN 查询失败: ${response.status}`);
      }

      const data = await response.json();
      
      const result = {
        source: "OPSIN",
        name: iupacName,
        smiles: data.smiles,
        inchi: data.inchi,
        inchikey: data.inchikey,
      };

      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });

      return result;
    } catch (e) {
      console.error("OPSIN 查询错误:", e);
      throw e;
    }
  }

  /**
   * 综合查询：自动尝试多个数据库
   */
  async searchCompound(name) {
    const results = [];
    const errors = [];

    // 尝试 PubChem
    try {
      const pubchemResult = await this.queryPubChem(name);
      results.push(pubchemResult);
    } catch (e) {
      errors.push(`PubChem: ${e.message}`);
    }

    // 尝试 OPSIN
    try {
      const opsinResult = await this.queryOPSIN(name);
      results.push(opsinResult);
    } catch (e) {
      errors.push(`OPSIN: ${e.message}`);
    }

    if (results.length === 0) {
      throw new Error(`所有数据库查询失败: ${errors.join(", ")}`);
    }

    return {
      query: name,
      results: results,
      errors: errors,
      total: results.length
    };
  }

  /**
   * 从 SMILES 获取化合物名称
   */
  async getNameFromSmiles(smiles) {
    const cacheKey = `name:${smiles}`;
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheExpiry) {
        return cached.data;
      }
    }

    try {
      // 使用 PubChem 的快速身份查找
      const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/property/IUPACName,MolecularFormula/JSON`;
      
      const response = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) {
        throw new Error("查询失败");
      }

      const data = await response.json();
      const properties = data.PropertyTable?.Properties?.[0];

      if (!properties) {
        throw new Error("未找到");
      }

      const result = {
        iupacName: properties.IUPACName,
        formula: properties.MolecularFormula,
      };

      this.cache.set(cacheKey, {
        timestamp: Date.now(),
        data: result
      });

      return result;
    } catch (e) {
      console.error("名称查询错误:", e);
      throw e;
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.cache.clear();
    new Notice("数据库缓存已清除", 1500);
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      totalEntries: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// 导出全局变量
window.ExternalChemDatabase = ExternalChemDatabase;
