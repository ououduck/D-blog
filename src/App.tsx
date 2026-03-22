import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AnimatePresence, motion } from 'framer-motion';
import { Layout } from './components/Layout';
import { siteConfig } from '@config/site.config';

const Home = lazy(() => import('./pages/Home').then((module) => ({ default: module.Home })));
const Post = lazy(() => import('./pages/Post').then((module) => ({ default: module.Post })));
const About = lazy(() => import('./pages/About').then((module) => ({ default: module.About })));
const ArchivePage = lazy(() => import('./pages/Archive').then((module) => ({ default: module.ArchivePage })));
const Stats = lazy(() => import('./pages/Stats').then((module) => ({ default: module.Stats })));
const Friends = lazy(() => import('./pages/Friends').then((module) => ({ default: module.Friends })));
const Tags = lazy(() => import('./pages/Tags').then((module) => ({ default: module.Tags })));
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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 1 }} className="mt-6 animate-pulse text-[10px] font-light uppercase tracking-[0.6em]">
          LOADING
        </motion.div>
      </div>
    </motion.div>
  );
};

const RouteFallback: React.FC = () => (
  <div className="mx-auto flex min-h-[40vh] max-w-7xl items-center justify-center px-4 text-sm text-zinc-500 dark:text-zinc-400">
    页面加载中...
  </div>
);

const AppRoutes: React.FC = () => {
  const location = useLocation();
  const routeKey = location.pathname;

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

  useEffect(() => {
    if (!showLoadingScreen) {
      return;
    }

    const timer = window.setTimeout(() => {
      sessionStorage.setItem('hasVisited', 'true');
      setShowLoadingScreen(false);
    }, 900);

    return () => {
      window.clearTimeout(timer);
    };
  }, [showLoadingScreen]);

  return (
    <HelmetProvider>
      <Router>
        <AppRoutes />
        <AnimatePresence>{showLoadingScreen && <LoadingScreen />}</AnimatePresence>
      </Router>
    </HelmetProvider>
  );
};

export default App;
