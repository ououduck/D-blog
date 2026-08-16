/**
 * 滚动进入视口的轻量揭示组件（灵感来自 react-bits「FadeContent /
 * AnimatedContent」的滚动激活思想，改用 framer-motion 实现）：
 * - 元素进入视口后淡入并轻微上移；
 * - 尊重 prefers-reduced-motion：直接渲染最终状态。
 *
 * SSR 行为说明：framer-motion 会把 initial（opacity:0）写为内联样式注入
 * SSG HTML，因此 JS 加载完成前元素不可见。无 JS 场景由 ssg.mjs 注入的
 * NOSCRIPT_FALLBACK 兜底（强制 [style*="opacity: 0"] 可见）；水合后由
 * framer-motion 在进入视口时播放入场动画。注意：本组件用于首屏以上内容
 * 时会延迟 LCP（初始不可见直到水合+动画），非首屏内容无此影响 ——
 * 请勿用本组件包裹 LCP 元素（LCP 元素应首帧即渲染最终可见状态）。
 */

import React from 'react';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { easeSmooth } from '@/utils/motion';

interface RevealProps {
  /** 进入视口的延迟（秒）。 */
  delay?: number;
  /** 入场位移距离（px）。 */
  y?: number;
  /** 触发阈值：元素可见比例达到该值即播放。 */
  amount?: number;
  /** 是否只播放一次。 */
  once?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export const Reveal: React.FC<RevealProps> = ({
  delay = 0,
  y = 12,
  amount = 0.15,
  once = true,
  className,
  children,
}) => {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reducedMotion ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, amount }}
      transition={{ duration: 0.4, ease: easeSmooth, delay }}
    >
      {children}
    </motion.div>
  );
};
