import type { Variants } from 'framer-motion';

/**
 * 全站统一的 cubic-bezier 缓动曲线。
 *
 * easeOut — 强减速（0.16, 1, 0.3, 1）：入场末段极缓，适合卡片/列表显隐。
 * easeSmooth — 柔和过渡（0.22, 1, 0.36, 1）：比 easeOut 更平缓，适合路由切换与
 * 状态过渡。两者均为「超射后回弹」型曲线，无位移动画，减少重排感。
 */
export const easeOut = [0.16, 1, 0.3, 1] as const;
export const easeSmooth = [0.22, 1, 0.36, 1] as const;

/** 轻量淡入（无位移与缩放，减少重排感）。 */
export const fadeInUp: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.18, ease: easeSmooth },
  },
};

/** 列表容器（轻量交错） */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.018,
      delayChildren: 0.01,
    },
  },
};

/** 路由切换变体 — 轻量淡入淡出 */
export const routeTransition = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.22, ease: easeSmooth },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.14, ease: easeSmooth },
  },
} as const;

