import React, { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { useReadingMode } from '@/components/ReadingModeContext';

const READING_MODE_TOGGLE_STYLE = {
  bottom: 'max(calc(var(--cookie-notice-height, 0px) + env(safe-area-inset-bottom, 0px) + 13rem), calc(var(--cookie-notice-height, 0px) + 13rem))'
} as const;

export const ReadingModeToggle: React.FC = () => {
  const { isReadingMode, toggleReadingMode } = useReadingMode();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient || isReadingMode) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={toggleReadingMode}
      style={READING_MODE_TOGGLE_STYLE}
      className="reading-mode-floating-toggle fixed-control-position print-hidden fixed z-floating inline-flex h-11 items-center justify-center gap-2 rounded-control border border-zinc-900 bg-zinc-900 px-3.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 focus-visible:ring-2 focus-visible:ring-zinc-400 active:scale-[0.98] dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300 dark:focus-visible:outline-zinc-100"
      aria-label="进入专注阅读"
    >
      <Eye size={17} aria-hidden="true" />
      <span>专注阅读</span>
    </button>
  );
};
