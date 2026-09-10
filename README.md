# MikTeX Chemfig SVG Renderer

Obsidian 插件：chem/tikz/miktex/ce/smiles 五种模式自动编译为 SVG/PNG，定位为**药物化学学习辅助工具**。

## ✨ 核心功能

### 🎨 化学渲染
- **五种渲染模式**: chem (chemfig) / tikz / miktex / ce / smiles
- **自动编译**: 代码块修改后自动重新编译
- **SVG/PNG 双输出**: 笔记中显示 PNG，SVG 存储在后端文件夹
- **3D 分子查看**: 基于 3Dmol.js 的交互式 3D 分子模型

### 🧪 分子编辑
- **分子编辑器**: 组分调整、原子键连接、官能团添加
- **SMILES 渲染**: 纯前端 SMILES → SVG 渲染
- **官能团分析**: 自动识别 13 种常见官能团
- **IUPAC 转换**: 化合物名称 ↔ SMILES 双向转换

### 📚 学习辅助
- **间隔重复卡片**: FSRS v6 算法 + SM-2 双引擎
- **默写练习**: 3 种模式（结构→命名、命名→结构、分子式→命名）
- **反应条件速查**: 30+ 常见有机反应数据库
- **配对游戏**: 官能团配对练习
- **学习数据分析**: 掌握度统计、薄弱点分析、复习趋势

### 🛠️ 开发工具
- **侧边栏**: 左侧模板库 + 右侧编辑器
- **右键菜单**: 快速编辑、查看源码、SVG/PNG 切换
- **代码块命名**: `% NAME: 反应名称` 持久绑定
- **视图切换定位**: 阅读/编辑模式间自动定位代码块

## 📋 系统要求

- **Obsidian**: v1.0.0+
- **MiKTeX**: 安装并配置 `latex` + `dvisvgm`
- **编译链路**: `latex → DVI → dvisvgm --no-fonts`

## 🚀 快速开始

### 安装 MiKTeX
1. 下载并安装 [MiKTeX](https://miktex.org/download)
2. 确保 `latex` 和 `dvisvgm` 在系统 PATH 中

### 安装插件
1. 将插件文件夹复制到 `.obsidian/plugins/miktex-chemfig-svg-render/`
2. 在 Obsidian 设置中启用插件

### 使用方法
创建 chemfig 代码块：
~~~markdown
```chem
% NAME: 苯环
\chemfig{*6(-=-=-=)}
```
~~~

## 📖 命令列表

| 命令 | 说明 |
|------|------|
| `3D 分子查看器` | 打开 3D 分子查看器 |
| `官能团分析` | 从 SMILES 识别官能团 |
| `学习模块: 学习数据分析` | 打开学习统计面板 |
| `反应条件速查` | 查看常见有机反应 |
| `配对游戏` | 官能团配对练习 |

## 🏗️ 项目结构

```
src/
├── core/              # 核心编译逻辑
│   ├── compiler.ts    # LaTeX 编译器
│   ├── parser.ts      # 代码块解析
│   └── converter.ts   # 格式转换
├── features/         # 功能模块
│   ├── learning.ts    # 学习卡片
│   ├── fsrs-algorithm.ts  # FSRS 算法
│   ├── smiles-renderer.ts # SMILES 渲染
│   ├── molecule-3d-viewer.ts # 3D 查看器
│   └── reaction-conditions.ts # 反应条件
├── ui/               # UI 组件
│   ├── sidebar.ts     # 侧边栏
│   ├── settings.ts    # 设置面板
│   └── editor.ts       # 编辑器
└── integrations/     # 第三方集成
    ├── ocl.bundle.js  # OpenChemLib
    └── excalidraw-integration.ts # Excalidraw
```

## 📊 版本历史

- **v15.0.0**: 架构现代化、学习数据分析
- **v14.5.0**: 学习数据统计面板
- **v14.0.0**: 扩展反应条件数据库
- **v13.5.0**: FSRS v6 算法升级
- **v13.0.0**: 官能团分析功能
- **v12.5.0**: 分子性质面板增强
- **v12.0.0**: 3D 分子可视化

## 📄 License

MIT
