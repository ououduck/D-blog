import { useCallback, useEffect, useRef, useState } from 'react';
import {
  getOfflinePost,
  getOfflinePosts,
  removeOfflinePost,
  saveOfflinePost,
  subscribeOfflinePosts,
  type OfflinePost,
  type OfflinePostInput
} from '@/services/offlinePosts';

interface UseOfflinePostsResult {
  posts: OfflinePost[];
  /** 正在从本地存储读取当前文章/列表时的加载态。 */
  loading: boolean;
  /** 收藏/取消收藏操作进行中。 */
  isSaving: boolean;
  error: string | null;
  isSaved: boolean;
  toggleSaved: () => Promise<void>;
  refresh: () => Promise<void>;
}

const getErrorMessage = (error: unknown, fallback: string) => (
  error instanceof Error && error.message ? error.message : fallback
);

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

  useEffect(() => {
    postRef.current = post;
  }, [post]);

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);

    try {
      const [savedPosts, savedPost] = await Promise.all([
        getOfflinePosts(),
        postId ? getOfflinePost(postId) : Promise.resolve(undefined)
      ]);
      if (requestId !== requestIdRef.current) {
        return;
      }
      setPosts(savedPosts);
      setIsSaved(Boolean(savedPost));
      setError(null);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      setError(getErrorMessage(loadError, '离线收藏加载失败，请稍后重试。'));
    } finally {
      if (requestId === requestIdRef.current) {
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

  const toggleSaved = useCallback(async () => {
    const currentPost = postRef.current;
    if (!currentPost || !currentPost.id || toggleInFlightRef.current) {
      return;
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
    } catch (toggleError) {
      setError(getErrorMessage(toggleError, '离线收藏操作失败，请稍后重试。'));
      throw toggleError;
    } finally {
      toggleInFlightRef.current = false;
      setIsSaving(false);
    }
  }, [isSaved, refresh]);

  return { posts, loading, isSaving, error, isSaved, toggleSaved, refresh };
};
