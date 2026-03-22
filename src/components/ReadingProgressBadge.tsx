import React, { RefObject, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpenCheck } from 'lucide-react';

interface ReadingProgressBadgeProps {
  targetRef: RefObject<HTMLElement | null>;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const MOBILE_BADGE_STYLE = {
  left: 'max(1rem, calc(env(safe-area-inset-left) + 1rem))',
  right: 'max(4.75rem, calc(env(safe-area-inset-right) + 4.75rem))',
  bottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 1rem))'
} as const;

export const ReadingProgressBadge: React.FC<ReadingProgressBadgeProps> = ({ targetRef }) => {
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

  const percentage = Math.round(progress * 100);

  return (
    <motion.div
      initial={false}
      animate={{
        opacity: isVisible ? 1 : 0,
        y: isVisible ? 0 : 14,
        scale: isVisible ? 1 : 0.96
      }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      style={MOBILE_BADGE_STYLE}
      className="pointer-events-none fixed z-30 md:bottom-28 md:right-6 md:left-auto md:w-auto"
      aria-hidden={!isVisible}
    >
      <div className="rounded-2xl border border-zinc-200/80 bg-white/90 px-3 py-2.5 shadow-[0_18px_48px_-30px_rgba(24,24,27,0.35)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/84 md:min-w-[9.5rem] md:px-4 md:py-3">
        <div className="mb-2 flex items-center justify-between gap-3 md:mb-2.5">
          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 md:text-[11px] md:tracking-[0.24em]">
            <BookOpenCheck size={13} className="text-accent md:h-[14px] md:w-[14px]" />
            阅读进度
          </span>
          <span className="font-serif text-base font-bold text-ink dark:text-white md:text-lg">
            {percentage}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800 md:h-2">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-accent/70 via-accent to-amber-400"
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          />
        </div>
      </div>
    </motion.div>
  );
};
