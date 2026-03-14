import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AnimatePresence, motion } from 'framer-motion';
import { Layout } from './components/Layout';
import { siteConfig } from '@config/site.config';
import { preloadPostSearch, preloadPosts } from './services/posts';
import { Home } from './pages/Home';
import { Post } from './pages/Post';
import { About } from './pages/About';
import { ArchivePage } from './pages/Archive';
import { Stats } from './pages/Stats';
import { Friends } from './pages/Friends';
import { Tags } from './pages/Tags';

const LoadingScreen = () => {
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
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/post/:id" element={<Post />} />
            <Route path="/archive" element={<ArchivePage />} />
            <Route path="/tags" element={<Tags />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/friends" element={<Friends />} />
            <Route path="/about" element={<About />} />
          </Routes>
        </Layout>
        <AnimatePresence>{showLoadingScreen && <LoadingScreen />}</AnimatePresence>
      </Router>
    </HelmetProvider>
  );
};

export default App;
