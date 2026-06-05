import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sun, Moon, Github, Menu, X, Search, Mail, Heart, Zap, Coffee, Code2, Layers, GitBranch, Box, Monitor, Rss, Image, BookOpen, Archive, Tag, BarChart3, Users, Info } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { preloadPage } from '@/utils/preload';
import { siteConfig } from '@config/site.config';

import { usePostSearch } from '@/hooks/usePostSearch';
import { ProgressiveImage } from './ProgressiveImage';
import { BackToTop } from './BackToTop';
import { GlobalLiquidGlass } from './GlobalLiquidGlass';
import type { PostSearchScope } from '@/services/posts';
import { easeSmooth, routeTransition } from '@/utils/motion';

const TEXT = {
  searchPlaceholder: '\u641c\u7d22\u6587\u7ae0... (\u2318K)',
  searchEmpty: '\u8f93\u5165\u5173\u952e\u8bcd\u5f00\u59cb\u641c\u7d22',
  searchHint: '\u652f\u6301\u6309\u6807\u9898\u3001\u6807\u7b7e\u3001\u5206\u7c7b\u641c\u7d22',
  searchScopeLabel: '\u641c\u7d22\u8303\u56f4',
  close: '\u5173\u95ed',
  theme: '\u5916\u89c2',
  notFoundPrefix: '\u6ca1\u6709\u627e\u5230\u4e0e',
  notFoundSuffix: '\u76f8\u5173\u7684\u5185\u5bb9',
  themeLight: '\u6d45\u8272',
  themeDark: '\u6df1\u8272',
  themeSystem: '\u8ddf\u968f\u7cfb\u7edf',
  navPosts: '\u6587\u7ae0',
  navArchive: '\u5f52\u6863',
  navTags: '\u6807\u7b7e',
  navStats: '\u7edf\u8ba1',
  navFriends: '\u53cb\u94fe',
  navSponsor: '\u8d5e\u52a9',
  navAbout: '\u5173\u4e8e',
  sourceCode: '\u9879\u76ee\u6e90\u7801',
  resultsSuffix: '\u6761\u7ed3\u679c',
  rssFeed: 'RSS \u8ba2\u9605',
  rssHint: '\u901a\u8fc7 RSS \u8ffd\u8e2a\u6700\u65b0\u66f4\u65b0'
};

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
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

const SearchModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.26, ease: modalEase }} onClick={onClose} className="absolute inset-0 bg-void/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: modalEase }} className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl liquid-glass backdrop-blur-xl shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="site-search-title" aria-describedby="site-search-desc">
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
                <div className="p-12 text-center text-zinc-400">
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

const ThemeToggle = () => {
  type Theme = 'light' | 'dark' | 'system';
  const hasInitializedThemeRef = useRef(false);
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme') as Theme;
      return saved || 'system';
    }
    return 'system';
  });

  useEffect(() => {
    const root = document.documentElement;
    const systemQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (nextTheme: Theme) => {
      const applyChanges = () => {
        if (nextTheme === 'dark' || (nextTheme === 'system' && systemQuery.matches)) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      };

      if (hasInitializedThemeRef.current && document.startViewTransition) {
        document.startViewTransition(() => {
          applyChanges();
        });
      } else {
        if (hasInitializedThemeRef.current) {
          root.classList.add('theme-switching');
          window.setTimeout(() => root.classList.remove('theme-switching'), 260);
        }
        applyChanges();
      }
    };

    const handleSystemChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    const attachSystemListener = () => {
      if (typeof systemQuery.addEventListener === 'function') {
        systemQuery.addEventListener('change', handleSystemChange);
        return () => systemQuery.removeEventListener('change', handleSystemChange);
      }

      systemQuery.addListener(handleSystemChange);
      return () => systemQuery.removeListener(handleSystemChange);
    };

    applyTheme(theme);
    hasInitializedThemeRef.current = true;
    localStorage.setItem('theme', theme);

    const detachSystemListener = attachSystemListener();
    return () => detachSystemListener();
  }, [theme]);

  const toggleTheme = () => {
    if (theme === 'light') {
      setTheme('dark');
      return;
    }

    if (theme === 'dark') {
      setTheme('system');
      return;
    }

    setTheme('light');
  };

  return (
    <button onClick={toggleTheme} className="group relative rounded-full bg-zinc-100 p-2.5 text-ink transition-all duration-300 hover:ring-2 ring-zinc-900/20 dark:bg-zinc-800 dark:text-amber-300 dark:ring-zinc-100/20" aria-label="切换主题">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={theme} initial={{ y: -10, opacity: 0, rotate: -45 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: 10, opacity: 0, rotate: 45 }} transition={{ duration: 0.2 }}>
          {theme === 'light' && <Sun size={18} />}
          {theme === 'dark' && <Moon size={18} />}
          {theme === 'system' && <Monitor size={18} className="text-zinc-500 dark:text-zinc-400" />}
        </motion.div>
      </AnimatePresence>
      <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded bg-black px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        {theme === 'light' ? TEXT.themeLight : theme === 'dark' ? TEXT.themeDark : TEXT.themeSystem}
      </span>
    </button>
  );
};

