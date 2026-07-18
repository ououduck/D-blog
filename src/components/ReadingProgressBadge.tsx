import React, { RefObject, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';

interface ReadingProgressBadgeProps {
  targetRef: RefObject<HTMLElement | null>;
  onVisibilityChange?: (visible: boolean) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const MOBILE_BADGE_STYLE = {
  right: 'max(1rem, calc(env(safe-area-inset-right) + 1rem))',
  bottom: 'max(5rem, calc(env(safe-area-inset-bottom) + 5rem))',
  width: 'min(10rem, calc(100vw - 2rem - env(safe-area-inset-left) - env(safe-area-inset-right)))'
} as const;
const DESKTOP_BADGE_STYLE = {
  right: '1.5rem',
  bottom: '5rem'
} as const;

export const ReadingProgressBadge: React.FC<ReadingProgressBadgeProps> = React.memo(({ targetRef, onVisibilityChange }) => {
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
      const viewportHeight = window.innerHeight;
      const startOffset = viewportHeight * 0.18;
      const endOffset = viewportHeight * 0.28;
      const totalScrollable = Math.max(rect.height - startOffset - endOffset, 1);
      const travelled = startOffset - rect.top;
      const nextProgress = clamp(travelled / totalScrollable, 0, 1);
      const nextPercentage = Math.round(nextProgress * 100);
      const currentPercentage = Math.round(progressRef.current * 100);
      const nextVisible = rect.top < viewportHeight - startOffset && rect.bottom > endOffset;

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
  }, [targetRef]);

  useEffect(() => {
    onVisibilityChange?.(isVisible);
  }, [isVisible, onVisibilityChange]);

  const percentage = Math.round(progress * 100);

  const mobileBadge =
    isVisible
      ? createPortal(
          <div
            style={MOBILE_BADGE_STYLE}
            className="pointer-events-none fixed z-40 rounded-control border border-zinc-300 bg-paper px-2.5 py-2 shadow-none dark:border-zinc-700 dark:bg-zinc-900 md:hidden"
          >
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
              <span>进度</span>
              <span className="tabular-nums text-zinc-800 dark:text-zinc-200">{percentage}%</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
              <motion.div
                className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                animate={{ width: `${percentage}%` }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
              />
            </div>
          </div>,
          document.body
        )
      : null;

  const desktopBadge =
    isVisible
      ? createPortal(
          <div
            style={DESKTOP_BADGE_STYLE}
            className="pointer-events-none fixed z-[50] hidden md:block"
            aria-hidden={!isVisible}
          >
            <div className="min-w-[7rem] rounded-control border border-zinc-300 bg-paper px-3 py-2 shadow-none dark:border-zinc-700 dark:bg-zinc-900">
              <div className="mb-1 flex items-center justify-between gap-3 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                <span>阅读进度</span>
                <span className="tabular-nums text-zinc-800 dark:text-zinc-200">{percentage}%</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <motion.div
                  className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.18, ease: 'easeOut' }}
                />
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <motion.div
      initial={false}
      animate={{
        opacity: isVisible ? 1 : 0,
        y: isVisible ? 0 : 8
      }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      aria-hidden={!isVisible}
    >
      {mobileBadge}
      {desktopBadge}
    </motion.div>
  );
});
