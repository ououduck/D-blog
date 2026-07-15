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
  initialQuery = ''
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

        console.error('Search failed:', error);
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
    hasSearchQuery: searchQuery.trim().length > 0
  };
};

