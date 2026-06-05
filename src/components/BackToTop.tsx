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
          btn.style.transform = 'scale(0.5)';
        } else {
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
          btn.style.transform = 'scale(1)';
        }
      },
      { rootMargin: '-300px 0px 0px 0px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
          transform: 'scale(0.5)',
          transition: 'opacity 0.2s ease, transform 0.2s ease',
        }}
        className="group fixed z-40 rounded-full border border-zinc-200/80 bg-white/94 p-3 text-ink shadow-[0_18px_40px_-26px_rgba(28,25,23,0.3)] backdrop-blur-xl hover:scale-110 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/94 dark:text-white dark:hover:bg-zinc-700 md:bottom-8 md:right-8"
        aria-label="返回顶部"
      >
        <ArrowUp size={20} className="transition-transform group-hover:-translate-y-1" />
      </button>
    </>
  );
};
