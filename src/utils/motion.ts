/**
 * 全站统一的 cubic-bezier 缓动曲线。
 *
 * easeOut — 强减速（0.16, 1, 0.3, 1）：入场末段极缓，适合卡片/列表显隐。
 * easeSmooth — 柔和过渡（0.22, 1, 0.36, 1）：比 easeOut 更平缓，适合路由切换与
 * 状态过渡。两者均为标准 ease-out（y 控制点不越过 1，无回弹），配合无位移动画，
 * 减少重排感。
 */

export const easeOut = [0.16, 1, 0.3, 1] as const;
export const easeSmooth = [0.22, 1, 0.36, 1] as const;

/**
 * 路由切换变体 — 只保留进入淡入（无退出动画）：避免 mode="wait" 下
 * 「旧页淡出 → 短暂空白 → 新页淡入」的闪白感；原生 View Transitions
 * 支持时由浏览器接管整段过渡。
 */
export const routeTransition = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.15, ease: easeSmooth },
  },
} as const;
