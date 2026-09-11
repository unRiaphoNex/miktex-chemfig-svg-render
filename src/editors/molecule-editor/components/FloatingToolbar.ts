/**
 * 悬浮工具栏组件
 * v17.0.0 - 完全重构版本
 */

/**
 * 创建悬浮工具栏
 * @param parent 父容器
 */
export function createFloatingToolbar(parent: HTMLElement): {
  container: HTMLElement;
  row: HTMLElement;
} {
  const container = parent.createDiv('chem-modal-toolbar');
  const row = container.createDiv('chem-modal-toolbar-row');
  return { container, row };
}

/**
 * 创建工具按钮组
 * @param parent 父容器
 */
export function createToolbarGroup(parent: HTMLElement): HTMLElement {
  return parent.createDiv('chem-modal-toolbar-group');
}

/**
 * 创建工具栏分隔线
 * @param parent 父容器
 */
export function createToolbarDivider(parent: HTMLElement): HTMLElement {
  return parent.createDiv('chem-modal-toolbar-divider');
}

/**
 * 创建工具按钮
 * @param parent 父容器
 * @param icon 图标
 * @param title 提示
 * @param onClick 点击回调
 * @param active 是否激活
 */
export function createToolButton(
  parent: HTMLElement,
  icon: string,
  title: string,
  onClick: () => void,
  active = false
): HTMLButtonElement {
  const btn = parent.createEl('button', { text: icon });
  btn.addClass('chem-modal-tool-btn');
  if (active) btn.addClass('chem-modal-tool-btn--active');
  btn.title = title;
  btn.onclick = onClick;
  return btn;
}
