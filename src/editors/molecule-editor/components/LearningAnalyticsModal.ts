/**
 * 学习统计面板组件
 * v17.0.0
 *
 * 显示:
 * - 总学习化合物数
 * - 按类别分布
 * - 学习趋势
 * - 正确率统计
 * - 薄弱点分析
 */

import { Modal, Notice } from 'obsidian';

/**
 * 学习统计面板
 */
export class LearningAnalyticsModal extends Modal {
  private reviewData: Record<string, any>;
  private allCards: any[];

  constructor(app: any, reviewData: Record<string, any>, allCards: any[]) {
    super(app);
    this.reviewData = reviewData;
    this.allCards = allCards;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('learning-analytics-modal');

    // 标题
    const title = contentEl.createDiv();
    title.style.cssText = 'font-size:18px;font-weight:600;margin-bottom:20px;text-align:center;';
    title.textContent = '📊 学习统计面板';

    // 总览卡片
    this.renderOverview(contentEl);

    // 类别分布
    this.renderCategoryDistribution(contentEl);

    // 掌握度分布
    this.renderMasteryDistribution(contentEl);

    // 薄弱点分析
    this.renderWeakPoints(contentEl);
  }

  /**
   * 渲染总览
   */
  private renderOverview(parent: HTMLElement): void {
    const total = this.allCards.length;
    const learned = Object.keys(this.reviewData).length;
    const due = this.getDueCount();
    const avgAccuracy = this.getAverageAccuracy();

    const overview = parent.createDiv();
    overview.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px;';

    const cards = [
      { label: '总卡片数', value: total, color: 'var(--interactive-accent)' },
      { label: '已学习', value: learned, color: '#10b981' },
      { label: '待复习', value: due, color: '#f59e0b' },
      { label: '正确率', value: `${avgAccuracy}%`, color: '#8b5cf6' },
    ];

    for (const card of cards) {
      const cardEl = overview.createDiv();
      cardEl.style.cssText = `
        background: var(--background-secondary);
        border-radius: 12px;
        padding: 16px;
        text-align: center;
        border-left: 4px solid ${card.color};
      `;

      const valueEl = cardEl.createDiv();
      valueEl.style.cssText = 'font-size:24px;font-weight:700;color:' + card.color + ';margin-bottom:4px;';
      valueEl.textContent = card.value;

      const labelEl = cardEl.createDiv();
      labelEl.style.cssText = 'font-size:12px;color:var(--text-muted);';
      labelEl.textContent = card.label;
    }
  }

  /**
   * 渲染类别分布
   */
  private renderCategoryDistribution(parent: HTMLElement): void {
    const section = parent.createDiv();
    section.style.cssText = 'margin-bottom:24px;';

    const title = section.createDiv();
    title.style.cssText = 'font-size:14px;font-weight:600;margin-bottom:12px;';
    title.textContent = '📂 按类别分布';

    // 统计类别
    const categoryStats: Record<string, { total: number; learned: number }> = {};
    for (const card of this.allCards) {
      const cat = card.category || '未分类';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { total: 0, learned: 0 };
      }
      categoryStats[cat].total++;
      if (this.reviewData[card.smiles]) {
        categoryStats[cat].learned++;
      }
    }