type MobileNavPhase = 'closed' | 'opening' | 'open' | 'closing';

export const MOBILE_NAV_ANIMATION_DURATION_MS = 340;

export const Navbar = ({ onSearchClick }: { onSearchClick: () => void }) => {
  const [mobileNavPhase, setMobileNavPhase] = useState<MobileNavPhase>('closed');
  const [isMobileNavMounted, setIsMobileNavMounted] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const animationFrameRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const afterCloseActionRef = useRef<(() => void) | null>(null);
  const mobileNavPanelRef = useRef<HTMLElement | null>(null);
  const touchStartYRef = useRef<number>(0);
  const touchCurrentYRef = useRef<number>(0);
  const isSwipingRef = useRef(false);
  const mobileNavDuration = shouldReduceMotion ? 1 : MOBILE_NAV_ANIMATION_DURATION_MS;
  const isMobileNavOpen = mobileNavPhase === 'open' || mobileNavPhase === 'opening';
  const isMobileNavAnimating = mobileNavPhase === 'opening' || mobileNavPhase === 'closing';
  const navItems = [
    { path: '/', label: TEXT.navPosts, hint: '最新内容', icon: BookOpen },
    { path: '/archive', label: TEXT.navArchive, hint: '时间归档', icon: Archive },
    { path: '/tags', label: TEXT.navTags, hint: '主题筛选', icon: Tag },
    { path: '/stats', label: TEXT.navStats, hint: '站点数据', icon: BarChart3 },
    { path: '/friends', label: TEXT.navFriends, hint: '友情链接', icon: Users },
    { path: '/sponsor', label: TEXT.navSponsor, hint: '赞助支持', icon: Heart },
    { path: '/about', label: TEXT.navAbout, hint: '站点介绍', icon: Info }
  ];
  const navListVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.04,
        delayChildren: 0.05
      }
    }
  };
  const navItemVariants = {
    hidden: { opacity: 0, y: -6 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.25,
        ease: easeSmooth
      }
    }
  };

  const clearAnimationFrame = useCallback(() => {
    if (animationFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = null;
  }, []);

  const clearTransitionTimer = useCallback(() => {
    if (transitionTimerRef.current === null) {
      return;
    }

    window.clearTimeout(transitionTimerRef.current);
    transitionTimerRef.current = null;
  }, []);

  const finalizeClose = useCallback(() => {
    clearAnimationFrame();
    clearTransitionTimer();
    setIsMobileNavMounted(false);
    setMobileNavPhase('closed');

    const afterCloseAction = afterCloseActionRef.current;
    afterCloseActionRef.current = null;
    afterCloseAction?.();
  }, [clearAnimationFrame, clearTransitionTimer]);

  const requestCloseMobileNav = useCallback((afterClose?: () => void) => {
    afterCloseActionRef.current = afterClose ?? null;

    if (!isMobileNavMounted && mobileNavPhase === 'closed') {
      const immediateAction = afterCloseActionRef.current;
      afterCloseActionRef.current = null;
      immediateAction?.();
      return;
    }

    if (mobileNavPhase === 'opening' || mobileNavPhase === 'closing') {
      return;
    }

    clearAnimationFrame();
    clearTransitionTimer();

    if (mobileNavDuration <= 1) {
      finalizeClose();
      return;
    }

    setMobileNavPhase('closing');
    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null;
      finalizeClose();
    }, mobileNavDuration);
  }, [clearAnimationFrame, clearTransitionTimer, finalizeClose, isMobileNavMounted, mobileNavDuration, mobileNavPhase]);

  const openMobileNav = useCallback(() => {
    if (isMobileNavMounted || mobileNavPhase === 'opening' || mobileNavPhase === 'open') {
      return;
    }

    afterCloseActionRef.current = null;
    clearAnimationFrame();
    clearTransitionTimer();
    setIsMobileNavMounted(true);
    setMobileNavPhase('closed');

    const beginOpening = () => {
      animationFrameRef.current = null;

      if (mobileNavDuration <= 1) {
        setMobileNavPhase('open');
        return;
      }

      setMobileNavPhase('opening');
      transitionTimerRef.current = window.setTimeout(() => {
        transitionTimerRef.current = null;
        setMobileNavPhase('open');
      }, mobileNavDuration);
    };

    animationFrameRef.current = window.requestAnimationFrame(() => {
      animationFrameRef.current = window.requestAnimationFrame(beginOpening);
    });
  }, [clearAnimationFrame, clearTransitionTimer, isMobileNavMounted, mobileNavDuration, mobileNavPhase]);

  const handleToggleMobileNav = useCallback(() => {
    if (isMobileNavAnimating) {
      return;
    }

    if (isMobileNavOpen) {
      requestCloseMobileNav();
      return;
    }

    openMobileNav();
  }, [isMobileNavAnimating, isMobileNavOpen, openMobileNav, requestCloseMobileNav]);

  const handleMobileNavItemSelect = useCallback((path: string) => {
    if (isMobileNavAnimating) {
      return;
    }

    if (location.pathname === path) {
      requestCloseMobileNav();
      return;
    }

    requestCloseMobileNav(() => navigate(path));
  }, [isMobileNavAnimating, location.pathname, navigate, requestCloseMobileNav]);

  // Swipe-to-close gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartYRef.current = e.touches[0].clientY;
    touchCurrentYRef.current = e.touches[0].clientY;
    isSwipingRef.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartYRef.current;
    touchCurrentYRef.current = currentY;

    // Only allow downward swipe
    if (deltaY <= 0) return;

    isSwipingRef.current = true;
    const panel = mobileNavPanelRef.current;
    if (panel) {
      panel.dataset.swiping = 'true';
      panel.style.transform = `translate3d(0, ${deltaY}px, 0)`;
      // Dim backdrop proportionally
      const backdrop = panel.parentElement?.querySelector('.mobile-nav-backdrop') as HTMLElement;
      if (backdrop) {
        const panelHeight = panel.offsetHeight;
        const progress = Math.min(deltaY / panelHeight, 1);
        backdrop.style.opacity = String(1 - progress * 0.6);
      }
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    const deltaY = touchCurrentYRef.current - touchStartYRef.current;
    const panel = mobileNavPanelRef.current;

    if (panel) {
      panel.dataset.swiping = 'false';
      panel.style.transform = '';
    }
    // Reset backdrop opacity
    const backdrop = panel?.parentElement?.querySelector('.mobile-nav-backdrop') as HTMLElement;
    if (backdrop) {
      backdrop.style.opacity = '';
    }

    if (isSwipingRef.current && deltaY > 80) {
      requestCloseMobileNav();
    }

    isSwipingRef.current = false;
  }, [requestCloseMobileNav]);

  useEffect(() => {
    if (!isMobileNavMounted) {
      return;
    }

    const htmlOverflow = document.documentElement.style.overflow;
    const bodyOverflow = document.body.style.overflow;
    const htmlOverscrollBehavior = document.documentElement.style.overscrollBehavior;

    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = htmlOverflow;
      document.documentElement.style.overscrollBehavior = htmlOverscrollBehavior;
      document.body.style.overflow = bodyOverflow;
    };
  }, [isMobileNavMounted]);

  useEffect(() => {
    if (!isMobileNavMounted) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      event.preventDefault();
      requestCloseMobileNav();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileNavMounted, requestCloseMobileNav]);

  const locationKey = `${location.pathname}${location.search}`;
  const previousLocationKeyRef = useRef(locationKey);

  useEffect(() => {
    if (previousLocationKeyRef.current === locationKey) {
      return;
    }

    previousLocationKeyRef.current = locationKey;

    if (!isMobileNavMounted) {
      return;
    }

    clearAnimationFrame();
    clearTransitionTimer();
    afterCloseActionRef.current = null;
    setIsMobileNavMounted(false);
    setMobileNavPhase('closed');
  }, [clearAnimationFrame, clearTransitionTimer, isMobileNavMounted, locationKey]);

  useEffect(() => () => {
    clearAnimationFrame();
    clearTransitionTimer();
  }, [clearAnimationFrame, clearTransitionTimer]);

  const mobileNavStyle = {
    '--mobile-nav-duration': `${mobileNavDuration}ms`
  } as React.CSSProperties;
  const mobileNavPanelStyle = {
    ...mobileNavStyle,
    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    paddingLeft: 'env(safe-area-inset-left, 0px)',
    paddingRight: 'env(safe-area-inset-right, 0px)'
  } as React.CSSProperties;

  return (
    <>
      <nav className="fixed left-0 right-0 top-0 z-50 liquid-glass-nav backdrop-blur-xl transition-all duration-500">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: easeSmooth }} className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:h-16 sm:px-6 md:h-20">
          <Link to="/" onMouseEnter={() => preloadPage('/')} className="group z-50 flex items-center space-x-2.5 sm:space-x-3">
            <div className="relative">
              <div
                className="absolute inset-0 bg-zinc-900/20 opacity-20 blur-md transition-opacity group-hover:opacity-40 dark:bg-zinc-100/20"
              />
              <ProgressiveImage src={siteConfig.logo} alt="Logo" fetchPriority="high" wrapperClassName="relative h-8 w-8 rounded-lg bg-white/10 sm:h-10 sm:w-10" className="h-8 w-8 rounded-lg bg-white/10 object-cover transition-transform duration-300 group-hover:scale-105 sm:h-10 sm:w-10" />
            </div>
            <span className="font-serif text-lg font-bold tracking-tight text-ink dark:text-white sm:text-2xl">{siteConfig.title}</span>
          </Link>

          <div className="hidden items-center space-x-8 md:flex">
            <motion.div className="mr-4 flex space-x-6" variants={navListVariants} initial="hidden" animate="visible">
              {navItems.map((item) => (
                <motion.div key={item.path} variants={navItemVariants}>
                  <Link
                    to={item.path}
                    onMouseEnter={() => preloadPage(item.path)}
                    aria-current={location.pathname === item.path ? 'page' : undefined}
                    className={`group relative inline-flex h-10 items-center px-2 py-1 text-sm font-semibold uppercase tracking-wider transition-all active:scale-95 ${
                      location.pathname === item.path
                        ? 'text-ink dark:text-white'
                        : 'text-zinc-700 hover:text-ink dark:text-zinc-300 dark:hover:text-white'
                    }`}
                  >
                    <span className="relative z-10">{item.label}</span>
                    <span
                      aria-hidden="true"
                      className={`absolute bottom-[2px] left-2 right-2 h-[2px] origin-center rounded-full bg-zinc-900 dark:bg-zinc-100 transition-all duration-250 ${
                        location.pathname === item.path
                          ? 'scale-x-100 opacity-100'
                          : 'scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-70'
                      }`}
                    />
                  </Link>
                </motion.div>
              ))}
            </motion.div>

            <div className="flex items-center space-x-3 border-l border-zinc-300 pl-6 dark:border-zinc-700">
              <motion.button variants={navItemVariants} onClick={onSearchClick} className="group flex items-center space-x-2 rounded-lg border border-transparent bg-zinc-100 px-3 py-2 text-zinc-700 transition-all duration-200 hover:-translate-y-px hover:border-zinc-200 hover:bg-white active:scale-95 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900" aria-label="打开站内搜索">
                <Search size={16} />
                <span className="text-xs font-medium text-zinc-600 transition-colors group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-300">Ctrl+K</span>
              </motion.button>
              <motion.a variants={navItemVariants} href="/feed.xml" target="_blank" rel="noopener noreferrer" className="group flex items-center space-x-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-zinc-700 transition-all duration-200 hover:-translate-y-px hover:bg-zinc-100 active:scale-95 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800">
                <Rss size={16} />
                <span className="text-xs font-medium">{TEXT.rssFeed}</span>
              </motion.a>
              <motion.div variants={navItemVariants} className="active:scale-95 transition-transform">
                <ThemeToggle />
              </motion.div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <button onClick={onSearchClick} className="rounded-xl bg-zinc-100/80 p-2.5 text-zinc-500 transition-all hover:bg-zinc-200/80 hover:text-ink active:scale-90 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-700/80 dark:hover:text-white" aria-label="打开站内搜索">
              <Search size={18} />
            </button>
            <button onClick={handleToggleMobileNav} disabled={isMobileNavAnimating} className="z-50 rounded-xl bg-zinc-100/80 p-2.5 text-zinc-500 transition-all hover:bg-zinc-200/80 hover:text-ink active:scale-90 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-800/80 dark:text-zinc-400 dark:hover:bg-zinc-700/80 dark:hover:text-white" aria-label={isMobileNavOpen ? '关闭导航菜单' : '打开导航菜单'} aria-expanded={isMobileNavOpen} aria-controls="mobile-navigation-panel">
              <div className="relative flex h-[18px] w-[18px] items-center justify-center">
                <Menu size={18} className={`absolute transition-all duration-300 ${isMobileNavOpen ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`} />
                <X size={18} className={`absolute transition-all duration-300 ${isMobileNavOpen ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'}`} />
              </div>
            </button>
          </div>
        </motion.div>
      </nav>

      {isMobileNavMounted && (
        <div className="mobile-nav-root md:hidden">
          <div data-testid="mobile-nav-backdrop" data-open={isMobileNavOpen} data-locked={isMobileNavAnimating} className="mobile-nav-backdrop fixed inset-0 z-[70] bg-void/50 backdrop-blur-sm" style={mobileNavStyle} onClick={() => requestCloseMobileNav()} />

          <motion.aside
            ref={mobileNavPanelRef}
            id="mobile-navigation-panel"
            role="dialog"
            aria-modal="true"
            aria-label="移动端导航菜单"
            aria-busy={isMobileNavAnimating}
            data-testid="mobile-nav-panel"
            data-open={isMobileNavOpen}
            data-state={mobileNavPhase}
            data-interaction-locked={isMobileNavAnimating}
            data-locked={isMobileNavAnimating}
            data-swiping="false"
            className="mobile-nav-panel !fixed inset-x-0 bottom-0 z-[80] overflow-hidden rounded-t-[2rem] liquid-glass backdrop-blur-3xl text-ink shadow-2xl dark:text-white"
            style={mobileNavPanelStyle}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="h-1 w-9 rounded-full bg-zinc-300 dark:bg-zinc-600" />
            </div>

            <div className="flex max-h-[65vh] flex-col overflow-y-auto px-4 pb-4 pt-1">
              {/* Nav grid - 4 columns */}
              <div className="grid grid-cols-4 gap-x-2 gap-y-3 pb-4">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => handleMobileNavItemSelect(item.path)}
                      onMouseEnter={() => preloadPage(item.path)}
                      disabled={isMobileNavAnimating}
                      className={`flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
                        isActive
                          ? 'bg-ink/[0.07] dark:bg-white/[0.1]'
                          : 'hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon size={20} className={isActive ? 'text-ink dark:text-white' : 'text-zinc-400 dark:text-zinc-500'} strokeWidth={isActive ? 2.2 : 1.8} />
                      <span className={`text-[11px] font-semibold leading-tight ${isActive ? 'text-ink dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>{item.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Bottom row: theme + RSS */}
              <div className="flex items-center justify-between border-t border-zinc-200/60 pt-3 dark:border-zinc-800/60">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500">{TEXT.theme}</span>
                  <ThemeToggle />
                </div>
                <a href="/feed.xml" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-ink dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-white">
                  <Rss size={12} />
                  <span>RSS</span>
                </a>
              </div>

              {/* Safe area bottom spacer */}
              <div className="h-[env(safe-area-inset-bottom,0px)]" />
            </div>
          </motion.aside>
        </div>
      )}
    </>
  );
};

