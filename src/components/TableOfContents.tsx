import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, List, X } from 'lucide-react';

import { siteConfig } from '@config/site.config';
import type { MarkdownHeading } from '@/utils/headings';

const formatIndex = (value: number) => String(value).padStart(2, '0');
const MOBILE_TOC_TRIGGER_STYLE = {
  right: 'max(1rem, calc(env(safe-area-inset-right) + 1rem))',
  bottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 1rem))'
} as const;
const MOBILE_TOC_SHEET_STYLE = {
  left: 'max(0.75rem, calc(env(safe-area-inset-left) + 0.75rem))',
  right: 'max(0.75rem, calc(env(safe-area-inset-right) + 0.75rem))',
  bottom: 'max(0.75rem, calc(env(safe-area-inset-bottom) + 0.75rem))',
  top: 'max(5.75rem, calc(env(safe-area-inset-top) + 5.75rem))'
} as const;

type TocNode = MarkdownHeading & {
  index: number;
  children: TocNode[];
};

const buildHeadingTree = (headings: MarkdownHeading[]) => {
  const tree: TocNode[] = [];
  const stack: TocNode[] = [];

  headings.forEach((heading, index) => {
    const node: TocNode = {
      ...heading,
      index,
      children: []
    };

    while (stack.length > 0 && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    if (stack.length === 0) {
      tree.push(node);
    } else {
      stack[stack.length - 1].children.push(node);
    }

    stack.push(node);
  });

  return tree;
};

const collectInitialExpandedState = (nodes: TocNode[]) => {
  const nextState: Record<string, boolean> = {};

  const traverse = (items: TocNode[]) => {
    items.forEach((node) => {
      if (node.children.length > 0) {
        nextState[node.id] = node.level === 1;
        traverse(node.children);
      }
    });
  };

  traverse(nodes);

  return nextState;
};

const buildParentMap = (nodes: TocNode[]) => {
  const parentMap = new Map<string, string | null>();

  const traverse = (items: TocNode[], parentId: string | null) => {
    items.forEach((node) => {
      parentMap.set(node.id, parentId);
      traverse(node.children, node.id);
    });
  };

  traverse(nodes, null);

  return parentMap;
};

const getAncestorIds = (id: string | null, parentMap: Map<string, string | null>) => {
  const ancestorIds: string[] = [];
  let currentId = id;

  while (currentId) {
    const parentId = parentMap.get(currentId) ?? null;

    if (!parentId) {
      break;
    }

    ancestorIds.push(parentId);
    currentId = parentId;
  }

  return ancestorIds;
};

const getRootBranchId = (id: string | null, parentMap: Map<string, string | null>) => {
  if (!id) {
    return null;
  }

  let currentId: string | null = id;

  while (currentId) {
    const parentId = parentMap.get(currentId) ?? null;

    if (!parentId) {
      return currentId;
    }

    currentId = parentId;
  }

  return null;
};

export const TableOfContents: React.FC<{ headings: MarkdownHeading[] }> = ({ headings }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(headings[0]?.id ?? null);
  const headingTree = useMemo(() => buildHeadingTree(headings), [headings]);
  const parentMap = useMemo(() => buildParentMap(headingTree), [headingTree]);
  const navRef = useRef<HTMLElement | null>(null);
  const activeItemRef = useRef<HTMLLIElement | null>(null);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const collapseInactiveRootBranches = siteConfig.toc?.collapseInactiveRootBranches ?? false;

  useEffect(() => {
    setExpandedMap(collectInitialExpandedState(headingTree));
  }, [headingTree]);

  useEffect(() => {
    if (headings.length === 0) {
      setActiveHeadingId(null);
      return;
    }

    const resolveActiveHeading = () => {
      const offset = 140;
      let nextActiveId = headings[0]?.id ?? null;

      headings.forEach((heading) => {
        const element = document.getElementById(heading.id);

        if (!element) {
          return;
        }

        const top = element.getBoundingClientRect().top;

        if (top <= offset) {
          nextActiveId = heading.id;
        }
      });

      setActiveHeadingId((current) => (current === nextActiveId ? current : nextActiveId));
    };

    resolveActiveHeading();
    window.addEventListener('scroll', resolveActiveHeading, { passive: true });
    window.addEventListener('resize', resolveActiveHeading);

    return () => {
      window.removeEventListener('scroll', resolveActiveHeading);
      window.removeEventListener('resize', resolveActiveHeading);
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

      return nextState;
    });
  }, [activeAncestorIds, activeHeadingId, activeRootBranchId, collapseInactiveRootBranches, headingTree]);

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
    const element = document.getElementById(id);

    if (!element) {
      return;
    }

    const offset = 100;
    const offsetPosition = element.getBoundingClientRect().top + window.pageYOffset - offset;
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
      top: offsetPosition,
      behavior: 'smooth'
    });

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
          const isExpanded = (expandedMap[item.id] ?? false) || activeAncestorIds.includes(item.id);
          const isSubLevel = item.level > 1;
          const isActive = activeHeadingId === item.id;
          const isInActiveBranch = activeBranchIds.has(item.id);

          return (
            <li key={item.id} ref={isActive ? activeItemRef : undefined}>
              <div
                className={`rounded-2xl transition-colors duration-200 ${
                  isActive
                    ? 'bg-accent/[0.08] dark:bg-accent/[0.14]'
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
                          ? 'bg-accent text-white'
                          : isInActiveBranch
                            ? 'bg-accent/10 text-accent dark:bg-accent/15'
                            : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
                      }`}
                    >
                      {formatIndex(item.index + 1)}
                    </span>

                    <span
                      className={`block flex-1 leading-6 ${isSubLevel ? 'text-[12.5px]' : 'text-[13px]'} ${
                        isActive ? 'font-semibold' : isInActiveBranch ? 'font-medium' : ''
                      }`}
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
                          ? 'bg-accent/10 text-accent dark:bg-accent/15'
                          : 'text-zinc-400 hover:bg-zinc-200/80 hover:text-accent dark:text-zinc-500 dark:hover:bg-zinc-800'
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

  const panelContent = (
    <div className="relative flex h-full flex-col overflow-hidden rounded-[24px] border border-zinc-200/80 bg-white/95 p-4 shadow-[0_20px_56px_-36px_rgba(24,24,27,0.28)] backdrop-blur-xl dark:border-zinc-800/80 dark:bg-zinc-950/92 dark:shadow-none sm:p-4.5">
      <div className="mb-3.5 flex items-center justify-between gap-3 border-b border-zinc-200/80 pb-3 dark:border-zinc-800/80">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-accent/[0.08] text-accent dark:bg-accent/[0.12]">
            <List size={16} />
          </span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-ink dark:text-white">文章目录</h3>
            <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500">共 {headings.length} 个章节</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-ink dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white lg:hidden"
          aria-label="关闭目录"
        >
          <X size={16} />
        </button>
      </div>

      <nav ref={navRef} aria-label="目录" className="min-h-0 flex-1 overflow-y-auto pr-1 no-scrollbar">
        {renderNodes(headingTree)}
      </nav>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        style={MOBILE_TOC_TRIGGER_STYLE}
        className="fixed z-40 inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-white/95 px-3.5 py-2.5 text-sm font-medium text-ink shadow-[0_16px_38px_-24px_rgba(28,25,23,0.3)] backdrop-blur-xl transition-all duration-300 hover:scale-[1.02] hover:border-accent/20 hover:text-accent dark:border-zinc-700 dark:bg-zinc-900/94 dark:text-zinc-100 lg:hidden"
        aria-label={isOpen ? '关闭目录' : '打开目录'}
        aria-expanded={isOpen}
      >
        {isOpen ? <X size={16} /> : <List size={16} />}
        <span className="leading-none">目录</span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 bg-black/35 backdrop-blur-sm lg:hidden"
              onClick={() => setIsOpen(false)}
            />

            <motion.aside
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={MOBILE_TOC_SHEET_STYLE}
              className="fixed z-40 lg:hidden"
            >
              {panelContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <aside className="hidden w-72 lg:block xl:w-80">
        {panelContent}
      </aside>
    </>
  );
};
