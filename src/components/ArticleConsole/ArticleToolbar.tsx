/**
 * 移动端文章阅读工具栏（<1024px）：[目录] [进度] [分享] [更多]。
 * 取代此前分散的目录触发按钮 / 进度徽标 / 阅读模式切换三个浮层；
 * 悬浮位置沿用旧控件栈的偏移变量（tab-bar/cookie/update 提示/safe-area）。
 * 「更多」面板经 useModalOverlay 获得焦点陷阱与 Esc 关闭。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, Check, Eye, Link2, List, MoreHorizontal, Share2, X } from 'lucide-react';
import { useModalOverlay } from '@/hooks/useModalOverlay';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const TOOLBAR_BOTTOM_STYLE = {
  bottom:
    'calc(var(--tab-bar-height, 0px) + max(calc(env(safe-area-inset-bottom, 0px) + var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + 1rem), calc(var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + 1rem)))',
} as const;

const COPY_FEEDBACK_MS = 2000;

interface MoreAction {
  id: 'reading-mode' | 'copy-link' | 'top';
  label: string;
  icon: React.ReactNode;
  run: () => void | Promise<void>;
}

interface ArticleToolbarProps {
  percentage: number;
  headingsCount: number;
  onOpenToc: () => void;
  onShare: () => void;
  isReadingMode: boolean;
  onToggleReadingMode: () => void;
  onCopyArticleLink: () => Promise<boolean>;
}

export const ArticleToolbar: React.FC<ArticleToolbarProps> = ({
  percentage,
  headingsCount,
  onOpenToc,
  onShare,
  isReadingMode,
  onToggleReadingMode,
  onCopyArticleLink,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [isClient, setIsClient] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [copyOk, setCopyOk] = useState<boolean | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const morePanelRef = useRef<HTMLDivElement | null>(null);
  const copyButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useModalOverlay({
    isOpen: moreOpen,
    onClose: useCallback(() => setMoreOpen(false), []),
    initialFocusRef: copyButtonRef,
    containerRef: morePanelRef,
  });

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  const handleCopyLink = useCallback(async () => {
    const ok = await onCopyArticleLink();
    setCopyOk(ok);
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => setCopyOk(null), COPY_FEEDBACK_MS);
    setMoreOpen(false);
  }, [onCopyArticleLink]);

  const handleBackToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
    setMoreOpen(false);
  }, [shouldReduceMotion]);

  const moreActions: MoreAction[] = [
    {
      id: 'reading-mode',
      label: isReadingMode ? '退出专注阅读' : '专注阅读',
      icon: isReadingMode ? <X size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />,
      run: () => {
        setMoreOpen(false);
        onToggleReadingMode();
      },
    },
    {
      id: 'copy-link',
      label: '复制文章链接',
      icon: <Link2 size={15} aria-hidden="true" />,
      run: () => void handleCopyLink(),
    },
    {
      id: 'top',
      label: '回到顶部',
      icon: <ArrowUp size={15} aria-hidden="true" />,
      run: handleBackToTop,
    },
  ];

  const runAction = (action: MoreAction) => {
    void action.run();
  };

  const toolbar = isClient
    ? createPortal(
        <div
          className="fixed left-1/2 z-floating -translate-x-1/2 lg:hidden"
          style={TOOLBAR_BOTTOM_STYLE}
          role="toolbar"
          aria-label="文章阅读工具"
        >
          {moreOpen && (
            <div
              ref={morePanelRef}
              role="menu"
              aria-label="更多阅读操作"
              className="mb-2 flex flex-col overflow-hidden rounded-surface border border-zinc-300 bg-paper p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
              {moreActions.map((action, index) => (
                <button
                  key={action.id}
                  ref={index === 1 ? copyButtonRef : undefined}
                  type="button"
                  role="menuitem"
                  onClick={() => runAction(action)}
                  className="flex min-h-11 items-center gap-2.5 rounded-control px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 active:scale-[0.98] dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {action.icon}
                  {action.label}
                </button>
              ))}
              <p className="sr-only" role="status" aria-live="polite">
                {copyOk === true ? '文章链接已复制' : copyOk === false ? '复制失败，请重试' : ''}
              </p>
            </div>
          )}
          <div className="flex items-center gap-1 rounded-full border border-zinc-300 bg-paper/95 p-1 shadow-none backdrop-blur-md dark:border-zinc-700 dark:bg-zinc-900/95">
            <button
              type="button"
              onClick={onOpenToc}
              disabled={headingsCount === 0}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-zinc-800 transition-colors hover:bg-zinc-100 active:scale-[0.98] disabled:opacity-40 dark:text-zinc-200 dark:hover:bg-zinc-800"
              aria-label={headingsCount > 0 ? `打开文章目录（共 ${headingsCount} 节）` : '本文无目录'}
              title="目录"
            >
              <List size={16} aria-hidden="true" />
            </button>
            <span
              className="min-w-[3rem] text-center text-sm font-semibold tabular-nums text-zinc-600 dark:text-zinc-300"
              aria-label={`阅读进度 ${percentage}%`}
              title="阅读进度"
            >
              {percentage}%
            </span>
            <button
              type="button"
              onClick={onShare}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-zinc-800 transition-colors hover:bg-zinc-100 active:scale-[0.98] dark:text-zinc-200 dark:hover:bg-zinc-800"
              aria-label="分享文章"
            >
              <Share2 size={16} aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setMoreOpen((value) => !value)}
              className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-zinc-100 active:scale-[0.98] dark:hover:bg-zinc-800 ${moreOpen ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : 'text-zinc-800 dark:text-zinc-200'}`}
              aria-label={moreOpen ? '关闭更多操作' : '更多阅读操作'}
              aria-expanded={moreOpen}
            >
              {moreOpen ? <Check size={16} aria-hidden="true" className="hidden" /> : null}
              <MoreHorizontal size={16} aria-hidden="true" />
            </button>
          </div>
        </div>,
        document.body,
      )
    : null;

  return toolbar;
};
