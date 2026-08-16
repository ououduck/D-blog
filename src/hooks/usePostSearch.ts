/**
 * 站内搜索 hook：对输入做 300ms 防抖后调用 searchPosts，自动处理竞态
 * （requestId 比对，旧查询的迟到结果被丢弃）；emptyResults 作为空查询时
 * 的兜底列表（首页/归档/标签页传入全量文章，实现"无查询显示全部"）。
 *
 * 注意：emptyResults 必须传稳定引用（组件 state / useMemo 结果）。若每次
 * 渲染内联新建数组（如 emptyResults={posts} 而非 state），空查询 effect 会
 * 因引用变化反复 setResults，形成渲染循环。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { searchPosts, type PostSearchResult, type PostSearchScope } from '@/services/posts';
import type { PostMetadata } from '@/types';

interface UsePostSearchOptions {
  emptyResults?: PostMetadata[];
  debounceMs?: number;
  scope?: PostSearchScope;
  initialQuery?: string;
}

const DEFAULT_EMPTY_RESULTS: PostMetadata[] = [];

export const usePostSearch = ({
  emptyResults = DEFAULT_EMPTY_RESULTS,
  debounceMs = 300,
  scope = 'all',
  initialQuery = '',
}: UsePostSearchOptions = {}) => {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [results, setResults] = useState<PostSearchResult[]>(emptyResults);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRequestIdRef = useRef(0);
  const emptyResultsRef = useRef<PostSearchResult[]>(emptyResults);

  useEffect(() => {
    emptyResultsRef.current = emptyResults;
  }, [emptyResults]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults(emptyResults);
      setIsSearching(false);
      setSearchError(null);
    }
  }, [emptyResults, searchQuery]);

  useEffect(() => {
    const currentQuery = searchQuery.trim();
    const requestId = ++searchRequestIdRef.current;

    if (!currentQuery) {
      setResults(emptyResultsRef.current);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    const timeoutId = window.setTimeout(async () => {
      try {
        const searchedPosts = await searchPosts(currentQuery, { scope });

        if (requestId !== searchRequestIdRef.current) {
          return;
        }

        setResults(searchedPosts);
        setSearchError(null);
      } catch (error) {
        if (requestId !== searchRequestIdRef.current) {
          return;
        }

        console.error('搜索失败:', error);
        setResults([]);
        setSearchError('搜索暂时不可用，请稍后重试。');
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [debounceMs, scope, searchQuery]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const clearSearch = useCallback(() => {
    searchRequestIdRef.current += 1;
    setSearchQuery('');
    setResults(emptyResultsRef.current);
    setIsSearching(false);
    setSearchError(null);
  }, []);

  return {
    searchQuery,
    isSearching,
    searchError,
    results,
    handleSearch,
    setSearchQuery: handleSearch,
    clearSearch,
    hasSearchQuery: searchQuery.trim().length > 0,
  };
};
