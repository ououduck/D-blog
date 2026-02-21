import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Post } from './pages/Post';
import { About } from './pages/About';
import { Friends } from './pages/Friends';

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
          {"D-blog".split("").map((char, i) => (
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

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/post/:id" element={<Post />} />
        <Route path="/friends" element={<Friends />} />
        <Route path="/about" element={<About />} />
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
    </Router>
  );
};

export default App;
