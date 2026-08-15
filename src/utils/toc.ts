/**
 * 目录树纯函数：从扁平标题构建树、祖先/根分支查询与初始展开状态计算，供 TableOfContents 消费。
 */

import type { MarkdownHeading } from './headings';

export type TocNode = MarkdownHeading & {
  index: number;
  children: TocNode[];
};

/** 从扁平标题列表构建目录树（按层级嵌套）。 */
export const buildHeadingTree = (headings: MarkdownHeading[]) => {
  const tree: TocNode[] = [];
  const stack: TocNode[] = [];

  headings.forEach((heading, index) => {
    const node: TocNode = {
      ...heading,
      index,
      children: [],
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
/** 计算目录初始展开状态（含子节点的父节点展开）。 */

export const collectInitialExpandedState = (nodes: TocNode[]) => {
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
  /** 构建子节点 id → 父节点 的映射。 */
};

export const buildParentMap = (nodes: TocNode[]) => {
  const parentMap = new Map<string, string | null>();

  const traverse = (items: TocNode[], parentId: string | null) => {
    items.forEach((node) => {
      parentMap.set(node.id, parentId);
      traverse(node.children, node.id);
    });
  };

  traverse(nodes, null);

  /** 获取节点到根的全部祖先 id。 */
  return parentMap;
};

export const getAncestorIds = (id: string | null, parentMap: Map<string, string | null>) => {
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
  /** 获取节点所属根分支（顶层节点）的 id。 */

  return ancestorIds;
};

export const getRootBranchId = (id: string | null, parentMap: Map<string, string | null>) => {
  if (!id) {
    return null;
  }

  let currentId: string | null = id;

  while (currentId) {
    const parentId: string | null = parentMap.get(currentId) ?? null;

    if (!parentId) {
      return currentId;
    }

    currentId = parentId;
    /** 按 id 在目录树中查找节点。 */
  }

  return null;
};

export const findTocNodeById = (nodes: TocNode[], id: string): TocNode | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }

    const found = findTocNodeById(node.children, id);
    if (found) {
      return found;
    }
  }

  return null;
};
