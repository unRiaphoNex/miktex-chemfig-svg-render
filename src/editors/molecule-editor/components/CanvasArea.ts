/**
 * 画布区域组件
 * v17.0.0 - 完全重构版本
 */

/**
 * 创建画布区域
 * @param parent 父容器
 */
export function createCanvasArea(parent: HTMLElement): HTMLElement {
  const canvas = parent.createDiv('chem-modal-canvas');
  return canvas;
}

/**
 * 创建三栏布局容器
 * @param parent 父容器
 */
export function createColumnsLayout(parent: HTMLElement): {
  container: HTMLElement;
  learningCol: HTMLElement;
  mainCol: HTMLElement;
  sideCol: HTMLElement;
} {
  const container = parent.createDiv('chem-modal-columns');

  const learningCol = container.createDiv('chem-modal-sidebar chem-modal-sidebar--left');
  const mainCol = container.createDiv('chem-modal-canvas');
  const sideCol = container.createDiv('chem-modal-sidebar chem-modal-sidebar--right');

  return { container, learningCol, mainCol, sideCol };
}
