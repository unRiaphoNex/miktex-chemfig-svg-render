/**
 * wheel 事件修复工具
 * 解决 Obsidian Modal 劫持滚轮事件导致侧边栏无法滚动的问题
 */

/**
 * 为滚动容器绑定 wheel 事件，阻止事件向上冒泡
 * @param el 滚动容器元素
 */
export function fixScrollWheel(el: HTMLElement): void {
  el.addEventListener('wheel', (e) => {
    e.stopPropagation();
  }, { passive: false });
}

/**
 * 为多个滚动容器批量绑定 wheel 事件
 * @param elements 滚动容器元素数组
 */
export function fixScrollWheels(elements: HTMLElement[]): void {
  elements.forEach(el => fixScrollWheel(el));
}
