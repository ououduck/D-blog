/**
 * 返回顶部按钮：全局常驻显示（不再随滚动位置显隐，用户反馈希望按钮始终
 * 可见可用）；滚动行为尊重 prefers-reduced-motion。
 */
import React, { useCallback } from 'react';
import { ArrowUp } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export const BackToTop = () => {
  const shouldReduceMotion = useReducedMotion();

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  }, [shouldReduceMotion]);

  return (
    <button
      type="button"
      onClick={scrollToTop}
      style={
        {
          '--back-to-top-bottom':
            'calc(var(--tab-bar-height, 0px) + max(1.25rem, var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + env(safe-area-inset-bottom, 0px) + 1.25rem))',
          '--back-to-top-right': 'max(1rem, calc(env(safe-area-inset-right, 0px) + 1rem))',
        } as React.CSSProperties
      }
      className="back-to-top-btn fixed bottom-[var(--back-to-top-bottom)] right-[var(--back-to-top-right)] z-floating inline-flex h-11 w-11 items-center justify-center rounded-icon border border-zinc-300 bg-paper text-ink shadow-none transition-colors hover:border-zinc-500 hover:bg-zinc-100 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:border-zinc-500 dark:hover:bg-zinc-800 md:bottom-[calc(var(--tab-bar-height,0px)+var(--cookie-notice-height,0px)+var(--service-worker-prompt-height,0px)+2rem)] md:right-8"
      aria-label="返回顶部"
    >
      <ArrowUp size={18} />
    </button>
  );
};
