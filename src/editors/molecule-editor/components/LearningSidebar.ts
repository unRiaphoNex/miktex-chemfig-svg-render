/**
 * 左侧学习栏组件
 * v17.0.0 - 完全重构版本
 */

/**
 * 创建左侧学习栏
 * @param parent 父容器
 * @param title 标题
 */
export function createLearningSidebar(parent: HTMLElement, title: string): {
  container: HTMLElement;
  header: HTMLElement;
  body: HTMLElement;
} {
  const container = parent.createDiv('chem-modal-sidebar chem-modal-sidebar--left');

  const header = container.createDiv('chem-modal-sidebar-header');
  header.setText(title);

  const body = container.createDiv('chem-modal-sidebar-body');

  return { container, header, body };
}

/**
 * 创建学习模块按钮
 * @param parent 父容器
 * @param icon 图标
 * @param name 名称
 * @param tooltip 提示
 * @param onClick 点击回调
 */
export function createLearningButton(
  parent: HTMLElement,
  icon: string,
  name: string,
  tooltip: string,
  onClick: () => void
): HTMLButtonElement {
  const btn = parent.createEl('button', {
    text: `${icon} ${name}`,
  });
  btn.addClass('chem-modal-learning-btn');
  btn.title = tooltip;
  btn.onclick = onClick;
  return btn;
}
