/**
 * 学习模块组件
 * v17.1.0 - 完全重构版本
 *
 * 包含:
 * - 翻转卡片练习
 * - 默写练习
 * - 每日一题
 * - 反应式分步查看
 * - 反应条件速查
 * - 官能团分析
 * - 配对游戏
 */

import { Modal, Notice } from 'obsidian';
import { LearningAnalyticsModal } from './LearningAnalyticsModal';

/**
 * 学习模块管理器
 */
export class LearningModuleManager {
  private app: any;
  private plugin: any;
  private editorInstance: any;

  constructor(app: any, plugin: any, editorInstance?: any) {
    this.app = app;
    this.plugin = plugin;
    this.editorInstance = editorInstance;
  }

  /**
   * 打开翻转卡片练习
   */
  openFlashcardPractice(): void {
    // 调用 molecule-editor.ts 中已有的功能
    if (this.editorInstance && typeof this.editorInstance.openFlashcardPractice === 'function') {
      this.editorInstance.openFlashcardPractice();
    } else if (typeof openFlashcardPractice === 'function') {
      openFlashcardPractice();
    } else {
      new Notice("翻转卡片练习功能未找到", 2000);
    }
  }

  /**
   * 打开默写练习
   */
  openQuizMode(): void {
    if (this.editorInstance && typeof this.editorInstance.openQuizMode === 'function') {
      this.editorInstance.openQuizMode();
    } else if (typeof openQuizMode === 'function') {
      openQuizMode();
    } else {
      new Notice("默写练习功能未找到", 2000);
    }
  }

  /**
   * 打开每日一题
   */
  openDailyChallenge(): void {
    if (this.editorInstance && typeof this.editorInstance.openDailyChallenge === 'function') {
      this.editorInstance.openDailyChallenge();
    } else if (typeof openDailyChallenge === 'function') {
      openDailyChallenge();
    } else {
      new Notice("每日一题功能未找到", 2000);
    }
  }

  /**
   * 打开反应式分步查看
   */
  openReactionStepsViewer(reactionText?: string): void {
    if (this.editorInstance && typeof this.editorInstance.openReactionStepsViewer === 'function') {
      this.editorInstance.openReactionStepsViewer(reactionText);
    } else if (typeof openReactionStepsViewer === 'function') {
      openReactionStepsViewer(reactionText);
    } else {
      new Notice("反应式分步查看功能未找到", 2000);
    }
  }

  /**
   * 打开反应条件速查
   */
  openReactionConditionsGuide(): void {
    if (this.editorInstance && typeof this.editorInstance.openReactionConditionsGuide === 'function') {
      this.editorInstance.openReactionConditionsGuide();
    } else if (typeof ReactionConditionsModal === 'function') {
      new ReactionConditionsModal(this.app).open();
    } else {
      new Notice("反应条件速查功能未找到", 2000);
    }
  }

  /**
   * 打开官能团分析
   */
  openFunctionalGroupAnalysis(smiles: string): void {
    if (this.editorInstance && typeof this.editorInstance.openFunctionalGroupAnalysis === 'function') {
      this.editorInstance.openFunctionalGroupAnalysis(smiles);
    } else if (typeof analyzeFunctionalGroups === 'function') {
      analyzeFunctionalGroups(smiles);
    } else {
      new Notice("官能团分析功能未找到", 2000);
    }
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
    let allCards = [];
    try {
      if (typeof MOLECULE_FRAGMENT_LIBRARY !== 'undefined') {
        allCards = MOLECULE_FRAGMENT_LIBRARY;
      }
    } catch (e) {}

    new LearningAnalyticsModal(this.app, reviewData, allCards).open();
  }

  /**
   * 打开配对游戏
   */
  openMatchingGame(): void {
    if (this.editorInstance && typeof this.editorInstance.openMatchingGame === 'function') {
      this.editorInstance.openMatchingGame();
    } else if (typeof MatchingGameModal === 'function') {
      new MatchingGameModal(this.app).open();
    } else {
      new Notice("配对游戏功能未找到", 2000);
    }
  }

  /**
   * 打开反向合成分析
   */
  openRetrosynthesis(): void {
    if (this.editorInstance && typeof this.editorInstance.openRetrosynthesis === 'function') {
      this.editorInstance.openRetrosynthesis();
    } else if (typeof RetrosynthesisModal === 'function') {
      new RetrosynthesisModal(this.app).open();
    } else {
      new Notice("反向合成分析功能未找到", 2000);
    }
  }

  /**
   * 获取学习统计
   */
  getLearningStats(): { total: number; learned: number; streak: number } {
    try {
      const reviewData = JSON.parse(localStorage.getItem("chemfig-review-data") || "{}");
      const learned = Object.keys(reviewData).length;
      const streak = reviewData._streak || 0;
      return {
        total: typeof MOLECULE_FRAGMENT_LIBRARY !== 'undefined' ? MOLECULE_FRAGMENT_LIBRARY.length : 0,
        learned,
        streak,
      };
    } catch (e) {
      return { total: 0, learned: 0, streak: 0 };
    }
  }
}

// 导出
export { LearningModuleManager };
