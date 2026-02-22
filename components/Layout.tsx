import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useScroll, useSpring } from 'framer-motion';
import { Sun, Moon, Github, Menu, X, Search, Mail, Heart, Zap, Coffee, Code2, Layers, GitBranch, Box, Monitor } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { searchPosts } from '../services/posts';
import { Post } from '../types';
import { siteConfig } from '../site.config';
import { BackToTop } from './BackToTop';

const SearchModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Post[]>([]);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchResults = async () => {
      if (query.trim().length > 0) {
        const res = await searchPosts(query);
        setResults(res);
      } else {
        setResults([]);
      }
    };
    const debounce = setTimeout(fetchResults, 300);
    return () => clearTimeout(debounce);
  }, [query]);

  const handleSelect = (id: string) => {
    navigate(`/post/${id}`);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center pt-24 px-4">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-void/60 backdrop-blur-sm" />
          <motion.div initial={{ opacity: 0, scale: 0.95, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: -20 }} transition={{ type: "spring", duration: 0.5 }} className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden relative z-10">
            <div className="flex items-center p-4 border-b border-zinc-100 dark:border-zinc-800">
              <Search className="text-zinc-400 mr-3" size={20} />
              <input ref={inputRef} type="text" placeholder="搜索文章..." className="w-full bg-transparent outline-none text-xl text-ink dark:text-white placeholder:text-zinc-400 font-serif" value={query} onChange={(e) => setQuery(e.target.value)} />
              <button onClick={onClose} className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded">
                <X size={20} className="text-zinc-400" />
              </button>
            </div>
            
            <div className="max-h-[60vh] overflow-y-auto">
              {results.length > 0 ? (
                <div className="p-2">
                   {results.map((post) => (
                     <div key={post.id} onClick={() => handleSelect(post.id)} className="p-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 rounded-xl cursor-pointer group transition-colors">
                       <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-accent px-1.5 py-0.5 border border-accent/20 rounded-md bg-accent/5">{post.category}</span>
                       </div>
                       <h4 className="text-lg font-serif font-semibold text-ink dark:text-gray-100 group-hover:text-accent dark:group-hover:text-accent-light transition-colors">{post.title}</h4>
                       <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-1">{post.excerpt}</p>
                     </div>
                   ))}
                </div>
              ) : query ? (
                <div className="p-12 text-center text-zinc-400"><p>未找到关于 "{query}" 的内容</p></div>
              ) : (
                <div className="p-12 text-center text-zinc-400"><p className="text-sm font-medium">输入关键词开始搜索...</p></div>
              )}
            </div>
            
            <div className="p-3 bg-zinc-50 dark:bg-zinc-950/50 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-xs text-zinc-400">
               <span>按标题、标签或分类搜索</span>
               <div className="flex items-center gap-2">
                 <kbd className="px-2 py-0.5 rounded bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-mono">esc</kbd>
                 <span>关闭</span>
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

    const applyTheme = (t: Theme) => {
      if (t === 'dark' || (t === 'system' && systemQuery.matches)) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme(theme);
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
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('system');
    else setTheme('light');
  };

  return (
    <button onClick={toggleTheme} className="p-2.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-ink dark:text-amber-300 hover:ring-2 ring-accent/20 transition-all duration-300 relative group" aria-label="Toggle Theme">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={theme} initial={{ y: -10, opacity: 0, rotate: -45 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ y: 10, opacity: 0, rotate: 45 }} transition={{ duration: 0.2 }}>
          {theme === 'light' && <Sun size={18} />}
          {theme === 'dark' && <Moon size={18} />}
          {theme === 'system' && <Monitor size={18} className="text-zinc-500 dark:text-zinc-400" />}
        </motion.div>
      </AnimatePresence>
      <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
        {theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System'}
      </span>
    </button>
  );
};

const Navbar = ({ onSearchClick }: { onSearchClick: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsOpen(false);
  }, [location]);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-lg bg-paper/80 dark:bg-void/80 border-b border-zinc-200/50 dark:border-zinc-800/50 transition-all duration-500 supports-[backdrop-filter]:bg-paper/60">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link to="/" className="flex items-center space-x-3 group z-50">
          <div className="relative">
             <div className="absolute inset-0 bg-accent blur-md opacity-20 group-hover:opacity-40 transition-opacity"></div>
             <img src={siteConfig.logo} alt="Logo" className="relative w-10 h-10 rounded-lg group-hover:scale-105 transition-transform duration-300 object-cover bg-white/10" />
          </div>
          <span className="font-serif font-bold text-2xl tracking-tight text-ink dark:text-white">{siteConfig.title}</span>
        </Link>

        <div className="hidden md:flex items-center space-x-8">
          <div className="flex space-x-6 mr-4">
             {[
               { path: '/', label: '文章' },
               { path: '/friends', label: '友链' },
               { path: '/about', label: '关于' }
             ].map((item) => (
                <Link key={item.path} to={item.path} className="relative px-2 py-1 text-sm font-semibold uppercase tracking-wider text-zinc-500 hover:text-ink dark:text-zinc-400 dark:hover:text-white transition-colors">
                  {item.label}
                  {location.pathname === item.path && <motion.div layoutId="nav-underline" className="absolute -bottom-1 left-0 right-0 h-0.5 bg-accent" />}
                </Link>
             ))}
          </div>

          <div className="flex items-center space-x-3 pl-6 border-l border-zinc-300 dark:border-zinc-700">
            <button onClick={onSearchClick} className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-accent dark:hover:text-accent-light transition-colors group">
              <Search size={16} />
              <span className="text-xs font-medium opacity-70 group-hover:opacity-100">Ctrl+K</span>
            </button>
            <ThemeToggle />
          </div>
        </div>

        <div className="flex md:hidden items-center space-x-4">
          <button onClick={onSearchClick} className="p-2 text-zinc-600 dark:text-zinc-300 active:scale-95 transition-transform"><Search size={22} /></button>
          <button onClick={() => setIsOpen(!isOpen)} className="p-2 text-ink dark:text-white z-50 active:scale-95 transition-transform">{isOpen ? <X size={24} /> : <Menu size={24} />}</button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: '100vh' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.3, ease: "easeInOut" }} className="fixed inset-0 top-0 bg-paper/95 dark:bg-void/95 backdrop-blur-xl pt-24 px-6 md:hidden z-40 overflow-hidden">
            <div className="flex flex-col space-y-8 items-center text-center">
              <Link onClick={() => setIsOpen(false)} to="/" className="text-4xl font-serif font-bold text-ink dark:text-white hover:text-accent transition-colors">文章</Link>
              <Link onClick={() => setIsOpen(false)} to="/friends" className="text-4xl font-serif font-bold text-ink dark:text-white hover:text-accent transition-colors">友链</Link>
              <Link onClick={() => setIsOpen(false)} to="/about" className="text-4xl font-serif font-bold text-ink dark:text-white hover:text-accent transition-colors">关于</Link>
              <div className="w-12 h-px bg-zinc-200 dark:bg-zinc-800 my-4" />
              <div className="flex items-center gap-4">
                <span className="text-lg font-medium text-zinc-500">外观</span>
                <ThemeToggle />
              </div>
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
           setLoadTime((timing / 1000).toFixed(2) + 's');
        }
     }, 0);
  }, []);

  const technologies = [
    { name: 'React 19', icon: Code2 },
    { name: 'Vite', icon: Zap },
    { name: 'Tailwind', icon: Box },
    { name: 'Framer Motion', icon: Layers },
    { name: 'TypeScript', icon: Code2 },
    { name: 'React Router', icon: GitBranch },
  ];

  return (
    <footer className="py-12 mt-32 border-t border-zinc-200 dark:border-zinc-800 bg-paper dark:bg-void relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-30"></div>
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
            <div className="flex flex-col items-center md:items-start space-y-4">
                <div>
                   <span className="font-serif font-bold text-xl text-ink dark:text-white tracking-tight">{siteConfig.title}</span>
                   <p className="text-zinc-500 text-sm mt-1">{siteConfig.subtitle}</p>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed text-center md:text-left">{siteConfig.description}</p>
                 <div className="flex items-center gap-4 pt-2">
                   <a href={siteConfig.social.github} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-white hover:bg-black dark:hover:bg-accent transition-all duration-300"><Github size={18} /></a>
                   <a href={siteConfig.social.email} className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:text-white hover:bg-black dark:hover:bg-accent transition-all duration-300"><Mail size={18} /></a>
                </div>
            </div>

            <div className="flex flex-col items-center md:items-start">
               <h4 className="font-bold text-sm uppercase tracking-widest text-zinc-400 mb-6">Tech Stack</h4>
               <div className="flex flex-wrap gap-2 justify-center md:justify-start max-w-xs">
                  {technologies.map(tech => (
                     <div key={tech.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-600 dark:text-zinc-400 hover:border-accent/30 transition-colors">
                        <tech.icon size={12} className="text-accent" />
                        {tech.name}
                     </div>
                  ))}
               </div>
            </div>

            <div className="flex flex-col items-center md:items-end">
               <h4 className="font-bold text-sm uppercase tracking-widest text-zinc-400 mb-6">Status</h4>
               <div className="flex flex-col gap-4 w-full">
                  <div className="flex items-center justify-center md:justify-end gap-2 text-xs font-bold text-zinc-500">
                     <span className="relative flex h-2 w-2">
                       <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                       <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                     </span>
                     <span>All Systems Normal</span>
                  </div>
                  {loadTime && (
                     <div className="flex items-center justify-center md:justify-end gap-2 text-xs text-zinc-400">
                        <Zap size={14} className="text-yellow-500" />
                        <span>Page loaded in <span className="text-accent font-mono font-bold">{loadTime}</span></span>
                     </div>
                  )}
                  <div className="flex items-center justify-center md:justify-end gap-2 text-xs text-zinc-400">
                     <Coffee size={14} className="text-amber-700 dark:text-amber-600" />
                     <span>Fueled by Coffee & Code</span>
                  </div>
               </div>
            </div>
        </div>

        <div className="w-full flex flex-col md:flex-row justify-between items-center pt-8 border-t border-zinc-200/50 dark:border-zinc-800/50 text-xs text-zinc-400 font-medium">
           <p>{siteConfig.footerText} ｜ {siteConfig.author.name}</p>
           <div className="flex items-center gap-6 mt-4 md:mt-0">
               <a href={siteConfig.beian.url} target="_blank" rel="noopener noreferrer" className="hover:text-accent transition-colors">{siteConfig.beian.text}</a>
               <span className="flex items-center gap-1">Made with <Heart size={10} className="text-accent fill-accent" /> by {siteConfig.author.name}</span>
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

  return (
    <motion.div className="fixed top-0 left-0 right-0 h-1 bg-accent z-[100] origin-left" style={{ scaleX }} />
  );
};

const Background = () => {
  return (
    <div className="fixed inset-0 z-[-1] overflow-hidden pointer-events-none">
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-zinc-200/40 dark:bg-zinc-800/20 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-overlay animate-float"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-zinc-300/40 dark:bg-zinc-800/20 rounded-full blur-[120px] mix-blend-multiply dark:mix-blend-overlay animate-float" style={{ animationDelay: '2s' }}></div>
    </div>
  );
};

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
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
    <div className="min-h-screen flex flex-col relative selection:bg-accent selection:text-white">
      <ScrollProgress key={location.pathname} />
      <Background />
      <Navbar onSearchClick={() => setIsSearchOpen(true)} />
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <main className="flex-grow pt-32 px-4 sm:px-6 relative">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </main>
      <BackToTop />
      <Footer />
    </div>
  );
};