import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sun, Moon, Github, Menu, X, Search, Heart, Monitor, Rss, BookOpen, Archive, Tag, BarChart3, Users, Info } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { preloadPage } from '@/utils/preload';
import { siteConfig } from '@config/site.config';

import { ProgressiveImage } from './ProgressiveImage';
import { easeSmooth, routeTransition } from '@/utils/motion';

const SearchModal = lazy(() => import('./SearchModal').then((m) => ({ default: m.SearchModal })));
const BackToTop = lazy(() => import('./BackToTop').then((m) => ({ default: m.BackToTop })));


const TEXT = {
  theme: '\u5916\u89c2',
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
  rssFeed: 'RSS \u8ba2\u9605'
};


const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();
  return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
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
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const mobileNavMenuButtonRef = useRef<HTMLButtonElement | null>(null);
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
  const mobileQuickActions = [
    {
      key: 'search',
      label: '搜索',
      hint: '快速找内容',
      icon: Search,
      onClick: () => requestCloseMobileNav(() => onSearchClick())
    },
    {
      key: 'rss',
      label: 'RSS',
      hint: '订阅更新',
      icon: Rss,
      href: '/feed.xml',
      external: true
    },
    {
      key: 'github',
      label: '源码',
      hint: '项目仓库',
      icon: Github,
      href: siteConfig.friendsPage.repoUrl,
      external: true
    }
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

    if (!afterCloseAction) {
      window.setTimeout(() => {
        const focusTarget = previousActiveElementRef.current ?? mobileNavMenuButtonRef.current;
        focusTarget?.focus();
        previousActiveElementRef.current = null;
      }, 0);
    }

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
    previousActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
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
  const resetMobileNavDragStyles = useCallback(() => {
    const panel = mobileNavPanelRef.current;
    const backdrop = panel?.parentElement?.querySelector('.mobile-nav-backdrop') as HTMLElement | null;

    if (panel) {
      panel.dataset.swiping = 'false';
      panel.style.transform = '';
    }

    if (backdrop) {
      backdrop.style.opacity = '';
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (mobileNavPhase !== 'open') {
      return;
    }

    touchStartYRef.current = e.touches[0].clientY;
    touchCurrentYRef.current = e.touches[0].clientY;
    isSwipingRef.current = false;
  }, [mobileNavPhase]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (mobileNavPhase !== 'open') {
      return;
    }

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
      const backdrop = panel.parentElement?.querySelector('.mobile-nav-backdrop') as HTMLElement | null;
      if (backdrop) {
        const panelHeight = panel.offsetHeight || 1;
        const progress = Math.min(deltaY / panelHeight, 1);
        backdrop.style.opacity = String(1 - progress * 0.6);
      }
    }
  }, [mobileNavPhase]);

  const handleTouchEnd = useCallback(() => {
    if (mobileNavPhase !== 'open') {
      resetMobileNavDragStyles();
      return;
    }

    const deltaY = touchCurrentYRef.current - touchStartYRef.current;

    resetMobileNavDragStyles();

    if (isSwipingRef.current && deltaY > 80) {
      requestCloseMobileNav();
    }

    isSwipingRef.current = false;
  }, [mobileNavPhase, requestCloseMobileNav, resetMobileNavDragStyles]);

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

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    const focusPanel = window.setTimeout(() => {
      const panel = mobileNavPanelRef.current;
      const firstFocusable = panel?.querySelector<HTMLElement>(focusableSelector);
      (firstFocusable ?? panel)?.focus();
    }, mobileNavDuration);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        requestCloseMobileNav();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const panel = mobileNavPanelRef.current;
      if (!panel) {
        return;
      }

      const focusableElements = Array.from(panel.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => element.offsetParent !== null || element === document.activeElement);
      if (focusableElements.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
        return;
      }

      if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.clearTimeout(focusPanel);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMobileNavMounted, mobileNavDuration, requestCloseMobileNav]);

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
    resetMobileNavDragStyles();
    afterCloseActionRef.current = null;
    previousActiveElementRef.current = null;
    setIsMobileNavMounted(false);
    setMobileNavPhase('closed');
  }, [clearAnimationFrame, clearTransitionTimer, isMobileNavMounted, locationKey, resetMobileNavDragStyles]);

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
      <nav className="fixed left-0 right-0 top-0 z-50 border-b border-zinc-200/80 bg-paper/95 dark:border-zinc-800 dark:bg-void/95">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: easeSmooth }} className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:h-16 sm:px-6 md:h-16">
          <Link to="/" onMouseEnter={() => preloadPage('/')} className="group z-50 flex items-center space-x-2.5 sm:space-x-3">
            <ProgressiveImage src={siteConfig.logo} alt="Logo" fetchPriority="high" wrapperClassName="h-8 w-8 rounded-lg bg-white sm:h-9 sm:w-9" className="h-8 w-8 rounded-lg object-cover sm:h-9 sm:w-9" />
            <span className="font-serif text-lg font-bold tracking-tight text-ink dark:text-white sm:text-2xl">{siteConfig.title}</span>
          </Link>

          <div className="hidden items-center gap-6 md:flex">
            <motion.div className="flex gap-4" variants={navListVariants} initial="hidden" animate="visible">
              {navItems.map((item) => (
                <motion.div key={item.path} variants={navItemVariants}>
                  <Link
                    to={item.path}
                    onMouseEnter={() => preloadPage(item.path)}
                    aria-current={location.pathname === item.path ? 'page' : undefined}
                    className={`group relative inline-flex h-10 items-center px-2 py-1 text-sm font-semibold tracking-wide transition-colors ${
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

            <div className="flex items-center gap-2 border-l border-zinc-300 pl-5 dark:border-zinc-700">
              <motion.button variants={navItemVariants} onClick={onSearchClick} className="group flex items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-zinc-700 transition-colors hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800" aria-label="打开站内搜索">
                <Search size={16} />
                <span className="text-xs font-medium text-zinc-600 transition-colors group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-300">Ctrl+K</span>
              </motion.button>
              <motion.a variants={navItemVariants} href="/feed.xml" target="_blank" rel="noopener noreferrer" className="group flex items-center gap-2 rounded-lg px-3 py-2 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white">
                <Rss size={16} />
                <span className="text-xs font-medium">{TEXT.rssFeed}</span>
              </motion.a>
              <motion.div variants={navItemVariants}>
                <ThemeToggle />
              </motion.div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 md:hidden">
            <button onClick={onSearchClick} className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-200 bg-white text-zinc-700 shadow-sm shadow-zinc-900/5 transition-all duration-200 hover:border-zinc-300 hover:bg-zinc-50 hover:text-ink active:scale-95 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-black/20 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-white" aria-label="打开站内搜索">
              <Search size={18} />
            </button>
            <button ref={mobileNavMenuButtonRef} onClick={handleToggleMobileNav} disabled={isMobileNavAnimating} className={`z-50 inline-flex h-11 w-11 items-center justify-center rounded-2xl border shadow-sm transition-all duration-200 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
              isMobileNavOpen
                ? 'border-zinc-900 bg-zinc-900 text-white shadow-zinc-900/20 dark:border-white dark:bg-white dark:text-zinc-950 dark:shadow-white/10'
                : 'border-zinc-200 bg-white text-zinc-700 shadow-zinc-900/5 hover:border-zinc-300 hover:bg-zinc-50 hover:text-ink dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:shadow-black/20 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-white'
            }`} aria-label={isMobileNavOpen ? '关闭导航菜单' : '打开导航菜单'} aria-expanded={isMobileNavOpen} aria-controls="mobile-navigation-panel">
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
          <div
            data-testid="mobile-nav-backdrop"
            data-open={isMobileNavOpen}
            data-locked={isMobileNavAnimating}
            className="mobile-nav-backdrop fixed inset-0 z-[70] bg-zinc-950/40 dark:bg-black/55"
            style={mobileNavStyle}
            onClick={() => requestCloseMobileNav()}
          />

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
            className="mobile-nav-panel !fixed inset-x-0 bottom-0 z-[80] overflow-hidden rounded-t-2xl border border-zinc-200 bg-white text-ink shadow-lg outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            style={mobileNavPanelStyle}
            tabIndex={-1}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="flex justify-center pb-1.5 pt-3">
              <div className="h-1 w-11 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            </div>

            <div className="flex max-h-[82vh] flex-col overflow-y-auto px-3.5 pb-4 pt-1 no-scrollbar sm:px-4">
              <div className="flex items-center justify-between border-b border-zinc-200 px-1 pb-4 dark:border-zinc-800">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">Navigation</p>
                  <h3 className="mt-1 font-serif text-xl font-bold text-ink dark:text-white">{siteConfig.title}</h3>
                </div>
                <ThemeToggle />
              </div>

              <nav className="divide-y divide-zinc-200 dark:divide-zinc-800" aria-label="移动端主导航">
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
                      className={`flex w-full items-center gap-3 px-1 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        isActive
                          ? 'text-ink dark:text-white'
                          : 'text-zinc-600 hover:text-ink dark:text-zinc-400 dark:hover:text-white'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon size={17} strokeWidth={1.8} className={isActive ? 'text-accent' : 'text-zinc-400 dark:text-zinc-500'} />
                      <span className="flex-1 text-sm font-semibold">{item.label}</span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">{item.hint}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-3 grid grid-cols-3 gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                {mobileQuickActions.map((action) => {
                  const Icon = action.icon;
                  const className = 'flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-xs font-semibold text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-white';
                  const content = <><Icon size={15} /><span>{action.label}</span></>;

                  if ('onClick' in action) {
                    return <button key={action.key} type="button" onClick={action.onClick} className={className} disabled={isMobileNavAnimating}>{content}</button>;
                  }

                  return <a key={action.key} href={action.href} target={action.external ? '_blank' : undefined} rel={action.external ? 'noopener noreferrer' : undefined} className={className}>{content}</a>;
                })}
              </div>

              <div className="h-[env(safe-area-inset-bottom,0px)]" />
            </div>
          </motion.aside>
        </div>
      )}
    </>
  );
};

