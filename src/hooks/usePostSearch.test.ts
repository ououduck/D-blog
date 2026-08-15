import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePostSearch } from './usePostSearch';
import * as postsService from '@/services/posts';
import type { PostMetadata } from '@/types';

vi.mock('@/services/posts', () => ({
  searchPosts: vi.fn(),
}));

const mockSearchPosts = vi.mocked(postsService.searchPosts);

// 使用真实计时器 + 极短防抖（5ms），避免 fake timers 与渲染/异步链的交互问题。
const SHORT_DEBOUNCE = 5;
// 必须用模块级稳定引用：内联数组字面量每次渲染都是新引用，会触发
// usePostSearch 的 emptyResults effect 无限循环（setResults → 重渲染 → 新引用）。
const EMPTY_POSTS: PostMetadata[] = [];
const ONE_EMPTY_RESULT = [{ id: 'x' }] as unknown as PostMetadata[];

const flush = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

describe('usePostSearch', () => {
  beforeEach(() => {
    mockSearchPosts.mockReset();
  });

  it('空查询返回 emptyResults 且不触发搜索', () => {
    const { result } = renderHook(() => usePostSearch({ emptyResults: ONE_EMPTY_RESULT }));
    expect(result.current.results).toEqual([{ id: 'x' }]);
    expect(result.current.hasSearchQuery).toBe(false);
    expect(mockSearchPosts).not.toHaveBeenCalled();
  });

  it('输入后防抖才发起搜索', async () => {
    mockSearchPosts.mockResolvedValue([]);
    const { result } = renderHook(() => usePostSearch({ debounceMs: SHORT_DEBOUNCE }));

    act(() => {
      result.current.handleSearch('react');
    });
    expect(mockSearchPosts).not.toHaveBeenCalled();
    await flush();
    expect(mockSearchPosts).toHaveBeenCalledWith('react', { scope: 'all' });
  });

  it('连续输入只触发最后一次搜索（防抖合并）', async () => {
    mockSearchPosts.mockResolvedValue([]);
    const { result } = renderHook(() => usePostSearch({ debounceMs: 50 }));

    act(() => {
      result.current.handleSearch('r');
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      result.current.handleSearch('re');
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      result.current.handleSearch('rea');
    });
    // 最终等待必须超过防抖窗口（50ms），搜索才会真正发出
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 80));
    });

    expect(mockSearchPosts).toHaveBeenCalledTimes(1);
    expect(mockSearchPosts).toHaveBeenCalledWith('rea', { scope: 'all' });
  });

  it('旧查询的迟到响应被丢弃（竞态保护）', async () => {
    let resolveFirst: ((value: never[]) => void) | undefined;
    mockSearchPosts.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        }),
    );
    mockSearchPosts.mockResolvedValueOnce([]);

    const { result } = renderHook(() => usePostSearch({ debounceMs: SHORT_DEBOUNCE }));

    act(() => {
      result.current.handleSearch('old');
    });
    await flush();
    act(() => {
      result.current.handleSearch('new');
    });
    await flush();
    // 旧查询迟到返回
    await act(async () => {
      resolveFirst!([{ id: 'stale' } as never]);
    });

    expect(result.current.results).toEqual([]);
    expect(mockSearchPosts).toHaveBeenCalledTimes(2);
  });

  it('搜索失败设置错误信息', async () => {
    mockSearchPosts.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => usePostSearch({ debounceMs: SHORT_DEBOUNCE }));

    act(() => {
      result.current.handleSearch('react');
    });
    await flush();
    await waitFor(() => {
      expect(result.current.searchError).toBe('搜索暂时不可用，请稍后重试。');
    });
    expect(result.current.isSearching).toBe(false);
  });

  it('clearSearch 清空查询与结果', async () => {
    mockSearchPosts.mockResolvedValue([{ id: 'post-1' } as never]);
    const { result } = renderHook(() => usePostSearch({ debounceMs: SHORT_DEBOUNCE, emptyResults: EMPTY_POSTS }));

    act(() => {
      result.current.handleSearch('react');
    });
    await flush();
    expect(result.current.results).toHaveLength(1);

    act(() => {
      result.current.clearSearch();
    });
    expect(result.current.searchQuery).toBe('');
    expect(result.current.hasSearchQuery).toBe(false);
    expect(result.current.results).toEqual([]);
  });
});
