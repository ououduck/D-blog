/**
 * 反馈侧签（FeedbackDock）：固定在视口右侧中下部、紧贴侧边的可收缩弹窗。
 *
 * 收起态：仅显示一个立着的长方形侧签（带向左箭头），贴在页面最右侧边缘；
 * 点击后向左拉出面板，顶部显示「我们需要您的反馈」，下方提供跳转外部
 * 反馈表单（Tally）的「前往反馈页」按钮。
 *
 * 交互与无障碍：
 * - 展开/收起由侧签按钮切换，支持 Escape 关闭、点击面板外部关闭；
 * - 收起态面板以 visibility:hidden + aria-hidden + inert 移出可访问性树
 *   （且不可聚焦），展开后焦点移入反馈链接，收起时焦点还给侧签按钮；
 * - 动画尊重 prefers-reduced-motion。
 */

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { siteConfig } from '@config/site.config';
import { useReducedMotion } from '@/hooks/useReducedMotion';

// 侧签固定在视口中下部（与历史反馈浮钮一致），紧贴右侧边缘（含刘海屏安全区）。
const FEEDBACK_DOCK_TOP = '62%';
const FEEDBACK_DOCK_RIGHT = 'env(safe-area-inset-right, 0px)';

export const FeedbackDock: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<HTMLButtonElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);
  const hasOpenedRef = useRef(false);

  const toggle = () => setIsOpen((open) => !open);

  // 焦点管理：展开后焦点进入面板（反馈链接），收起时还给侧签按钮；
  // 首次挂载（从未展开）不抢焦点。
  useEffect(() => {
    if (isOpen) {
      hasOpenedRef.current = true;
      linkRef.current?.focus();
      return;
    }
    if (hasOpenedRef.current) {
      hasOpenedRef.current = false;
      handleRef.current?.focus();
    }
  }, [isOpen]);

  // Escape 收起。
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // 点击面板外部收起（非模态：页面其余内容保持可交互）。
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const handlePointerDown = (event: PointerEvent) => {
      const root = rootRef.current;
      if (root && event.target instanceof Node && !root.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  const transitionClasses = shouldReduceMotion ? '' : 'transition-[transform,visibility] duration-300 ease-out';

  return (
    <div
      ref={rootRef}
      className="feedback-dock fixed z-floating"
      style={{ top: FEEDBACK_DOCK_TOP, right: FEEDBACK_DOCK_RIGHT }}
    >
      <div className="relative">
        {/* 收起态侧签：立着的长方形，紧贴右侧边缘，带向左箭头；展开后箭头翻转指向收起方向 */}
        <button
          ref={handleRef}
          type="button"
          onClick={toggle}
          aria-expanded={isOpen}
          aria-controls="feedback-dock-panel"
          aria-label={isOpen ? '收起反馈面板' : '打开反馈面板'}
          className="feedback-dock-handle relative z-10 inline-flex h-28 w-10 flex-col items-center justify-center rounded-l-md border border-r-0 border-zinc-950 bg-zinc-950 text-white shadow-sm transition-colors hover:bg-zinc-800 active:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
        >
          <ArrowLeft
            size={18}
            aria-hidden="true"
            className={`${shouldReduceMotion ? '' : 'transition-transform duration-200'} ${isOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {/* 展开面板：以侧签左缘为锚向左拉出；收起时右移出屏并移出可访问性树 */}
        <div
          id="feedback-dock-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="feedback-dock-title"
          aria-hidden={!isOpen}
          inert={!isOpen}
          data-open={isOpen}
          className={`feedback-dock-panel absolute right-full top-0 w-64 max-w-[calc(100vw-3.5rem)] rounded-l-overlay border border-zinc-300 border-r-0 bg-paper shadow-[0_10px_30px_rgba(24,24,27,0.14)] dark:border-zinc-700 dark:bg-zinc-900 ${transitionClasses} ${
            isOpen ? 'visible translate-x-0' : 'invisible translate-x-full'
          }`}
        >
          <div className="border-b border-zinc-200 px-4 pb-3 pt-4 dark:border-zinc-800">
            <h2
              id="feedback-dock-title"
              className="font-serif text-base font-bold leading-snug text-ink dark:text-white"
            >
              我们需要您的反馈
            </h2>
          </div>
          <div className="px-4 py-4">
            <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
              您的反馈与建议能帮助 D-blog 变得更好，期待听到您的声音。
            </p>
            <a
              ref={linkRef}
              href={siteConfig.feedback.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="editorial-button-primary mt-4 w-full justify-center"
            >
              前往反馈页
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