const Footer = () => {
  const [loadTime, setLoadTime] = useState<string>('');

  useEffect(() => {
    setTimeout(() => {
      if (typeof window !== 'undefined' && window.performance) {
        const timing = window.performance.now();
        setLoadTime(`${(timing / 1000).toFixed(2)}s`);
      }
    }, 0);
  }, []);

  const technologies = [
    { name: 'React 19', icon: Code2 },
    { name: 'Vite', icon: Zap },
    { name: 'Tailwind', icon: Box },
    { name: 'Framer Motion', icon: Layers },
    { name: 'TypeScript', icon: Code2 },
    { name: 'React Router', icon: GitBranch }
  ];

  return (
    <footer className="relative mt-12 overflow-hidden border-t border-zinc-200/90 py-12 dark:border-zinc-800/90 md:mt-32">
      <div className="absolute left-1/2 top-0 h-px w-full -translate-x-1/2 bg-gradient-to-r from-transparent via-zinc-900/30 to-transparent opacity-30 dark:via-zinc-100/30" />
      <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.18 }} transition={{ duration: 0.35, ease: easeSmooth }} className="mx-auto max-w-7xl px-6">
        <div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-3">
          <div className="flex flex-col items-center space-y-4 md:items-start">
            <div>
              <span className="font-serif text-xl font-bold tracking-tight text-ink dark:text-white">{siteConfig.title}</span>
              <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{siteConfig.subtitle}</p>
            </div>
            <p className="text-center text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 md:text-left">{siteConfig.description}</p>
            <div className="flex items-center gap-4 pt-2">
              <a href={siteConfig.social.github} target="_blank" rel="noopener noreferrer" className="rounded-full bg-zinc-100 p-2 text-zinc-700 transition-all duration-200 hover:-translate-y-px hover:bg-black hover:text-white active:scale-95 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-white dark:hover:text-zinc-900" aria-label="打开 GitHub 主页">
                <Github size={18} />
              </a>
              <a href={siteConfig.social.email} className="rounded-full bg-zinc-100 p-2 text-zinc-700 transition-all duration-200 hover:-translate-y-px hover:bg-black hover:text-white active:scale-95 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-white dark:hover:text-zinc-900" aria-label="发送邮件">
                <Mail size={18} />
              </a>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <h4 className="mb-6 text-sm font-bold uppercase tracking-widest text-zinc-700 dark:text-zinc-300">Tech Stack</h4>
            <div className="flex max-w-xs flex-wrap justify-center gap-2 md:justify-start">
              {technologies.map((tech, index) => (
                <motion.div key={tech.name} initial={{ opacity: 0, y: 6 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.22, delay: index * 0.03, ease: easeSmooth }} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-700 transition-all duration-200 hover:-translate-y-px hover:border-zinc-900/30 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:border-zinc-100/30">
                  <tech.icon size={12} className="text-zinc-700 dark:text-zinc-300" />
                  {tech.name}
                </motion.div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end">
            <h4 className="mb-6 text-sm font-bold uppercase tracking-widest text-zinc-700 dark:text-zinc-300">Status</h4>
            <div className="flex w-full flex-col gap-4">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 md:justify-end">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                <span>All Systems Normal</span>
              </div>
              {loadTime && (
                <motion.div initial={{ opacity: 0, x: 6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.25, ease: easeSmooth }} className="flex items-center justify-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 md:justify-end">
                  <Zap size={14} className="text-yellow-500" />
                  <span>
                    Page loaded in <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100">{loadTime}</span>
                  </span>
                </motion.div>
              )}
              <motion.div initial={{ opacity: 0, x: 6 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.25, delay: 0.03, ease: easeSmooth }} className="flex items-center justify-center gap-2 text-xs text-zinc-600 dark:text-zinc-300 md:justify-end">
                <Coffee size={14} className="text-amber-700 dark:text-amber-600" />
                <span>Fueled by Coffee &amp; Code</span>
              </motion.div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 pb-6 pt-8 md:flex-row">
          <a href="/cover" className="group relative inline-flex items-center gap-3 rounded-xl liquid-glass backdrop-blur-xl border-purple-200 dark:border-purple-900/60 px-6 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-purple-300 dark:hover:border-purple-700">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500 transition-transform duration-300 group-hover:scale-110">
              <Image size={18} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-ink dark:text-white">封面生成器</span>
              <span className="text-xs text-zinc-600 dark:text-zinc-300">快速生成精美封面</span>
            </div>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-400/0 via-purple-300/10 to-purple-400/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </a>
          <a href="/feed.xml" target="_blank" rel="noopener noreferrer" className="group relative inline-flex items-center gap-3 rounded-xl liquid-glass backdrop-blur-xl border-orange-200 dark:border-orange-900/60 px-6 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-orange-300 dark:hover:border-orange-700">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 transition-transform duration-300 group-hover:scale-110">
              <Rss size={18} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-ink dark:text-white">{TEXT.rssFeed}</span>
              <span className="text-xs text-zinc-600 dark:text-zinc-300">{TEXT.rssHint}</span>
            </div>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-400/0 via-orange-300/10 to-orange-400/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </a>
          <a href={siteConfig.friendsPage.repoUrl} target="_blank" rel="noopener noreferrer" className="group relative inline-flex items-center gap-3 rounded-xl liquid-glass backdrop-blur-xl border-zinc-200 dark:border-zinc-700 px-6 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-900/50 dark:hover:border-zinc-100/50">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black transition-transform duration-300 group-hover:scale-110 dark:bg-white">
              <Github size={18} className="text-white dark:text-black" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-ink dark:text-white">{TEXT.sourceCode}</span>
              <span className="text-xs text-zinc-600 dark:text-zinc-300">Open Source on GitHub</span>
            </div>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent/0 via-accent/5 to-accent/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </a>
        </div>

        <div className="flex w-full flex-col items-center justify-between border-t border-zinc-200/50 pt-8 text-xs font-medium text-zinc-700 dark:text-zinc-300 dark:border-zinc-800/50 md:flex-row">
          <p>{siteConfig.footerText} · {siteConfig.author.name}</p>
          <div className="mt-4 flex items-center gap-6 md:mt-0">
            <a href={siteConfig.beian.url} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-accent">
              {siteConfig.beian.text}
            </a>
            <span className="flex items-center gap-1">
              Made with <Heart size={10} className="fill-accent text-accent" /> by {siteConfig.author.name}
            </span>
          </div>
        </div>
      </motion.div>
    </footer>
  );
};

const Background = () => {
  return (
    <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(192,57,43,0.08),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(24,24,27,0.08),_transparent_34%),linear-gradient(180deg,_rgba(255,255,255,0.55),_transparent_45%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(192,57,43,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(161,161,170,0.08),_transparent_34%),linear-gradient(180deg,_rgba(255,255,255,0.04),_transparent_35%)]"
      />
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-1/3 hidden h-64 w-64 -translate-x-1/2 rounded-full bg-accent/5 blur-[110px] lg:block"
      />
    </div>
  );
};


