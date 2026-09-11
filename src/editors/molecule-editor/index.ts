/**
 * 分子编辑器模块
 * v17.0.0 - 完全重构版本
 *
 * 导出:
 * - MOLECULE_EDITOR_CSS: CSS 样式字符串
 * - fixScrollWheel: 滚动修复工具
 * - makeDraggable: 拖动工具
 * - 组件: AppBar, LearningSidebar, CompoundSidebar, FloatingToolbar, CanvasArea
 */

export { MOLECULE_EDITOR_CSS } from './css';
export { fixScrollWheel, fixScrollWheels } from './utils/useWheel';
export { makeDraggable, type DragOptions } from './utils/useDrag';
export type {
  MoleculeEditorOptions,
  CompoundItem,
  CategoryMeta,
  EditorTool,
  EditorState,
} from './types';

// 组件
export { createAppBar, createHintBar } from './components/AppBar';
export { createLearningSidebar, createLearningButton } from './components/LearningSidebar';
export { createCompoundSidebar, createCompoundItem, createCategoryTitle } from './components/CompoundSidebar';
export { createFloatingToolbar, createToolbarGroup, createToolbarDivider, createToolButton } from './components/FloatingToolbar';
export { createCanvasArea, createColumnsLayout } from './components/CanvasArea';
