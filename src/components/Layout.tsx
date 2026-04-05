import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sun, Moon, Github, Menu, X, Search, Mail, Heart, Zap, Coffee, Code2, Layers, GitBranch, Box, Monitor, Rss } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { siteConfig } from '@config/site.config';
import { BackToTop } from './BackToTop';
import { usePostSearch } from '@/hooks/usePostSearch';
import { ProgressiveImage } from './ProgressiveImage';
import type { PostSearchScope } from '@/services/posts';

const TEXT = {
  searchPlaceholder: '\u641c\u7d22\u6587\u7ae0...',
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
  const { searchQuery, isSearching, results, handleSearch, clearSearch, hasSearchQuery } = usePostSearch({
    scope: searchScope
  });
  const visibleResults = results.slice(0, 8);
  const activeScopeHint = SEARCH_SCOPE_HINTS[searchScope];
  const modalEase = [0.16, 1, 0.3, 1] as const;

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
        <div className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-24">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.26, ease: modalEase }} onClick={onClose} className="absolute inset-0 bg-void/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.975, y: -12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.982, y: -8 }} transition={{ duration: 0.34, ease: modalEase }} className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900" role="dialog" aria-modal="true" aria-labelledby="site-search-title" aria-describedby="site-search-desc">
            <div className="flex items-center border-b border-zinc-100 p-4 dark:border-zinc-800">
              <motion.div animate={searchQuery ? { opacity: 1, scale: 1.03 } : { opacity: 0.82, scale: 1 }} transition={{ duration: 0.24, ease: modalEase }}>
                <Search className="mr-3 text-zinc-400" size={20} />
              </motion.div>
              <input
                ref={inputRef}
                type="text"
                placeholder={TEXT.searchPlaceholder}
                className="w-full bg-transparent text-xl text-ink outline-none placeholder:text-zinc-400 dark:text-white"
                value={searchQuery}
                onChange={(event) => handleSearch(event.target.value)}
                onKeyDown={handleInputKeyDown}
                aria-labelledby="site-search-title"
              />
              <button ref={closeButtonRef} onClick={onClose} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="关闭站内搜索">
                <X size={20} className="text-zinc-400" />
              </button>
            </div>

            <div className="border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-400">{TEXT.searchScopeLabel}</div>
              <div className="flex flex-wrap gap-2">
                {SEARCH_SCOPE_OPTIONS.map((option) => (
                  <motion.button
                    key={option.value}
                    type="button"
                    onClick={() => setSearchScope(option.value)}
                    aria-pressed={searchScope === option.value}
                    whileHover={{ y: -1 }}
                    whileTap={{ scale: 0.992 }}
                    transition={{ duration: 0.22, ease: modalEase }}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      searchScope === option.value
                        ? 'border-accent bg-accent text-white shadow-sm shadow-accent/30'
                        : 'border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-ink dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-white'
                    }`}
                  >
                    {option.label}
                  </motion.button>
                ))}
              </div>
              <motion.p key={searchScope} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.24, ease: modalEase }} className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">{activeScopeHint}</motion.p>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {isSearching ? (
                <div className="p-12 text-center text-zinc-400">
                  <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                </div>
              ) : visibleResults.length > 0 ? (
                <motion.div layout className="p-2">
                  <div id="site-search-title" className="px-3 pt-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
                    {results.length} {TEXT.resultsSuffix}
                  </div>
                  {visibleResults.map((post, index) => (
                    <motion.button key={post.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.26, delay: index * 0.03, ease: modalEase }} onClick={() => handleSelect(post.id)} className="group block w-full rounded-xl p-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50" aria-label={`打开文章：${post.title}`}>
                      <div className="mb-1 flex items-center gap-2">
                        <span className="rounded-md border border-accent/20 bg-accent/5 px-1.5 py-0.5 text-xs font-bold text-accent">{post.category}</span>
                      </div>
                      <h4 className="text-lg font-semibold text-ink transition-colors group-hover:text-accent dark:text-gray-100 dark:group-hover:text-accent-light">
                        {post.title}
                      </h4>
                      <p className="mt-1 line-clamp-1 text-sm text-zinc-500 dark:text-zinc-400">{post.excerpt}</p>
                    </motion.button>
                  ))}
                </motion.div>
              ) : hasSearchQuery ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: modalEase }} className="p-12 text-center text-zinc-400">
                  <p>{`${TEXT.notFoundPrefix} “${searchQuery}” ${TEXT.notFoundSuffix}`}</p>
                </motion.div>
              ) : (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24, ease: modalEase }} className="p-12 text-center text-zinc-400">
                  <p className="text-sm font-medium">{TEXT.searchEmpty}</p>
                </motion.div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/50">
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
      if (hasInitializedThemeRef.current) {
        root.classList.add('theme-switching');
        window.setTimeout(() => root.classList.remove('theme-switching'), 260);
      }

      if (nextTheme === 'dark' || (nextTheme === 'system' && systemQuery.matches)) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
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
    <button onClick={toggleTheme} className="group relative rounded-full bg-zinc-100 p-2.5 text-ink transition-all duration-300 hover:ring-2 ring-accent/20 dark:bg-zinc-800 dark:text-amber-300" aria-label="切换主题">
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
export const MOBILE_NAV_SWIPE_CLOSE_THRESHOLD = 84;
const MOBILE_NAV_MAX_DRAG_OFFSET = 56;
const MOBILE_NAV_SWIPE_VELOCITY_THRESHOLD = 0.4;

export const Navbar = ({ onSearchClick }: { onSearchClick: () => void }) => {
  const [mobileNavPhase, setMobileNavPhase] = useState<MobileNavPhase>('closed');
  const [isMobileNavMounted, setIsMobileNavMounted] = useState(false);
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const animationFrameRef = useRef<number | null>(null);
  const transitionTimerRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTimeRef = useRef<number | null>(null);
  const touchDeltaYRef = useRef(0);
  const afterCloseActionRef = useRef<(() => void) | null>(null);
  const mobileNavDuration = shouldReduceMotion ? 1 : MOBILE_NAV_ANIMATION_DURATION_MS;
  const isMobileNavOpen = mobileNavPhase === 'open' || mobileNavPhase === 'opening';
  const isMobileNavAnimating = mobileNavPhase === 'opening' || mobileNavPhase === 'closing';
  const navItems = [
    { path: '/', label: TEXT.navPosts },
    { path: '/archive', label: TEXT.navArchive },
    { path: '/tags', label: TEXT.navTags },
    { path: '/stats', label: TEXT.navStats },
    { path: '/friends', label: TEXT.navFriends },
    { path: '/about', label: TEXT.navAbout }
  ];
  const navListVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: 0.06,
        delayChildren: 0.08
      }
    }
  };
  const navItemVariants = {
    hidden: { opacity: 0, y: -8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.32,
        ease: [0.22, 1, 0.36, 1]
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

  const resetTouchState = useCallback(() => {
    touchStartYRef.current = null;
    touchStartTimeRef.current = null;
    touchDeltaYRef.current = 0;
    setDragOffsetY(0);
  }, []);

  const finalizeClose = useCallback(() => {
    clearAnimationFrame();
    clearTransitionTimer();
    setIsMobileNavMounted(false);
    setMobileNavPhase('closed');
    resetTouchState();

    const afterCloseAction = afterCloseActionRef.current;
    afterCloseActionRef.current = null;
    afterCloseAction?.();
  }, [clearAnimationFrame, clearTransitionTimer, resetTouchState]);

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
    resetTouchState();

    if (mobileNavDuration <= 1) {
      finalizeClose();
      return;
    }

    setMobileNavPhase('closing');
    transitionTimerRef.current = window.setTimeout(() => {
      transitionTimerRef.current = null;
      finalizeClose();
    }, mobileNavDuration);
  }, [clearAnimationFrame, clearTransitionTimer, finalizeClose, isMobileNavMounted, mobileNavDuration, mobileNavPhase, resetTouchState]);

  const openMobileNav = useCallback(() => {
    if (isMobileNavMounted || mobileNavPhase === 'opening' || mobileNavPhase === 'open') {
      return;
    }

    afterCloseActionRef.current = null;
    clearAnimationFrame();
    clearTransitionTimer();
    resetTouchState();
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
  }, [clearAnimationFrame, clearTransitionTimer, isMobileNavMounted, mobileNavDuration, mobileNavPhase, resetTouchState]);

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

  const handleMobileSearchClick = useCallback(() => {
    if (isMobileNavAnimating) {
      return;
    }

    requestCloseMobileNav(onSearchClick);
  }, [isMobileNavAnimating, onSearchClick, requestCloseMobileNav]);

  const handleMobilePanelTouchStart = useCallback((event: React.TouchEvent<HTMLElement>) => {
    if (isMobileNavAnimating) {
      return;
    }

    touchStartYRef.current = event.touches[0]?.clientY ?? null;
    touchStartTimeRef.current = Date.now();
    touchDeltaYRef.current = 0;
  }, [isMobileNavAnimating]);

  const handleMobilePanelTouchMove = useCallback((event: React.TouchEvent<HTMLElement>) => {
    if (isMobileNavAnimating || touchStartYRef.current === null) {
      return;
    }

    const currentY = event.touches[0]?.clientY ?? touchStartYRef.current;
    const deltaY = Math.max(0, currentY - touchStartYRef.current);
    touchDeltaYRef.current = deltaY;
    setDragOffsetY(Math.min(deltaY * 0.32, MOBILE_NAV_MAX_DRAG_OFFSET));
  }, [isMobileNavAnimating]);

  const handleMobilePanelTouchEnd = useCallback(() => {
    if (touchStartYRef.current === null) {
      resetTouchState();
      return;
    }

    const elapsed = Math.max(Date.now() - (touchStartTimeRef.current ?? Date.now()), 1);
    const swipeVelocity = touchDeltaYRef.current / elapsed;
    const shouldClose = touchDeltaYRef.current >= MOBILE_NAV_SWIPE_CLOSE_THRESHOLD || swipeVelocity >= MOBILE_NAV_SWIPE_VELOCITY_THRESHOLD;

    resetTouchState();

    if (shouldClose) {
      requestCloseMobileNav();
    }
  }, [requestCloseMobileNav, resetTouchState]);

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
    resetTouchState();
  }, [clearAnimationFrame, clearTransitionTimer, isMobileNavMounted, locationKey, resetTouchState]);

  useEffect(() => () => {
    clearAnimationFrame();
    clearTransitionTimer();
  }, [clearAnimationFrame, clearTransitionTimer]);

  const mobileNavStyle = {
    '--mobile-nav-duration': `${mobileNavDuration}ms`,
    '--mobile-nav-drag-offset': `${dragOffsetY}px`
  } as React.CSSProperties;

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-zinc-200/65 bg-paper/80 shadow-[0_18px_48px_-38px_rgba(28,25,23,0.45)] backdrop-blur-xl transition-all duration-500 supports-[backdrop-filter]:bg-paper/64 dark:border-zinc-800/65 dark:bg-void/80">
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="group z-50 flex items-center space-x-3">
          <div className="relative">
            <motion.div
              className="absolute inset-0 bg-accent opacity-20 blur-md transition-opacity group-hover:opacity-40"
              animate={{ opacity: [0.18, 0.3, 0.18], scale: [0.96, 1.04, 0.96] }}
              transition={{ duration: 5.8, repeat: Infinity, ease: 'easeInOut' }}
            />
            <ProgressiveImage src={siteConfig.logo} alt="Logo" wrapperClassName="relative h-10 w-10 rounded-lg bg-white/10" className="h-10 w-10 rounded-lg bg-white/10 object-cover transition-transform duration-300 group-hover:scale-105" />
          </div>
          <span className="font-serif text-2xl font-bold tracking-tight text-ink dark:text-white">{siteConfig.title}</span>
        </Link>

        <div className="hidden items-center space-x-8 md:flex">
          <motion.div className="mr-4 flex space-x-6" variants={navListVariants} initial="hidden" animate="visible">
            {navItems.map((item) => (
              <motion.div key={item.path} variants={navItemVariants}>
                <Link
                  to={item.path}
                  aria-current={location.pathname === item.path ? 'page' : undefined}
                  className={`group relative inline-flex h-10 items-center px-2 py-1 text-sm font-semibold uppercase tracking-wider transition-colors ${
                    location.pathname === item.path
                      ? 'text-ink dark:text-white'
                      : 'text-zinc-500 hover:text-ink dark:text-zinc-400 dark:hover:text-white'
                  }`}
                >
                  <span className="relative z-10">{item.label}</span>
                  <span
                    aria-hidden="true"
                    className={`absolute bottom-[2px] left-2 right-2 h-[2px] origin-center rounded-full bg-gradient-to-r from-accent-light via-accent to-accent-dark transition-all duration-250 ${
                      location.pathname === item.path
                        ? 'scale-x-100 opacity-100 shadow-[0_0_16px_rgba(192,57,43,0.4)]'
                        : 'scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-70'
                    }`}
                  />
                </Link>
              </motion.div>
            ))}
          </motion.div>

          <motion.div className="flex items-center space-x-3 border-l border-zinc-300 pl-6 dark:border-zinc-700" variants={navListVariants} initial="hidden" animate="visible">
            <motion.button variants={navItemVariants} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} onClick={onSearchClick} className="group flex items-center space-x-2 rounded-lg border border-transparent bg-zinc-100/90 px-3 py-2 text-zinc-500 transition-all duration-300 hover:border-zinc-200 hover:bg-white hover:text-accent dark:bg-zinc-800/90 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800" aria-label="打开站内搜索">
              <Search size={16} />
              <span className="text-xs font-medium opacity-70 group-hover:opacity-100">Ctrl+K</span>
            </motion.button>
            <motion.a variants={navItemVariants} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }} href="/feed.xml" target="_blank" rel="noopener noreferrer" className="group flex items-center space-x-2 rounded-lg bg-orange-50 px-3 py-2 text-orange-600 transition-colors hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:bg-orange-950/70">
              <Rss size={16} />
              <span className="text-xs font-medium">{TEXT.rssFeed}</span>
            </motion.a>
            <motion.div variants={navItemVariants}>
              <ThemeToggle />
            </motion.div>
          </motion.div>
        </div>

        <div className="flex items-center space-x-4 md:hidden">
          <button onClick={onSearchClick} className="p-2 text-zinc-600 transition-transform active:scale-95 dark:text-zinc-300" aria-label="打开站内搜索">
            <Search size={22} />
          </button>
          <button onClick={handleToggleMobileNav} disabled={isMobileNavAnimating} className="z-50 p-2 text-ink transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 dark:text-white" aria-label={isMobileNavOpen ? '关闭导航菜单' : '打开导航菜单'} aria-expanded={isMobileNavOpen} aria-controls="mobile-navigation-panel">
            {isMobileNavOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </motion.div>

      {isMobileNavMounted && (
        <div className="mobile-nav-root md:hidden">
          <div data-testid="mobile-nav-backdrop" data-open={isMobileNavOpen} data-locked={isMobileNavAnimating} className="mobile-nav-backdrop fixed inset-0 z-[70] bg-void/72 backdrop-blur-md" style={mobileNavStyle} onClick={() => requestCloseMobileNav()} />

          <aside
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
            className="mobile-nav-panel fixed inset-0 z-[80] flex flex-col bg-paper/95 text-ink backdrop-blur-xl dark:bg-void/95 dark:text-white"
            style={{ ...mobileNavStyle, touchAction: 'pan-y' }}
            onTouchStart={handleMobilePanelTouchStart}
            onTouchMove={handleMobilePanelTouchMove}
            onTouchEnd={handleMobilePanelTouchEnd}
            onTouchCancel={handleMobilePanelTouchEnd}
          >
            <div className="flex h-20 items-center justify-between border-b border-zinc-200/70 px-6 dark:border-zinc-800/70">
              <button type="button" onClick={() => handleMobileNavItemSelect('/')} disabled={isMobileNavAnimating} className="group flex items-center space-x-3 text-left disabled:cursor-not-allowed disabled:opacity-60" aria-label="返回首页">
                <div className="relative">
                  <div className="absolute inset-0 bg-accent/20 blur-md transition-opacity group-hover:opacity-40" />
                  <ProgressiveImage src={siteConfig.logo} alt="Logo" wrapperClassName="relative h-10 w-10 rounded-lg bg-white/10" className="h-10 w-10 rounded-lg bg-white/10 object-cover transition-transform duration-300 group-hover:scale-105" />
                </div>
                <span className="font-serif text-2xl font-bold tracking-tight text-ink dark:text-white">{siteConfig.title}</span>
              </button>

              <button type="button" onClick={() => requestCloseMobileNav()} disabled={isMobileNavAnimating} className="rounded-full border border-zinc-200/80 bg-white/80 p-2 text-zinc-500 transition-colors hover:border-zinc-300 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700/80 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:text-white" aria-label="关闭导航菜单">
                <X size={22} />
              </button>
            </div>

            <div className="flex flex-1 flex-col overflow-y-auto px-6 pb-10 pt-5">
              <div className="mb-6 flex justify-center">
                <span className="h-1.5 w-16 rounded-full bg-zinc-300/90 dark:bg-zinc-700/90" />
              </div>

              <div className="flex flex-1 flex-col justify-between gap-10">
                <div className="space-y-3">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.path;

                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => handleMobileNavItemSelect(item.path)}
                        disabled={isMobileNavAnimating}
                        className={`flex w-full items-center justify-between rounded-[28px] border px-5 py-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                          isActive
                            ? 'border-accent/25 bg-accent/[0.08] text-accent dark:border-accent/30 dark:bg-accent/[0.12]'
                            : 'border-zinc-200/80 bg-white/80 text-ink hover:border-zinc-300 hover:bg-white dark:border-zinc-800/80 dark:bg-zinc-900/70 dark:text-white dark:hover:border-zinc-700 dark:hover:bg-zinc-900'
                        }`}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <span className="text-4xl font-serif font-bold tracking-tight">{item.label}</span>
                        <span className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400 dark:text-zinc-500">GO</span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-4 pb-safe">
                  <button type="button" onClick={handleMobileSearchClick} disabled={isMobileNavAnimating} className="flex w-full items-center justify-between rounded-2xl border border-zinc-200/80 bg-white/80 px-4 py-3 text-left text-zinc-600 transition-colors hover:border-zinc-300 hover:text-ink disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800/80 dark:bg-zinc-900/70 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-white" aria-label="打开站内搜索">
                    <span className="flex items-center gap-3">
                      <Search size={18} />
                      <span className="text-sm font-semibold">站内搜索</span>
                    </span>
                    <span className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">Ctrl+K</span>
                  </button>

                  <div className="flex items-center justify-between rounded-2xl border border-zinc-200/80 bg-white/80 px-4 py-3 dark:border-zinc-800/80 dark:bg-zinc-900/70">
                    <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{TEXT.theme}</span>
                    <ThemeToggle />
                  </div>

                  <a href="/feed.xml" target="_blank" rel="noopener noreferrer" className="inline-flex w-full items-center justify-center gap-3 rounded-2xl border border-orange-200/80 bg-orange-50 px-5 py-3 text-sm font-bold tracking-wide text-orange-600 transition-colors hover:bg-orange-100 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300 dark:hover:bg-orange-950/50">
                    <Rss size={16} />
                    <span>{TEXT.rssFeed}</span>
                  </a>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}
    </nav>
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
    <footer className="relative mt-12 overflow-hidden border-t border-zinc-200/90 bg-paper/88 py-12 dark:border-zinc-800/90 dark:bg-void/92 md:mt-32">
      <motion.div
        className="absolute left-1/2 top-0 h-px w-full -translate-x-1/2 bg-gradient-to-r from-transparent via-accent to-transparent opacity-30"
        animate={{ opacity: [0.2, 0.46, 0.2], scaleX: [0.96, 1, 0.97] }}
        transition={{ duration: 6.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div initial={{ opacity: 0, y: 22 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.18 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }} className="mx-auto max-w-7xl px-6">
        <div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-3">
          <div className="flex flex-col items-center space-y-4 md:items-start">
            <div>
              <span className="font-serif text-xl font-bold tracking-tight text-ink dark:text-white">{siteConfig.title}</span>
              <p className="mt-1 text-sm text-zinc-500">{siteConfig.subtitle}</p>
            </div>
            <p className="text-center text-sm leading-relaxed text-zinc-400 md:text-left">{siteConfig.description}</p>
            <div className="flex items-center gap-4 pt-2">
              <motion.a whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} href={siteConfig.social.github} target="_blank" rel="noopener noreferrer" className="rounded-full bg-zinc-100 p-2 text-zinc-500 transition-all duration-300 hover:bg-black hover:text-white dark:bg-zinc-800 dark:hover:bg-accent" aria-label="打开 GitHub 主页">
                <Github size={18} />
              </motion.a>
              <motion.a whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }} href={siteConfig.social.email} className="rounded-full bg-zinc-100 p-2 text-zinc-500 transition-all duration-300 hover:bg-black hover:text-white dark:bg-zinc-800 dark:hover:bg-accent" aria-label="发送邮件">
                <Mail size={18} />
              </motion.a>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <h4 className="mb-6 text-sm font-bold uppercase tracking-widest text-zinc-400">Tech Stack</h4>
            <div className="flex max-w-xs flex-wrap justify-center gap-2 md:justify-start">
              {technologies.map((tech, index) => (
                <motion.div key={tech.name} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.3 }} transition={{ duration: 0.3, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }} whileHover={{ y: -2 }} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600 transition-colors hover:border-accent/30 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
                  <tech.icon size={12} className="text-accent" />
                  {tech.name}
                </motion.div>
              ))}
            </div>
          </div>

          <div className="flex flex-col items-center md:items-end">
            <h4 className="mb-6 text-sm font-bold uppercase tracking-widest text-zinc-400">Status</h4>
            <div className="flex w-full flex-col gap-4">
              <div className="flex items-center justify-center gap-2 text-xs font-bold text-zinc-500 md:justify-end">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                <span>All Systems Normal</span>
              </div>
              {loadTime && (
                <motion.div initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }} className="flex items-center justify-center gap-2 text-xs text-zinc-400 md:justify-end">
                  <Zap size={14} className="text-yellow-500" />
                  <span>
                    Page loaded in <span className="font-mono font-bold text-accent">{loadTime}</span>
                  </span>
                </motion.div>
              )}
              <motion.div initial={{ opacity: 0, x: 10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: 0.5 }} transition={{ duration: 0.35, delay: 0.05, ease: [0.22, 1, 0.36, 1] }} className="flex items-center justify-center gap-2 text-xs text-zinc-400 md:justify-end">
                <Coffee size={14} className="text-amber-700 dark:text-amber-600" />
                <span>Fueled by Coffee &amp; Code</span>
              </motion.div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 pb-6 pt-8 md:flex-row">
          <motion.a whileHover={{ y: -3 }} whileTap={{ scale: 0.985 }} href="/feed.xml" target="_blank" rel="noopener noreferrer" className="group relative inline-flex items-center gap-3 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-3 transition-all duration-300 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-100 dark:border-orange-900/60 dark:from-orange-950/40 dark:to-amber-950/20 dark:hover:border-orange-700">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 transition-transform duration-300 group-hover:scale-110">
              <Rss size={18} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-ink dark:text-white">{TEXT.rssFeed}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{TEXT.rssHint}</span>
            </div>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-400/0 via-orange-300/10 to-orange-400/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </motion.a>
          <motion.a whileHover={{ y: -3 }} whileTap={{ scale: 0.985 }} href={siteConfig.friendsPage.repoUrl} target="_blank" rel="noopener noreferrer" className="group relative inline-flex items-center gap-3 rounded-xl border border-zinc-200 bg-gradient-to-r from-zinc-100 to-zinc-50 px-6 py-3 transition-all duration-300 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10 dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-900 dark:hover:border-accent/50">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black transition-transform duration-300 group-hover:scale-110 dark:bg-white">
              <Github size={18} className="text-white dark:text-black" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-ink dark:text-white">{TEXT.sourceCode}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Open Source on GitHub</span>
            </div>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent/0 via-accent/5 to-accent/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </motion.a>
        </div>

        <div className="flex w-full flex-col items-center justify-between border-t border-zinc-200/50 pt-8 text-xs font-medium text-zinc-400 dark:border-zinc-800/50 md:flex-row">
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
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden">
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(192,57,43,0.08),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(24,24,27,0.08),_transparent_34%),linear-gradient(180deg,_rgba(255,255,255,0.55),_transparent_45%)] dark:bg-[radial-gradient(circle_at_top_left,_rgba(192,57,43,0.12),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(161,161,170,0.08),_transparent_34%),linear-gradient(180deg,_rgba(255,255,255,0.04),_transparent_35%)]"
        animate={shouldReduceMotion ? undefined : { scale: [1, 1.03, 1], opacity: [0.92, 1, 0.92] }}
        transition={shouldReduceMotion ? undefined : { duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute left-[-8%] top-[-6%] hidden h-[34rem] w-[34rem] rounded-full bg-zinc-200/30 blur-[96px] xl:block dark:bg-zinc-800/18"
        animate={shouldReduceMotion ? undefined : { x: [-18, 22, -10], y: [0, 20, -12], scale: [1, 1.08, 0.96] }}
        transition={shouldReduceMotion ? undefined : { duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute bottom-[-10%] right-[-8%] hidden h-[30rem] w-[30rem] rounded-full bg-zinc-300/25 blur-[90px] xl:block dark:bg-zinc-800/16"
        animate={shouldReduceMotion ? undefined : { x: [16, -20, 12], y: [0, -18, 14], scale: [1, 0.94, 1.05] }}
        transition={shouldReduceMotion ? undefined : { duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute left-1/2 top-1/3 hidden h-64 w-64 -translate-x-1/2 rounded-full bg-accent/5 blur-[110px] lg:block"
        animate={shouldReduceMotion ? undefined : { opacity: [0.18, 0.32, 0.18], scale: [0.9, 1.08, 0.94] }}
        transition={shouldReduceMotion ? undefined : { duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  );
};


interface LayoutProps {
  children: React.ReactNode;
}

const routeShellVariants = {
  initial: { opacity: 0, y: 22, scale: 0.992, filter: 'blur(12px)' },
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.55,
      ease: [0.22, 1, 0.36, 1]
    }
  },
  exit: {
    opacity: 0,
    y: -14,
    scale: 0.995,
    filter: 'blur(8px)',
    transition: {
      duration: 0.28,
      ease: [0.4, 0, 1, 1]
    }
  }
} as const;

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();
  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);

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

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname, location.search]);

  return (
    <div className="relative flex min-h-screen flex-col selection:bg-accent selection:text-white">
      <Background />
      <Navbar onSearchClick={openSearch} />
      <SearchModal isOpen={isSearchOpen} onClose={closeSearch} />
      <main className="relative flex-grow px-4 pt-32 sm:px-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={`${location.pathname}${location.search}`} variants={routeShellVariants} initial="initial" animate="animate" exit="exit" className="mx-auto max-w-7xl will-change-transform">
            {children}
          </motion.div>
        </AnimatePresence>
      </main>
      <BackToTop />
      <Footer />
    </div>
  );
};

