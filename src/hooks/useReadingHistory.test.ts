import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useReadingHistory } from './useReadingHistory';
import * as readingHistoryService from '@/services/readingHistory';

const makeEntry = (postId: string, progress: number, updatedAt: number): readingHistoryService.ReadingHistoryEntry => ({
  postId,
  progress,
  updatedAt,
});

describe('useReadingHistory', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('初始读取全部历史（service 已按最近更新倒序）', async () => {
    // getReadingHistory 在 service 层排序，mock 返回已排序结果。
    vi.spyOn(readingHistoryService, 'getReadingHistory').mockReturnValue([
      makeEntry('new', 0.5, 300),
      makeEntry('old', 0.3, 100),
    ]);
    const { result } = renderHook(() => useReadingHistory());
    await waitFor(() => expect(result.current.entries.length).toBe(2));
    expect(result.current.entries[0].postId).toBe('new');
    expect(result.current.latest?.postId).toBe('new');
  });

  it('订阅变更：外部 save 后列表刷新', async () => {
    let entries = [makeEntry('a', 0.2, 100)];
    vi.spyOn(readingHistoryService, 'getReadingHistory').mockImplementation(() => entries);
    const { result } = renderHook(() => useReadingHistory());
    await waitFor(() => expect(result.current.entries.length).toBe(1));

    // 触发订阅回调（saveReadingHistory 内部会 dispatch 事件）。
    entries = [makeEntry('b', 0.1, 200), ...entries];
    act(() => {
      readingHistoryService.saveReadingHistory({ postId: 'b', progress: 0.1, updatedAt: 200 });
    });
    await waitFor(() => expect(result.current.entries[0].postId).toBe('b'));
  });

  it('卸载时退订（再次触发事件不再刷新）', async () => {
    let entries = [makeEntry('a', 0.2, 100)];
    vi.spyOn(readingHistoryService, 'getReadingHistory').mockImplementation(() => entries);
    const { result, unmount } = renderHook(() => useReadingHistory());
    await waitFor(() => expect(result.current.entries.length).toBe(1));

    unmount();
    // 用新数组替换：若未退订，事件会触发 refresh 读取新数组；
    // 已退订则保持旧引用不变。
    entries = [makeEntry('c', 0.4, 300), ...entries];
    act(() => {
      readingHistoryService.saveReadingHistory({ postId: 'c', progress: 0.4, updatedAt: 300 });
    });
    expect(result.current.entries.length).toBe(1);
  });
});
