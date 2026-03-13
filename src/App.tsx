import React, { useState, useEffect, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { HelmetProvider } from 'react-helmet-async';
import { AnimatePresence, motion } from 'framer-motion';
import { Layout } from './components/Layout';
import { siteConfig } from '@config/site.config';

// 路由懒加载
const Home = React.lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
const Post = React.lazy(() => import('./pages/Post').then(module => ({ default: module.Post })));
const About = React.lazy(() => import('./pages/About').then(module => ({ default: module.About })));
const ArchivePage = React.lazy(() => import('./pages/Archive').then(module => ({ default: module.ArchivePage })));
const Stats = React.lazy(() => import('./pages/Stats').then(module => ({ default: module.Stats })));
const Friends = React.lazy(() => import('./pages/Friends').then(module => ({ default: module.Friends })));
const Tags = React.lazy(() => import('./pages/Tags').then(module => ({ default: module.Tags })));

const LoadingScreen = () => {
  const letterVariants = {
    initial: { y: 100 },
    animate: (i: number) => ({
      y: 0,
      transition: { duration: 0.8, ease: [0.33, 1, 0.68, 1], delay: 0.1 + i * 0.05 }
    })
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-ink dark:bg-black text-white flex flex-col items-center justify-center overflow-hidden"
      exit={{ clipPath: 'inset(0 0 100% 0)', transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] } }}
    >
      <div className="relative flex flex-col items-center">
        <div className="flex overflow-hidden pb-2">
          {siteConfig.title.split("").map((char, i) => (
            <motion.span key={i} custom={i} variants={letterVariants} initial="initial" animate="animate" className="text-6xl md:text-8xl font-serif font-bold tracking-tighter">
              {char}
            </motion.span>
          ))}
        </div>
        <motion.div initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 1 }} transition={{ delay: 0.8, duration: 0.8 }} className="w-48 md:w-64 h-[2px] bg-zinc-800 mt-6 relative overflow-hidden rounded-full">
          <motion.div className="absolute inset-y-0 left-0 bg-accent w-full" initial={{ x: '-100%' }} animate={{ x: '100%' }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }} />
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 0.6 }} transition={{ delay: 1 }} className="mt-6 text-[10px] tracking-[0.6em] uppercase font-sans font-light animate-pulse">
          LOADING
        </motion.div>
      </div>
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-screen bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
    </motion.div>
  );
};

const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
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
  const [loading, setLoading] = useState(() => {
    const hasVisited = sessionStorage.getItem('hasVisited');
    return !hasVisited;
  });

  useEffect(() => {
    if (loading) {
      const finishLoading = () => {
        setLoading(false);
        sessionStorage.setItem('hasVisited', 'true');
      };

      const handleLoad = () => {
        // 减少人为延迟，从 800ms 降至 300ms
        setTimeout(finishLoading, 300);
      };

      // 减少后备超时时间
      const fallbackTimer = setTimeout(() => {
        finishLoading();
      }, 3000);

      if (document.readyState === 'complete') {
        handleLoad();
      } else {
        window.addEventListener('load', handleLoad);
      }

      return () => {
        window.removeEventListener('load', handleLoad);
        clearTimeout(fallbackTimer);
      };
    }
  }, [loading]);

  return (
    <HelmetProvider>
      <Router>
        <AnimatePresence>
          {loading && <LoadingScreen />}
        </AnimatePresence>

        {!loading && (
           <Layout>
              <AnimatedRoutes />
           </Layout>
        )}
      </Router>
    </HelmetProvider>
  );
};

export default App;
