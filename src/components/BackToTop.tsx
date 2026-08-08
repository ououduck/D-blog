import React, { useCallback, useEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export const BackToTop = () => {
  const shouldReduceMotion = useReducedMotion();
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
    window.scrollTo({ top: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  }, [shouldReduceMotion]);

  return (
    <>
      {/* Visibility sentinel observed by IntersectionObserver. */}
      <div ref={sentinelRef} aria-hidden="true" style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1 }} />
      <button
        ref={buttonRef}
        onClick={scrollToTop}
        style={{
          '--back-to-top-bottom': 'max(1rem, calc(var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + env(safe-area-inset-bottom, 0px) + 1rem))',
          '--back-to-top-right': 'max(1rem, calc(env(safe-area-inset-right, 0px) + 1rem))',
          opacity: 0,
          pointerEvents: 'none',
          transform: 'translateY(8px)',
          transition: shouldReduceMotion ? 'none' : 'opacity 0.2s ease, transform 0.2s ease',
        } as React.CSSProperties}
        className="back-to-top-btn fixed bottom-[var(--back-to-top-bottom)] right-[var(--back-to-top-right)] z-floating inline-flex h-11 w-11 items-center justify-center rounded-icon border border-zinc-300 bg-paper text-ink shadow-none transition-colors hover:border-zinc-500 hover:bg-zinc-100 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:border-zinc-500 dark:hover:bg-zinc-800 md:bottom-[calc(var(--cookie-notice-height,0px)+var(--service-worker-prompt-height,0px)+2rem)] md:right-8"
        aria-label="返回顶部"
      >
        <ArrowUp size={18} />
      </button>
    </>
  );
};
