// ========== 知识点导入功能 (v17.2.0) ==========
// 从外部文件导入知识点
// 支持格式：JSON、Markdown、CSV

class KnowledgeImporter {
  constructor(plugin) {
    this.plugin = plugin;
  }

  /**
   * 从 JSON 文件导入知识点
   * JSON 格式：
   * {
   *   "bookName": "教材名",
   *   "chapters": [
   *     {
   *       "chapter": "第1章 章节名",
   *       "sections": [
   *         {
   *           "id": "ORG-001",
   *           "title": "知识点标题",
   *           "content": "知识点内容",
   *           "keywords": ["关键词1", "关键词2"]
   *         }
   *       ]
   *     }
   *   ]
   * }
   */
  async importFromJSON(fileContent) {
    try {
      const data = JSON.parse(fileContent);
      
      if (!data.bookName || !data.chapters) {
        throw new Error("JSON 格式不正确：缺少 bookName 或 chapters 字段");
      }

      // 验证数据结构
      const validated = this.validateKnowledgeData(data);
      
      // 保存到 IndexedDB 或 localStorage
      await this.saveImportedData(validated);
      
      new Notice(`成功导入 ${validated.chapters.length} 章知识点`, 3000);
      return validated;
    } catch (e) {
      console.error("[KnowledgeImporter] JSON 导入失败:", e);
      new Notice(`导入失败: ${e.message}`, 3000);
      throw e;
    }
  }

  /**
   * 从 Markdown 文件导入知识点
   * Markdown 格式：
   * # 第1章 章节名
   * ## 知识点标题
   * 知识点内容...
   * 关键词：关键词1, 关键词2
   */
  async importFromMarkdown(fileContent, bookName = "导入的知识点") {
    try {
      const lines = fileContent.split("\n");
      const chapters = [];
      let currentChapter = null;
      let currentSection = null;
      let sectionContent = [];
      let sectionKeywords = [];

      for (const line of lines) {
        // 章节标题
        if (line.startsWith("# ")) {
          // 保存上一个 section
          if (currentSection && sectionContent.length > 0) {
            currentSection.content = sectionContent.join("\n").trim();
            currentSection.keywords = sectionKeywords;
            currentChapter.sections.push(currentSection);
          }
          // 保存上一个 chapter
          if (currentChapter) {
            chapters.push(currentChapter);
          }
          // 新建 chapter
          currentChapter = {
            chapter: line.substring(2).trim(),
            sections: [],
          };
          currentSection = null;
          sectionContent = [];
          sectionKeywords = [];
        }
        // 知识点标题
        else if (line.startsWith("## ") && currentChapter) {
          // 保存上一个 section
          if (currentSection && sectionContent.length > 0) {
            currentSection.content = sectionContent.join("\n").trim();
            currentSection.keywords = sectionKeywords;
            currentChapter.sections.push(currentSection);
          }
          // 新建 section
          currentSection = {
            id: `IMP-${chapters.length + 1}-${currentChapter.sections.length + 1}`,
            title: line.substring(3).trim(),
            content: "",
            keywords: [],
          };
          sectionContent = [];
          sectionKeywords = [];
        }
        // 关键词行
        else if (line.startsWith("关键词：") && currentSection) {
          const keywordsStr = line.substring(4).trim();
          sectionKeywords = keywordsStr.split(/[,，、]/).map((k) => k.trim()).filter((k) => k);
        }
        // 内容行
        else if (currentSection) {
          sectionContent.push(line);
        }
      }

      // 保存最后一个 section
      if (currentSection && sectionContent.length > 0) {
        currentSection.content = sectionContent.join("\n").trim();
        currentSection.keywords = sectionKeywords;
        currentChapter.sections.push(currentSection);
      }
      // 保存最后一个 chapter
      if (currentChapter) {
        chapters.push(currentChapter);
      }

      const data = {
        bookName: bookName,
        chapters: chapters,
      };

      // 验证并保存
      const validated = this.validateKnowledgeData(data);
      await this.saveImportedData(validated);
      
      new Notice(`成功从 Markdown 导入 ${chapters.length} 章知识点`, 3000);
      return validated;
    } catch (e) {
      console.error("[KnowledgeImporter] Markdown 导入失败:", e);
      new Notice(`导入失败: ${e.message}`, 3000);
      throw e;
    }
  }

