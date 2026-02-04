import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Post } from './pages/Post';
import { About } from './pages/About';
import { siteConfig } from './site.config';

// --- Ultra Minimalist High-End Loader ---
const LoadingScreen = ({ onComplete }: { onComplete: () => void }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const duration = 1500; 
    const intervalTime = 20;
    const steps = duration / intervalTime;
    let currentStep = 0;

    const timer = setInterval(() => {
      currentStep++;
      const progress = Math.min(Math.round(Math.pow(currentStep / steps, 0.5) * 100), 100);
      setCount(progress);

      if (currentStep >= steps) {
        clearInterval(timer);
        setTimeout(onComplete, 400);
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [onComplete]);

  const letterVariants = {
    initial: { y: 100 },
    animate: (i: number) => ({
      y: 0,
      transition: { 
        duration: 0.8, 
        ease: [0.33, 1, 0.68, 1], 
        delay: 0.1 + i * 0.05 
      }
    })
  };

  return (
    <motion.div
      className="fixed inset-0 z-[100] bg-ink dark:bg-black text-white flex flex-col items-center justify-center overflow-hidden"
      exit={{ 
        clipPath: 'inset(0 0 100% 0)',
        transition: { duration: 0.8, ease: [0.76, 0, 0.24, 1] }
      }}
    >
      {/* Centered Brand Reveal */}
      <div className="relative flex flex-col items-center">
        <div className="flex overflow-hidden pb-2">
          {"D-blog".split("").map((char, i) => (
            <motion.span
              key={i}
              custom={i}
              variants={letterVariants}
              initial="initial"
              animate="animate"
              className="text-6xl md:text-8xl font-serif font-bold tracking-tighter"
            >
              {char}
            </motion.span>
          ))}
        </div>

        {/* Minimalist Progress Line */}
        <div className="w-48 md:w-64 h-[1px] bg-white/10 mt-6 relative overflow-hidden">
          <motion.div 
            className="absolute inset-y-0 left-0 bg-accent"
            initial={{ width: 0 }}
            animate={{ width: `${count}%` }}
            transition={{ ease: "linear" }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 1 }}
          className="mt-6 text-[10px] tracking-[0.6em] uppercase font-sans font-light"
        >
          {siteConfig.subtitle}
        </motion.div>
      </div>

      {/* Numerical Counter - Bottom Right */}
      <div className="absolute bottom-12 right-12 md:bottom-16 md:right-16 overflow-hidden">
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="flex items-baseline gap-2"
        >
          <span className="text-4xl md:text-6xl font-sans font-bold tabular-nums tracking-tighter">
            {count.toString().padStart(2, '0')}
          </span>
          <span className="text-sm opacity-30 font-sans tracking-widest uppercase">Index</span>
        </motion.div>
      </div>

      {/* Fine-grained noise texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.03] mix-blend-screen bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>
    </motion.div>
  );
};

// --- Animated Routes Wrapper ---
const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/post/:id" element={<Post />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </AnimatePresence>
  );
};

const App: React.FC = () => {
  const [loading, setLoading] = useState(true);

  return (
    <Router>
      <AnimatePresence>
        {loading && <LoadingScreen onComplete={() => setLoading(false)} />}
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
