import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { ChevronDown, List, Search, X, ArrowUp } from 'lucide-react';


import { siteConfig } from '@config/site.config';
import type { MarkdownHeading } from '@/utils/headings';
import {
  buildHeadingTree,
  buildParentMap,
  collectInitialExpandedState,
  findTocNodeById,
  getAncestorIds,
  getRootBranchId,
  type TocNode
} from '@/utils/toc';

const formatIndex = (value: number) => String(value).padStart(2, '0');
const MOBILE_TOC_TRIGGER_STYLE = {
  right: 'max(1rem, calc(env(safe-area-inset-right) + 1rem))',
  bottom: 'max(8.5rem, calc(env(safe-area-inset-bottom) + 8.5rem))'
} as const;
const DESKTOP_TOC_TRIGGER_STYLE = {
  right: '1.5rem',
  bottom: '11rem'
} as const;
const DESKTOP_TOC_POPOVER_STYLE = {
  right: '1.5rem',
  bottom: '15.75rem'
} as const;
const MOBILE_TOC_SHEET_STYLE = {
  left: 'max(0.6rem, calc(env(safe-area-inset-left) + 0.6rem))',
  right: 'max(0.6rem, calc(env(safe-area-inset-right) + 0.6rem))',
  bottom: 'max(0.45rem, env(safe-area-inset-bottom))'
} as const;
const MOBILE_SCROLL_STYLE = {
  WebkitOverflowScrolling: 'touch' as const
};
const HEADING_SCROLL_OFFSET = 104;

const getHeadingTop = (element: HTMLElement) => element.getBoundingClientRect().top + window.scrollY;

const getHeadingById = (id: string) => document.getElementById(id) as HTMLElement | null;

const getHeadingScrollTop = (element: HTMLElement) => Math.max(0, getHeadingTop(element) - HEADING_SCROLL_OFFSET);





