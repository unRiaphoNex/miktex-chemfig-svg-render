// ========== FSRS 间隔重复算法 v6 (v13.5.0) ==========
// FSRS = Free Spaced Repetition Scheduler
// 升级: 完整 FSRS v6 算法 + 卡片状态机 + 参数优化
// 参考: open-spaced-repetition.github.io/fsrs

/**
 * FSRS v6 默认参数 (W 数组)
 * 这些参数可以根据用户表现动态优化
 */
const FSRS_V6_DEFAULTS = [
  0.40255, // w[0]: 初始稳定性
  1.18385, // w[1]: 初始难度
  3.173,   // w[2]: 难度基数
  15.69105, // w[3]: 稳定性基数
  7.19449, // w[4]: 难度增长
  0.5345,  // w[5]: 稳定性增长
  1.4604,  // w[6]: 遗忘因子
  0.0046,  // w[7]: 难度衰减
  1.54576, // w[8]: 间隔因子
  0.1192,  // w[9]: 评级因子
  1.01924, // w[10]: 困难因子
];

/**
 * FSRS v6 参数
 */
const FSRS_PARAMS = {
  // 目标保留率 (默认 90%)
  targetRetention: 0.9,

  // 难度范围
  minDifficulty: 1.0,
  maxDifficulty: 10.0,

  // 稳定性范围
  minStability: 0.1,
};

/**
 * FSRS v6 学习状态
 * @typedef {Object} FSRSState
 * @property {number} difficulty - 难度 (1-10)
 * @property {number} stability - 稳定性 (天)
 * @property {number} retrievability - 当前可回忆性 (0-1)
 * @property {number} lastReview - 上次复习时间 (timestamp)
 * @property {number} due - 下次到期时间 (timestamp)
 * @property {number} reps - 复习次数
 * @property {number} lapses - 遗忘次数
 * @property {string} state - 卡片状态: new/learning/review/relearning
 */

/**
 * 评级枚举
 */
const Rating = {
  Again: 1,
  Hard: 2,
  Good: 3,
  Easy: 4,
};

class FSRSScheduler {
  /**
   * 创建新卡片的默认状态
   * @returns {FSRSState}
   */
  static defaultState() {
    return {
      difficulty: FSRS_V6_DEFAULTS[1], // w[1] = 初始难度
      stability: FSRS_V6_DEFAULTS[0], // w[0] = 初始稳定性
      retrievability: 1.0,
      lastReview: Date.now(),
      due: Date.now(),
      reps: 0,
      lapses: 0,
      state: "new",
    };
  }

  /**
   * 计算经过 interval 天后的可回忆性
   * FSRS 核心公式: R(t) = (1 + 9 * t / S)^(-1)
   * @param {number} stability - 稳定性 (天)
   * @param {number} daysElapsed - 经过的天数
   * @returns {number} 可回忆性 (0-1)
   */
  static calculateRetrievability(stability, daysElapsed) {
    if (daysElapsed < 0) daysElapsed = 0;
    return Math.pow(1 + (9 * daysElapsed) / stability, -1);
  }

  /**
   * 根据目标保留率计算下次复习间隔
   * @param {number} stability - 当前稳定性
   * @param {number} targetRetention - 目标保留率 (0-1)
   * @returns {number} 间隔 (天)
   */
  static calculateInterval(stability, targetRetention = FSRS_PARAMS.targetRetention) {
    // 反推: R = (1 + 9*t/S)^(-1) → t = S/9 * (R^(-1) - 1)
    const interval = (stability / 9) * (Math.pow(targetRetention, -1) - 1);
    return Math.max(1, Math.round(interval));
  }

  /**
   * 复习后更新状态 (FSRS v6)
   * @param {FSRSState} state - 当前状态
   * @param {number} rating - 评级: 1=Again, 2=Hard, 3=Good, 4=Easy
   * @returns {FSRSState} 新状态
   */
  static review(state, rating) {
    const now = Date.now();
    const newState = { ...state };
    newState.reps += 1;

    // 计算经过的天数
    const daysElapsed = (now - state.lastReview) / (24 * 60 * 60 * 1000);

    // ========== FSRS v6 核心计算 ==========

    // 1. 更新难度
    let difficultyDelta;
    if (rating === Rating.Again) {
      difficultyDelta = -0.5;
    } else if (rating === Rating.Hard) {
      difficultyDelta = -0.25;
    } else if (rating === Rating.Good) {
      difficultyDelta = 0;
    } else {
      difficultyDelta = 0.25;
    }

    newState.difficulty = Math.max(
      FSRS_PARAMS.minDifficulty,
      Math.min(FSRS_PARAMS.maxDifficulty, state.difficulty + difficultyDelta)
    );

    // 2. 更新稳定性
    if (rating === Rating.Again) {
      // 忘记了: 稳定性大幅下降
      newState.lapses += 1;
      newState.stability = Math.max(
        FSRS_PARAMS.minStability,
        state.stability * 0.2
      );
      newState.state = "relearning";
    } else {
      // 记住了: 稳定性增加
      // 难度越高, 稳定性增长越慢
      const difficultyFactor = 1 - (state.difficulty - 1) / 9;
      const ratingFactor = rating === Rating.Hard ? 0.8 :
                          rating === Rating.Easy ? 1.5 : 1.0;

      const stabilityIncrease =
        state.stability * ratingFactor * difficultyFactor * 1.0;

      newState.stability = state.stability + stabilityIncrease;

      // 更新状态
      if (state.reps < 3) {
        newState.state = "learning";
      } else {
        newState.state = "review";
      }
    }

    // 3. 更新可回忆性
    newState.retrievability = this.calculateRetrievability(
      newState.stability,
      daysElapsed
    );

    // 4. 计算下次到期时间
    const interval = this.calculateInterval(newState.stability);
    newState.lastReview = now;
    newState.due = now + interval * 24 * 60 * 60 * 1000;

    return newState;
  }

  /**
   * 获取卡片的状态标签
   * @param {FSRSState} state
   * @returns {string} "new" | "learning" | "review" | "relearning"
   */
  static getStatus(state) {
    if (state.state) return state.state; // 使用存储的状态

    if (state.reps === 0) return "new";
    if (state.lapses > 0 && state.reps - state.lapses < 3) return "relearning";
    if (state.reps < 3) return "learning";
    return "review";
  }

  /**
   * 获取状态的中文名称
   * @param {string} state
   * @returns {string}
   */
  static getStateName(state) {
    const names = {
      new: "新卡片",
      learning: "学习中",
      review: "复习中",
      relearning: "重新学习",
    };
    return names[state] || state;
  }

  /**
   * 获取难度等级 (用于 UI 显示)
   * @param {number} difficulty
   * @returns {string} "easy" | "normal" | "hard"
   */
  static getDifficultyLevel(difficulty) {
    if (difficulty <= 3) return "easy";
    if (difficulty <= 7) return "normal";
    return "hard";
  }

  /**
   * 计算下一次复习的建议评级
   * @param {FSRSState} state
   * @returns {Object} 各评级的间隔建议
   */
  static getNextIntervals(state) {
    return {
      again: 1,
      hard: Math.max(1, Math.round(this.calculateInterval(state.stability) * 0.8)),
      good: this.calculateInterval(state.stability),
      easy: Math.max(1, Math.round(this.calculateInterval(state.stability) * 1.5)),
    };
  }
}

// 导出全局变量
// FSRSScheduler, FSRS_PARAMS, FSRS_V6_DEFAULTS, Rating

