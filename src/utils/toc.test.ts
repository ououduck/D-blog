import { describe, it, expect } from 'vitest';
import {
  buildHeadingTree,
  collectInitialExpandedState,
  buildParentMap,
  getAncestorIds,
  getRootBranchId,
  findTocNodeById,
  getActiveItemScrollTarget,
  type TocNode,
} from './toc';
import type { MarkdownHeading } from './headings';

const heading = (id: string, level: number, text: string): MarkdownHeading => ({ id, level, rawText: text, text });

describe('buildHeadingTree', () => {
  it('空标题列表返回空树', () => {
    expect(buildHeadingTree([])).toEqual([]);
  });

  it('同级标题平铺在根层级', () => {
    const tree = buildHeadingTree([heading('a', 2, 'A'), heading('b', 2, 'B')]);
    expect(tree.map((node) => node.id)).toEqual(['a', 'b']);
    expect(tree.every((node) => node.children.length === 0)).toBe(true);
  });

  it('子标题挂到最近的上级标题下', () => {
    const tree = buildHeadingTree([heading('h2', 2, 'H2'), heading('h3', 3, 'H3'), heading('h4', 4, 'H4')]);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('h2');
    expect(tree[0].children.map((node) => node.id)).toEqual(['h3']);
    expect(tree[0].children[0].children.map((node) => node.id)).toEqual(['h4']);
  });

  it('跳级标题（h2 后直接 h4）仍挂到 h2 下', () => {
    const tree = buildHeadingTree([heading('h2', 2, 'H2'), heading('h4', 4, 'H4')]);
    expect(tree[0].children.map((node) => node.id)).toEqual(['h4']);
  });

  it('新上级标题后，旧分支不再接收后续子标题', () => {
    const tree = buildHeadingTree([
      heading('h2a', 2, 'A'),
      heading('h3a', 3, 'A3'),
      heading('h2b', 2, 'B'),
      heading('h3b', 3, 'B3'),
    ]);
    expect(tree.map((node) => node.id)).toEqual(['h2a', 'h2b']);
    expect(tree[0].children.map((node) => node.id)).toEqual(['h3a']);
    expect(tree[1].children.map((node) => node.id)).toEqual(['h3b']);
  });

  it('index 字段按输入顺序编号', () => {
    const tree = buildHeadingTree([heading('a', 1, 'A'), heading('b', 2, 'B'), heading('c', 3, 'C')]);
    const indexes: number[] = [];
    const walk = (nodes: TocNode[]) => {
      nodes.forEach((node) => {
        indexes.push(node.index);
        walk(node.children);
      });
    };
    walk(tree);
    expect(indexes).toEqual([0, 1, 2]);
  });
});

describe('collectInitialExpandedState', () => {
  it('h1 分支默认展开，深层分支默认折叠', () => {
    const tree: TocNode[] = [
      { ...heading('h1', 1, 'H1'), index: 0, children: [{ ...heading('h2', 2, 'H2'), index: 1, children: [] }] },
    ];
    expect(collectInitialExpandedState(tree)).toEqual({ h1: true });
  });

  it('h2 根节点（文章无 h1）默认折叠', () => {
    const tree: TocNode[] = [
      { ...heading('h2', 2, 'H2'), index: 0, children: [{ ...heading('h3', 3, 'H3'), index: 1, children: [] }] },
    ];
    expect(collectInitialExpandedState(tree)).toEqual({ h2: false });
  });

  it('无子节点的标题不进入展开状态表', () => {
    const tree: TocNode[] = [{ ...heading('h1', 1, 'H1'), index: 0, children: [] }];
    expect(collectInitialExpandedState(tree)).toEqual({});
  });
});

describe('buildParentMap / getAncestorIds / getRootBranchId', () => {
  const tree: TocNode[] = [
    {
      ...heading('a', 2, 'A'),
      index: 0,
      children: [
        {
          ...heading('b', 3, 'B'),
          index: 1,
          children: [{ ...heading('c', 4, 'C'), index: 2, children: [] }],
        },
      ],
    },
  ];

  it('parentMap 记录每个节点的直接父级', () => {
    const parentMap = buildParentMap(tree);
    expect(parentMap.get('a')).toBeNull();
    expect(parentMap.get('b')).toBe('a');
    expect(parentMap.get('c')).toBe('b');
  });

  it('getAncestorIds 返回从近到远的祖先链（不含自身）', () => {
    const parentMap = buildParentMap(tree);
    expect(getAncestorIds('c', parentMap)).toEqual(['b', 'a']);
    expect(getAncestorIds('a', parentMap)).toEqual([]);
    expect(getAncestorIds(null, parentMap)).toEqual([]);
  });

  it('getRootBranchId 返回最顶层祖先（自身为根时返回自身）', () => {
    const parentMap = buildParentMap(tree);
    expect(getRootBranchId('c', parentMap)).toBe('a');
    expect(getRootBranchId('a', parentMap)).toBe('a');
    expect(getRootBranchId(null, parentMap)).toBeNull();
  });
});

describe('findTocNodeById', () => {
  const tree: TocNode[] = [
    {
      ...heading('a', 2, 'A'),
      index: 0,
      children: [{ ...heading('b', 3, 'B'), index: 1, children: [] }],
    },
  ];

  it('递归查找深层节点', () => {
    expect(findTocNodeById(tree, 'b')?.text).toBe('B');
    expect(findTocNodeById(tree, 'a')?.text).toBe('A');
  });

  it('未找到时返回 null', () => {
    expect(findTocNodeById(tree, 'missing')).toBeNull();
    expect(findTocNodeById([], 'a')).toBeNull();
  });
});

describe('getActiveItemScrollTarget', () => {
  it('激活项可完整居中时按居中计算', () => {
    const target = getActiveItemScrollTarget({
      currentScrollTop: 40,
      itemTop: 60,
      itemHeight: 32,
      navTop: 20,
      navHeight: 200,
      maxScrollTop: 500,
    });
    // 40 + (60-20) - 100 + 16 = -4 → 下限钳制为 0
    expect(target).toBe(0);
  });

  it('激活项位于面板下方时滚动到居中位置', () => {
    const target = getActiveItemScrollTarget({
      currentScrollTop: 0,
      itemTop: 300,
      itemHeight: 32,
      navTop: 20,
      navHeight: 200,
      maxScrollTop: 500,
    });
    // 0 + 280 - 100 + 16 = 196
    expect(target).toBe(196);
  });

  it('激活项高于面板时对齐顶部而非居中（避免列表顶部被推出可视区）', () => {
    // 单个 H1 承载整篇子标题时激活 li 高于面板，居中会把开头条目推离可视区。
    const target = getActiveItemScrollTarget({
      currentScrollTop: 300,
      itemTop: 100,
      itemHeight: 500,
      navTop: 20,
      navHeight: 200,
      maxScrollTop: 800,
    });
    // 300 + (100-20) = 380（对齐顶部；居中会得 300 + 80 - 100 + 250 = 530）
    expect(target).toBe(380);
  });

  it('结果限制在 [0, maxScrollTop] 内', () => {
    const overMax = getActiveItemScrollTarget({
      currentScrollTop: 800,
      itemTop: 500,
      itemHeight: 32,
      navTop: 20,
      navHeight: 200,
      maxScrollTop: 100,
    });
    expect(overMax).toBe(100);
  });
});
