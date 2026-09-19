/**
 * TOC 展开状态共享 hook（移动 Sheet 与桌面胶囊共用，单一实现）：
 *
 * 设计要点（任务约束）：
 * - active heading 变化时「只保证 active 分支可见」：展开祖先链，配合
 *   collapseInactiveRootBranches 收拢「用户未手动操作过」的根分支；
 * - 用户通过 chevron 手动展开/折叠过的节点（userTouched）永不被自动逻辑
 *   强制改写——滚动不会重置用户刚刚手动展开的内容；
 * - 仅在状态真正变化时 setState，滚动期间零额外渲染；
 * - 点击目录项导航 = 自动展开目标分支（属导航意图，不计入 userTouched）。
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { collectInitialExpandedState, findTocNodeById, type TocNode } from '@/utils/toc';

export interface UseTocExpansionOptions {
  headingTree: TocNode[];
  activeHeadingId: string | null;
  activeRootBranchId: string | null;
  activeAncestorIds: string[];
  collapseInactiveRootBranches: boolean;
  /** 是否自动展开激活节点本身（桌面端开启；移动端仅展开祖先链）。 */
  autoExpandActiveNode?: boolean;
}

export const useTocExpansion = ({
  headingTree,
  activeHeadingId,
  activeRootBranchId,
  activeAncestorIds,
  collapseInactiveRootBranches,
  autoExpandActiveNode = false,
}: UseTocExpansionOptions) => {
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  // 用户手动操作过的节点 id：自动收拢不得改写这些节点的展开状态。
  const userTouchedRef = useRef<Set<string>>(new Set());
  // 祖先链经 ref 读取：效果只在「active heading 真正变化」时执行一次，
  // 否则用户刚折叠/展开的分支会立刻被普通重渲染触发的 effect 覆盖。
  const activeAncestorIdsRef = useRef(activeAncestorIds);
  activeAncestorIdsRef.current = activeAncestorIds;

  // 目录内容变化（切换文章）：重置为初始展开态并清空用户操作记录。
  useEffect(() => {
    userTouchedRef.current = new Set();
    setExpandedMap(collectInitialExpandedState(headingTree));
  }, [headingTree]);

  // active heading 变化：只保证 active 分支可见，不重生成整棵展开状态。
  useEffect(() => {
    setExpandedMap((current) => {
      const next = { ...current };
      let changed = false;
      const ensureExpanded = (id: string) => {
        if (!next[id]) {
          next[id] = true;
          changed = true;
        }
      };

      if (collapseInactiveRootBranches) {
        for (const node of headingTree) {
          if (node.children.length > 0 && !userTouchedRef.current.has(node.id)) {
            const target = node.id === activeRootBranchId;
            if (Boolean(next[node.id]) !== target) {
              next[node.id] = target;
              changed = true;
            }
          }
        }
      }

      activeAncestorIdsRef.current.forEach(ensureExpanded);

      if (autoExpandActiveNode && activeHeadingId) {
        const activeNode = findTocNodeById(headingTree, activeHeadingId);
        if (activeNode && activeNode.children.length > 0) {
          ensureExpanded(activeHeadingId);
        }
      }

      return changed ? next : current;
    });
    // 仅依赖 activeHeadingId（及其派生 root）：祖先链经 ref 读取最新值。
  }, [activeHeadingId, activeRootBranchId, autoExpandActiveNode, collapseInactiveRootBranches, headingTree]);

  /** 用户手动切换（chevron）：记录 userTouched，自动逻辑此后不再改写该节点。
      注意 touched 标记在 updater 外执行（updater 必须保持纯函数）。 */
  const toggleNode = useCallback((id: string) => {
    userTouchedRef.current.add(id);
    setExpandedMap((current) => ({ ...current, [id]: !(current[id] ?? false) }));
  }, []);

  /**
   * 点击目录项导航时的分支展开：收拢未受用户操作影响的根分支到目标根、
   * 展开目标祖先链与目标根（不写入 userTouched，保持导航=自动语义）。
   */
  const expandBranchForNavigation = useCallback(
    (branchRootId: string | null, ancestorIds: string[]) => {
      setExpandedMap((current) => {
        const next = { ...current };

        if (collapseInactiveRootBranches) {
          for (const node of headingTree) {
            if (node.children.length > 0 && !userTouchedRef.current.has(node.id)) {
              next[node.id] = node.id === branchRootId;
            }
          }
        }

        ancestorIds.forEach((id) => {
          next[id] = true;
        });
        // 仅对有子节点的目标根写入展开标记（无子节点的根没有「展开」语义）。
        if (branchRootId && findTocNodeById(headingTree, branchRootId)?.children.length) {
          next[branchRootId] = true;
        }

        return next;
      });
    },
    [collapseInactiveRootBranches, headingTree],
  );

  return { expandedMap, toggleNode, expandBranchForNavigation };
};
