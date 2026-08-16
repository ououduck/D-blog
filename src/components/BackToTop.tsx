/**
 * 返回顶部按钮：IntersectionObserver 观察顶部哨兵控制显隐，隐藏时同步
 * 移除焦点可达性；滚动行为尊重 prefers-reduced-motion。
 */
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
          // 隐藏时同步 visibility/tabIndex：仅 opacity/pointer-events 仍可被键盘
          // Tab 聚焦触发滚动，且会被读屏软件读出。
          // 键盘用户聚焦可见按钮后向上滚动越过阈值：visibility:hidden 不移走
          // 焦点，主动 blur 避免焦点滞留于不可见、不可读元素。
          if (document.activeElement === btn) {
            btn.blur();
          }
          btn.style.opacity = '0';
          btn.style.pointerEvents = 'none';
          btn.style.visibility = 'hidden';
          btn.tabIndex = -1;
          btn.style.transform = 'translateY(8px)';
        } else {
          btn.style.opacity = '1';
          btn.style.pointerEvents = 'auto';
          btn.style.visibility = 'visible';
          btn.tabIndex = 0;
          btn.style.transform = 'translateY(0)';
        }
      },
      // 正值 top margin 向上扩展根矩形：哨兵（top:0）在前 300px 内与根相交
      // → isIntersecting=true → 隐藏按钮；滚动超过 300px 后脱离相交 → 显示按钮。
      { rootMargin: '300px 0px 0px 0px' },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  }, [shouldReduceMotion]);

  return (
    <>
      {/* 可见性哨兵：由 IntersectionObserver 观察，控制按钮的显隐与焦点可达性。 */}
      <div
        ref={sentinelRef}
        aria-hidden="true"
        style={{ position: 'absolute', top: 0, left: 0, width: 1, height: 1 }}
      />
      <button
        ref={buttonRef}
        onClick={scrollToTop}
        style={
          {
            '--back-to-top-bottom':
              'max(1rem, calc(var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + env(safe-area-inset-bottom, 0px) + 1rem))',
            '--back-to-top-right': 'max(1rem, calc(env(safe-area-inset-right, 0px) + 1rem))',
            opacity: 0,
            pointerEvents: 'none',
            visibility: 'hidden',
            transform: 'translateY(8px)',
            transition: shouldReduceMotion ? 'none' : 'opacity 0.2s ease, transform 0.2s ease, visibility 0.2s ease',
          } as React.CSSProperties
        }
        className="back-to-top-btn fixed bottom-[var(--back-to-top-bottom)] right-[var(--back-to-top-right)] z-floating inline-flex h-11 w-11 items-center justify-center rounded-icon border border-zinc-300 bg-paper text-ink shadow-none transition-colors hover:border-zinc-500 hover:bg-zinc-100 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:border-zinc-500 dark:hover:bg-zinc-800 md:bottom-[calc(var(--cookie-notice-height,0px)+var(--service-worker-prompt-height,0px)+2rem)] md:right-8"
        aria-label="返回顶部"
      >
        <ArrowUp size={18} />
      </button>
    </>
  );
};
