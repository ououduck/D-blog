import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp } from 'lucide-react';

const MOBILE_OFFSET_STYLE = {
  right: 'max(1rem, calc(env(safe-area-inset-right) + 1rem))',
  bottom: 'max(1rem, calc(env(safe-area-inset-bottom) + 1rem))'
} as const;

export const BackToTop = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.scrollY > 300) {
        setIsVisible(true);
      } else {
        setIsVisible(false);
      }
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
          onClick={scrollToTop}
          style={MOBILE_OFFSET_STYLE}
          className="fixed z-40 rounded-full border border-zinc-200/80 bg-white/94 p-3 text-ink shadow-[0_18px_40px_-26px_rgba(28,25,23,0.3)] backdrop-blur-xl transition-all duration-300 hover:scale-110 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/94 dark:text-white dark:hover:bg-zinc-700 md:bottom-8 md:right-8 group"
          aria-label="Back to Top"
        >
          <ArrowUp size={20} className="transition-transform group-hover:-translate-y-1" />
        </motion.button>
      )}
    </AnimatePresence>
  );
};
