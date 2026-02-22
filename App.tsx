import React, { useState, useEffect, lazy, Suspense } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Layout } from './components/Layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PerformanceMonitor } from './components/PerformanceMonitor';
import { siteConfig } from './site.config';

// 路由组件懒加载
const Home = lazy(() => import('./pages/Home'));
const Post = lazy(() => import('./pages/Post'));
const About = lazy(() => import('./pages/About'));
const Friends = lazy(() => import('./pages/Friends'));

// 初始加载屏幕
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

// 路由页面加载状态
const RouteLoading = () => (
  <div className="flex items-center justify-center min-h-[200px]">
    <div className="flex flex-col items-center">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">页面加载中...</p>
    </div>
  </div>
);

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route 
          path="/" 
          element={
            <ErrorBoundary>
              <Suspense fallback={<RouteLoading />}>
                <Home />
              </Suspense>
            </ErrorBoundary>
          } 
        />
        <Route 
          path="/post/:id" 
          element={
            <ErrorBoundary>
              <Suspense fallback={<RouteLoading />}>
                <Post />
              </Suspense>
            </ErrorBoundary>
          } 
        />
        <Route 
          path="/friends" 
          element={
            <ErrorBoundary>
              <Suspense fallback={<RouteLoading />}>
                <Friends />
              </Suspense>
            </ErrorBoundary>
          } 
        />
        <Route 
          path="/about" 
          element={
            <ErrorBoundary>
              <Suspense fallback={<RouteLoading />}>
                <About />
              </Suspense>
            </ErrorBoundary>
          } 
        />
      </Routes>
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
        setTimeout(finishLoading, 800); 
      };

      const fallbackTimer = setTimeout(() => {
        finishLoading();
      }, 7000);

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
    <Router>
      <AnimatePresence>
        {loading && <LoadingScreen />}
      </AnimatePresence>
      
      {!loading && (
         <Layout>
            <AnimatedRoutes />
         </Layout>
      )}
      
      {/* 开发环境性能监控 */}
      {import.meta.env.DEV && <PerformanceMonitor />}
    </Router>
  );
};

export default App;