import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Box, Search, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePostSearch } from '@/hooks/usePostSearch';
import type { PostSearchScope } from '@/services/posts';
import { easeSmooth } from '@/utils/motion';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const [searchScope, setSearchScope] = useState<PostSearchScope>('content');
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
  const { searchQuery, isSearching, results, handleSearch, clearSearch, hasSearchQuery } = usePostSearch({
    scope: searchScope
  });
  const visibleResults = results.slice(0, 8);
  const activeScopeHint = SEARCH_SCOPE_HINTS[searchScope];
  const modalEase = easeSmooth;

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
      setSearchScope('content');
      previousActiveElementRef.current?.focus?.();
      previousActiveElementRef.current = null;
      return;
    }

    previousActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const timerId = window.setTimeout(() => inputRef.current?.focus(), 100);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [clearSearch, isOpen]);

  useEffect(() => {
    if (isOpen) {
      onClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusableElements = [inputRef.current, closeButtonRef.current].filter(Boolean) as HTMLElement[];
      if (focusableElements.length === 0) {
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSelect = (id: string) => {
    saveHistory(searchQuery);
    navigate(`/post/${id}`);
    onClose();
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && visibleResults[0]) {
      handleSelect(visibleResults[0].id);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-16 sm:pt-24">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.26, ease: modalEase }} onClick={onClose} className="absolute inset-0 bg-void/60 backdrop-blur-sm md:backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: modalEase }} className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl bg-white/95 dark:bg-zinc-900/95 border border-zinc-200 dark:border-zinc-800 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="site-search-title" aria-describedby="site-search-desc">
            <div className="flex items-center border-b border-zinc-100 p-4 dark:border-zinc-800">
              <motion.div animate={searchQuery ? { opacity: 1 } : { opacity: 0.82 }} transition={{ duration: 0.2, ease: modalEase }}>
                <Search className="mr-3 text-zinc-600 dark:text-zinc-300" size={20} />
              </motion.div>
              <input
                ref={inputRef}
                type="text"
                placeholder={TEXT.searchPlaceholder}
                className="w-full bg-transparent text-xl text-ink outline-none placeholder:text-zinc-600 dark:placeholder:text-zinc-300 dark:text-white"
                value={searchQuery}
                onChange={(event) => handleSearch(event.target.value)}
                onKeyDown={handleInputKeyDown}
                aria-labelledby="site-search-title"
              />
              <button ref={closeButtonRef} onClick={onClose} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="关闭站内搜索">
                <X size={20} className="text-zinc-600 dark:text-zinc-300" />
              </button>
            </div>

            <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">{TEXT.searchScopeLabel}</div>
              <div className="flex flex-wrap gap-2">
                {SEARCH_SCOPE_OPTIONS.map((option) => (
                  <motion.button
                    key={option.value}
                    type="button"
                    onClick={() => setSearchScope(option.value)}
                    aria-pressed={searchScope === option.value}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ duration: 0.18, ease: modalEase }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      searchScope === option.value
                        ? 'border-zinc-900 bg-zinc-900 text-white shadow-sm dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                        : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:text-ink dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-white'
                    }`}
                  >
                    {option.label}
                  </motion.button>
                ))}
              </div>
              <motion.p key={searchScope} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.24, ease: modalEase }} className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">{activeScopeHint}</motion.p>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {isSearching ? (
                <div className="p-12 text-center text-zinc-600 dark:text-zinc-300">
                  <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-zinc-900 border-t-transparent dark:border-zinc-100" />
                </div>
              ) : visibleResults.length > 0 ? (
                <motion.div layout className="p-2">
                  <div id="site-search-title" className="px-3 pt-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">
                    {results.length} {TEXT.resultsSuffix}
                  </div>
                  {visibleResults.map((post, index) => (
                    <motion.button key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26, delay: index * 0.03, ease: modalEase }} onClick={() => handleSelect(post.id)} className="group block w-full rounded-xl p-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50" aria-label={`打开文章：${post.title}`}>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="rounded-md border border-zinc-200 bg-zinc-100 px-1.5 py-0.5 text-xs font-bold text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">{post.category}</span>
                      </div>
                      <h4 className="text-lg font-semibold text-ink transition-colors group-hover:text-zinc-700 dark:text-gray-100 dark:group-hover:text-zinc-300">
                        {post.title}
                      </h4>
                      <p className="mt-1 line-clamp-1 text-sm text-zinc-600 dark:text-zinc-300">{post.excerpt}</p>
                    </motion.button>
                  ))}
                </motion.div>
              ) : hasSearchQuery ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: modalEase }} className="flex flex-col items-center justify-center p-12 text-center text-zinc-400">
                  <Search size={48} strokeWidth={1} className="mb-4 text-zinc-300 dark:text-zinc-700" />
                  <p>{`${TEXT.notFoundPrefix} “${searchQuery}” ${TEXT.notFoundSuffix}`}</p>
                </motion.div>
              ) : searchHistory.length > 0 ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: modalEase }} className="p-4">
                  <div className="mb-3 px-2 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">搜索历史</div>
                  <div className="flex flex-wrap gap-2">
                    {searchHistory.map((query) => (
                      <div key={query} className="group flex items-center rounded-full border border-zinc-200 bg-zinc-50 pl-3 pr-1 py-1 text-sm text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800">
                        <button type="button" className="mr-1 hover:text-zinc-900 dark:hover:text-white" onClick={() => handleSearch(query)}>{query}</button>
                        <button type="button" className="rounded-full p-1 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200" onClick={(e) => removeHistory(query, e)}>
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: modalEase }} className="flex flex-col items-center justify-center p-12 text-center text-zinc-400">
                  <Box size={48} strokeWidth={1} className="mb-4 text-zinc-300 dark:text-zinc-700" />
                  <p className="text-sm font-medium">{TEXT.searchEmpty}</p>
                </motion.div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-700 dark:text-zinc-300 dark:border-zinc-800 dark:bg-zinc-950/50">
              <span id="site-search-desc">{activeScopeHint}</span>
              <div className="flex items-center gap-2">
                <kbd className="rounded border border-zinc-200 bg-white px-2 py-0.5 font-mono dark:border-zinc-700 dark:bg-zinc-800">esc</kbd>
                <span>{TEXT.close}</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