interface LayoutProps {
  children: React.ReactNode;
  hasViewTransition?: boolean;
}

const routeShellVariants = routeTransition;

export const Layout: React.FC<LayoutProps> = ({ children, hasViewTransition }) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();
  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);
  const scrollTimerRef = useRef<number | null>(null);
  const locationKey = `${location.pathname}${location.search}`;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (isEditableTarget(event.target)) {
          return;
        }

        event.preventDefault();
        setIsSearchOpen(true);
        return;
      }

      if (event.key === 'Escape' && isSearchOpen) {
        event.preventDefault();
        setIsSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  // Scroll to top after route transition
  useEffect(() => {
    if (scrollTimerRef.current) {
      window.clearTimeout(scrollTimerRef.current);
    }

    if (hasViewTransition) {
      // With VT: scroll after the circle reveal animation has mostly completed
      scrollTimerRef.current = window.setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }, 200);
    } else {
      // With FM: scroll after exit animation completes
      scrollTimerRef.current = window.setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }, 140);
    }

    return () => {
      if (scrollTimerRef.current) {
        window.clearTimeout(scrollTimerRef.current);
      }
    };
  }, [locationKey, hasViewTransition]);

  return (
    <div className="relative flex min-h-screen flex-col selection:bg-accent selection:text-white">
      <Background />
      <GlobalLiquidGlass />
      <Navbar onSearchClick={openSearch} />
      <SearchModal isOpen={isSearchOpen} onClose={closeSearch} />
      <main className="relative flex-grow px-3 pt-20 sm:px-6 sm:pt-24 md:pt-32">
        {hasViewTransition ? (
          <div key={locationKey} style={{ viewTransitionName: 'route-content' }} className="mx-auto max-w-7xl">
            {children}
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={locationKey} variants={routeShellVariants} initial="initial" animate="animate" exit="exit" className="mx-auto max-w-7xl">
              {children}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BackToTop />
      <Footer />
    </div>
  );
};

