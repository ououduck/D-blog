import React, { RefObject, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { BookOpenCheck } from 'lucide-react';

interface ReadingProgressBadgeProps {
  targetRef: RefObject<HTMLElement | null>;
  onVisibilityChange?: (visible: boolean) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const MOBILE_BADGE_STYLE = {
  right: 'max(1rem, calc(env(safe-area-inset-right) + 1rem))',
  bottom: 'max(4.4rem, calc(env(safe-area-inset-bottom) + 4.4rem))',
  width: '11rem'
} as const;
const DESKTOP_BADGE_STYLE = {
  right: '1.5rem',
  bottom: '5rem'
} as const;

export const ReadingProgressBadge: React.FC<ReadingProgressBadgeProps> = ({ targetRef, onVisibilityChange }) => {
  const [progress, setProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateProgress = () => {
      const target = targetRef.current;

      if (!target) {
        setProgress(0);
        setIsVisible(false);
        return;
      }

      const rect = target.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const startOffset = viewportHeight * 0.18;
      const endOffset = viewportHeight * 0.28;
      const totalScrollable = Math.max(rect.height - startOffset - endOffset, 1);
      const travelled = startOffset - rect.top;
      const nextProgress = clamp(travelled / totalScrollable, 0, 1);

      setProgress(nextProgress);
      setIsVisible(rect.top < viewportHeight - startOffset && rect.bottom > endOffset);
    };

    updateProgress();

    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);

    return () => {
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
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
            className="pointer-events-none fixed z-40 rounded-2xl border border-zinc-200/80 bg-white/92 px-2.5 py-2 shadow-[0_16px_34px_-24px_rgba(24,24,27,0.28)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/84 md:hidden"
          >
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.1em] text-zinc-500 dark:text-zinc-400">
                <BookOpenCheck size={11} className="text-accent" />
                进度
              </span>
              <span className="font-serif text-xs font-bold text-ink dark:text-white">
                {percentage}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-accent/70 via-accent to-amber-400"
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
            <div className="min-w-[9.5rem] rounded-2xl border border-zinc-200/80 bg-white/92 px-4 py-3 shadow-[0_18px_48px_-30px_rgba(24,24,27,0.35)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/84">
              <div className="mb-2 flex items-center justify-between gap-3 md:mb-2.5">
                <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">
                  <BookOpenCheck size={14} className="text-accent" />
                  阅读进度
                </span>
                <span className="font-serif text-lg font-bold text-ink dark:text-white">
                  {percentage}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-accent/70 via-accent to-amber-400"
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
        y: isVisible ? 0 : 10,
        scale: isVisible ? 1 : 0.98
      }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      aria-hidden={!isVisible}
    >
      {mobileBadge}
      {desktopBadge}
    </motion.div>
  );
};
