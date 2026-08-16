/**
 * 离线收藏 hook：列表/收藏状态/切换收藏/刷新，自动订阅跨页变更。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getOfflinePost,
  getOfflinePosts,
  removeOfflinePost,
  saveOfflinePost,
  subscribeOfflinePosts,
  type OfflinePost,
  type OfflinePostInput,
} from '@/services/offlinePosts';

interface UseOfflinePostsResult {
  posts: OfflinePost[];
  /** 正在从本地存储读取当前文章/列表时的加载态。 */
  loading: boolean;
  /** 收藏/取消收藏操作进行中。 */
  isSaving: boolean;
  error: string | null;
  isSaved: boolean;
  /** 切换收藏；resolve 值为是否成功（失败时不抛出，错误通过 error 状态反馈）。 */
  toggleSaved: () => Promise<boolean>;
  refresh: () => Promise<void>;
}

const getErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message ? error.message : fallback;

export const useOfflinePosts = (post?: OfflinePostInput | null): UseOfflinePostsResult => {
  const postId = post?.id;
  const postRef = useRef(post);
  const [posts, setPosts] = useState<OfflinePost[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const requestIdRef = useRef(0);
  const toggleInFlightRef = useRef(false);
  // 卸载守卫：IndexedDB 读写耗时可能跨过组件卸载（路由切换），
  // 卸载后不再 setState（React 19 下为空操作，防御性卫生）。
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    postRef.current = post;
  }, [post]);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    if (!mountedRef.current) return;
    setLoading(true);

    try {
      const [savedPosts, savedPost] = await Promise.all([
        getOfflinePosts(),
        postId ? getOfflinePost(postId) : Promise.resolve(undefined),
      ]);
      if (requestId !== requestIdRef.current || !mountedRef.current) {
        return;
      }
      setPosts(savedPosts);
      setIsSaved(Boolean(savedPost));
      setError(null);
    } catch (loadError) {
      if (requestId !== requestIdRef.current || !mountedRef.current) {
        return;
      }
      setError(getErrorMessage(loadError, '离线收藏加载失败，请稍后重试。'));
    } finally {
      if (requestId === requestIdRef.current && mountedRef.current) {
        setLoading(false);
      }
    }
  }, [postId]);

  useEffect(() => {
    void refresh();
    return subscribeOfflinePosts(() => {
      void refresh();
    });
  }, [refresh]);

  const toggleSaved = useCallback(async (): Promise<boolean> => {
    const currentPost = postRef.current;
    if (!currentPost || !currentPost.id || toggleInFlightRef.current) {
      return false;
    }

    toggleInFlightRef.current = true;
    setIsSaving(true);
    setError(null);
    try {
      if (isSaved) {
        await removeOfflinePost(currentPost.id);
      } else {
        await saveOfflinePost(currentPost);
      }
      await refresh();
      return true;
    } catch (toggleError) {
      // 失败信息通过 error 状态反馈给 UI；返回 false 供调用点区分成败，
      // 不向上抛出，避免调用点（Post.tsx 的 void toggleSaved()）产生未处理的
      // Promise rejection。
      setError(getErrorMessage(toggleError, '离线收藏操作失败，请稍后重试。'));
      return false;
    } finally {
      toggleInFlightRef.current = false;
      setIsSaving(false);
    }
  }, [isSaved, refresh]);

  return { posts, loading, isSaving, error, isSaved, toggleSaved, refresh };
};
