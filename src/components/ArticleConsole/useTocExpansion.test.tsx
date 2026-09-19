import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTocExpansion } from './useTocExpansion';
import type { MarkdownHeading } from '@/utils/headings';
import { buildHeadingTree } from '@/utils/toc';

const heading = (id: string, level: number, text: string): MarkdownHeading => ({ id, level, text, rawText: text });

/** 结构：01 intro / 02 rendering(SSR, Hydration) / 03 fiber / 04 perf（后两者无子节点） */
const makeTree = () =>
  buildHeadingTree([
    heading('intro', 1, '介绍'),
    heading('rendering', 1, '渲染'),
    heading('ssr', 2, 'SSR'),
    heading('hydration', 2, 'Hydration'),
    heading('fiber', 1, 'Fiber'),
    heading('perf', 1, '性能'),
  ]);

const setup = (collapseInactive = true) => {
  const headingTree = makeTree();
  return renderHook(
    (props: { activeId: string | null; ancestors?: string[] }) => {
      const isRenderingChild = props.activeId === 'ssr' || props.activeId === 'hydration';
      return useTocExpansion({
        headingTree,
        activeHeadingId: props.activeId,
        activeRootBranchId: isRenderingChild ? 'rendering' : props.activeId,
        activeAncestorIds: isRenderingChild ? ['rendering'] : (props.ancestors ?? []),
        collapseInactiveRootBranches: collapseInactive,
        autoExpandActiveNode: false,
      });
    },
    { initialProps: { activeId: 'intro' as string | null } },
  );
};

describe('useTocExpansion（TOC 展开状态共享逻辑）', () => {
  it('active 变化：未触碰的根分支收拢到 active 分支（collapseInactiveRootBranches）', () => {
    const { result, rerender } = setup();

    rerender({ activeId: 'ssr' });
    // rendering 是 active 根分支 → 展开；其余「有子节点且未触碰」的根分支收拢
    expect(result.current.expandedMap['rendering']).toBe(true);
  });

  it('用户手动展开的分支：滚动导致 active 变化后不被强制收起', () => {
    const { result, rerender } = setup();

    // active 在 fiber；用户手动展开 rendering（自动逻辑原本会把它收拢）
    rerender({ activeId: 'fiber' });
    act(() => {
      result.current.toggleNode('rendering');
    });
    expect(result.current.expandedMap['rendering']).toBe(true);

    // 滚动到 perf（active 变化）：rendering 是用户展开过的 → 保持打开
    rerender({ activeId: 'perf' });
    expect(result.current.expandedMap['rendering']).toBe(true);
  });

  it('用户手动折叠非 active 分支：保持折叠；成为 active 祖先时可见性优先', () => {
    const { result, rerender } = setup();

    // active 在 ssr：rendering 自动展开
    rerender({ activeId: 'ssr' });
    expect(result.current.expandedMap['rendering']).toBe(true);

    // 用户手动折叠 rendering
    act(() => {
      result.current.toggleNode('rendering');
    });
    expect(result.current.expandedMap['rendering']).toBe(false);

    // active 移到 perf：rendering 非激活分支且被用户折叠过 → 保持折叠
    rerender({ activeId: 'perf' });
    expect(result.current.expandedMap['rendering']).toBe(false);

    // active 回到 ssr（rendering 是祖先）：「active 分支可见」规则优先 → 展开
    rerender({ activeId: 'ssr' });
    expect(result.current.expandedMap['rendering']).toBe(true);
  });

  it('expandBranchForNavigation：收拢未触碰根分支到目标根（导航意图，不写入 userTouched）', () => {
    const { result, rerender } = setup();

    act(() => {
      result.current.expandBranchForNavigation('perf', []);
    });
    // perf 无子节点 → 不进 expandedMap；验证「其他未触碰根」被收拢的副作用
    expect(result.current.expandedMap['perf']).toBeFalsy();

    // 之后 active 变化仍正常收拢/展开（导航展开不算用户操作）
    rerender({ activeId: 'ssr' });
    expect(result.current.expandedMap['rendering']).toBe(true);
  });

  it('collapseInactiveRootBranches=false：active 祖先展开，已展开分支保持原状', () => {
    const headingTree = makeTree();
    const { result, rerender } = renderHook(
      (props: { activeId: string | null; ancestors?: string[] }) =>
        useTocExpansion({
          headingTree,
          activeHeadingId: props.activeId,
          activeRootBranchId: props.activeId === 'ssr' ? 'rendering' : props.activeId,
          activeAncestorIds: props.activeId === 'ssr' ? ['rendering'] : (props.ancestors ?? []),
          collapseInactiveRootBranches: false,
        }),
      { initialProps: { activeId: 'intro' as string | null } },
    );

    act(() => {
      result.current.expandBranchForNavigation('perf', []);
    });
    rerender({ activeId: 'ssr' });
    // 非收拢模式：rendering 因 active 展开；其他分支无「强制收拢」行为
    expect(result.current.expandedMap['rendering']).toBe(true);
  });
});
