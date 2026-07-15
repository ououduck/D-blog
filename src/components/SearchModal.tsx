import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, Search, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useModalOverlay } from '@/hooks/useModalOverlay';
import { usePostSearch } from '@/hooks/usePostSearch';
import type { PostSearchScope } from '@/services/posts';
import { easeSmooth } from '@/utils/motion';
import { SearchField } from '@/components/SearchField';

const TEXT = {
  searchPlaceholder: '搜索文章... (⌘K)',
  searchEmpty: '输入关键词开始搜索',
  searchScopeLabel: '搜索范围',
  close: '关闭',
  notFoundPrefix: '没有找到与',
  notFoundSuffix: '相关的内容',
  resultsSuffix: '条结果'
};

const SEARCH_SCOPE_OPTIONS: Array<{ value: PostSearchScope; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'category', label: '分类' },
  { value: 'content', label: '正文内容' },
  { value: 'title', label: '仅标题' }
];

const SEARCH_SCOPE_HINTS: Record<PostSearchScope, string> = {
  all: '支持按标题、标签、分类、摘要与正文搜索',
  category: '仅搜索文章分类名称，适合快速缩小到专题目录',
  content: '只在摘要和正文内容中搜索，不匹配标题和分类',
  title: '只匹配文章标题，适合按标题关键字快速定位'
};

