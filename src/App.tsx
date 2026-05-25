import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AnimatePresence, motion } from 'framer-motion';
import { Layout } from './components/Layout';
import { DBlogLoader } from './components/DBlogLoader';
import { CookieNotice } from './components/CookieNotice';
import { siteConfig } from '@config/site.config';

const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })));
const Post = lazy(() => import('./pages/Post').then((module) => ({ default: module.Post })));
const About = lazy(() => import('./pages/About').then((module) => ({ default: module.About })));
const ArchivePage = lazy(() => import('./pages/Archive').then((module) => ({ default: module.ArchivePage })));
const Stats = lazy(() => import('./pages/Stats').then((module) => ({ default: module.Stats })));
const Friends = lazy(() => import('./pages/Friends').then((module) => ({ default: module.Friends })));
const Tags = lazy(() => import('./pages/Tags').then((module) => ({ default: module.Tags })));
const CoverGenerator = lazy(() => import('./pages/CoverGenerator').then((module) => ({ default: module.CoverGenerator })));
const Sponsor = lazy(() => import('./pages/Sponsor').then((module) => ({ default: module.Sponsor })));
const NotFound = lazy(() => import('./pages/NotFound').then((module) => ({ default: module.NotFound })));

const LoadingScreen: React.FC = () => {
  const letterVariants = {
    initial: { y: 100 },
    animate: (index: number) => ({
      y: 0,
      transition: { duration: 0.8, ease: [0.33, 1, 0.68, 1], delay: 0.1 + index * 0.05 }
    })
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-ink text-white dark:bg-black"
      exit={{ clipPath: 'inset(0 0 100% 0)', transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } }}
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
          <motion.div className="absolute inset-y-0 left-0 w-full bg-accent" initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }} />
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 1, duration: 0.6 }} className="mt-6 text-[10px] font-light uppercase tracking-[0.6em]">
          LOADING
        </motion.div>
      </div>
    </motion.div>
  );
};

const RouteFallback: React.FC = () => (
  <div className="mx-auto flex min-h-[40vh] max-w-7xl items-center justify-center px-4 text-sm text-zinc-500 dark:text-zinc-400">
    <div className="flex flex-col items-center gap-3">
      <DBlogLoader size="image" label="页面加载中" className="opacity-85" />
      <span className="text-[11px] uppercase tracking-[0.45em] text-zinc-400 dark:text-zinc-500">LOADING</span>
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
              className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
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
  const routeKey = location.pathname;

  useEffect(() => {
    document.title = siteConfig.title;
  }, [location.pathname]);

  return (
    <Layout>
      <Suspense fallback={<RouteFallback />}>
        <Routes location={location} key={routeKey}>
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
      return;
    }

    const timer = window.setTimeout(() => {
      sessionStorage.setItem('hasVisited', 'true');
      setShowLoadingScreen(false);
      // 加载动画结束后显示Cookie通知
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
          {showCookieNotice && <CookieNotice />}
        </Router>
      </ErrorBoundary>
    </HelmetProvider>
  );
};

export default App;
