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
      <ol className={depth === 0 ? 'space-y-2' : 'mt-2 space-y-2 border-l border-zinc-200/70 pl-4 dark:border-zinc-800'}>
        {nodes.map((item) => {
          const hasChildren = item.children.length > 0;
          const isExpanded = (expandedMap[item.id] ?? false) || activeAncestorIds.includes(item.id);
          const isSubLevel = item.level > 1;
          const isActive = activeHeadingId === item.id;
          const isInActiveBranch = activeBranchIds.has(item.id);

          return (
            <li key={item.id} ref={isActive ? activeItemRef : undefined}>
              <div
                className={`group relative overflow-hidden rounded-[1.1rem] border transition-all duration-300 ${
                  isActive
                    ? 'border-accent/25 bg-accent/[0.08] shadow-[0_18px_40px_-30px_rgba(249,115,22,0.6)] dark:border-accent/25 dark:bg-accent/[0.14]'
                    : isInActiveBranch
                      ? 'border-zinc-200/80 bg-white/80 dark:border-zinc-700 dark:bg-zinc-800/70'
                      : `border-transparent hover:border-zinc-200/80 hover:bg-white/80 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/70 ${depth > 0 ? 'bg-zinc-50/55 dark:bg-zinc-900/35' : ''}`
                }`}
              >
                <div className="flex items-start gap-2 px-3.5 py-3">
                  <button
                    type="button"
                    onClick={() => scrollToHeading(item.id)}
                    className={`flex min-w-0 flex-1 items-start gap-3 text-left transition-colors duration-300 ${
                      isActive
                        ? 'text-ink dark:text-white'
                        : isInActiveBranch
                          ? 'text-ink/85 dark:text-zinc-100'
                          : 'text-zinc-500 hover:text-ink dark:text-zinc-400 dark:hover:text-white'
                    }`}
                    aria-current={isActive ? 'location' : undefined}
                  >
                    <span
                      className={`mt-1 inline-flex min-w-[2.2rem] justify-center rounded-full px-2 py-1 font-mono text-[10px] font-semibold tracking-[0.18em] transition-colors ${
                        isActive
                          ? 'bg-accent text-white'
                          : isInActiveBranch
                            ? 'bg-accent/10 text-accent dark:bg-accent/15'
                            : 'bg-zinc-100 text-zinc-400 group-hover:bg-accent/8 group-hover:text-accent dark:bg-zinc-800 dark:text-zinc-500'
                      }`}
                    >
                      {formatIndex(item.index + 1)}
                    </span>

                    <span
                      className={`block flex-1 leading-6 ${isSubLevel ? 'text-[13px]' : 'text-[13.5px]'} ${
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
                      className={`mt-0.5 inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border transition-all duration-300 ${
                        isInActiveBranch
                          ? 'border-accent/20 bg-accent/[0.08] text-accent dark:border-accent/20 dark:bg-accent/[0.14]'
                          : 'border-zinc-200/80 bg-white/90 text-zinc-400 hover:border-accent/20 hover:text-accent dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500'
                      }`}
                      aria-label={isExpanded ? '折叠子目录' : '展开子目录'}
                      aria-expanded={isExpanded}
                    >
                      <ChevronDown
                        size={15}
                        className={`transition-transform duration-300 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
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
                      transition={{ duration: 0.22, ease: 'easeOut' }}
                      className="overflow-hidden px-3.5 pb-3"
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
    <div className="relative overflow-hidden rounded-[30px] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(246,244,241,0.94))] p-5 shadow-[0_24px_64px_-36px_rgba(24,24,27,0.26)] dark:border-zinc-800/80 dark:bg-[linear-gradient(180deg,rgba(24,24,27,0.94),rgba(12,12,14,0.9))] dark:shadow-none">
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
      <div className="pointer-events-none absolute right-[-3.5rem] top-[-3.5rem] h-28 w-28 rounded-full bg-accent/8 blur-3xl dark:bg-accent/12" />

      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-[1.15rem] border border-accent/10 bg-accent/[0.06] text-accent dark:border-accent/15 dark:bg-accent/[0.08]">
            <List size={18} />
          </span>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-zinc-400 dark:text-zinc-500">
              ARTICLE GUIDE
            </p>
            <h3 className="mt-1 font-serif text-[1.32rem] font-semibold text-ink dark:text-white">目录</h3>
          </div>
        </div>

        <div className="rounded-full border border-zinc-200/80 bg-white/90 px-3 py-1 font-mono text-xs text-zinc-400 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
          {formatIndex(headings.length)}
        </div>
      </div>

      <nav ref={navRef} aria-label="目录" className="max-h-[calc(100vh-10rem)] overflow-y-auto pr-1 no-scrollbar">
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
        className="fixed z-40 flex h-12 w-12 items-center justify-center rounded-full border border-accent/15 bg-white/94 text-ink shadow-[0_18px_44px_rgba(28,25,23,0.16)] backdrop-blur-xl transition-all duration-300 hover:scale-105 hover:border-accent/30 hover:text-accent dark:border-zinc-700 dark:bg-zinc-900/94 dark:text-zinc-100 lg:hidden"
        aria-label={isOpen ? '关闭目录' : '打开目录'}
      >
        {isOpen ? <X size={18} /> : <List size={18} />}
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
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fixed inset-y-4 right-4 z-40 w-[min(19rem,calc(100vw-1.5rem))] lg:hidden"
            >
              {panelContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <aside className="hidden w-72 lg:block">
        {panelContent}
      </aside>
    </>
  );
};
