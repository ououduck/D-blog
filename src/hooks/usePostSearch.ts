import { useCallback, useEffect, useRef, useState } from 'react';
import { searchPosts } from '@/services/posts';
import type { PostMetadata } from '@/types';

interface UsePostSearchOptions {
  emptyResults?: PostMetadata[];
  debounceMs?: number;
}

export const usePostSearch = ({
  emptyResults = [],
  debounceMs = 300
}: UsePostSearchOptions = {}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<PostMetadata[]>(emptyResults);
  const [isSearching, setIsSearching] = useState(false);
  const searchRequestIdRef = useRef(0);

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
      setResults(emptyResults);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);

    const timeoutId = window.setTimeout(async () => {
      const searchedPosts = await searchPosts(normalizedQuery);

      if (requestId !== searchRequestIdRef.current) {
        return;
      }

      setResults(searchedPosts);
      setIsSearching(false);
    }, debounceMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [debounceMs, emptyResults, searchQuery]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const clearSearch = useCallback(() => {
    searchRequestIdRef.current += 1;
    setSearchQuery('');
    setResults(emptyResults);
    setIsSearching(false);
  }, [emptyResults]);

  return {
    searchQuery,
    isSearching,
    results,
    handleSearch,
    clearSearch,
    hasSearchQuery: searchQuery.trim().length > 0
  };
};
