/**
 * 目录树（展示组件）：从 TableOfContents 抽出的递归树渲染，
 * 供移动端目录 Sheet、桌面 TOC popover 与胶囊导航展开面板共用同一渲染与交互。
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import type { TocNode } from '@/utils/toc';

const formatIndex = (value: number) => String(value).padStart(2, '0');

export interface TocTreeProps {
  nodes: TocNode[];
  depth?: number;
  expandedMap: Record<string, boolean>;
  activeHeadingId: string | null;
  activeBranchIds: Set<string>;
  activeItemRef?: React.RefObject<HTMLLIElement | null>;
  shouldForceExpand: boolean;
  shouldReduceMotion: boolean;
  onNavigate: (id: string) => void;
  onToggle: (id: string) => void;
}

export const TocTree: React.FC<TocTreeProps> = ({
  nodes,
  depth = 0,
  expandedMap,
  activeHeadingId,
  activeBranchIds,
  activeItemRef,
  shouldForceExpand,
  shouldReduceMotion,
  onNavigate,
  onToggle,
}) => {
  return (
    <ol
      className={
        depth === 0 ? 'space-y-1.5' : 'mt-1.5 space-y-1.5 border-l border-zinc-200/80 pl-3.5 dark:border-zinc-800'
      }
    >
      {nodes.map((item) => {
        const hasChildren = item.children.length > 0;
        const isExpanded = shouldForceExpand || (expandedMap[item.id] ?? false) || activeBranchIds.has(item.id);
        const isSubLevel = item.level > 1;
        const isActive = activeHeadingId === item.id;
        const isInActiveBranch = activeBranchIds.has(item.id);

        return (
          <li key={item.id} ref={isActive ? activeItemRef : undefined}>
            <div
              className={`rounded-control transition-colors duration-200 ${
                isActive
                  ? 'bg-zinc-100 dark:bg-zinc-800'
                  : isInActiveBranch
                    ? 'bg-zinc-50 dark:bg-zinc-900'
                    : 'bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900'
              }`}
            >
              <div className="flex items-start gap-1.5 px-2.5 py-2">
                <button
                  type="button"
                  onClick={() => onNavigate(item.id)}
                  className={`flex min-w-0 flex-1 items-start gap-2.5 px-1 py-1 text-left transition-colors duration-200 ${
                    isActive
                      ? 'text-ink dark:text-white'
                      : isInActiveBranch
                        ? 'text-ink/85 dark:text-zinc-100'
                        : 'text-zinc-500 hover:text-ink dark:text-zinc-400 dark:hover:text-white'
                  }`}
                  aria-current={isActive ? 'location' : undefined}
                >
                  <span
                    className={`mt-[0.15rem] inline-flex min-w-[1.9rem] justify-center border border-current/20 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.14em] transition-colors ${
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
                    className={`block flex-1 leading-6 line-clamp-2 md:line-clamp-none md:truncate ${isSubLevel ? 'text-[12.5px]' : 'text-[13px]'}`}
                    title={item.text}
                  >
                    {item.text}
                  </span>
                </button>

                {hasChildren && (
                  <button
                    type="button"
                    onClick={() => onToggle(item.id)}
                    className={`inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-icon transition-colors duration-200 active:scale-[0.98] ${
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
                    initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.16, ease: 'easeOut' }}
                    className="overflow-hidden px-2.5 pb-2"
                  >
                    <TocTree
                      nodes={item.children}
                      depth={depth + 1}
                      expandedMap={expandedMap}
                      activeHeadingId={activeHeadingId}
                      activeBranchIds={activeBranchIds}
                      shouldForceExpand={shouldForceExpand}
                      shouldReduceMotion={shouldReduceMotion}
                      onNavigate={onNavigate}
                      onToggle={onToggle}
                    />
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