    // 渲染进度条
    for (const [cat, stats] of Object.entries(categoryStats)) {
      const row = section.createDiv();
      row.style.cssText = 'margin-bottom:8px;';

      const header = row.createDiv();
      header.style.cssText = 'display:flex;justify-content:space-between;margin-bottom:4px;';
      
      const name = header.createSpan();
      name.style.cssText = 'font-size:12px;';
      name.textContent = cat;
      
      const count = header.createSpan();
      count.style.cssText = 'font-size:12px;color:var(--text-muted);';
      count.textContent = `${stats.learned}/${stats.total}`;

      const progressBar = row.createDiv();
      progressBar.style.cssText = 'height:6px;background:var(--background-modifier-border);border-radius:3px;overflow:hidden;';

      const progress = progressBar.createDiv();
      const percent = stats.total > 0 ? (stats.learned / stats.total) * 100 : 0;
      progress.style.cssText = `
        height:100%;
        width:${percent}%;
        background: var(--interactive-accent);
        border-radius:3px;
        transition: width 0.3s ease;
      `;
    }
  }

  /**
   * 渲染掌握度分布
   */
  private renderMasteryDistribution(parent: HTMLElement): void {
    const section = parent.createDiv();
    section.style.cssText = 'margin-bottom:24px;';

    const title = section.createDiv();
    title.style.cssText = 'font-size:14px;font-weight:600;margin-bottom:12px;';
    title.textContent = '🎯 掌握度分布';

    // 统计掌握度
    const masteryStats = { easy: 0, medium: 0, hard: 0, new: 0 };
    for (const card of this.allCards) {
      const data = this.reviewData[card.smiles];
      if (!data) {
        masteryStats.new++;
      } else {
        masteryStats[data.difficulty || 'medium']++;
      }
    }

    const colors = {
      easy: '#10b981',
      medium: '#f59e0b',
      hard: '#ef4444',
      new: '#6b7280',
    };

    const labels = {
      easy: '简单',
      medium: '中等',
      hard: '困难',
      new: '新卡片',
    };

    // 渲染进度条
    const total = this.allCards.length || 1;
    for (const [level, count] of Object.entries(masteryStats)) {
      const row = section.createDiv();
      row.style.cssText = 'display:flex;align-items:center;margin-bottom:6px;';

      const label = row.createSpan();
      label.style.cssText = 'width:60px;font-size:12px;';
      label.textContent = labels[level];

      const barContainer = row.createDiv();
      barContainer.style.cssText = 'flex:1;height:20px;background:var(--background-modifier-border);border-radius:4px;overflow:hidden;margin:0 12px;';

      const bar = barContainer.createDiv();
      const percent = (count / total) * 100;
      bar.style.cssText = `
        height:100%;
        width:${percent}%;
        background: ${colors[level]};
        border-radius:4px;
        transition: width 0.3s ease;
      `;

      const countEl = row.createSpan();
      countEl.style.cssText = 'width:40px;font-size:12px;text-align:right;';
      countEl.textContent = count.toString();
    }
  }

  /**
   * 渲染薄弱点分析
   */
  private renderWeakPoints(parent: HTMLElement): void {
    const section = parent.createDiv();
    section.style.cssText = 'margin-bottom:24px;';

    const title = section.createDiv();
    title.style.cssText = 'font-size:14px;font-weight:600;margin-bottom:12px;';
    title.textContent = '⚠️ 薄弱点分析';

    // 找出困难卡片
    const hardCards = this.allCards
      .filter((card) => {
        const data = this.reviewData[card.smiles];
        return data && data.difficulty === 'hard';
      })
      .slice(0, 5);

    if (hardCards.length === 0) {
      const empty = section.createDiv();
      empty.style.cssText = 'text-align:center;color:var(--text-muted);padding:20px;font-size:13px;';
      empty.textContent = '暂无薄弱点，继续保持！🎉';
      return;
    }

    for (const card of hardCards) {
      const row = section.createDiv();
      row.style.cssText = '
        display:flex;
        align-items:center;
        padding:10px;
        background:var(--background-secondary);
        border-radius:8px;
        margin-bottom:6px;
        border-left:3px solid #ef4444;
      ';

      const name = row.createSpan();
      name.style.cssText = 'flex:1;font-size:13px;';
      name.textContent = card.name;

      const difficulty = row.createSpan();
      difficulty.style.cssText = 'font-size:11px;color:#ef4444;';
      difficulty.textContent = '困难';
    }
  }

  /**
   * 获取待复习数量
   */
  private getDueCount(): number {
    const now = Date.now();
    return Object.values(this.reviewData).filter(
      (card: any) => card.nextReview <= now
    ).length;
  }

  /**
   * 获取平均正确率
   */
  private getAverageAccuracy(): number {
    const cards = Object.values(this.reviewData);
    if (cards.length === 0) return 0;
    // 简化版: 根据 ease factor 估算
    const avgEase = cards.reduce((sum: number, card: any) => sum + (card.ease || 2.5), 0) / cards.length;
    return Math.round(((avgEase - 1.3) / (3.0 - 1.3)) * 100);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
