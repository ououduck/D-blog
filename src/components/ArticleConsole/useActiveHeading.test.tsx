import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useActiveHeading } from './useActiveHeading';
import type { MarkdownHeading } from '@/utils/headings';

const headings: MarkdownHeading[] = [
  { id: 'intro', level: 1, text: '介绍', rawText: '介绍' },
  { id: 'usage', level: 2, text: '使用方法', rawText: '使用方法' },
  { id: 'faq', level: 2, text: '常见问题', rawText: '常见问题' },
];

/** 各标题的文档绝对 top（px）：intro 0 / usage 5000 / faq 9000。 */
const HEADING_TOPS: Record<string, number> = { intro: 0, usage: 5000, faq: 9000 };

describe('useActiveHeading（激活判定与滚动偏移一致性）', () => {
  beforeEach(() => {
    // rect.top 是视口相对值（hook 内部会加 scrollY 换算文档绝对位置）：
    // mock 按「文档绝对 top − 当前 scrollY」返回，与真实几何一致。
    vi.spyOn(document, 'getElementById').mockImplementation(
      (id: string | null) =>
        ({
          getBoundingClientRect: () => ({ top: (HEADING_TOPS[id ?? ''] ?? 0) - window.scrollY }),
        }) as unknown as HTMLElement,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setScrollY = (value: number) => {
    Object.defineProperty(window, 'scrollY', { configurable: true, value });
  };

  it('初始激活第一个标题', () => {
    setScrollY(0);
    const { result } = renderHook(() => useActiveHeading(headings));
    expect(result.current).toBe('intro');
  });

  it('滚动跨过标题落点（offset 参考线）后激活切换', async () => {
    setScrollY(0);
    const { result, rerender } = renderHook(() => useActiveHeading(headings));

    // getHeadingScrollOffset 在 jsdom 走 fallback（104）：激活线 = scrollY + 104。
    // scrollY=4900 → 边界 5004 → usage(5000) 已越过 → 激活 usage。
    // 激活同步走 rAF：断言用 waitFor 等待一帧。
    setScrollY(4900);
    rerender();
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    await waitFor(() => expect(result.current).toBe('usage'), { timeout: 3000 });

    // 边界之下（4994 < 5000）仍停留在 usage 之前的 intro。
    setScrollY(4890);
    rerender();
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    await waitFor(() => expect(result.current).toBe('intro'));

    setScrollY(9100);
    rerender();
    act(() => {
      window.dispatchEvent(new Event('scroll'));
    });
    await waitFor(() => expect(result.current).toBe('faq'));
  });

  it('空标题返回 null', () => {
    setScrollY(0);
    const { result } = renderHook(() => useActiveHeading([]));
    expect(result.current).toBeNull();
  });
});
