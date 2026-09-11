/**
 * 右侧化合物库组件
 * v17.0.0 - 完全重构版本
 */

/**
 * 创建右侧化合物库
 * @param parent 父容器
 * @param title 标题
 */
export function createCompoundSidebar(parent: HTMLElement, title: string): {
  container: HTMLElement;
  header: HTMLElement;
  search: HTMLInputElement;
  body: HTMLElement;
} {
  const container = parent.createDiv('chem-modal-sidebar chem-modal-sidebar--right');

  const header = container.createDiv('chem-modal-sidebar-header');
  header.setText(title);

  const searchWrapper = container.createDiv('chem-modal-sidebar-search');
  const search = searchWrapper.createEl('input', {
    type: 'text',
    placeholder: '搜索化合物...',
  });

  const body = container.createDiv('chem-modal-sidebar-body');

  return { container, header, search, body };
}

/**
 * 创建化合物卡片
 * @param parent 父容器
 * @param name 化合物名称
 * @param onClick 点击回调
 */
export function createCompoundItem(
  parent: HTMLElement,
  name: string,
  onClick: () => void
): HTMLElement {
  const item = parent.createDiv('chem-modal-compound-item');
  item.setText(name);
  item.onclick = onClick;
  return item;
}

/**
 * 创建分类标题
 * @param parent 父容器
 * @param name 分类名称
 */
export function createCategoryTitle(parent: HTMLElement, name: string): HTMLElement {
  const title = parent.createDiv('chem-modal-category-title');
  title.setText(name);
  return title;
}
