/**
 * 阅读模式切换开关：一键进入/退出专注阅读布局。
 *
 * 悬浮位置与右下角控件栈的垂直间距保持一致：移动端（<768px）「专注阅读」
 * 与「目录」触发按钮之间、目录与「阅读进度」徽标之间的间距同为 3.5rem；
 * 桌面端三者的间距同为 4rem（目录/进度各自的位置见 TableOfContents 与
 * ReadingProgressBadge 的 style 常量，改动需同步核对）。
 */

import React, { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { useReadingMode } from '@/components/ReadingModeContext';

// 移动端（<768px）：底部标签栏之上、通知条/更新条之下再偏移 12rem。
// 目录触发按钮位于 +8.5rem、进度徽标位于 +5rem，故三者间距恒为 3.5rem。
const READING_MODE_TOGGLE_MOBILE_STYLE = {
  bottom:
    'calc(var(--tab-bar-height, 0px) + max(calc(var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + env(safe-area-inset-bottom, 0px) + 12rem), calc(var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + 12rem)))',
} as const;
// 桌面端（≥768px）：目录触发按钮位于 +9rem、进度徽标位于 +5rem，
// 本按钮位于 +13rem，三者间距同为 4rem。
const READING_MODE_TOGGLE_DESKTOP_STYLE = {
  bottom: 'calc(var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + 13rem)',
} as const;

const isDesktopMediaQuery = '(min-width: 768px)';

export const ReadingModeToggle: React.FC = () => {
  const { isReadingMode, toggleReadingMode } = useReadingMode();
  const [isClient, setIsClient] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(isDesktopMediaQuery);
    const syncViewport = () => setIsDesktopViewport(mediaQuery.matches);
    syncViewport();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewport);
      return () => mediaQuery.removeEventListener('change', syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  if (!isClient || isReadingMode) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={toggleReadingMode}
      style={isDesktopViewport ? READING_MODE_TOGGLE_DESKTOP_STYLE : READING_MODE_TOGGLE_MOBILE_STYLE}
      className="reading-mode-floating-toggle fixed-control-position print-hidden fixed z-floating inline-flex h-11 items-center justify-center gap-2 rounded-control border border-zinc-900 bg-zinc-900 px-3.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98] dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100"
      aria-label="进入专注阅读"
    >
      <Eye size={17} aria-hidden="true" />
      <span>专注阅读</span>
    </button>
  );
};
