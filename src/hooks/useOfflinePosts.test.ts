import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOfflinePosts } from './useOfflinePosts';
import * as offlinePostsService from '@/services/offlinePosts';

vi.mock('@/services/offlinePosts', () => ({
  getOfflinePosts: vi.fn(),
  getOfflinePost: vi.fn(),
  saveOfflinePost: vi.fn(),
  removeOfflinePost: vi.fn(),
  subscribeOfflinePosts: vi.fn(() => () => {}),
}));

const mocked = vi.mocked(offlinePostsService);

const makePost = (id: string) =>
  ({ id, title: id, excerpt: '', date: '2026-01-01', category: '技术', filePath: `/posts/${id}.md`, readTime: '1分钟', tags: [], savedAt: 1, schema: 'd-blog-offline-post', version: 1 }) as const;

describe('useOfflinePosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.getOfflinePosts.mockResolvedValue([]);
    mocked.getOfflinePost.mockResolvedValue(undefined);
    mocked.subscribeOfflinePosts.mockImplementation(() => () => {});
  });

  it('加载列表与当前文章收藏状态', async () => {
    mocked.getOfflinePosts.mockResolvedValue([makePost('a')]);
    mocked.getOfflinePost.mockResolvedValue(makePost('a') as never);
    const { result } = renderHook(() => useOfflinePosts(makePost('a')));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.posts).toHaveLength(1);
    expect(result.current.isSaved).toBe(true);
  });

  it('toggleSaved 未收藏时调用 saveOfflinePost 并刷新', async () => {
    mocked.saveOfflinePost.mockResolvedValue(makePost('a') as never);
    const { result } = renderHook(() => useOfflinePosts(makePost('a')));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let saved = false;
    await act(async () => {
      saved = await result.current.toggleSaved();
    });
    expect(mocked.saveOfflinePost).toHaveBeenCalled();
    expect(saved).toBe(true);
    expect(result.current.isSaving).toBe(false);
  });

  it('toggleSaved 失败时返回 false 并通过 error 反馈（不抛出）', async () => {
    mocked.saveOfflinePost.mockRejectedValue(new Error('quota'));
    const { result } = renderHook(() => useOfflinePosts(makePost('a')));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let saved = true;
    await act(async () => {
      saved = await result.current.toggleSaved();
    });
    expect(saved).toBe(false);
    expect(result.current.error).toContain('quota');
    expect(result.current.isSaving).toBe(false);
  });

  it('卸载后迟到的 refresh 结果不再 setState（mountedRef 守卫）', async () => {
    let resolvePosts!: (value: never[]) => void;
    mocked.getOfflinePosts.mockReturnValue(new Promise((resolve) => (resolvePosts = resolve)));

    const { result, unmount } = renderHook(() => useOfflinePosts());
    // 等待首次加载挂起后卸载。
    await act(async () => {});
    unmount();
    // 卸载后 resolve：mountedRef 守卫应跳过 setState（不抛错、不更新）。
    await act(async () => {
      resolvePosts([]);
    });
    expect(result.current.loading).toBe(true); // 卸载后 loading 未被置 false
  });
});
