/**
 * 目录树（展示组件）：移动 Sheet 与桌面胶囊共用的大纲式渲染。
 *
 * 视觉减法（相对旧版）：
 * - 无数字 badge（flat index 会制造错误的层级感）；
 * - 无逐项卡片背景/边框，仅「缩进 + 圆点 + 字重」表达层级与激活态；
 * - chevron 为视觉小、命中区大的透明按钮（h-9 负外边距），仅旋转过渡；
 * - 分支展开不做递归 height/opacity 动画（保留 Sheet/胶囊自身的进出动画），
 *   尊重 prefers-reduced-motion（无动画即无差别）。
 */

import React from 'react';
import { ChevronDown } from 'lucide-react';
import type { TocNode } from '@/utils/toc';

export interface TocTreeProps {
  nodes: TocNode[];
  depth?: number;
  expandedMap: Record<string, boolean>;
  activeHeadingId: string | null;
  activeBranchIds: Set<string>;
  activeItemRef?: React.RefObject<HTMLLIElement | null>;
  shouldForceExpand: boolean;
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
  onNavigate,
  onToggle,
}) => {
  return (
    <ol className={depth === 0 ? 'space-y-0.5' : 'space-y-0.5'}>
      {nodes.map((item) => {
        const hasChildren = item.children.length > 0;
        const isExpanded = shouldForceExpand || (expandedMap[item.id] ?? false) || activeBranchIds.has(item.id);
        const isActive = activeHeadingId === item.id;
        const isInActiveBranch = activeBranchIds.has(item.id);

        return (
          <li key={item.id} ref={isActive ? activeItemRef : undefined}>
            <div className="flex items-center" style={depth > 0 ? { paddingLeft: `${depth}rem` } : undefined}>
              <button
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pr-1 text-left transition-colors duration-150 ${
                  isActive
                    ? 'font-semibold text-ink dark:text-white'
                    : isInActiveBranch
                      ? 'text-ink/80 hover:text-ink dark:text-zinc-300 dark:hover:text-white'
                      : 'text-zinc-500 hover:text-ink dark:text-zinc-400 dark:hover:text-white'
                }`}
                aria-current={isActive ? 'location' : undefined}
                title={item.text}
              >
                {/* 激活圆点：非激活时透明占位，保持文本对齐一致 */}
                <span
                  aria-hidden="true"
                  className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-150 ${
                    isActive
                      ? 'bg-zinc-900 dark:bg-zinc-100'
                      : isInActiveBranch
                        ? 'bg-zinc-300 dark:bg-zinc-600'
                        : 'bg-transparent'
                  }`}
                />
                <span className={`truncate leading-6 ${item.level > 1 ? 'text-[12.5px]' : 'text-[13px]'}`}>
                  {item.text}
                </span>
              </button>

              {hasChildren && (
                <button
                  type="button"
                  onClick={() => onToggle(item.id)}
                  className="-m-1 flex h-9 w-9 shrink-0 items-center justify-center text-zinc-300 transition-colors duration-150 hover:text-zinc-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-900 dark:text-zinc-600 dark:hover:text-zinc-300 dark:focus-visible:outline-zinc-100"
                  aria-label={isExpanded ? '折叠子目录' : '展开子目录'}
                  aria-expanded={isExpanded}
                >
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={`transition-transform duration-150 ${isExpanded ? 'rotate-0' : '-rotate-90'}`}
                  />
                </button>
              )}
            </div>

            {hasChildren && isExpanded && (
              <div className="pb-0.5">
                <TocTree
                  nodes={item.children}
                  depth={depth + 1}
                  expandedMap={expandedMap}
                  activeHeadingId={activeHeadingId}
                  activeBranchIds={activeBranchIds}
                  shouldForceExpand={shouldForceExpand}
                  onNavigate={onNavigate}
                  onToggle={onToggle}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
};