export const SearchModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [searchScope, setSearchScope] = useState<PostSearchScope>('all');
  const [activeResultIndex, setActiveResultIndex] = useState(0);
  const [searchHistory, setSearchHistory] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        return JSON.parse(localStorage.getItem('searchHistory') || '[]');
      } catch {
        return [];
      }
    }
    return [];
  });
  const { searchQuery, isSearching, searchError, results, handleSearch, clearSearch, hasSearchQuery } = usePostSearch({
    scope: searchScope
  });
  const visibleResults = results.slice(0, 8);
  const activeScopeHint = SEARCH_SCOPE_HINTS[searchScope];
  const modalEase = easeSmooth;

  useModalOverlay({
    isOpen,
    onClose,
    initialFocusRef: inputRef,
    containerRef: modalRef
  });

  const saveHistory = (query: string) => {
    if (!query.trim()) return;
    const newHistory = [query, ...searchHistory.filter(q => q !== query)].slice(0, 5);
    setSearchHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  const removeHistory = (query: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newHistory = searchHistory.filter(q => q !== query);
    setSearchHistory(newHistory);
    localStorage.setItem('searchHistory', JSON.stringify(newHistory));
  };

  useEffect(() => {
    if (!isOpen) {
      clearSearch();
      setSearchScope('all');
      setActiveResultIndex(0);
    }
  }, [clearSearch, isOpen]);

  useEffect(() => {
    if (isOpen) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    setActiveResultIndex(0);
  }, [searchQuery, searchScope, visibleResults.length]);

  const handleSelect = (id: string) => {
    saveHistory(searchQuery);
    navigate(`/post/${id}`);
    onClose();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && visibleResults.length > 0) {
      event.preventDefault();
      setActiveResultIndex((current) => (current + 1) % visibleResults.length);
      return;
    }

    if (event.key === 'ArrowUp' && visibleResults.length > 0) {
      event.preventDefault();
      setActiveResultIndex((current) => (current - 1 + visibleResults.length) % visibleResults.length);
      return;
    }

    if (event.key === 'Enter' && visibleResults[activeResultIndex]) {
      handleSelect(visibleResults[activeResultIndex].id);
    }
  };

  const renderHighlightedText = (text: string, terms: string[]) => {
    const normalizedTerms = terms.map((term) => term.trim()).filter(Boolean);
    if (normalizedTerms.length === 0) {
      return text;
    }

    const pattern = new RegExp(`(${normalizedTerms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    return text.split(pattern).map((part, index) => {
      const isMatch = normalizedTerms.some((term) => part.toLocaleLowerCase() === term.toLocaleLowerCase());
      return isMatch ? <mark key={`${part}-${index}`} className="bg-zinc-200 px-0.5 text-zinc-950 dark:bg-zinc-700 dark:text-zinc-100">{part}</mark> : part;
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-16 sm:pt-24">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16, ease: modalEase }} onClick={onClose} className="absolute inset-0 bg-void/55" />
          <motion.div ref={modalRef} tabIndex={-1} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: modalEase }} className="relative z-10 w-full max-w-2xl overflow-hidden border border-zinc-300 bg-paper shadow-none dark:border-zinc-700 dark:bg-void" role="dialog" aria-modal="true" aria-labelledby="site-search-title" aria-describedby="site-search-desc">
            <h2 id="site-search-title" className="sr-only">站内搜索</h2>
            <div className="flex items-center border-b border-zinc-100 p-4 dark:border-zinc-800">
              <SearchField
                ref={inputRef}
                size="large"
                placeholder={TEXT.searchPlaceholder}
                className="border-0 bg-transparent text-xl dark:bg-transparent"
                containerClassName="min-w-0 flex-1"
                value={searchQuery}
                onValueChange={handleSearch}
                onKeyDown={handleInputKeyDown}
                onClear={clearSearch}
                aria-labelledby="site-search-title"
              />
              <button onClick={onClose} className="inline-flex min-h-11 min-w-11 items-center justify-center text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800" aria-label="关闭站内搜索">
                <X size={20} />
              </button>
            </div>

            <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">{TEXT.searchScopeLabel}</div>
              <div className="flex flex-wrap gap-2">
                {SEARCH_SCOPE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSearchScope(option.value)}
                    aria-pressed={searchScope === option.value}
                    className={`border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      searchScope === option.value
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:text-ink dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-white'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">{activeScopeHint}</p>
            </div>

            <div className="max-h-[60vh] supports-[height:100dvh]:max-h-[60dvh] overflow-y-auto" aria-busy={isSearching}>
              {isSearching ? (
                <div className="p-12 text-center text-zinc-600 dark:text-zinc-300" role="status" aria-live="polite">
                  <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent dark:border-zinc-100" aria-hidden="true" />
                  <span className="sr-only">正在搜索</span>
                </div>
              ) : searchError ? (
                <div className="p-12 text-center" role="alert">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100">搜索暂时不可用</p>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{searchError}</p>
                  <button type="button" onClick={clearSearch} className="editorial-button mt-4">清除搜索</button>
                </div>
              ) : visibleResults.length > 0 ? (
                <div className="p-2">
                  <div className="px-3 pt-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">
                    {results.length} {TEXT.resultsSuffix}
                  </div>
                  {visibleResults.map((post, index) => {
                    const isActive = index === activeResultIndex;
                    return (
                      <button
                        key={post.id}
                        onMouseEnter={() => setActiveResultIndex(index)}
                        onClick={() => handleSelect(post.id)}
                        className={`group block w-full p-4 text-left transition-colors ${
                          isActive ? 'border-l-2 border-zinc-900 bg-zinc-100 dark:border-zinc-100 dark:bg-zinc-800/80' : 'border-l-2 border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        }`}
                        aria-label={`打开文章：${post.title}`}
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <span className="border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-xs font-bold text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">{post.category}</span>
                          {post.searchMatch && (
                            <span className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">命中{post.searchMatch.label}</span>
                          )}
                        </div>
                        <h4 className="text-lg font-semibold text-ink transition-colors group-hover:text-zinc-700 dark:text-gray-100 dark:group-hover:text-zinc-300">
                          {post.title}
                        </h4>
                        <p className="mt-1 line-clamp-1 text-sm text-zinc-600 dark:text-zinc-300">{post.excerpt}</p>
                        {post.searchMatch && (
                          <p className="mt-2 line-clamp-2 bg-zinc-100 px-2.5 py-1.5 text-xs leading-5 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                            {renderHighlightedText(post.searchMatch.snippet, post.searchMatch.terms)}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : hasSearchQuery ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-400">
                  <Search size={48} strokeWidth={1} className="mb-4 text-zinc-300 dark:text-zinc-700" />
                  <p>{`${TEXT.notFoundPrefix} “${searchQuery}” ${TEXT.notFoundSuffix}`}</p>
                </div>
              ) : searchHistory.length > 0 ? (
                <div className="p-4">
                  <div className="mb-3 px-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">搜索历史</div>
                  <div className="flex flex-wrap gap-2">
                    {searchHistory.map((query) => (
                      <div key={query} className="group flex items-center border border-zinc-200 bg-zinc-50 py-1 pl-3 pr-1 text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800">
                        <button type="button" className="mr-1 min-h-9 hover:text-zinc-900 dark:hover:text-white" onClick={() => handleSearch(query)}>{query}</button>
                        <button type="button" className="inline-flex min-h-9 min-w-9 items-center justify-center text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200" onClick={(e) => removeHistory(query, e)} aria-label={`删除搜索历史：${query}`}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center text-zinc-400">
                  <Box size={48} strokeWidth={1} className="mb-4 text-zinc-300 dark:text-zinc-700" />
                  <p className="text-sm font-medium">{TEXT.searchEmpty}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-300">
              <span id="site-search-desc">{activeScopeHint}</span>
              <div className="flex items-center gap-2">
                <kbd className="border border-zinc-200 bg-white px-2 py-0.5 font-mono dark:border-zinc-700 dark:bg-zinc-800">esc</kbd>
                <span>{TEXT.close}</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

