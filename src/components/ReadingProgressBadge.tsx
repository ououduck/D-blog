import React, { RefObject, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpenCheck } from 'lucide-react';

interface ReadingProgressBadgeProps {
  targetRef: RefObject<HTMLElement | null>;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

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
      className="pointer-events-none fixed bottom-5 right-4 z-40 sm:bottom-7 sm:right-6"
      aria-hidden={!isVisible}
    >
      <div className="min-w-[9.5rem] rounded-2xl border border-zinc-200/80 bg-white/88 px-4 py-3 shadow-[0_20px_60px_-28px_rgba(24,24,27,0.35)] backdrop-blur-xl dark:border-zinc-800 dark:bg-zinc-950/82">
        <div className="mb-2 flex items-center justify-between gap-3">
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
    </motion.div>
  );
};
