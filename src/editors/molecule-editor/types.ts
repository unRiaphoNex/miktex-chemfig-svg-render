/**
 * 分子编辑器类型定义
 * v17.0.0 - 完全重构版本
 */

export interface MoleculeEditorOptions {
  enableTemplateLibrary?: boolean;
  initialSmiles?: string;
  initialChemfig?: string;
  onSave?: (chemfig: string) => void;
}

export interface CompoundItem {
  name: string;
  smiles: string;
  formula: string;
  category?: string;
}

export interface CategoryMeta {
  name: string;
  description?: string;
  count?: number;
}

export type EditorTool = 'select' | 'erase' | 'bond' | 'atom' | 'text' | 'chain' | 'ring';

export interface EditorState {
  currentTool: EditorTool;
  history: string[];
  historyIndex: number;
  zoom: number;
  panX: number;
  panY: number;
}
