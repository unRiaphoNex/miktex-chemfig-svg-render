/**
 * 学习模块组件
 * v17.0.0 - 完全重构版本
 *
 * 包含:
 * - 翻转卡片练习
 * - 默写练习
 * - 每日一题
 * - 反应式分步查看
 * - 反应条件速查
 */

import { Modal, Notice } from 'obsidian';
import { LearningAnalyticsModal } from './LearningAnalyticsModal';

/**
 * 学习模块管理器
 */
export class LearningModuleManager {
  private app: any;
  private plugin: any;

  constructor(app: any, plugin: any) {
    this.app = app;
    this.plugin = plugin;
  }

  /**
   * 打开翻转卡片练习
   */
  openFlashcardPractice(): void {
    // TODO: 从 molecule-editor.ts 迁移
    new Notice("翻转卡片练习功能正在迁移中...", 2000);
  }

  /**
   * 打开默写练习
   */
  openQuizMode(): void {
    // TODO: 从 molecule-editor.ts 迁移
    new Notice("默写练习功能正在迁移中...", 2000);
  }

  /**
   * 打开每日一题
   */
  openDailyChallenge(): void {
    // TODO: 从 molecule-editor.ts 迁移
    new Notice("每日一题功能正在迁移中...", 2000);
  }

  /**
   * 打开反应式分步查看
   */
  openReactionStepsViewer(reactionText?: string): void {
    // TODO: 从 molecule-editor.ts 迁移
    new Notice("反应式分步查看功能正在迁移中...", 2000);
  }

  /**
   * 打开反应条件速查
   */
  openReactionConditionsGuide(): void {
    // TODO: 从 molecule-editor.ts 迁移
    new Notice("反应条件速查功能正在迁移中...", 2000);
  }

  /**
   * 打开官能团分析
   */
  openFunctionalGroupAnalysis(smiles: string): void {
    // TODO: 从 molecule-editor.ts 迁移
    new Notice("官能团分析功能正在迁移中...", 2000);
  }

  /**
   * 打开学习统计
   */
  openLearningAnalytics(): void {
    // 加载复习数据
    let reviewData = {};
    try {
      reviewData = JSON.parse(localStorage.getItem("chemfig-review-data") || "{}");
    } catch (e) {}

    // 收集所有卡片
    const allCards = [];
    // TODO: 从外部传入 MOLECULE_FRAGMENT_LIBRARY
    new LearningAnalyticsModal(this.app, reviewData, allCards).open();
  }

  /**
   * 打开配对游戏
   */
  openMatchingGame(): void {
    // TODO: 从 molecule-editor.ts 迁移
    new Notice("配对游戏功能正在迁移中...", 2000);
  }
}
