import type { Variants, Transition } from 'framer-motion';

/** 统一缓动函数 */
export const easeOut = [0.16, 1, 0.3, 1] as const;
export const easeSmooth = [0.22, 1, 0.36, 1] as const;

/** 共享默认过渡 */
export const defaultTransition: Transition = {
  duration: 0.3,
  ease: easeOut,
};

/** 淡入（纯 opacity） */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.25, ease: easeOut },
  },
};

/** 淡入上移（通用入场） */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: easeOut },
  },
};

/** 列表容器（交错子元素） */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.02,
    },
  },
};

/** 卡片 hover 微交互 */
export const cardHover = {
  y: -3,
  transition: { duration: 0.22, ease: easeSmooth },
};

/** 小按钮 hover 微交互 */
export const chipHover = {
  rest: { y: 0 },
  hover: {
    y: -1,
    transition: { duration: 0.2, ease: easeSmooth },
  },
  tap: {
    scale: 0.98,
    transition: { duration: 0.12 },
  },
};

/** 路由切换变体 — 带微妙的方向感和层次感 */
export const routeTransition = {
  initial: { opacity: 0, y: 12, scale: 0.995 },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.32, ease: easeSmooth },
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.998,
    transition: { duration: 0.18, ease: easeSmooth },
  },
} as const;
