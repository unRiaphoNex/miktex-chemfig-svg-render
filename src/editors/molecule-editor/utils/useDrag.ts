/**
 * 拖动工具
 * 实现悬浮工具栏的拖动功能
 */

export interface DragOptions {
  /** 拖动开始时的回调 */
  onDragStart?: (e: MouseEvent) => void;
  /** 拖动过程中的回调 */
  onDrag?: (x: number, y: number, e: MouseEvent) => void;
  /** 拖动结束时的回调 */
  onDragEnd?: () => void;
}

/**
 * 为元素添加拖动功能
 * @param el 要拖动的元素
 * @param options 拖动选项
 */
export function makeDraggable(el: HTMLElement, options: DragOptions = {}): () => void {
  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  const handleMouseDown = (e: MouseEvent) => {
    // 只在空白处拖动，不阻止按钮点击
    if ((e.target as HTMLElement).tagName === 'BUTTON') return;

    isDragging = true;
    el.classList.add('dragging');

    const rect = el.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    options.onDragStart?.(e);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;

    const parentRect = el.parentElement!.getBoundingClientRect();
    let newX = e.clientX - parentRect.left - offsetX;
    let newY = e.clientY - parentRect.top - offsetY;

    // 限制在父容器内
    newX = Math.max(0, Math.min(newX, parentRect.width - el.offsetWidth));
    newY = Math.max(0, Math.min(newY, parentRect.height - el.offsetHeight));

    el.style.left = newX + 'px';
    el.style.top = newY + 'px';

    options.onDrag?.(newX, newY, e);
  };

  const handleMouseUp = () => {
    if (isDragging) {
      isDragging = false;
      el.classList.remove('dragging');
      options.onDragEnd?.();
    }
  };

  el.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // 返回清理函数
  return () => {
    el.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}
