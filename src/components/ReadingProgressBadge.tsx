/**
 * 阅读进度百分比徽标：滚动时实时更新文章阅读进度。
 */

import React, { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { getReadingProgress, READING_PROGRESS_END_RATIO } from '@/utils/readingProgress';

interface ReadingProgressBadgeProps {
  targetRef: RefObject<HTMLElement | null>;
  endRef?: RefObject<HTMLElement | null>;
  onVisibilityChange?: (visible: boolean) => void;
}

const MOBILE_BADGE_STYLE = {
  bottom:
    'max(calc(env(safe-area-inset-bottom, 0px) + var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + 5rem), calc(var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + 5rem))',
  width: 'min(10rem, calc(100vw - 2rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)))',
} as const;
const DESKTOP_BADGE_STYLE = {
  bottom: 'calc(var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + 5rem)',
} as const;

export const ReadingProgressBadge: React.FC<ReadingProgressBadgeProps> = React.memo(
  ({ targetRef, endRef, onVisibilityChange }) => {
    const shouldReduceMotion = useReducedMotion();
    const [progress, setProgress] = useState(0);
    const [isVisible, setIsVisible] = useState(false);

    const progressRef = useRef(0);
    const visibilityRef = useRef(false);

    useEffect(() => {
      let animationFrame = 0;

      const updateProgress = () => {
        animationFrame = 0;
        const target = targetRef.current;

        if (!target) {
          if (progressRef.current !== 0) {
            progressRef.current = 0;
            setProgress(0);
          }
          if (visibilityRef.current) {
            visibilityRef.current = false;
            setIsVisible(false);
          }
          return;
        }

        const rect = target.getBoundingClientRect();
        const endRect = endRef?.current?.getBoundingClientRect();
        const nextProgress = getReadingProgress({
          rect,
          endRect,
          viewportHeight: window.innerHeight,
          scrollY: window.scrollY,
          documentHeight: document.documentElement.scrollHeight,
        });
        const nextPercentage = Math.round(nextProgress * 100);
        const currentPercentage = Math.round(progressRef.current * 100);
        const visibilityRect = endRect ?? rect;
        // 正文末尾仍位于视口下半区（即尚未滚过正文）时显示徽章；
        // 滚过正文末尾（进入评论区/推荐区）后隐藏。不附加 nextProgress >= 1：
        // 进度被 clamp 在 1 后该条件恒真，会让隐藏分支永远不可达。
        const nextVisible = visibilityRect.bottom > window.innerHeight * READING_PROGRESS_END_RATIO;

        if (nextPercentage !== currentPercentage) {
          progressRef.current = nextProgress;
          setProgress(nextProgress);
        }
        if (nextVisible !== visibilityRef.current) {
          visibilityRef.current = nextVisible;
          setIsVisible(nextVisible);
        }
      };

      const scheduleUpdate = () => {
        if (!animationFrame) {
          animationFrame = window.requestAnimationFrame(updateProgress);
        }
      };

      scheduleUpdate();
      window.addEventListener('scroll', scheduleUpdate, { passive: true });
      window.addEventListener('resize', scheduleUpdate);

      return () => {
        window.removeEventListener('scroll', scheduleUpdate);
        window.removeEventListener('resize', scheduleUpdate);
        if (animationFrame) {
          window.cancelAnimationFrame(animationFrame);
        }
      };
    }, [endRef, targetRef]);

    useEffect(() => {
      onVisibilityChange?.(isVisible);
    }, [isVisible, onVisibilityChange]);

    const percentage = Math.round(progress * 100);

    const mobileBadge = isVisible
      ? createPortal(
          <div
            style={MOBILE_BADGE_STYLE}
            className="reading-progress-badge fixed-control-position pointer-events-none fixed z-floating flex h-11 flex-col justify-center rounded-control border border-zinc-300 bg-paper px-2.5 shadow-none dark:border-zinc-700 dark:bg-zinc-900 lg:hidden"
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
              <span>进度</span>
              <span className="tabular-nums text-zinc-800 dark:text-zinc-200">{percentage}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <motion.div
                className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                animate={{ width: `${percentage}%` }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }}
              />
            </div>
          </div>,
          document.body,
        )
      : null;

    const desktopBadge = isVisible
      ? createPortal(
          <div
            style={DESKTOP_BADGE_STYLE}
            // 仅在 isVisible 时渲染：隐藏语义由条件渲染承担（portal 内容不在
            // wrapper 的 DOM 作用域内，wrapper 上的 aria-hidden 对它无效）。
            className="fixed-control-position pointer-events-none fixed z-floating hidden h-11 lg:block"
          >
            <div className="flex h-full min-w-[7rem] flex-col justify-center rounded-control border border-zinc-300 bg-paper px-3 shadow-none dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mb-1 flex items-center justify-between gap-3 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                <span>阅读进度</span>
                <span className="tabular-nums text-zinc-800 dark:text-zinc-200">{percentage}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <motion.div
                  className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                  animate={{ width: `${percentage}%` }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

    return (
      <motion.div
        initial={false}
        animate={{
          opacity: isVisible ? 1 : 0,
          y: isVisible ? 0 : 8,
        }}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
      >
        {mobileBadge}
        {desktopBadge}
      </motion.div>
    );
  },
);
