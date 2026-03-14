import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import { Sun, Moon, Github, Menu, X, Search, Mail, Heart, Zap, Coffee, Code2, Layers, GitBranch, Box, Monitor, Rss } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { siteConfig } from '@config/site.config';
import { BackToTop } from './BackToTop';
import { usePostSearch } from '@/hooks/usePostSearch';
import { ProgressiveImage } from './ProgressiveImage';

const TEXT = {
  searchPlaceholder: '\u641c\u7d22\u6587\u7ae0...',
  searchEmpty: '\u8f93\u5165\u5173\u952e\u8bcd\u5f00\u59cb\u641c\u7d22',
  searchHint: '\u652f\u6301\u6309\u6807\u9898\u3001\u6807\u7b7e\u3001\u5206\u7c7b\u641c\u7d22',
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

const SearchModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const { searchQuery, isSearching, results, handleSearch, clearSearch, hasSearchQuery } = usePostSearch();
  const visibleResults = results.slice(0, 8);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      clearSearch();
    }
  }, [clearSearch, isOpen]);

  useEffect(() => {
    if (isOpen) {
      onClose();
    }
    // Only react to route changes; including isOpen here would close immediately on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

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
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-void/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -20 }} transition={{ type: 'spring', duration: 0.5 }} className="relative z-10 w-full max-w-2xl overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center border-b border-zinc-100 p-4 dark:border-zinc-800">
              <Search className="mr-3 text-zinc-400" size={20} />
              <input
                ref={inputRef}
                type="text"
                placeholder={TEXT.searchPlaceholder}
                className="w-full bg-transparent text-xl text-ink outline-none placeholder:text-zinc-400 dark:text-white"
                value={searchQuery}
                onChange={(event) => handleSearch(event.target.value)}
                onKeyDown={handleInputKeyDown}
              />
              <button onClick={onClose} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X size={20} className="text-zinc-400" />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {isSearching ? (
                <div className="p-12 text-center text-zinc-400">
                  <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                </div>
              ) : visibleResults.length > 0 ? (
                <div className="p-2">
                  <div className="px-3 pt-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-400">
                    {results.length} {TEXT.resultsSuffix}
                  </div>
                  {visibleResults.map((post) => (
                    <button key={post.id} onClick={() => handleSelect(post.id)} className="group block w-full rounded-xl p-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <div className="mb-1 flex items-center gap-2">
                        <span className="rounded-md border border-accent/20 bg-accent/5 px-1.5 py-0.5 text-xs font-bold text-accent">{post.category}</span>
                      </div>
                      <h4 className="text-lg font-semibold text-ink transition-colors group-hover:text-accent dark:text-gray-100 dark:group-hover:text-accent-light">
                        {post.title}
                      </h4>
                      <p className="mt-1 line-clamp-1 text-sm text-zinc-500 dark:text-zinc-400">{post.excerpt}</p>
                    </button>
                  ))}
                </div>
              ) : hasSearchQuery ? (
                <div className="p-12 text-center text-zinc-400">
                  <p>{`${TEXT.notFoundPrefix} “${searchQuery}” ${TEXT.notFoundSuffix}`}</p>
                </div>
              ) : (
                <div className="p-12 text-center text-zinc-400">
                  <p className="text-sm font-medium">{TEXT.searchEmpty}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50 p-3 text-xs text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950/50">
              <span>{TEXT.searchHint}</span>
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

    applyTheme(theme);
    hasInitializedThemeRef.current = true;
    localStorage.setItem('theme', theme);

    const handleSystemChange = () => {
      if (theme === 'system') {
        applyTheme('system');
      }
    };

    systemQuery.addEventListener('change', handleSystemChange);
    return () => systemQuery.removeEventListener('change', handleSystemChange);
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
    <button onClick={toggleTheme} className="group relative rounded-full bg-zinc-100 p-2.5 text-ink transition-all duration-300 hover:ring-2 ring-accent/20 dark:bg-zinc-800 dark:text-amber-300" aria-label="\u5207\u6362\u4e3b\u9898">
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

const Navbar = ({ onSearchClick }: { onSearchClick: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navItems = [
    { path: '/', label: TEXT.navPosts },
    { path: '/archive', label: TEXT.navArchive },
    { path: '/tags', label: TEXT.navTags },
    { path: '/stats', label: TEXT.navStats },
    { path: '/friends', label: TEXT.navFriends },
    { path: '/about', label: TEXT.navAbout }
  ];

  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  return (
    <nav className="fixed left-0 right-0 top-0 z-50 border-b border-zinc-200/50 bg-paper/80 backdrop-blur-lg transition-all duration-500 supports-[backdrop-filter]:bg-paper/60 dark:border-zinc-800/50 dark:bg-void/80">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="group z-50 flex items-center space-x-3">
          <div className="relative">
            <div className="absolute inset-0 bg-accent opacity-20 blur-md transition-opacity group-hover:opacity-40" />
            <ProgressiveImage src={siteConfig.logo} alt="Logo" wrapperClassName="relative h-10 w-10 rounded-lg bg-white/10" className="h-10 w-10 rounded-lg bg-white/10 object-cover transition-transform duration-300 group-hover:scale-105" />
          </div>
          <span className="font-serif text-2xl font-bold tracking-tight text-ink dark:text-white">{siteConfig.title}</span>
        </Link>

        <div className="hidden items-center space-x-8 md:flex">
          <div className="mr-4 flex space-x-6">
            {navItems.map((item) => (
              <Link key={item.path} to={item.path} className="relative px-2 py-1 text-sm font-semibold uppercase tracking-wider text-zinc-500 transition-colors hover:text-ink dark:text-zinc-400 dark:hover:text-white">
                {item.label}
                {location.pathname === item.path && <motion.div layoutId="nav-underline" className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent" />}
              </Link>
            ))}
          </div>

          <div className="flex items-center space-x-3 border-l border-zinc-300 pl-6 dark:border-zinc-700">
            <button onClick={onSearchClick} className="group flex items-center space-x-2 rounded-lg bg-zinc-100 px-3 py-2 text-zinc-500 transition-colors hover:text-accent dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-accent-light">
              <Search size={16} />
              <span className="text-xs font-medium opacity-70 group-hover:opacity-100">Ctrl+K</span>
            </button>
            <a href="/feed.xml" target="_blank" rel="noopener noreferrer" className="group flex items-center space-x-2 rounded-lg bg-orange-50 px-3 py-2 text-orange-600 transition-colors hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-300 dark:hover:bg-orange-950/70">
              <Rss size={16} />
              <span className="text-xs font-medium">{TEXT.rssFeed}</span>
            </a>
            <ThemeToggle />
          </div>
        </div>

        <div className="flex items-center space-x-4 md:hidden">
          <button onClick={onSearchClick} className="p-2 text-zinc-600 transition-transform active:scale-95 dark:text-zinc-300">
            <Search size={22} />
          </button>
          <button onClick={() => setIsOpen(!isOpen)} className="z-50 p-2 text-ink transition-transform active:scale-95 dark:text-white">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: '100vh' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: 'easeInOut' }} className="fixed inset-0 top-0 z-40 overflow-hidden bg-paper/95 px-6 pt-24 backdrop-blur-xl dark:bg-void/95 md:hidden">
            <div className="flex flex-col items-center space-y-8 text-center">
              {navItems.map((item) => (
                <Link key={item.path} onClick={() => setIsOpen(false)} to={item.path} className="text-4xl font-serif font-bold text-ink transition-colors hover:text-accent dark:text-white">
                  {item.label}
                </Link>
              ))}
              <div className="my-4 h-px w-12 bg-zinc-200 dark:bg-zinc-800" />
              <div className="flex items-center gap-4">
                <span className="text-lg font-medium text-zinc-500">{TEXT.theme}</span>
                <ThemeToggle />
              </div>
              <a href="/feed.xml" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 rounded-full border border-orange-200 bg-orange-50 px-5 py-2.5 text-sm font-bold tracking-wide text-orange-600 transition-colors hover:bg-orange-100 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300 dark:hover:bg-orange-950/50">
                <Rss size={16} />
                <span>{TEXT.rssFeed}</span>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
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
    <footer className="relative mt-12 overflow-hidden border-t border-zinc-200 bg-paper py-12 dark:border-zinc-800 dark:bg-void md:mt-32">
      <div className="absolute left-1/2 top-0 h-px w-full -translate-x-1/2 bg-gradient-to-r from-transparent via-accent to-transparent opacity-30" />
      <div className="mx-auto max-w-7xl px-6">
        <div className="mb-12 grid grid-cols-1 gap-12 md:grid-cols-3">
          <div className="flex flex-col items-center space-y-4 md:items-start">
            <div>
              <span className="font-serif text-xl font-bold tracking-tight text-ink dark:text-white">{siteConfig.title}</span>
              <p className="mt-1 text-sm text-zinc-500">{siteConfig.subtitle}</p>
            </div>
            <p className="text-center text-sm leading-relaxed text-zinc-400 md:text-left">{siteConfig.description}</p>
            <div className="flex items-center gap-4 pt-2">
              <a href={siteConfig.social.github} target="_blank" rel="noopener noreferrer" className="rounded-full bg-zinc-100 p-2 text-zinc-500 transition-all duration-300 hover:bg-black hover:text-white dark:bg-zinc-800 dark:hover:bg-accent">
                <Github size={18} />
              </a>
              <a href={siteConfig.social.email} className="rounded-full bg-zinc-100 p-2 text-zinc-500 transition-all duration-300 hover:bg-black hover:text-white dark:bg-zinc-800 dark:hover:bg-accent">
                <Mail size={18} />
              </a>
            </div>
          </div>

          <div className="flex flex-col items-center md:items-start">
            <h4 className="mb-6 text-sm font-bold uppercase tracking-widest text-zinc-400">Tech Stack</h4>
            <div className="flex max-w-xs flex-wrap justify-center gap-2 md:justify-start">
              {technologies.map((tech) => (
                <div key={tech.name} className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-100 px-3 py-1.5 text-xs font-bold text-zinc-600 transition-colors hover:border-accent/30 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
                  <tech.icon size={12} className="text-accent" />
                  {tech.name}
                </div>
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
                <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 md:justify-end">
                  <Zap size={14} className="text-yellow-500" />
                  <span>
                    Page loaded in <span className="font-mono font-bold text-accent">{loadTime}</span>
                  </span>
                </div>
              )}
              <div className="flex items-center justify-center gap-2 text-xs text-zinc-400 md:justify-end">
                <Coffee size={14} className="text-amber-700 dark:text-amber-600" />
                <span>Fueled by Coffee &amp; Code</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center gap-4 pb-6 pt-8 md:flex-row">
          <a href="/feed.xml" target="_blank" rel="noopener noreferrer" className="group relative inline-flex items-center gap-3 rounded-xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 px-6 py-3 transition-all duration-300 hover:border-orange-300 hover:shadow-lg hover:shadow-orange-100 dark:border-orange-900/60 dark:from-orange-950/40 dark:to-amber-950/20 dark:hover:border-orange-700">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500 transition-transform duration-300 group-hover:scale-110">
              <Rss size={18} className="text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-ink dark:text-white">{TEXT.rssFeed}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{TEXT.rssHint}</span>
            </div>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-400/0 via-orange-300/10 to-orange-400/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </a>
          <a href={siteConfig.friendsPage.repoUrl} target="_blank" rel="noopener noreferrer" className="group relative inline-flex items-center gap-3 rounded-xl border border-zinc-200 bg-gradient-to-r from-zinc-100 to-zinc-50 px-6 py-3 transition-all duration-300 hover:border-accent/50 hover:shadow-lg hover:shadow-accent/10 dark:border-zinc-700 dark:from-zinc-800 dark:to-zinc-900 dark:hover:border-accent/50">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black transition-transform duration-300 group-hover:scale-110 dark:bg-white">
              <Github size={18} className="text-white dark:text-black" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-ink dark:text-white">{TEXT.sourceCode}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Open Source on GitHub</span>
            </div>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent/0 via-accent/5 to-accent/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </a>
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
      </div>
    </footer>
  );
};

const ScrollProgress = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return <motion.div className="fixed left-0 right-0 top-0 z-[100] h-1 origin-left bg-accent" style={{ scaleX }} />;
};

const Background = () => {
  return (
    <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden">
      <div className="absolute left-[-10%] top-[-10%] h-[50%] w-[50%] animate-float rounded-full bg-zinc-200/40 blur-[120px] mix-blend-multiply dark:bg-zinc-800/20 dark:mix-blend-overlay" />
      <div className="absolute bottom-[-10%] right-[-10%] h-[50%] w-[50%] animate-float rounded-full bg-zinc-300/40 blur-[120px] mix-blend-multiply dark:bg-zinc-800/20 dark:mix-blend-overlay" style={{ animationDelay: '2s' }} />
    </div>
  );
};

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();
  const openSearch = useCallback(() => setIsSearchOpen(true), []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setIsSearchOpen(true);
      }

      if (event.key === 'Escape') {
        setIsSearchOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="relative flex min-h-screen flex-col selection:bg-accent selection:text-white">
      <ScrollProgress />
      <Background />
      <Navbar onSearchClick={openSearch} />
      <SearchModal isOpen={isSearchOpen} onClose={closeSearch} />
      <main className="relative flex-grow px-4 pt-32 sm:px-6">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
      <BackToTop />
      <Footer />
    </div>
  );
};
