/**
 * 阅读进度百分比徽标：滚动时实时更新文章阅读进度。
 * 常驻显示：不随滚动到正文末尾而隐藏（此前进入评论区/推荐区后自动消失，
 * 用户反馈希望进度始终可见）。
 */

import React, { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { getReadingProgress } from '@/utils/readingProgress';

interface ReadingProgressBadgeProps {
  targetRef: RefObject<HTMLElement | null>;
  endRef?: RefObject<HTMLElement | null>;
}

const MOBILE_BADGE_STYLE = {
  bottom:
    'calc(var(--tab-bar-height, 0px) + max(calc(env(safe-area-inset-bottom, 0px) + var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + 5rem), calc(var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + 5rem)))',
  width: 'min(10rem, calc(100vw - 2rem - env(safe-area-inset-left, 0px) - env(safe-area-inset-right, 0px)))',
} as const;
const DESKTOP_BADGE_STYLE = {
  bottom: 'calc(var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + 5rem)',
} as const;

export const ReadingProgressBadge: React.FC<ReadingProgressBadgeProps> = React.memo(({ targetRef, endRef }) => {
  const shouldReduceMotion = useReducedMotion();
  const [progress, setProgress] = useState(0);
  // 正文容器是否存在（文章已加载）：不存在时不渲染徽章。
  const [hasTarget, setHasTarget] = useState(false);
  const progressRef = useRef(0);
  const hasTargetRef = useRef(false);

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
        if (hasTargetRef.current) {
          hasTargetRef.current = false;
          setHasTarget(false);
        }
        return;
      }

      if (!hasTargetRef.current) {
        hasTargetRef.current = true;
        setHasTarget(true);
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

      if (nextPercentage !== currentPercentage) {
        progressRef.current = nextProgress;
        setProgress(nextProgress);
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

  const percentage = Math.round(progress * 100);

  if (!hasTarget) {
    return null;
  }

  const mobileBadge = createPortal(
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
  );

  const desktopBadge = createPortal(
    <div
      style={DESKTOP_BADGE_STYLE}
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
  );

  return (
    <>
      {mobileBadge}
      {desktopBadge}
    </>
  );
});
