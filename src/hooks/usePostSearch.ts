import { useCallback, useEffect, useRef, useState } from 'react';
import { searchPosts } from '@/services/posts';
import type { PostMetadata } from '@/types';

interface UsePostSearchOptions {
  emptyResults?: PostMetadata[];
  debounceMs?: number;
}

const DEFAULT_EMPTY_RESULTS: PostMetadata[] = [];

export const usePostSearch = ({
  emptyResults = DEFAULT_EMPTY_RESULTS,
  debounceMs = 300
}: UsePostSearchOptions = {}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<PostMetadata[]>(emptyResults);
  const [isSearching, setIsSearching] = useState(false);
  const searchRequestIdRef = useRef(0);
  const emptyResultsRef = useRef<PostMetadata[]>(emptyResults);

  useEffect(() => {
    emptyResultsRef.current = emptyResults;
  }, [emptyResults]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults(emptyResults);
      setIsSearching(false);
    }
  }, [emptyResults, searchQuery]);

  useEffect(() => {
    const normalizedQuery = searchQuery.trim();
    const requestId = ++searchRequestIdRef.current;

    if (!normalizedQuery) {
      setResults(emptyResultsRef.current);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const timeoutId = window.setTimeout(async () => {
      try {
        const searchedPosts = await searchPosts(normalizedQuery);

        if (requestId !== searchRequestIdRef.current) {
          return;
        }

        setResults(searchedPosts);
      } catch (error) {
        if (requestId !== searchRequestIdRef.current) {
          return;
        }

        console.error('Search failed:', error);
        setResults([]);
      } finally {
        if (requestId === searchRequestIdRef.current) {
          setIsSearching(false);
        }
      }
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [debounceMs, searchQuery]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const clearSearch = useCallback(() => {
    searchRequestIdRef.current += 1;
    setSearchQuery('');
    setResults(emptyResultsRef.current);
    setIsSearching(false);
  }, []);

  return {
    searchQuery,
    isSearching,
    results,
    handleSearch,
    clearSearch,
    hasSearchQuery: searchQuery.trim().length > 0
  };
};
