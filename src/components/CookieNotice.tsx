import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

const COOKIE_CONSENT_KEY = 'cookie-consent';

export const CookieNotice: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const hasConsented = localStorage.getItem(COOKIE_CONSENT_KEY);
      if (!hasConsented) {
        setIsVisible(true);
      }
    } catch {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    setIsVisible(false);
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* 左侧标题和文字内容 */}
              <div className="flex flex-1 flex-col gap-2 pr-4 sm:flex-row sm:items-start sm:gap-4">
                {/* Cookie使用标题 */}
                <div className="flex-shrink-0">
                  <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Cookie 使用</span>
                </div>
                
                {/* 文字内容 */}
                <div className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  <p className="mb-1">
                    <span className="font-medium text-zinc-900 dark:text-zinc-100">我们尊重您的隐私。</span>
                  </p>
                  <p>
                    如果您继续访问 D-blog，为了帮助我们更好地改进网站，我们会使用 Umami、Cloudflare、MS Clarity 等项目对您在网站上的行为进行分析。如不同意，请您关闭 D-blog 以保护您的隐私。
                  </p>
                </div>
              </div>

              {/* 按钮组 */}
              <div className="flex w-full items-center gap-2 sm:w-auto sm:flex-shrink-0">
                <button
                  onClick={handleAccept}
                  className="flex-1 rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100 dark:focus:ring-white sm:flex-initial"
                >
                  同意
                </button>
                <button
                  onClick={handleClose}
                  className="flex items-center justify-center rounded-md p-2 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:ring-offset-2 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 dark:focus:ring-white"
                  aria-label="关闭"
                >
                  <X size={18} />
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
