# MiKTeX Chemfig SVG Render

An Obsidian plugin that renders chemfig/tikz/miktex/ce code blocks to SVG/PNG using local MiKTeX installation.

## Features

- **4 rendering modes**: chem (chemfig shorthand), tikz (full syntax), miktex (complete LaTeX), ce (mhchem equations)
- **Local compilation**: Uses MiKTeX (latex → DVI → dvisvgm) for high-quality vector output
- **PNG export**: Converts SVG to PNG for better cross-platform compatibility
- **Molecule editor**: Interactive fragment library with 200+ pre-loaded structures
- **Learning tools**: Flashcards, spaced repetition, quiz mode, daily challenge
- **Component layout**: Visual arrangement of reaction components
- **Sidebar integration**: Left sidebar (template library) + right sidebar (component editor)
- **CM6 support**: CodeMirror 6 live preview with LaTeX syntax highlighting

## Requirements

- **Obsidian** v1.0+
- **MiKTeX** installed locally (Windows)
  - Default path: `D:\MiKTeX\miktex\bin\x64\`
  - Required packages: chemfig, tikz, mhchem, dvisvgm

## Installation

### From Obsidian Community Plugin
1. Settings → Community plugins → Browse
2. Search for "MiKTeX Chemfig SVG Render"
3. Install and enable

### Manual Installation
1. Download `main.js`, `manifest.json`, `styles.css`
2. Copy to `<vault>/.obsidian/plugins/miktex-chemfig-svg-render/`
3. Reload Obsidian and enable the plugin

## Usage

### Code Blocks

```chem
\chemfig{*6(-=-=-=)}
```

```tikz
\usepackage{chemfig}
\begin{document}
\chemfig{H_3C-C(=O)-OH}
\end{document}
```

```ce
\ce{A + B -> C}
```

### Naming Convention

Add a name comment at the first line:
```
% NAME: 苯环结构
\chemfig{*6(-=-=-=)}
```

Or use strict naming:
```
%% name: benzene_ring
\chemfig{*6(-=-=-=)}
```

## Development

### Setup
```bash
npm install
```

### Build
```bash
npm run build
```

### Watch mode
```bash
npm run dev
```

### Lint
```bash
npm run lint
npm run lint:fix
```

### Format
```bash
npm run format
```

### Test
```bash
npm test
```

## Project Structure

```
├── src/
│   ├── core/           # Core compilation logic
│   │   ├── compiler.ts
│   │   ├── parser.ts
│   │   ├── converter.ts
│   │   └── svg-utils.ts
│   ├── state/          # State management
│   │   ├── SettingsManager.ts
│   │   └── EnvironmentManager.ts
│   ├── ui/             # UI components
│   │   └── TemplateBrowser.ts
│   ├── main.ts         # Plugin entry
│   ├── molecule-editor.ts
│   ├── cm6.ts
│   ├── sidebar.ts
│   ├── group-layout.ts
│   └── ...
├── tests/              # Test files
├── .github/
│   └── workflows/
│       └── ci.yml      # GitHub Actions CI
├── build.js            # Build script (esbuild + merge)
├── manifest.json       # Obsidian plugin manifest
├── styles.css          # Plugin styles
├── tsconfig.json       # TypeScript config
├── eslint.config.mjs   # ESLint 9 config
└── .prettierrc.json    # Prettier config
```

## Technology Stack

- **TypeScript** (strict mode)
- **esbuild** (build)
- **CodeMirror 6** (editor)
- **OpenChemLib** (SMILES rendering)
- **ESLint 9** (code quality)
- **Prettier** (code formatting)
- **GitHub Actions** (CI/CD)

## License

MIT
