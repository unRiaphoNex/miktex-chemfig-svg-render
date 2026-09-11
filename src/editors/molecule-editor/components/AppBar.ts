/**
 * 顶部标题栏组件
 * v17.0.0 - 完全重构版本
 */

/**
 * 创建顶部标题栏
 * @param parent 父容器
 * @param title 标题文字
 */
export function createAppBar(parent: HTMLElement, title: string): HTMLElement {
  const appbar = parent.createEl('h2', { text: title });
  appbar.addClass('chem-modal-appbar');
  return appbar;
}

/**
 * 创建提示条
 * @param parent 父容器
 * @param text 提示文字
 */
export function createHintBar(parent: HTMLElement, text: string): HTMLElement {
  const hint = parent.createEl('p', { text });
  hint.addClass('chem-modal-hint');
  return hint;
}
