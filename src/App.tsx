import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AnimatePresence, motion } from 'framer-motion';
import { Layout } from './components/Layout';
import { siteConfig } from '@config/site.config';
import { preloadPostSearch, preloadPosts } from './services/posts';

const loadHome = () => import('./pages/Home').then((module) => ({ default: module.Home }));
const loadPost = () => import('./pages/Post').then((module) => ({ default: module.Post }));
const loadAbout = () => import('./pages/About').then((module) => ({ default: module.About }));
const loadArchive = () => import('./pages/Archive').then((module) => ({ default: module.ArchivePage }));
const loadStats = () => import('./pages/Stats').then((module) => ({ default: module.Stats }));
const loadFriends = () => import('./pages/Friends').then((module) => ({ default: module.Friends }));
const loadTags = () => import('./pages/Tags').then((module) => ({ default: module.Tags }));

const Home = React.lazy(loadHome);
const Post = React.lazy(loadPost);
const About = React.lazy(loadAbout);
const ArchivePage = React.lazy(loadArchive);
const Stats = React.lazy(loadStats);
const Friends = React.lazy(loadFriends);
const Tags = React.lazy(loadTags);

const LoadingScreen = () => {
  const letterVariants = {
    initial: { y: 100, opacity: 0 },
    animate: (index: number) => ({
      y: 0,
      opacity: 1,
      transition: { duration: 0.6, ease: [0.33, 1, 0.68, 1], delay: 0.08 + index * 0.04 }
    })
  };

  return (
    <motion.div
      className="pointer-events-none fixed inset-0 z-[90] flex items-center justify-center overflow-hidden bg-ink/92 text-white backdrop-blur-sm dark:bg-black/92"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.45, ease: 'easeOut' } }}
      aria-hidden="true"
    >
      <div className="relative flex flex-col items-center">
        <div className="flex overflow-hidden pb-2">
          {siteConfig.title.split('').map((char, index) => (
            <motion.span key={`${char}-${index}`} custom={index} variants={letterVariants} initial="initial" animate="animate" className="font-serif text-5xl font-bold tracking-tighter md:text-7xl">
              {char}
            </motion.span>
          ))}
        </div>
        <motion.div initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ delay: 0.45, duration: 0.5 }} className="relative mt-5 h-[2px] w-44 overflow-hidden rounded-full bg-zinc-700 md:w-60">
          <motion.div className="absolute inset-y-0 left-0 w-full bg-accent" initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }} />
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.72 }} transition={{ delay: 0.6 }} className="mt-5 text-[10px] font-light uppercase tracking-[0.55em]">
          Loading
        </motion.div>
      </div>
    </motion.div>
  );
};

const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
  </div>
);

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<PageLoader />}>
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Home />} />
          <Route path="/post/:id" element={<Post />} />
          <Route path="/archive" element={<ArchivePage />} />
          <Route path="/tags" element={<Tags />} />
          <Route path="/stats" element={<Stats />} />
          <Route path="/friends" element={<Friends />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </Suspense>
    </AnimatePresence>
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

  useEffect(() => {
    const warmUp = () => {
      void preloadPosts();
      void preloadPostSearch();
      void loadPost();
      void loadArchive();
      void loadTags();
      void loadStats();
      void loadFriends();
      void loadAbout();
    };

    if (typeof window === 'undefined') {
      return;
    }

    if ('requestIdleCallback' in window) {
      const idleId = window.requestIdleCallback(warmUp, { timeout: 1500 });
      return () => {
        window.cancelIdleCallback(idleId);
      };
    }

    const fallbackTimer = window.setTimeout(warmUp, 1200);
    return () => {
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  return (
    <HelmetProvider>
      <Router>
        <Layout>
          <AnimatedRoutes />
        </Layout>
        <AnimatePresence>{showLoadingScreen && <LoadingScreen />}</AnimatePresence>
      </Router>
    </HelmetProvider>
  );
};

export default App;