export const TableOfContents: React.FC<{
  headings: MarkdownHeading[];
  mobileShowTrigger?: boolean;
  desktopShowTrigger?: boolean;
}> = ({
  headings,
  mobileShowTrigger = true,
  desktopShowTrigger = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(headings[0]?.id ?? null);
  const [isClient, setIsClient] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const touchStartYRef = useRef<number | null>(null);
  const headingTree = useMemo(() => buildHeadingTree(headings), [headings]);
  const parentMap = useMemo(() => buildParentMap(headingTree), [headingTree]);
  const navRef = useRef<HTMLElement | null>(null);
  const activeItemRef = useRef<HTMLLIElement | null>(null);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const collapseInactiveRootBranches = siteConfig.toc?.collapseInactiveRootBranches ?? false;


  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia('(max-width: 1023px)');
    const syncViewport = () => {
      const nextIsMobile = mediaQuery.matches;
      setIsClient(true);
      setIsMobileViewport(nextIsMobile);

      if (!nextIsMobile) {
        setIsOpen(false);
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
    if (typeof document === 'undefined') {
      return;
    }

    if (!(isOpen && isMobileViewport)) {
      document.body.style.removeProperty('overflow');
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, isMobileViewport]);

  useEffect(() => {
    if (!isOpen) {
      setDragOffsetY(0);
      setSearchQuery('');
      touchStartYRef.current = null;
    }
  }, [isOpen]);

  useEffect(() => {
    setExpandedMap(collectInitialExpandedState(headingTree));
  }, [headingTree]);

  useEffect(() => {
    if (headings.length === 0 || typeof window === 'undefined') {
      setActiveHeadingId(null);
      return;
    }

    let animationFrameId: number | null = null;

    const syncActiveHeading = () => {
      animationFrameId = null;
      const visibleBoundary = window.scrollY + HEADING_SCROLL_OFFSET + 1;
      let nextActiveId = headings[0]?.id ?? null;

      for (const heading of headings) {
        const element = getHeadingById(heading.id);

        if (!element) {
          continue;
        }

        if (getHeadingTop(element) <= visibleBoundary) {
          nextActiveId = heading.id;
        } else {
          break;
        }
      }

      setActiveHeadingId((currentId) => (currentId === nextActiveId ? currentId : nextActiveId));
    };

    const requestSyncActiveHeading = () => {
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(syncActiveHeading);
    };

    setActiveHeadingId(headings[0]?.id ?? null);
    requestSyncActiveHeading();

    window.addEventListener('scroll', requestSyncActiveHeading, { passive: true });
    window.addEventListener('resize', requestSyncActiveHeading);
    window.addEventListener('hashchange', requestSyncActiveHeading);

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      window.removeEventListener('scroll', requestSyncActiveHeading);
      window.removeEventListener('resize', requestSyncActiveHeading);
      window.removeEventListener('hashchange', requestSyncActiveHeading);
    };
  }, [headings]);

  const activeAncestorIds = useMemo(
    () => getAncestorIds(activeHeadingId, parentMap),
    [activeHeadingId, parentMap]
  );
  const activeBranchIds = useMemo(
    () => new Set(activeHeadingId ? [activeHeadingId, ...activeAncestorIds] : activeAncestorIds),
    [activeAncestorIds, activeHeadingId]
  );
  const activeRootBranchId = useMemo(
    () => getRootBranchId(activeHeadingId, parentMap),
    [activeHeadingId, parentMap]
  );

  useEffect(() => {
    if (!activeHeadingId) {
      return;
    }

    setExpandedMap((current) => {
      const nextState = { ...current };

      if (collapseInactiveRootBranches) {
        headingTree.forEach((node) => {
          if (node.children.length > 0) {
            nextState[node.id] = node.id === activeRootBranchId;
          }
        });
      }

      activeAncestorIds.forEach((ancestorId) => {
        nextState[ancestorId] = true;
      });

      // 大屏端自动展开当前激活节点（如果有子节点）
      if (!isMobileViewport) {
        const activeNode = findTocNodeById(headingTree, activeHeadingId);
        if (activeNode && activeNode.children.length > 0) {
          nextState[activeHeadingId] = true;
        }
      }

      return nextState;
    });
  }, [activeAncestorIds, activeHeadingId, activeRootBranchId, collapseInactiveRootBranches, headingTree, isMobileViewport]);

  useEffect(() => {
    const navElement = navRef.current;
    const activeElement = activeItemRef.current;

    if (!navElement || !activeElement) {
      return;
    }

    const navRect = navElement.getBoundingClientRect();
    const itemRect = activeElement.getBoundingClientRect();
    const currentScrollTop = navElement.scrollTop;
    const targetScrollTop = currentScrollTop + (itemRect.top - navRect.top) - navRect.height / 2 + itemRect.height / 2;

    navElement.scrollTo({
      top: Math.max(0, targetScrollTop),
      behavior: 'smooth'
    });
  }, [activeHeadingId, expandedMap, isOpen]);

  const scrollToHeading = (id: string) => {
    const element = getHeadingById(id);

    if (!element) {
      return;
    }

    const branchAncestorIds = getAncestorIds(id, parentMap);
    const branchRootId = getRootBranchId(id, parentMap);

    setExpandedMap((current) => {
      const nextState = { ...current };

      if (collapseInactiveRootBranches) {
        headingTree.forEach((node) => {
          if (node.children.length > 0) {
            nextState[node.id] = node.id === branchRootId;
          }
        });
      }

      branchAncestorIds.forEach((ancestorId) => {
        nextState[ancestorId] = true;
      });

      return nextState;
    });
    setActiveHeadingId(id);

    window.scrollTo({
      top: getHeadingScrollTop(element),
      behavior: 'smooth'
    });

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.hash = id;
      window.history.replaceState({}, '', url.toString());
    }

    setIsOpen(false);
  };

  const toggleNode = (id: string) => {
    setExpandedMap((current) => ({
      ...current,
      [id]: !(current[id] ?? false)
    }));
  };

  if (headings.length === 0) {
    return null;
  }

  const renderNodes = (nodes: TocNode[], depth = 0) => {
    return (
      <ol className={depth === 0 ? 'space-y-1.5' : 'mt-1.5 space-y-1.5 border-l border-zinc-200/80 pl-3.5 dark:border-zinc-800'}>
        {nodes.map((item) => {
          const hasChildren = item.children.length > 0;
          const isExpanded = shouldForceExpandFilteredTree || (expandedMap[item.id] ?? false) || activeAncestorIds.includes(item.id);
          const isSubLevel = item.level > 1;
          const isActive = activeHeadingId === item.id;
          const isInActiveBranch = activeBranchIds.has(item.id);

          return (
            <li key={item.id} ref={isActive ? activeItemRef : undefined}>
              <div
                className={`rounded-2xl transition-all duration-200 ${
                  isActive
                    ? 'bg-zinc-100 dark:bg-zinc-800 scale-[0.98]'
                    : isInActiveBranch
                      ? 'bg-zinc-100/80 dark:bg-zinc-900/70'
                      : 'bg-transparent hover:bg-zinc-100/70 dark:hover:bg-zinc-900/60'
                }`}
              >
                <div className="flex items-start gap-1.5 px-2.5 py-2">
                  <button
                    type="button"
                    onClick={() => scrollToHeading(item.id)}
                    className={`flex min-w-0 flex-1 items-start gap-2.5 rounded-xl px-1 py-1 text-left transition-colors duration-200 ${
                      isActive
                        ? 'text-ink dark:text-white'
                        : isInActiveBranch
                          ? 'text-ink/85 dark:text-zinc-100'
                          : 'text-zinc-500 hover:text-ink dark:text-zinc-400 dark:hover:text-white'
                    }`}
                    aria-current={isActive ? 'location' : undefined}
                  >
                    <span
                      className={`mt-[0.15rem] inline-flex min-w-[1.9rem] justify-center rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.14em] transition-colors ${
                        isActive
                          ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                          : isInActiveBranch
                            ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                            : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
                      }`}
                    >
                      {formatIndex(item.index + 1)}
                    </span>

                    <span
                      className={`block flex-1 truncate leading-6 ${isSubLevel ? 'text-[12.5px]' : 'text-[13px]'} ${
                        isActive ? 'font-semibold' : isInActiveBranch ? 'font-medium' : ''
                      }`}
                      title={item.text}
                    >
                      {item.text}
                    </span>
                  </button>

                  {hasChildren && (
                    <button
                      type="button"
                      onClick={() => toggleNode(item.id)}
                      className={`mt-0.5 inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full transition-all duration-200 ${
                        isInActiveBranch
                          ? 'bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300'
                          : 'text-zinc-400 hover:bg-zinc-200/80 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300'
                      }`}
                      aria-label={isExpanded ? '折叠子目录' : '展开子目录'}
                      aria-expanded={isExpanded}
                    >
                      <ChevronDown
                        size={14}
                        className={`transition-transform duration-200 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                      />
                    </button>
                  )}
                </div>

                <AnimatePresence initial={false}>
                  {hasChildren && isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.18, ease: 'easeOut' }}
                      className="overflow-hidden px-2.5 pb-2"
                    >
                      {renderNodes(item.children, depth + 1)}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </li>
          );
        })}
      </ol>
    );
  };


  const handleSheetTouchStart = (event: React.TouchEvent<HTMLElement>) => {
    if (navRef.current?.contains(event.target as Node)) {
      touchStartYRef.current = null;
      return;
    }

    touchStartYRef.current = event.touches[0]?.clientY ?? null;
  };

  const handleSheetTouchMove = (event: React.TouchEvent<HTMLElement>) => {
    const startY = touchStartYRef.current;

    if (startY === null) {
      return;
    }

    const currentY = event.touches[0]?.clientY ?? startY;
    const nextOffset = Math.max(0, currentY - startY);
    setDragOffsetY(nextOffset);
  };

  const handleSheetTouchEnd = () => {
    if (dragOffsetY > 96) {
      setIsOpen(false);
    }

    setDragOffsetY(0);
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
            children: filteredChildren
          });
        }

        return result;
      }, []);
    };

    return filterNodes(headingTree);
  }, [headingTree, searchQuery]);
  const rootHeadingsCount = headingTree.length;
  const visibleHeadingsCount = filteredHeadingTree.reduce((count, node) => {
    const countNodes = (items: TocNode[]): number => items.reduce((total, current) => total + 1 + countNodes(current.children), 0);
    return count + countNodes([node]);
  }, 0);
  const shouldForceExpandFilteredTree = searchQuery.trim().length > 0;
  const currentHeadingIndex = headings.findIndex((h) => h.id === activeHeadingId);
  const readingProgressDisplay = headings.length > 0 ? Math.round(((currentHeadingIndex + 1) / headings.length) * 100) : 0;

  const panelContent = (
    <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:p-4.5">
      <div
        className="mb-3 flex justify-center lg:hidden"
        onTouchStart={handleSheetTouchStart}
        onTouchMove={handleSheetTouchMove}
        onTouchEnd={handleSheetTouchEnd}
        onTouchCancel={handleSheetTouchEnd}
      >
        <span className="h-1.5 w-14 rounded-full bg-zinc-300 dark:bg-zinc-700" />
      </div>

      <div className="mb-3.5 space-y-3 border-b border-zinc-200 pb-3 dark:border-zinc-800">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <List size={17} />
            </span>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">文章目录</h3>
              <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">
                {rootHeadingsCount} 个主章节 · 共 {headings.length} 节
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsOpen(false)}
            className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-zinc-300 lg:hidden"
            aria-label="关闭目录"
          >
            <X size={16} />
          </button>
        </div>

        {/* Reading progress bar */}
        <div className="flex items-center gap-2.5">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-200/80 dark:bg-zinc-800">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-zinc-500 to-zinc-900 dark:from-zinc-400 dark:to-zinc-100"
              animate={{ width: `${readingProgressDisplay}%` }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            />
          </div>
          <span className="min-w-[2.2rem] text-right text-[11px] font-semibold tabular-nums text-zinc-500 dark:text-zinc-400">
            {readingProgressDisplay}%
          </span>
        </div>
      </div>

      <div className="mb-3.5">
        <label className="relative block">
          <span className="pointer-events-none absolute inset-y-0 left-3 inline-flex items-center text-zinc-400 dark:text-zinc-500">
            <Search size={15} />
          </span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜索目录标题"
            className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-4 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 focus:bg-white dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-100 dark:focus:bg-zinc-950"
            aria-label="搜索目录标题"
          />
        </label>
        {searchQuery.trim() ? (
          <p className="mt-2 px-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            匹配到 {visibleHeadingsCount} 个目录项
          </p>
        ) : null}
      </div>

      <nav
        ref={navRef}
        aria-label="目录"
        style={MOBILE_SCROLL_STYLE}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1 pb-1 no-scrollbar"
      >
        {filteredHeadingTree.length > 0 ? renderNodes(filteredHeadingTree) : (
          <div className="flex h-full min-h-[9rem] items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 text-center text-sm text-zinc-400 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-500">
            没有找到匹配的目录标题
          </div>
        )}
      </nav>

      {/* Back to top button */}
      <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            if (isMobileViewport) setIsOpen(false);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl py-2 text-[12px] font-medium text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          aria-label="回到顶部"
        >
          <ArrowUp size={14} />
          回到顶部
        </button>
      </div>
    </div>
  );

  const mobileSheet =
    isClient && isOpen && isMobileViewport
      ? createPortal(
          <AnimatePresence>
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-sm lg:hidden"
                onClick={() => setIsOpen(false)}
              />

              <motion.aside
                initial={{ opacity: 0, y: 28, scale: 0.98 }}
                animate={{ opacity: 1, y: dragOffsetY, scale: 1 }}
                exit={{ opacity: 0, y: 28, scale: 0.98 }}
                transition={{ duration: dragOffsetY > 0 ? 0 : 0.24, ease: 'easeOut' }}
                style={{
                  ...MOBILE_TOC_SHEET_STYLE,
                  touchAction: 'pan-y'
                }}
                className="fixed z-[80] h-[min(72vh,38rem)] lg:hidden"
              >
                {panelContent}
              </motion.aside>
            </>
          </AnimatePresence>,
          document.body
        )
      : null;

  const mobileTrigger =
    isClient && isMobileViewport && mobileShowTrigger
      ? createPortal(
          <button
            type="button"
            onClick={() => setIsOpen((value) => !value)}
            style={MOBILE_TOC_TRIGGER_STYLE}
            className="fixed z-[60] inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 lg:hidden"
            aria-label={isOpen ? '关闭目录' : '打开目录'}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={16} /> : <List size={16} />}
            <span className="leading-none">目录</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              {headings.length}
            </span>
          </button>,
          document.body
        )
      : null;

  const desktopPopover =
    isClient && !isMobileViewport && desktopShowTrigger
      ? createPortal(
          <AnimatePresence>
            {isOpen ? (
              <motion.aside
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.98 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                style={DESKTOP_TOC_POPOVER_STYLE}
                className="fixed z-[70] hidden h-[min(26rem,60vh)] w-[min(22rem,calc(100vw-3rem))] md:block"
              >
                {panelContent}
              </motion.aside>
            ) : null}
          </AnimatePresence>,
          document.body
        )
      : null;

  const desktopTrigger =
    isClient && !isMobileViewport && desktopShowTrigger
      ? createPortal(
          <button
            type="button"
            onClick={() => setIsOpen((value) => !value)}
            style={DESKTOP_TOC_TRIGGER_STYLE}
            className="fixed z-[60] hidden items-center gap-2 rounded-full border border-zinc-200 bg-white/96 px-4 py-2.5 text-sm font-medium text-zinc-900 shadow-lg backdrop-blur-xl transition-all duration-300 hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900/94 dark:text-zinc-100 dark:hover:border-zinc-600 md:inline-flex"
            aria-label={isOpen ? '关闭目录' : '打开目录'}
            aria-expanded={isOpen}
          >
            {isOpen ? <X size={16} /> : <List size={16} />}
            <span className="leading-none">目录</span>
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-zinc-500 dark:bg-zinc-800 dark:text-zinc-300">
              {headings.length}
            </span>
          </button>,
          document.body
        )
      : null;

  return (
    <>
      {mobileTrigger}
      {desktopTrigger}

      {mobileSheet}
      {desktopPopover}
    </>
  );
};

