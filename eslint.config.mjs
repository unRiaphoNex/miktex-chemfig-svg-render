// @ts-check
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";

export default tseslint.config(
  // 忽略目录
  {
    ignores: [
      "main.js",
      "node_modules/**",
      "*.js",
      "tests/**",
      "src/ocl.bundle.js"
    ],
  },
  
  // 基础规则
  js.configs.recommended,
  ...tseslint.configs.recommended,
  
  // Obsidian 专用规则
  {
    plugins: {
      obsidianmd: obsidianmd,
    },
    rules: {
      // 通用规则
      "no-unused-vars": "off", // 用 TypeScript 的
      "@typescript-eslint/no-unused-vars": [
        "warn", 
        { 
          argsIgnorePattern: "^_",
          // 合并架构：跨文件使用的类/工具/服务不检查
          varsIgnorePattern: "^(_|Plugin|Notice|Modal|Menu|Setting|ItemView|WorkspaceLeaf|requestUrl|execFile|fs|os|crypto|.*Manager$|.*Service$|.*Cache$|.*Queue$|.*Reporter$|.*DB$|.*List$|.*Parser$|.*Compiler$|.*Converter$|.*Helper$|.*Browser$|.*Plugin$|.*Modal$|.*View$|.*Sidebar$|TIKZ_BLOCK_REG|NAME_REG_)",
          caughtErrors: "none", // catch (e) 不检查
          ignoreRestSiblings: true,
        }
      ],
      "@typescript-eslint/no-explicit-any": "off", // 渐进式迁移，先关掉
      "@typescript-eslint/no-this-alias": "off", // that = this 是常见模式
      "@typescript-eslint/no-require-imports": "off", // Obsidian 用 require/CommonJS
      "no-console": "off", // 插件开发阶段允许 console.log
      "no-useless-assignment": "off", // 很多初始化模式是合理的
      "no-empty": ["warn", { allowEmptyCatch: true }], // 空 catch 是常见模式
      "no-useless-escape": "warn", // 不必要的转义
      "prefer-rest-params": "warn", // 用 rest 参数代替 arguments
      "no-var": "warn", // 用 let/const 代替 var
      "preserve-caught-error": "warn", // 抛出错误时保留 cause
    },
  },
  
  // 浏览器环境
  {
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        localStorage: "readonly",
      },
    },
  }
);
