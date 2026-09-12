/**
 * 分子编辑器 CSS 样式
 * v17.0.0 - 完全重构版本
 * 命名规范: chem-modal-*
 */

export const MOLECULE_EDITOR_CSS = `
/* ========== v17.0.0: 分子编辑器重构样式 ========== */

/* ===== 弹窗根容器 - 清除 Obsidian 原生圆角和内边距 ===== */
.chem-modal-root {
  border-radius: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
  max-width: 100vw !important;
  width: 100vw !important;
  height: 100vh !important;
  max-height: 100vh !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  box-shadow: none !important;
  background: var(--background-primary) !important;
}

/* 编辑器根容器 - 填满 modal */
.chem-modal-root .modal-content {
  display: flex !important;
  flex-direction: column !important;
  height: 100% !important;
  width: 100% !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: var(--background-primary) !important;
  border-radius: 0 !important;
}

/* ===== 顶部标题栏 ===== */
.chem-modal-appbar {
  margin: 0 !important;
  padding: 12px 20px !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  color: var(--text-normal) !important;
  background: var(--background-secondary) !important;
  border-bottom: 1px solid var(--background-modifier-border) !important;
  flex-shrink: 0 !important;
}

.chem-modal-hint {
  margin: 0 !important;
  padding: 6px 20px !important;
  font-size: 12px !important;
  color: var(--text-muted) !important;
  background: var(--background-secondary) !important;
  border-bottom: 1px solid var(--background-modifier-border) !important;
  flex-shrink: 0 !important;
}

/* ===== 主区域: Grid 三栏布局 ===== */
.chem-modal-columns {
  display: grid !important;
  grid-template-columns: 260px 1fr 320px !important;
  flex: 1 1 auto !important;
  min-height: 0 !important;
  overflow: hidden !important;
  width: 100% !important;
}

/* ===== 左侧学习栏 ===== */
.chem-modal-sidebar {
  background: var(--background-primary) !important;
  display: flex !important;
  flex-direction: column !important;
  min-height: 0 !important;
  height: 100% !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}

.chem-modal-sidebar--left {
  border-right: 1px solid var(--background-modifier-border) !important;
}

.chem-modal-sidebar--right {
  border-left: 1px solid var(--background-modifier-border) !important;
}

/* 侧边栏头部 - 固定高度 */
.chem-modal-sidebar-header {
  padding: 12px 16px !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  color: var(--text-normal) !important;
  background: var(--background-primary) !important;
  border-bottom: 1px solid var(--background-modifier-border) !important;
  flex-shrink: 0 !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
  display: flex !important;
  align-items: center !important;
  justify-content: space-between !important;
}

/* 侧边栏搜索区 - 固定高度 */
.chem-modal-sidebar-search {
  padding: 10px 16px !important;
  border-bottom: 1px solid var(--background-modifier-border) !important;
  flex-shrink: 0 !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
}

.chem-modal-sidebar-search input {
  width: 100% !important;
  padding: 8px 14px !important;
  border: 1px solid var(--background-modifier-border) !important;
  border-radius: 20px !important;
  font-size: 13px !important;
  background: var(--background-secondary) !important;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease !important;
  box-sizing: border-box !important;
}

.chem-modal-sidebar-search input:focus {
  outline: none !important;
  border-color: var(--interactive-accent) !important;
  background: var(--background-primary) !important;
}

/* 侧边栏内容区 - 可滚动 */
.chem-modal-sidebar-body {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  padding: 10px !important;
  -webkit-overflow-scrolling: touch !important;
  box-sizing: border-box !important;
}

/* ===== 中间画布区域 ===== */
.chem-modal-canvas {
  position: relative !important;
  background: var(--background-primary) !important;
  min-width: 0 !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  background-image: radial-gradient(circle, var(--background-modifier-border) 1px, transparent 1px) !important;
  background-size: 24px 24px !important;
}

/* ===== 悬浮工具栏 ===== */
.chem-modal-toolbar {
  position: relative !important;
  top: auto !important;
  left: auto !important;
  z-index: 100 !important;
  background: var(--background-primary) !important;
  border: none !important;
  border-top: 1px solid var(--background-modifier-border) !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  padding: 8px 16px !important;
  backdrop-filter: none !important;
  width: 100% !important;
  max-width: 100% !important;
  cursor: default !important;
  user-select: none !important;
  transition: none !important;
  box-sizing: border-box !important;
  order: 999 !important;
}

.chem-modal-toolbar--dragging {
  opacity: 0.9 !important;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2) !important;
}

.chem-modal-toolbar-row {
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
  flex-wrap: wrap !important;
  justify-content: center !important;
}

.chem-modal-toolbar-group {
  display: flex !important;
  align-items: center !important;
  gap: 2px !important;
}

.chem-modal-toolbar-divider {
  width: 1px !important;
  height: 24px !important;
  background: var(--background-modifier-border) !important;
  margin: 0 6px !important;
}

.chem-modal-tool-btn {
  min-width: 36px !important;
  height: 36px !important;
  padding: 0 6px !important;
  border: none !important;
  border-radius: 50% !important;
  background: transparent !important;
  color: var(--text-muted) !important;
  font-size: 14px !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease !important;
}

.chem-modal-tool-btn:hover {
  background: var(--background-modifier-hover) !important;
  color: var(--text-normal) !important;
}

.chem-modal-tool-btn--active {
  background: var(--background-modifier-active) !important;
  color: var(--interactive-accent) !important;
}

.chem-modal-tool-btn--primary {
  background: var(--interactive-accent) !important;
  color: var(--text-on-accent) !important;
}

/* ===== 学习模块按钮 ===== */
.chem-modal-learning-btn {
  width: 100% !important;
  padding: 10px 14px !important;
  margin-bottom: 6px !important;
  font-size: 13px !important;
  background: var(--background-secondary) !important;
  border: 1px solid var(--background-modifier-border) !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  text-align: left !important;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease !important;
  display: flex !important;
  align-items: center !important;
  gap: 10px !important;
  color: var(--text-normal) !important;
}

.chem-modal-learning-btn:hover {
  background: var(--background-modifier-hover) !important;
  border-color: var(--interactive-accent) !important;
}

/* ===== 化合物卡片 ===== */
.chem-modal-compound-item {
  padding: 10px !important;
  margin-bottom: 6px !important;
  background: var(--background-secondary) !important;
  border: 1px solid var(--background-modifier-border) !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease !important;
}

.chem-modal-compound-item:hover {
  border-color: var(--interactive-accent) !important;
  background: var(--background-modifier-hover) !important;
}

.chem-modal-category-title {
  padding: 10px 6px 6px !important;
  font-size: 12px !important;
  font-weight: 500 !important;
  color: var(--text-muted) !important;
  text-transform: uppercase !important;
  letter-spacing: 0.5px !important;
}

/* ===== 滚动条 ===== */
.chem-modal-sidebar-body::-webkit-scrollbar {
  width: 8px !important;
}

.chem-modal-sidebar-body::-webkit-scrollbar-track {
  background: transparent !important;
}

.chem-modal-sidebar-body::-webkit-scrollbar-thumb {
  background: var(--background-modifier-border) !important;
  border-radius: 4px !important;
}

.chem-modal-sidebar-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted) !important;
}

/* ===== 盒模型全局修复 ===== */
.chem-modal-root,
.chem-modal-root * {
  box-sizing: border-box !important;
}

/* ===== 动画 ===== */
@keyframes chemModalFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.chem-modal-canvas {
  animation: chemModalFadeIn 0.2s ease-out !important;
}

/* ===== 兼容层: 旧类名映射到新类名 ===== */
.molecule-editor-modal {
  border-radius: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
  max-width: 100vw !important;
  width: 100vw !important;
  height: 100vh !important;
  max-height: 100vh !important;
  display: flex !important;
  flex-direction: column !important;
  overflow: hidden !important;
  box-shadow: none !important;
  background: var(--background-primary) !important;
}

.molecule-editor-modal .modal-content {
  display: flex !important;
  flex-direction: column !important;
  height: 100% !important;
  width: 100% !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: var(--background-primary) !important;
  border-radius: 0 !important;
}

.molecule-editor-modal h2 {
  margin: 0 !important;
  padding: 12px 20px !important;
  font-size: 16px !important;
  font-weight: 600 !important;
  color: var(--text-normal) !important;
  background: var(--background-secondary) !important;
  border-bottom: 1px solid var(--background-modifier-border) !important;
  flex-shrink: 0 !important;
}

.molecule-editor-hint {
  margin: 0 !important;
  padding: 6px 20px !important;
  font-size: 12px !important;
  color: var(--text-muted) !important;
  background: var(--background-secondary) !important;
  border-bottom: 1px solid var(--background-modifier-border) !important;
  flex-shrink: 0 !important;
}

.molecule-editor-columns {
  display: grid !important;
  grid-template-columns: 260px 1fr 320px !important;
  flex: 1 1 auto !important;
  min-height: 0 !important;
  overflow: hidden !important;
  width: 100% !important;
}

.molecule-editor-learning-sidebar,
.molecule-editor-sidebar {
  background: var(--background-primary) !important;
  display: flex !important;
  flex-direction: column !important;
  min-height: 0 !important;
  height: 100% !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
}

.molecule-editor-learning-sidebar {
  border-right: 1px solid var(--background-modifier-border) !important;
}

.molecule-editor-sidebar,
.molecule-editor-side {
  border-left: 1px solid var(--background-modifier-border) !important;
}

.molecule-editor-learning-sidebar .sidebar-header,
.molecule-editor-learning-sidebar .learning-sidebar-header,
.molecule-editor-sidebar .sidebar-header,
.molecule-editor-sidebar .fragment-library-header {
  padding: 12px 16px !important;
  font-size: 14px !important;
  font-weight: 500 !important;
  color: var(--text-normal) !important;
  background: var(--background-primary) !important;
  border-bottom: 1px solid var(--background-modifier-border) !important;
  flex-shrink: 0 !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
}

.molecule-editor-sidebar .sidebar-search {
  padding: 10px 16px !important;
  border-bottom: 1px solid var(--background-modifier-border) !important;
  flex-shrink: 0 !important;
  min-height: 0 !important;
  box-sizing: border-box !important;
}

.molecule-editor-sidebar .sidebar-search input {
  width: 100% !important;
  padding: 8px 14px !important;
  border: 1px solid var(--background-modifier-border) !important;
  border-radius: 20px !important;
  font-size: 13px !important;
  background: var(--background-secondary) !important;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease !important;
  box-sizing: border-box !important;
}

.molecule-editor-sidebar .sidebar-body,
.molecule-editor-side .sidebar-body,
.molecule-editor-learning-sidebar .sidebar-body,
.molecule-editor-sidebar .fragment-library-body,
.molecule-editor-side .fragment-library-body {
  flex: 1 1 auto !important;
  min-height: 0 !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  padding: 10px !important;
  -webkit-overflow-scrolling: touch !important;
  box-sizing: border-box !important;
}

.molecule-editor-main {
  position: relative !important;
  background: var(--background-primary) !important;
  min-width: 0 !important;
  overflow: hidden !important;
  box-sizing: border-box !important;
  background-image: radial-gradient(circle, var(--background-modifier-border) 1px, transparent 1px) !important;
  background-size: 24px 24px !important;
}

.molecule-editor-floating-toolbar {
  position: relative !important;
  top: auto !important;
  left: auto !important;
  z-index: 100 !important;
  background: var(--background-primary) !important;
  border: none !important;
  border-top: 1px solid var(--background-modifier-border) !important;
  border-radius: 0 !important;
  box-shadow: none !important;
  padding: 8px 16px !important;
  backdrop-filter: none !important;
  width: 100% !important;
  max-width: 100% !important;
  cursor: default !important;
  user-select: none !important;
  transition: none !important;
  box-sizing: border-box !important;
  margin: 0 !important;
  order: 999 !important;
}

.molecule-editor-toolbar-top {
  display: flex !important;
  align-items: center !important;
  gap: 4px !important;
  flex-wrap: wrap !important;
  justify-content: center !important;
}

.molecule-editor-tool-group {
  display: flex !important;
  align-items: center !important;
  gap: 2px !important;
}

.toolbar-divider {
  width: 1px !important;
  height: 24px !important;
  background: var(--background-modifier-border) !important;
  margin: 0 6px !important;
}

.molecule-editor-tool-btn {
  min-width: 36px !important;
  height: 36px !important;
  padding: 0 6px !important;
  border: none !important;
  border-radius: 50% !important;
  background: transparent !important;
  color: var(--text-muted) !important;
  font-size: 14px !important;
  cursor: pointer !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: border-color 0.15s ease, background 0.15s ease, box-shadow 0.15s ease !important;
}

.molecule-editor-tool-btn:hover {
  background: var(--background-modifier-hover) !important;
  color: var(--text-normal) !important;
}

.molecule-editor-tool-btn.active {
  background: var(--background-modifier-active) !important;
  color: var(--interactive-accent) !important;
}

.molecule-editor-func-btn {
  padding: 6px 12px !important;
  background: var(--background-secondary) !important;
  border: 1px solid var(--background-modifier-border) !important;
  border-radius: 6px !important;
  cursor: pointer !important;
  font-size: 12px !important;
  transition: transform 0.2s ease, opacity 0.2s ease !important;
  color: var(--text-normal) !important;
}

.molecule-editor-func-btn:hover {
  background: var(--background-modifier-hover) !important;
}

/* 旧类名盒模型 */
.molecule-editor-modal,
.molecule-editor-modal * {
  box-sizing: border-box !important;
}

/* 旧类名滚动条 */
.molecule-editor-sidebar .sidebar-body::-webkit-scrollbar,
.molecule-editor-side .sidebar-body::-webkit-scrollbar,
.molecule-editor-learning-sidebar .sidebar-body::-webkit-scrollbar {
  width: 8px !important;
}

.molecule-editor-sidebar .sidebar-body::-webkit-scrollbar-track,
.molecule-editor-side .sidebar-body::-webkit-scrollbar-track,
.molecule-editor-learning-sidebar .sidebar-body::-webkit-scrollbar-track {
  background: transparent !important;
}

.molecule-editor-sidebar .sidebar-body::-webkit-scrollbar-thumb,
.molecule-editor-side .sidebar-body::-webkit-scrollbar-thumb,
.molecule-editor-learning-sidebar .sidebar-body::-webkit-scrollbar-thumb {
  background: var(--background-modifier-border) !important;
  border-radius: 4px !important;
}

.molecule-editor-sidebar .sidebar-body::-webkit-scrollbar-thumb:hover,
.molecule-editor-side .sidebar-body::-webkit-scrollbar-thumb:hover,
.molecule-editor-learning-sidebar .sidebar-body::-webkit-scrollbar-thumb:hover {
  background: var(--text-muted) !important;
}

/* 性能优化: 硬件加速提示 */
.chem-modal-tool-btn,
.chem-modal-compound-item,
.chem-modal-toolbar-group {
  will-change: transform, opacity !important;
}
`;
