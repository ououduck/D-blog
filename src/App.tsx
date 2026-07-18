import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AnimatePresence, motion, type Variants } from 'framer-motion';
import { flushSync } from 'react-dom';
import { Layout } from './components/Layout';
import { siteConfig } from '@config/site.config';
import { pageLoaders } from './utils/preload';

const Home = lazy(pageLoaders['/']);
const Post = lazy(() => import('./pages/Post').then((m) => ({ default: m.Post })));
const About = lazy(pageLoaders['/about']);
const ArchivePage = lazy(pageLoaders['/archive']);
const Stats = lazy(pageLoaders['/stats']);
const Friends = lazy(pageLoaders['/friends']);
const Tags = lazy(pageLoaders['/tags']);
const CoverGenerator = lazy(pageLoaders['/cover']);
const Sponsor = lazy(pageLoaders['/sponsor']);
const NotFound = lazy(() => import('./pages/NotFound').then((m) => ({ default: m.NotFound })));
const CookieNotice = lazy(() => import('./components/CookieNotice').then((m) => ({ default: m.CookieNotice })));

const LoadingScreen: React.FC = () => {
  const letterVariants: Variants = {
    initial: { y: 100 },
    animate: (index: number) => ({
      y: 0,
      transition: { duration: 0.8, ease: [0.33, 1, 0.68, 1], delay: 0.1 + index * 0.05 }
    })
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-ink text-white dark:bg-black"
      exit={{ clipPath: 'circle(0% at 50% 50%)', transition: { duration: 0.7, ease: [0.76, 0, 0.24, 1] } }}
      aria-hidden="true"
    >
      <div className="relative flex flex-col items-center">
        <div className="flex overflow-hidden pb-2">
          {siteConfig.title.split('').map((char, index) => (
            <motion.span key={`${char}-${index}`} custom={index} variants={letterVariants} initial="initial" animate="animate" className="font-serif text-6xl font-bold tracking-tighter md:text-8xl">
              {char}
            </motion.span>
          ))}
        </div>
        <motion.div initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ delay: 0.8, duration: 0.8 }} className="relative mt-6 h-[2px] w-48 overflow-hidden rounded-full bg-zinc-800 md:w-64">
          <motion.div className="absolute inset-y-0 left-0 w-full bg-zinc-100" initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }} />
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 1, duration: 0.6 }} className="mt-6 text-[10px] font-light uppercase tracking-[0.6em]">
          LOADING
        </motion.div>
      </div>
    </motion.div>
  );
};

const RouteFallback: React.FC = () => (
  <div className="mx-auto flex min-h-[50vh] max-w-7xl items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-500 dark:border-zinc-700 dark:border-t-zinc-400" />
    </div>
  </div>
);

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.error('App Error:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">页面加载出错</h1>
            <p className="mb-6 text-zinc-600 dark:text-zinc-400">抱歉，页面发生了意外错误，请刷新重试。</p>
            <button
              onClick={() => window.location.reload()}
              className="border border-zinc-950 bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AppRoutes: React.FC = () => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const hasViewTransition = typeof document !== 'undefined' && 'startViewTransition' in document;

  useEffect(() => {
    if (location.pathname === displayLocation.pathname && location.search === displayLocation.search) {
      return;
    }

    if (location.pathname === displayLocation.pathname) {
      setDisplayLocation(location);
      return;
    }

    if (hasViewTransition) {
      (document as Document & { startViewTransition?: (callback: () => void) => void }).startViewTransition?.(() => {
        flushSync(() => {
          setDisplayLocation(location);
        });
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      });
      return;
    }

    setDisplayLocation(location);
  }, [location, displayLocation.pathname, displayLocation.search, hasViewTransition]);

  return (
    <Layout hasViewTransition={hasViewTransition}>
      <Suspense fallback={<RouteFallback />}>
        <Routes location={displayLocation} key={displayLocation.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/post/:id" element={<Post />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/tags" element={<Tags />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/about" element={<About />} />
          <Route path="/cover" element={<CoverGenerator />} />
          <Route path="/sponsor" element={<Sponsor />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
};

const App: React.FC = () => {
  const [showLoadingScreen, setShowLoadingScreen] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    return sessionStorage.getItem('hasVisited') !== 'true';
  });

  const [showCookieNotice, setShowCookieNotice] = useState(false);

  useEffect(() => {
    if (!showLoadingScreen) {
      const timer = window.setTimeout(() => {
        setShowCookieNotice(true);
      }, 2000);
      return () => window.clearTimeout(timer);
    }

    const timer = window.setTimeout(() => {
      sessionStorage.setItem('hasVisited', 'true');
      setShowLoadingScreen(false);
      setShowCookieNotice(true);
    }, 900);

    return () => {
      window.clearTimeout(timer);
    };
  }, [showLoadingScreen]);

  return (
    <HelmetProvider>
      <ErrorBoundary>
        <Router>
          <AppRoutes />
          <AnimatePresence>{showLoadingScreen && <LoadingScreen />}</AnimatePresence>
          {showCookieNotice && (
            <Suspense fallback={null}>
              <CookieNotice />
            </Suspense>
          )}
        </Router>
      </ErrorBoundary>
    </HelmetProvider>
  );
};

export default App;