  /**
   * 从 CSV 文件导入知识点
   * CSV 格式：
   * id,title,content,keywords
   * ORG-001,知识点标题,知识点内容,关键词1;关键词2
   */
  async importFromCSV(fileContent, bookName = "导入的知识点") {
    try {
      const lines = fileContent.split("\n");
      const headers = lines[0].split(",").map((h) => h.trim());
      
      const chapters = [{
        chapter: "导入的知识点",
        sections: [],
      }];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values = line.split(",").map((v) => v.trim());
        const section = {};
        
        headers.forEach((header, index) => {
          section[header] = values[index] || "";
        });

        // 转换格式
        const converted = {
          id: section.id || `IMP-${i}`,
          title: section.title || `知识点 ${i}`,
          content: section.content || "",
          keywords: section.keywords ? section.keywords.split(/[;；]/).map((k) => k.trim()) : [],
        };

        chapters[0].sections.push(converted);
      }

      const data = {
        bookName: bookName,
        chapters: chapters,
      };

      // 验证并保存
      const validated = this.validateKnowledgeData(data);
      await this.saveImportedData(validated);
      
      new Notice(`成功从 CSV 导入 ${chapters[0].sections.length} 个知识点`, 3000);
      return validated;
    } catch (e) {
      console.error("[KnowledgeImporter] CSV 导入失败:", e);
      new Notice(`导入失败: ${e.message}`, 3000);
      throw e;
    }
  }

  /**
   * 验证知识点数据
   */
  validateKnowledgeData(data) {
    if (!data.bookName) {
      throw new Error("缺少 bookName 字段");
    }
    if (!Array.isArray(data.chapters)) {
      throw new Error("chapters 必须是数组");
    }

    data.chapters.forEach((chapter, chapterIndex) => {
      if (!chapter.chapter) {
        throw new Error(`第 ${chapterIndex + 1} 章缺少 chapter 字段`);
      }
      if (!Array.isArray(chapter.sections)) {
        throw new Error(`第 ${chapter.chapter} 的 sections 必须是数组`);
      }

      chapter.sections.forEach((section, sectionIndex) => {
        if (!section.id) {
          section.id = `IMP-${chapterIndex + 1}-${sectionIndex + 1}`;
        }
        if (!section.title) {
          throw new Error(`第 ${chapter.chapter} 的第 ${sectionIndex + 1} 个知识点缺少 title 字段`);
        }
        if (!section.content) {
          section.content = "";
        }
        if (!Array.isArray(section.keywords)) {
          section.keywords = [];
        }
      });
    });

    return data;
  }

  /**
   * 保存导入的数据
   */
  async saveImportedData(data) {
    const storageKey = "chemfig-imported-knowledge";
    
    // 读取现有数据
    let existing = [];
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        existing = JSON.parse(saved);
      }
    } catch (e) {
      existing = [];
    }

    // 添加新数据
    existing.push(data);

    // 保存
    localStorage.setItem(storageKey, JSON.stringify(existing));
  }

  /**
   * 获取导入的知识点
   */
  getImportedKnowledge() {
    const storageKey = "chemfig-imported-knowledge";
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("[KnowledgeImporter] 读取导入数据失败:", e);
    }
    return [];
  }

  /**
   * 清空导入的知识点
   */
  async clearImported() {
    localStorage.removeItem("chemfig-imported-knowledge");
    new Notice("已清空导入的知识点", 2000);
  }
}

/**
 * 知识点导入模态框
 */
class KnowledgeImportModal extends Modal {
  constructor(app) {
    super(app);
    this.importer = new KnowledgeImporter(null);
  }

  async onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("knowledge-import-modal");

    contentEl.createEl("h2", { text: "📥 导入知识点" });

    // 说明
    const desc = contentEl.createDiv({ cls: "import-desc" });
    desc.textContent = "支持从 JSON、Markdown、CSV 文件导入知识点";

    // 文件选择
    const fileInput = contentEl.createEl("input", {
      type: "file",
      cls: "import-file-input",
      attr: { accept: ".json,.md,.csv,.txt" },
    });

    // 预览区域
    this.previewContainer = contentEl.createDiv({ cls: "import-preview" });

    // 导入按钮
    const importBtn = contentEl.createEl("button", {
      text: "导入",
      cls: "chemfig-action-btn",
    });
    importBtn.disabled = true;

    // 文件选择事件
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        const content = event.target.result;
        const ext = file.name.split(".").pop().toLowerCase();

        // 预览
        this.previewContent(content, ext);
        importBtn.disabled = false;

        // 导入按钮事件
        importBtn.onclick = async () => {
          try {
            if (ext === "json") {
              await this.importer.importFromJSON(content);
            } else if (ext === "md" || ext === "txt") {
              await this.importer.importFromMarkdown(content);
            } else if (ext === "csv") {
              await this.importer.importFromCSV(content);
            }
            this.close();
          } catch (e) {
            console.error("导入失败:", e);
          }
        };
      };
      reader.readAsText(file);
    };
  }

  previewContent(content, format) {
    this.previewContainer.empty();
    this.previewContainer.createEl("h3", { text: "预览" });

    const preview = this.previewContainer.createEl("pre", { cls: "import-preview-content" });
    
    if (format === "json") {
      try {
        const parsed = JSON.parse(content);
        preview.textContent = JSON.stringify(parsed, null, 2).substring(0, 500) + "...";
      } catch (e) {
        preview.textContent = "JSON 格式错误";
      }
    } else {
      preview.textContent = content.substring(0, 500) + "...";
    }
  }

  async onClose() {
    this.contentEl.empty();
  }
}

// 导出全局变量
// KnowledgeImporter, KnowledgeImportModal
