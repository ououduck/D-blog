import React, { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Sun, Moon, Github, Menu, X, Search, Heart, Monitor, Rss, BookOpen, Archive, Tag, BarChart3, Users, Info, Bookmark, Bell, ChevronDown, Mail, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { preloadPage } from '@/utils/preload';
import { assetUrl } from '@/utils/siteUrl';
import { siteConfig } from '@config/site.config';

import { ProgressiveImage } from './ProgressiveImage';
import { IssueSubscriptionCard, ISSUE_SUBSCRIPTION_URL } from './IssueSubscriptionCard';
import { useReducedMotion as useSiteReducedMotion } from '@/hooks/useReducedMotion';
import { hasOpenOverlay } from '@/hooks/useModalOverlay';
import { useReadingMode, ReadingModeProvider } from './ReadingModeContext';
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
  navFavorites: '\u6211\u7684\u6536\u85cf',
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
  const prefersReducedMotion = useSiteReducedMotion();
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('theme') as Theme;
        return saved || 'system';
      } catch {
        return 'system';
      }
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

      if (hasInitializedThemeRef.current && !prefersReducedMotion && document.startViewTransition) {
        document.startViewTransition(() => {
          applyChanges();
        });
      } else {
        if (hasInitializedThemeRef.current && !prefersReducedMotion) {
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
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // Theme persistence is optional when browser storage is unavailable.
    }

    const detachSystemListener = attachSystemListener();
    return () => detachSystemListener();
  }, [prefersReducedMotion, theme]);

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

  const currentThemeLabel = theme === 'light' ? TEXT.themeLight : theme === 'dark' ? TEXT.themeDark : TEXT.themeSystem;
  const nextThemeLabel = theme === 'light' ? TEXT.themeDark : theme === 'dark' ? TEXT.themeSystem : TEXT.themeLight;

  return (
    <button onClick={toggleTheme} className="group relative inline-flex h-11 w-11 items-center justify-center rounded-icon border border-zinc-300 bg-zinc-100 text-ink transition-colors hover:border-zinc-500 hover:bg-zinc-200 active:bg-zinc-300 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-500 dark:active:bg-zinc-700" aria-label={`切换外观主题，当前为${currentThemeLabel}，点击切换为${nextThemeLabel}`}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={theme}
          initial={prefersReducedMotion ? false : { y: -10, opacity: 0, rotate: -45 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          exit={prefersReducedMotion ? undefined : { y: 10, opacity: 0, rotate: 45 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
        >
          {theme === 'light' && <Sun size={18} />}
          {theme === 'dark' && <Moon size={18} />}
          {theme === 'system' && <Monitor size={18} className="text-zinc-500 dark:text-zinc-400" />}
        </motion.div>
      </AnimatePresence>
      <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 whitespace-nowrap rounded-control border border-zinc-700 bg-black px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
        {currentThemeLabel}
      </span>
    </button>
  );
};

type MobileNavPhase = 'closed' | 'opening' | 'open' | 'closing';

export const MOBILE_NAV_ANIMATION_DURATION_MS = 340;

export const Navbar = ({ onSearchClick }: { onSearchClick: () => void }) => {
  const [mobileNavPhase, setMobileNavPhase] = useState<MobileNavPhase>('closed');
  const [isMobileNavMounted, setIsMobileNavMounted] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
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
    { path: '/about', label: TEXT.navAbout, hint: '\u7ad9\u70b9\u4ecb\u7ecd', icon: Info }
  ];
  const moreNavItems = [
    { key: 'favorites', path: '/favorites', label: TEXT.navFavorites, hint: '\u672c\u5730\u79bb\u7ebf\u9605\u8bfb', icon: Bookmark },
    { key: 'cover', path: '/cover', label: '\u5c01\u9762\u751f\u6210\u5668', hint: '\u5236\u4f5c\u6587\u7ae0\u5c01\u9762', icon: ImageIcon },
    { key: 'watermark', path: '/watermark', label: '\u6c34\u5370\u5de5\u5177', hint: '\u7ed9\u56fe\u7247\u6dfb\u52a0\u6587\u5b57\u6c34\u5370', icon: ImageIcon },
    { key: 'email', label: '邮件', hint: '联系作者', icon: Mail, href: siteConfig.social.email },
    { key: 'github', label: 'GitHub', hint: '项目仓库', icon: Github, href: siteConfig.friendsPage.repoUrl },
    { key: 'rss', label: TEXT.rssFeed, hint: '订阅更新', icon: Rss, href: assetUrl('/feed.xml') },
    { key: 'issue-subscription', label: '订阅', hint: '接收文章提醒', icon: Bell, href: ISSUE_SUBSCRIPTION_URL }
  ];
  const isNavItemActive = (path: string) => location.pathname === path || (path === '/' && location.pathname.startsWith('/post/'));
  const mobileQuickActions = [
    {
      key: 'search',
      label: '搜索',
      hint: '快速找内容',
      icon: Search,
      onClick: () => requestCloseMobileNav(() => onSearchClick())
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
    setIsMoreMenuOpen(false);

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
    setIsMoreMenuOpen(false);
  }, [clearAnimationFrame, clearTransitionTimer, isMobileNavMounted, locationKey, resetMobileNavDragStyles]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMoreMenuOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

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
      <nav className={`site-navbar fixed left-0 right-0 top-0 ${isMobileNavMounted ? 'z-nav-panel' : 'z-nav'} border-b border-zinc-200/80 bg-paper/95 dark:border-zinc-800 dark:bg-void/95 lg:border-transparent lg:bg-paper lg:dark:border-transparent lg:dark:bg-void`}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: easeSmooth }} className="mx-auto flex h-14 max-w-7xl items-center justify-between px-3 sm:h-16 sm:px-6 md:h-16">
          <Link to="/" className="group z-50 flex items-center space-x-2.5 sm:space-x-3">
            <ProgressiveImage src={assetUrl(siteConfig.logoSmall)} alt={`${siteConfig.title} 站点标志`} fetchPriority="high" width={96} height={96} wrapperClassName="h-8 w-8 bg-white sm:h-9 sm:w-9" className="h-8 w-8 object-cover sm:h-9 sm:w-9" />
            <span className="font-serif text-lg font-bold tracking-tight text-ink dark:text-white sm:text-2xl">{siteConfig.title}</span>
          </Link>

          <div className="hidden items-center gap-6 lg:flex">
            <motion.div className="flex gap-4" variants={navListVariants} initial="hidden" animate="visible">
              {navItems.map((item) => {
                const isActive = isNavItemActive(item.path);

                return (
                  <motion.div key={item.path} variants={navItemVariants}>
                    <Link
                      to={item.path}
                      onMouseEnter={() => preloadPage(item.path)}
                      aria-current={isActive ? 'page' : undefined}
                      className={`group relative inline-flex h-10 items-center px-2 py-1 text-sm font-semibold tracking-wide transition-colors ${
                        isActive
                          ? 'text-ink dark:text-white'
                          : 'text-zinc-700 hover:text-ink dark:text-zinc-300 dark:hover:text-white'
                      }`}
                    >
                      <span className="relative z-10">{item.label}</span>
                      <span
                        aria-hidden="true"
                        className={`absolute bottom-[2px] left-2 right-2 h-[2px] origin-center rounded-none bg-zinc-900 dark:bg-zinc-100 transition-all duration-[250ms] ${
                          isActive
                            ? 'scale-x-100 opacity-100'
                            : 'scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-70'
                        }`}
                      />
                    </Link>
                  </motion.div>
                );
              })}
              <motion.div
                variants={navItemVariants}
                className="nav-more-menu relative"
                onMouseEnter={() => setIsMoreMenuOpen(true)}
                onMouseLeave={() => setIsMoreMenuOpen(false)}
              >
                <button
                  type="button"
                  className="group inline-flex h-10 items-center gap-1 px-2 py-1 text-sm font-semibold tracking-wide text-zinc-700 transition-colors hover:text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:text-zinc-300 dark:hover:text-white"
                  aria-label="展开收藏与订阅菜单"
                  aria-expanded={isMoreMenuOpen}
                  aria-controls="desktop-more-menu"
                  onClick={() => setIsMoreMenuOpen((open) => !open)}
                >
                  <span>更多</span>
                  <ChevronDown size={14} className={`transition-transform duration-200 ${isMoreMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                </button>
                <div id="desktop-more-menu" role="menu" data-open={isMoreMenuOpen} className="nav-more-menu-panel absolute right-0 top-full z-popover min-w-44 rounded-surface border border-zinc-200 bg-paper p-1.5 shadow-lg dark:border-zinc-700 dark:bg-zinc-950">
                  {moreNavItems.map((item) => {
                    const Icon = item.icon;
                    const content = <><Icon size={15} aria-hidden="true" /><span className="flex-1">{item.label}</span><span className="text-[10px] font-normal text-zinc-400">{item.hint}</span></>;
                    if ('path' in item) {
                      return <Link key={item.key} role="menuitem" to={item.path} onMouseEnter={() => preloadPage(item.path)} onClick={() => setIsMoreMenuOpen(false)} className="flex items-center gap-2 rounded-control px-2.5 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-ink dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white">{content}</Link>;
                    }
                    return <a key={item.key} role="menuitem" href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => setIsMoreMenuOpen(false)} className="flex items-center gap-2 rounded-control px-2.5 py-2 text-xs font-semibold text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-ink dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white">{content}<ExternalLink size={11} aria-hidden="true" /></a>;
                  })}
                </div>
              </motion.div>
            </motion.div>

            <div className="flex items-center gap-2 border-l border-zinc-300 pl-5 dark:border-zinc-700">
              <motion.button variants={navItemVariants} onClick={onSearchClick} className="group flex h-11 items-center gap-2 rounded-control border border-zinc-300 bg-zinc-100 px-3 text-zinc-700 transition-colors hover:border-zinc-500 hover:bg-zinc-200 active:bg-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:active:bg-zinc-700" aria-label="打开站内搜索">
                <Search size={16} />
                <span className="text-xs font-medium text-zinc-600 transition-colors group-hover:text-zinc-700 dark:text-zinc-400 dark:group-hover:text-zinc-300">Ctrl+K</span>
              </motion.button>
              <motion.div variants={navItemVariants}>
                <ThemeToggle />
              </motion.div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 lg:hidden">
            <button onClick={onSearchClick} className="inline-flex h-11 w-11 items-center justify-center rounded-icon border border-zinc-300 bg-paper text-zinc-700 shadow-none transition-colors duration-200 hover:border-zinc-500 hover:bg-zinc-100 hover:text-ink active:bg-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-white dark:active:bg-zinc-800" aria-label="打开站内搜索">
              <Search size={18} />
            </button>
            <button ref={mobileNavMenuButtonRef} onClick={handleToggleMobileNav} disabled={isMobileNavAnimating} className={`z-50 inline-flex h-11 w-11 items-center justify-center rounded-icon border shadow-none transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
              isMobileNavOpen
                ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-950'
                : 'border-zinc-300 bg-paper text-zinc-700 hover:border-zinc-500 hover:bg-zinc-100 hover:text-ink dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-white'
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
        <div className="mobile-nav-root lg:hidden">
          <div
            data-testid="mobile-nav-backdrop"
            data-open={isMobileNavOpen}
            data-locked={isMobileNavAnimating}
            className="mobile-nav-backdrop fixed inset-0 z-popover bg-zinc-950/40 dark:bg-black/55"
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
            className="mobile-nav-panel !fixed inset-x-0 bottom-0 z-nav-panel overflow-hidden editorial-sheet border border-b-0 border-zinc-300 bg-paper text-ink shadow-none outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
            style={mobileNavPanelStyle}
            tabIndex={-1}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="flex justify-center pb-1.5 pt-3">
              <div className="h-1 w-11 rounded-full bg-zinc-300 dark:bg-zinc-700" />
            </div>

            <div className="mobile-nav-scroll flex flex-col overflow-y-auto px-3.5 pb-4 pt-1 no-scrollbar sm:px-4">
              <div className="flex items-center justify-between border-b border-zinc-200 px-1 pb-4 dark:border-zinc-800">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-400 dark:text-zinc-500">Navigation</p>
                  <h3 className="mt-1 font-serif text-xl font-bold text-ink dark:text-white">{siteConfig.title}</h3>
                </div>
                <ThemeToggle />
              </div>

              <nav className="divide-y divide-zinc-200 dark:divide-zinc-800" aria-label="移动端主导航">
                {navItems.map((item) => {
                  const isActive = isNavItemActive(item.path);
                  const Icon = item.icon;

                  return (
                    <button
                      key={item.path}
                      type="button"
                      onClick={() => handleMobileNavItemSelect(item.path)}
                      onMouseEnter={() => preloadPage(item.path)}
                      disabled={isMobileNavAnimating}
                      className={`flex w-full items-center gap-3 rounded-control px-1 py-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                        isActive
                          ? 'text-ink dark:text-white'
                          : 'text-zinc-600 hover:text-ink dark:text-zinc-400 dark:hover:text-white'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon size={17} strokeWidth={1.8} className={isActive ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'} />
                      <span className="flex-1 text-sm font-semibold">{item.label}</span>
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">{item.hint}</span>
                    </button>
                  );
                })}
              </nav>

              <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen((open) => !open)}
                  className="flex w-full items-center gap-3 rounded-control px-1 py-3.5 text-left text-zinc-600 transition-colors hover:text-ink dark:text-zinc-400 dark:hover:text-white"
                  aria-label="展开更多菜单"
                  aria-expanded={isMoreMenuOpen}
                  aria-controls="mobile-more-menu"
                >
                  <ChevronDown size={17} className={`transition-transform duration-200 ${isMoreMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                  <span className="flex-1 text-sm font-semibold">更多</span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">我的收藏、邮件、GitHub、RSS</span>
                </button>
                <div id="mobile-more-menu" data-open={isMoreMenuOpen} className="mobile-more-menu-panel">
                  {isMoreMenuOpen && moreNavItems.map((item) => {
                    const Icon = item.icon;
                    const className = 'flex w-full items-center gap-3 rounded-control px-3 py-3 text-left text-sm font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-ink dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-white';
                    const content = <><Icon size={16} aria-hidden="true" /><span className="flex-1">{item.label}</span><span className="text-xs font-normal text-zinc-400 dark:text-zinc-500">{item.hint}</span></>;
                    if ('path' in item) {
                      return <button key={item.key} type="button" onClick={() => handleMobileNavItemSelect(item.path)} disabled={isMobileNavAnimating} className={className}>{content}</button>;
                    }
                    return <a key={item.key} href={item.href} target="_blank" rel="noopener noreferrer" onClick={() => requestCloseMobileNav()} className={className}>{content}<ExternalLink size={12} aria-hidden="true" /></a>;
                  })}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
                {mobileQuickActions.map((action) => {
                  const Icon = action.icon;
                  const className = 'flex min-h-11 items-center justify-center gap-2 rounded-control border border-zinc-300 bg-paper px-3 py-2.5 text-xs font-semibold text-zinc-600 shadow-none transition-colors hover:border-zinc-500 hover:text-zinc-950 active:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-white dark:active:bg-zinc-800';
                  const content = <><Icon size={15} /><span>{action.label}</span></>;
                  return <button key={action.key} type="button" onClick={action.onClick} className={className} disabled={isMobileNavAnimating}>{content}</button>;
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

const Footer = () => {
  const footerLinks = [
    { label: TEXT.navPosts, to: '/' },
    { label: TEXT.navArchive, to: '/archive' },
    { label: TEXT.navTags, to: '/tags' },
    { label: TEXT.navStats, to: '/stats' },
    { label: TEXT.navFriends, to: '/friends' },
    { label: TEXT.navSponsor, to: '/sponsor' },
    { label: TEXT.navAbout, to: '/about' },
    { label: TEXT.navFavorites, to: '/favorites' }
  ];
  const footerExternalLinks = [
    { label: '\u90ae\u4ef6', href: siteConfig.social.email, external: false },
    { label: 'GitHub', href: siteConfig.social.github, external: true },
    { label: TEXT.rssFeed, href: assetUrl('/feed.xml'), external: true }
  ];

  return (
    <footer className="site-footer mt-8 border-t border-zinc-200/90 dark:border-zinc-800/90 md:mt-12">
      <div className="mx-auto max-w-7xl px-3 py-8 sm:px-6 md:py-10">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xl">
            <Link to="/" className="font-serif text-lg font-bold tracking-tight text-ink transition-colors hover:text-zinc-600 dark:text-white dark:hover:text-zinc-300">
              {siteConfig.title}
            </Link>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{siteConfig.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {footerLinks.map((item) => (
              <Link key={item.to} to={item.to} className="transition-colors hover:text-ink dark:hover:text-white">
                {item.label}
              </Link>
            ))}
            {footerExternalLinks.map((item) => (
              <a
                key={item.href}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className="transition-colors hover:text-ink dark:hover:text-white"
              >
                {item.label}
              </a>
            ))}
            <IssueSubscriptionCard compact />
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-2 border-t border-zinc-200/70 pt-5 text-xs text-zinc-600 dark:border-zinc-800/70 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
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
    <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden bg-paper dark:bg-void" />
  );
};


interface LayoutProps {
  children: React.ReactNode;
  hasViewTransition?: boolean;
}

const routeShellVariants = routeTransition;

const LayoutShell: React.FC<LayoutProps> = ({ children, hasViewTransition }) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [hasOpenedSearch, setHasOpenedSearch] = useState(false);
  const location = useLocation();
  const { isReadingMode } = useReadingMode();
  const openSearch = useCallback(() => {
    setHasOpenedSearch(true);
    setIsSearchOpen(true);
  }, []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);
  const prefersReducedMotion = useSiteReducedMotion();
  const routeVariants = prefersReducedMotion
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : routeShellVariants;
  const routeContentKey = `${location.pathname}${location.search}`;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // 页面快捷键只在没有任何弹层时生效，避免覆盖弹层自身的焦点与 Escape 行为。
      if (hasOpenOverlay()) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (isEditableTarget(event.target)) {
          return;
        }

        event.preventDefault();
        openSearch();
        return;
      }

      if (event.key === 'Escape' && isSearchOpen) {
        event.preventDefault();
        setIsSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen, openSearch]);

  return (
    <div className={`relative flex min-h-screen flex-col ${isReadingMode ? 'reading-mode-shell' : ''}`} data-reading-mode={isReadingMode ? 'true' : undefined}>
      <Background />
      {!isReadingMode && <Navbar onSearchClick={openSearch} />}
      {hasOpenedSearch && (
        <Suspense fallback={null}>
          <SearchModal isOpen={isSearchOpen} onClose={closeSearch} />
        </Suspense>
      )}
      <main className={`relative min-w-0 w-full flex-grow px-3 sm:px-6 ${isReadingMode ? 'pt-6 sm:pt-8 md:pt-10' : 'pt-20 sm:pt-24 md:pt-24'}`}>
        {hasViewTransition ? (
          <div key={routeContentKey} style={{ viewTransitionName: 'route-content' }} className="mx-auto min-w-0 w-full max-w-7xl">
            {children}
          </div>
        ) : (
          <AnimatePresence
            mode="wait"
            initial={false}
            onExitComplete={() => window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })}
          >
            <motion.div key={routeContentKey} variants={routeVariants} initial="initial" animate="animate" exit="exit" className="mx-auto min-w-0 w-full max-w-7xl">
              {children}
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      {!isReadingMode && (
        <Suspense fallback={null}>
          <BackToTop />
        </Suspense>
      )}
      {!isReadingMode && <Footer />}
    </div>
  );
};

export const Layout: React.FC<LayoutProps> = (props) => (
  <ReadingModeProvider>
    <LayoutShell {...props} />
  </ReadingModeProvider>
);

