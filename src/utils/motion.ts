import type { Variants, Transition } from 'framer-motion';

/** 统一缓动函数 */
export const easeOut = [0.16, 1, 0.3, 1] as const;
export const easeSmooth = [0.22, 1, 0.36, 1] as const;

/** 共享默认过渡 */
export const defaultTransition: Transition = {
  duration: 0.18,
  ease: easeOut,
};

/** 淡入（纯 opacity） */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.16, ease: easeOut },
  },
};

/** 淡入（无位移与缩放，减少重排感） */
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

/** 卡片 hover：保持静态，避免悬浮动画 */
export const cardHover = {
  transition: { duration: 0.16, ease: easeSmooth },
};

/** 小按钮交互：仅保留状态切换，不做位移/缩放 */
export const chipHover = {
  rest: {},
  hover: { transition: { duration: 0.16, ease: easeSmooth } },
  tap: { transition: { duration: 0.1 } },
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

