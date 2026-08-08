import React, { useEffect, useRef, useState } from 'react';

export const OfflineStatus: React.FC = () => {
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  const [showRecovered, setShowRecovered] = useState(false);

  const recoveredTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const handleOffline = () => {
      setShowRecovered(false);
      setIsOffline(true);
    };
    const handleOnline = () => {
      setIsOffline(false);
      setShowRecovered(true);
      if (recoveredTimerRef.current !== null) {
        window.clearTimeout(recoveredTimerRef.current);
      }
      recoveredTimerRef.current = window.setTimeout(() => {
        recoveredTimerRef.current = null;
        setShowRecovered(false);
      }, 2400);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (recoveredTimerRef.current !== null) {
        window.clearTimeout(recoveredTimerRef.current);
      }
    };
  }, []);

  if (!isOffline && !showRecovered) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 top-[max(calc(env(safe-area-inset-top,0px)+4.25rem),4.25rem)] z-[120] mx-auto max-w-md rounded-control border border-zinc-300 bg-paper px-4 py-3 text-center text-sm font-semibold text-ink shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 sm:top-[max(calc(env(safe-area-inset-top,0px)+4.75rem),4.75rem)]"
    >
      {isOffline ? '当前处于离线模式，已收藏文章仍可继续阅读。' : '网络已恢复。'}
    </div>
  );
};