const Footer = ({ isPostPage = false }: { isPostPage?: boolean }) => {
  const footerLinks = [
    { label: TEXT.navArchive, to: '/archive' },
    { label: TEXT.navTags, to: '/tags' },
    { label: TEXT.navAbout, to: '/about' }
  ];

  return (
    <footer className="mt-12 border-t border-zinc-200/90 dark:border-zinc-800/90 md:mt-20">
      <div className="mx-auto max-w-7xl px-3 py-8 sm:px-6 md:py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xl">
            <Link to="/" className="font-serif text-lg font-bold tracking-tight text-ink transition-colors hover:text-accent dark:text-white dark:hover:text-accent-light">
              {siteConfig.title}
            </Link>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{siteConfig.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {isPostPage && (
              <Link to="/" className="transition-colors hover:text-ink dark:hover:text-white">首页</Link>
            )}
            {footerLinks.map((item) => (
              <Link key={item.to} to={item.to} className="transition-colors hover:text-ink dark:hover:text-white">
                {item.label}
              </Link>
            ))}
            <a href="/feed.xml" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-ink dark:hover:text-white">RSS</a>
            <a href={siteConfig.social.github} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-ink dark:hover:text-white">GitHub</a>
            <a href={siteConfig.social.email} className="transition-colors hover:text-ink dark:hover:text-white">邮件</a>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-2 border-t border-zinc-200/70 pt-5 text-xs text-zinc-500 dark:border-zinc-800/70 dark:text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
          <p>{siteConfig.footerText} · {siteConfig.author.name}</p>
          <a href={siteConfig.beian.url} target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-ink dark:hover:text-white">
            {siteConfig.beian.text}
          </a>
        </div>
      </div>
    </footer>
  );
};

const Background = () => {
  return (
    <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden bg-paper dark:bg-void">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,_rgba(192,57,43,0.055),_transparent_68%)] dark:bg-[radial-gradient(ellipse_at_top,_rgba(192,57,43,0.08),_transparent_68%)]"
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
  const routeContentKey = location.pathname;
  const isPostPage = location.pathname.startsWith('/post/');

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
  }, [routeContentKey, hasViewTransition]);

  return (
    <div className="relative flex min-h-screen flex-col selection:bg-accent selection:text-white">
      <Background />
      <Navbar onSearchClick={openSearch} />
      <SearchModal isOpen={isSearchOpen} onClose={closeSearch} />
      <main className="relative flex-grow px-3 pt-20 sm:px-6 sm:pt-24 md:pt-24">
        {hasViewTransition ? (
          <div key={routeContentKey} style={{ viewTransitionName: 'route-content' }} className="mx-auto max-w-7xl">
            {children}
          </div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={routeContentKey} variants={routeShellVariants} initial="initial" animate="animate" exit="exit" className="mx-auto max-w-7xl">
              {children}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <Suspense fallback={null}>
        <BackToTop />
      </Suspense>
      <Footer isPostPage={isPostPage} />
    </div>
  );
};

