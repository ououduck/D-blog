import React, { useCallback, useEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';

const MOBILE_OFFSET_STYLE = {
  right: 'max(1rem, calc(env(safe-area-inset-right) + 1rem))',
  bottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 1rem))'
} as const;

export const BackToTop = () => {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const btn = buttonRef.current;
        if (!btn) return;
        if (entry.isIntersecting) {
          btn.style.opacity = '0';
          btn.style.pointerEvents = 'none';
          btn.style.transform = 'translateY(8px)';
        } else {
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
          btn.style.transform = 'translateY(0)';
        }
      },
      { rootMargin: '-300px 0px 0px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const scrollToTop = useCallback(() => {
    const shouldReduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  }, []);

  return (
    <>
      {/* Sentinel element at the top of the page */}
      <div ref={sentinelRef} aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1 }} />
      <button
        ref={buttonRef}
        onClick={scrollToTop}
        style={{
          ...MOBILE_OFFSET_STYLE,
          opacity: 0,
          pointerEvents: 'none',
          transform: 'translateY(8px)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
        className="fixed z-40 rounded-icon border border-zinc-300 bg-paper p-2.5 text-ink shadow-none transition-colors hover:border-zinc-500 hover:bg-zinc-100 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:border-zinc-500 dark:hover:bg-zinc-800 md:bottom-8 md:right-8"
        aria-label="返回顶部"
      >
        <ArrowUp size={18} />
      </button>
    </>
  );
};
