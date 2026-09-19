/**
 * 文章目录：移动端底部 sheet（受控模式由 ArticleToolbar 驱动）+ 独立桌面 popover。
 *
 * 轻量化（任务约束的减法）：
 * - Sheet 内不再有进度条/百分比/章节统计/回到顶部（由 ArticleToolbar 与其
 *   「更多」面板提供，避免重复）；
 * - 搜索按需显示：标题数 ≤ SHOW_TOC_SEARCH_THRESHOLD 时隐藏入口；打开搜索
 *   才渲染输入框并聚焦（用户主动搜索才弹键盘）；
 * - 打开 Sheet 默认聚焦容器本身（tabIndex=-1），不会自动弹出手机键盘。
 *
 * 激活标题（useActiveHeading）、展开状态
 * （useTocExpansion）与胶囊导航共享同一实现。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { List, Search, X } from 'lucide-react';
import { SearchField } from '@/components/SearchField';
import { useReducedMotion } from '@/hooks/useReducedMotion';

import { useModalOverlay } from '@/hooks/useModalOverlay';
import { siteConfig } from '@config/site.config';
import type { MarkdownHeading } from '@/utils/headings';
import { replaceUrlHash, scrollToHeadingElement } from '@/utils/headingScroll';
import { useActiveHeading } from '@/components/ArticleConsole/useActiveHeading';
import { useTocExpansion } from '@/components/ArticleConsole/useTocExpansion';
import { TocTree } from '@/components/ArticleConsole/TocTree';
import {
  buildHeadingTree,
  buildParentMap,
  getActiveItemScrollTarget,
  getAncestorIds,
  getRootBranchId,
  type TocNode,
} from '@/utils/toc';

/** 目录条目超过该数量才显示搜索入口（避免短目录浪费空间）。 */
export const SHOW_TOC_SEARCH_THRESHOLD = 10;

const MOBILE_TOC_TRIGGER_STYLE = {
  bottom:
    'calc(var(--tab-bar-height, 0px) + max(calc(var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + env(safe-area-inset-bottom, 0px) + 8.5rem), calc(var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + 8.5rem)))',
} as const;
const DESKTOP_TOC_TRIGGER_STYLE = {
  bottom: 'calc(var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + 9rem)',
} as const;
const DESKTOP_TOC_POPOVER_STYLE = {
  right: '1.5rem',
  bottom: 'calc(var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + 12.5rem)',
} as const;
const MOBILE_TOC_SHEET_STYLE = {
  left: 'env(safe-area-inset-left, 0px)',
  right: 'env(safe-area-inset-right, 0px)',
  bottom:
    'calc(var(--cookie-notice-height, 0px) + var(--service-worker-prompt-height, 0px) + env(safe-area-inset-bottom, 0px))',
} as const;
const MOBILE_SCROLL_STYLE = {
  WebkitOverflowScrolling: 'touch' as const,
};

export const TableOfContents: React.FC<{
  headings: MarkdownHeading[];
  mobileShowTrigger?: boolean;
  desktopShowTrigger?: boolean;
  /** 受控模式：提供时组件开关完全由外部驱动（文章页移动端工具栏接管）。 */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}> = ({ headings, mobileShowTrigger = true, desktopShowTrigger = true, isOpen: isOpenProp, onOpenChange }) => {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isControlled = isOpenProp !== undefined;
  const isOpen = isControlled ? isOpenProp : internalIsOpen;
  const setIsOpen = useCallback(
    (next: boolean | ((current: boolean) => boolean)) => {
      const resolved = typeof next === 'function' ? next(isControlled ? Boolean(isOpenProp) : internalIsOpen) : next;
      if (!isControlled) {
        setInternalIsOpen(resolved);
      }
      onOpenChange?.(resolved);
    },
    [internalIsOpen, isControlled, isOpenProp, onOpenChange],
  );

  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const touchStartYRef = useRef<number | null>(null);
  // 触摸拖动的 rAF 合并帧：touchmove 频率可高于帧率，同帧内多次移动合并为
  // 一次 setDragOffsetY，避免整棵目录树随每次 touchmove 逐帧重渲染。
  const sheetDragFrameRef = useRef(0);
  // 帧挂起期间的最新位移：touchmove 每次都更新，帧回调与 touchend 读取它，
  // 避免「帧未执行时后续位移丢失」导致 touchend 的关闭判定使用过期值。
  const latestDragOffsetRef = useRef(0);
  const mobileSheetRef = useRef<HTMLElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const headingTree = useMemo(() => buildHeadingTree(headings), [headings]);
  const parentMap = useMemo(() => buildParentMap(headingTree), [headingTree]);
  const navRef = useRef<HTMLElement | null>(null);
  const desktopPopoverRef = useRef<HTMLElement | null>(null);
  const desktopTriggerRef = useRef<HTMLButtonElement | null>(null);
  const activeItemRef = useRef<HTMLLIElement | null>(null);
  const collapseInactiveRootBranches = siteConfig.toc?.collapseInactiveRootBranches ?? false;
  const isMobileDialogOpen = isOpen && isMobileViewport;
  const closeTableOfContents = useCallback(() => setIsOpen(false), [setIsOpen]);
  // 搜索过滤时强制展开整棵过滤后的树（过滤结果本就精简，无需折叠状态）。
  const shouldForceExpandFilteredTree = searchQuery.trim().length > 0;

  useModalOverlay({
    isOpen: isMobileDialogOpen,
    onClose: closeTableOfContents,
    // 初始聚焦 Sheet 容器（tabIndex=-1）：不会自动弹出手机键盘；用户主动
    // 打开搜索时才聚焦输入框。
    initialFocusRef: mobileSheetRef,
    containerRef: mobileSheetRef,
  });

  // setIsOpen 经 ref 引用：viewport 同步 effect 只需挂载时执行一次，
  // 否则 setIsOpen 引用随 internalIsOpen 变化会导致 effect 重跑、
  // 把刚打开的桌面面板立即关闭（回归防护见 TableOfContents.test）。
  const setIsOpenRef = useRef(setIsOpen);
  setIsOpenRef.current = setIsOpen;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const syncViewport = () => {
      setIsClient(true);
      setIsMobileViewport(mediaQuery.matches);

      if (!mediaQuery.matches) {
        setIsOpenRef.current(false);
      }
    };

    syncViewport();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewport);
      return () => mediaQuery.removeEventListener('change', syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setDragOffsetY(0);
      setSearchQuery('');
      setIsSearchOpen(false);
      touchStartYRef.current = null;
      // 清理挂起的拖拽 rAF 帧（关闭后不应再有位移写入）。
      if (sheetDragFrameRef.current) {
        window.cancelAnimationFrame(sheetDragFrameRef.current);
        sheetDragFrameRef.current = 0;
      }
      latestDragOffsetRef.current = 0;
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || isMobileViewport) {
      return;
    }

    const handleDesktopPopoverInteraction = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!desktopPopoverRef.current?.contains(target) && !desktopTriggerRef.current?.contains(target)) {
        setIsOpen(false);
      }
    };
    const handleDesktopPopoverKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        // 关闭后归还焦点到触发按钮：弹层内的焦点元素随卸载消失，不归还则
        // 焦点掉到 body，键盘用户按 Escape 后失去 Tab 起点（与移动端 sheet
        // 走 useModalOverlay 关闭后还原焦点的行为保持一致）。
        desktopTriggerRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleDesktopPopoverInteraction);
    window.addEventListener('keydown', handleDesktopPopoverKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleDesktopPopoverInteraction);
      window.removeEventListener('keydown', handleDesktopPopoverKeyDown);
    };
  }, [isMobileViewport, isOpen, setIsOpen]);

  // 当前章节：与胶囊导航/跳转共享同一实现与偏移源。
  const activeHeadingId = useActiveHeading(headings);

  const activeAncestorIds = useMemo(() => getAncestorIds(activeHeadingId, parentMap), [activeHeadingId, parentMap]);
  const activeBranchIds = useMemo(
    () => new Set(activeHeadingId ? [activeHeadingId, ...activeAncestorIds] : activeAncestorIds),
    [activeAncestorIds, activeHeadingId],
  );
  const activeRootBranchId = useMemo(() => getRootBranchId(activeHeadingId, parentMap), [activeHeadingId, parentMap]);

  const { expandedMap, toggleNode, expandBranchForNavigation } = useTocExpansion({
    headingTree,
    activeHeadingId,
    activeRootBranchId,
    activeAncestorIds,
    collapseInactiveRootBranches,
    autoExpandActiveNode: !isMobileViewport,
  });

  useEffect(() => {
    const navElement = navRef.current;
    const activeElement = activeItemRef.current;

    if (!navElement || !activeElement) {
      return;
    }

    const navRect = navElement.getBoundingClientRect();
    const itemRect = activeElement.getBoundingClientRect();
    const maxScrollTop = Math.max(0, navElement.scrollHeight - navElement.clientHeight);

    navElement.scrollTo({
      top: getActiveItemScrollTarget({
        currentScrollTop: navElement.scrollTop,
        itemTop: itemRect.top,
        itemHeight: itemRect.height,
        navTop: navRect.top,
        navHeight: navRect.height,
        maxScrollTop,
      }),
      behavior: shouldReduceMotion ? 'auto' : 'smooth',
    });
  }, [activeHeadingId, expandedMap, isOpen, shouldReduceMotion]);

  const scrollToHeading = useCallback(
    (id: string) => {
      const branchAncestorIds = getAncestorIds(id, parentMap);
      const branchRootId = getRootBranchId(id, parentMap);
      expandBranchForNavigation(branchRootId, branchAncestorIds);

      scrollToHeadingElement(id, shouldReduceMotion ? 'auto' : 'smooth');
      replaceUrlHash(id);

      setIsOpen(false);
    },
    [expandBranchForNavigation, parentMap, setIsOpen, shouldReduceMotion],
  );

  // 触摸下滑关闭：仅绑定在顶部抓手区域（nav 列表之外），无需判断触摸起点。
  const handleSheetTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    touchStartYRef.current = event.touches[0]?.clientY ?? null;
    latestDragOffsetRef.current = 0;
  };

  const handleSheetTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    const startY = touchStartYRef.current;

    if (startY === null) {
      return;
    }

    const currentY = event.touches[0]?.clientY ?? startY;
    latestDragOffsetRef.current = Math.max(0, currentY - startY);
    if (sheetDragFrameRef.current) {
      return;
    }
    sheetDragFrameRef.current = window.requestAnimationFrame(() => {
      sheetDragFrameRef.current = 0;
      setDragOffsetY((current) => (current === latestDragOffsetRef.current ? current : latestDragOffsetRef.current));
    });
  };

  const handleSheetTouchEnd = () => {
    if (sheetDragFrameRef.current) {
      window.cancelAnimationFrame(sheetDragFrameRef.current);
      sheetDragFrameRef.current = 0;
    }
    // 用最新位移（而非可能滞后的 state）判定是否下滑关闭。
    if (latestDragOffsetRef.current > 96) {
      setIsOpen(false);
    }

    setDragOffsetY(0);
    latestDragOffsetRef.current = 0;
    touchStartYRef.current = null;
  };

  const filteredHeadingTree = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) {
      return headingTree;
    }

    const filterNodes = (nodes: TocNode[]): TocNode[] => {
      return nodes.reduce<TocNode[]>((result, node) => {
        const filteredChildren = filterNodes(node.children);
        const matchesKeyword = node.text.toLowerCase().includes(keyword);

        if (matchesKeyword || filteredChildren.length > 0) {
          result.push({
            ...node,
            children: filteredChildren,
          });
        }

        return result;
      }, []);
    };

    return filterNodes(headingTree);
  }, [headingTree, searchQuery]);

  // 搜索入口按需显示：长目录才提供，短目录不占空间。
  const showSearchToggle = headings.length > SHOW_TOC_SEARCH_THRESHOLD;

  const toggleSearch = useCallback(() => {
    setIsSearchOpen((open) => {
      if (open) {
        setSearchQuery('');
      }
      return !open;
    });
  }, []);

  // 用户主动打开搜索后聚焦输入框（effect 而非 autoFocus，键盘只在此时弹出）。
  useEffect(() => {
    if (isSearchOpen) {
      searchInputRef.current?.focus();
    }
  }, [isSearchOpen]);

  const panelContent = (
    <div className="relative flex h-full flex-col overflow-hidden rounded-overlay border border-zinc-300 bg-paper shadow-none dark:border-zinc-700 dark:bg-void sm:p-[1.125rem]">
      <div
        className="mb-3 flex justify-center pt-3 lg:hidden"
        onTouchStart={handleSheetTouchStart}
        onTouchMove={handleSheetTouchMove}
        onTouchEnd={handleSheetTouchEnd}
        onTouchCancel={handleSheetTouchEnd}
      >
        <span className="h-1.5 w-14 rounded-full bg-zinc-300 dark:bg-zinc-700" />
      </div>

      <div className="mb-2 flex items-center justify-between gap-2 px-4 pb-2 pt-1 sm:px-5">
        <h3
          id={isMobileDialogOpen ? 'mobile-toc-title' : undefined}
          className="text-sm font-semibold text-zinc-900 dark:text-zinc-100"
        >
          文章目录
        </h3>

        <div className="flex shrink-0 items-center gap-1">
          {showSearchToggle && (
            <button
              type="button"
              onClick={toggleSearch}
              className="inline-flex h-11 w-11 items-center justify-center rounded-icon text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.98] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label={isSearchOpen ? '关闭搜索' : '搜索目录标题'}
              aria-expanded={isSearchOpen}
            >
              {isSearchOpen ? <X size={16} /> : <Search size={16} />}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="inline-flex h-11 w-11 items-center justify-center rounded-icon text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 active:scale-[0.98] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-300 lg:hidden"
            aria-label="关闭目录"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {isSearchOpen && (
        <div className="mb-2 px-4 sm:px-5">
          <SearchField
            ref={searchInputRef}
            value={searchQuery}
            onValueChange={setSearchQuery}
            onClear={() => setSearchQuery('')}
            placeholder="搜索目录标题"
            className="border-zinc-200 bg-zinc-50 focus:bg-white dark:border-zinc-800 dark:bg-zinc-800 dark:focus:bg-zinc-950"
            aria-label="搜索目录标题"
          />
        </div>
      )}

      <nav
        ref={navRef}
        aria-label="目录"
        style={MOBILE_SCROLL_STYLE}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 no-scrollbar sm:px-5"
      >
        {filteredHeadingTree.length > 0 ? (
          <TocTree
            nodes={filteredHeadingTree}
            expandedMap={expandedMap}
            activeHeadingId={activeHeadingId}
            activeBranchIds={activeBranchIds}
            activeItemRef={activeItemRef}
            shouldForceExpand={shouldForceExpandFilteredTree}
            onNavigate={scrollToHeading}
            onToggle={toggleNode}
          />
        ) : (
          <div className="flex h-full min-h-[9rem] items-center justify-center border border-dashed border-zinc-200 bg-zinc-50 px-4 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-500">
            没有找到匹配的目录标题
          </div>
        )}
      </nav>
    </div>
  );

  // AnimatePresence 始终挂载（条件在内部），关闭时子元素被移除但退出动画能正常播放。
  const mobileSheet =
    isClient && isMobileViewport
      ? createPortal(
          <AnimatePresence>
            {isOpen ? (
              <>
                <motion.div
                  key="mobile-toc-backdrop"
                  initial={shouldReduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
                  className="fixed inset-0 z-popover bg-black/40 lg:hidden"
                  onClick={() => setIsOpen(false)}
                />

                <motion.aside
                  key="mobile-toc-sheet"
                  ref={mobileSheetRef}
                  tabIndex={-1}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="mobile-toc-title"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 28 }}
                  animate={{ opacity: 1, y: shouldReduceMotion ? 0 : dragOffsetY }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: 28 }}
                  transition={
                    shouldReduceMotion || dragOffsetY > 0 ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }
                  }
                  style={{
                    ...MOBILE_TOC_SHEET_STYLE,
                    touchAction: 'pan-y',
                  }}
                  className="fixed z-nav-panel h-[min(72vh,38rem)] supports-[height:100dvh]:h-[min(72dvh,38rem)] lg:hidden"
                >
                  {panelContent}
                </motion.aside>
              </>
            ) : null}
          </AnimatePresence>,
          document.body,
        )
      : null;

  const mobileTrigger =
    isClient && isMobileViewport && mobileShowTrigger
      ? createPortal(
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            style={MOBILE_TOC_TRIGGER_STYLE}
            className="toc-mobile-trigger fixed-control-position fixed z-floating inline-flex h-11 items-center justify-center gap-2 rounded-control border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 lg:hidden"
            aria-label={isOpen ? '关闭目录' : '打开目录'}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={16} /> : <List size={16} />}
            <span className="leading-none">目录</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              {headings.length}
            </span>
          </button>,
          document.body,
        )
      : null;

  const desktopPopover =
    isClient && !isMobileViewport && desktopShowTrigger
      ? createPortal(
          <AnimatePresence>
            {isOpen ? (
              <motion.aside
                ref={desktopPopoverRef}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: 8 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
                style={DESKTOP_TOC_POPOVER_STYLE}
                className="fixed z-popover hidden h-[min(26rem,60vh)] w-[min(22rem,calc(100vw-3rem))] md:block"
              >
                {panelContent}
              </motion.aside>
            ) : null}
          </AnimatePresence>,
          document.body,
        )
      : null;

  const desktopTrigger =
    isClient && !isMobileViewport && desktopShowTrigger
      ? createPortal(
          <button
            ref={desktopTriggerRef}
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            style={DESKTOP_TOC_TRIGGER_STYLE}
            className="toc-desktop-trigger fixed-control-position fixed z-floating hidden h-11 items-center justify-center gap-2 rounded-control border border-zinc-200 bg-white px-3.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 active:scale-[0.98] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800 md:inline-flex"
            aria-label={isOpen ? '关闭目录' : '打开目录'}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={16} /> : <List size={16} />}
            <span className="leading-none">目录</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              {headings.length}
            </span>
          </button>,
          document.body,
        )
      : null;

  if (headings.length === 0) {
    return null;
  }

  return (
    <>
      {mobileTrigger}
      {desktopTrigger}

      {mobileSheet}
      {desktopPopover}
    </>
  );
};
