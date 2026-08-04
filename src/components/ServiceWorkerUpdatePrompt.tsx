import React, { useEffect, useState } from 'react';
import {
  applyServiceWorkerUpdate,
  getServiceWorkerState,
  subscribeToServiceWorker,
  type ServiceWorkerState
} from '@/registerServiceWorker';

export const ServiceWorkerUpdatePrompt: React.FC = () => {
  const [state, setState] = useState<ServiceWorkerState>(() => getServiceWorkerState());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => subscribeToServiceWorker(setState), []);

  useEffect(() => {
    if (state.status === 'update-available') {
      setDismissed(false);
    }
  }, [state.status]);

  if (state.status !== 'update-available' || dismissed) {
    return null;
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 right-4 z-[120] mx-auto flex max-w-lg flex-col gap-3 rounded-control border border-zinc-300 bg-paper/95 p-4 text-sm text-ink shadow-xl backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95 dark:text-zinc-100 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="font-semibold">发现新版本，刷新后即可使用最新功能。</span>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="min-h-10 rounded-control border border-zinc-300 px-3 py-2 font-semibold text-zinc-600 transition-colors hover:border-zinc-500 hover:text-ink dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:text-white"
        >
          稍后
        </button>
        <button
          type="button"
          onClick={() => applyServiceWorkerUpdate()}
          className="min-h-10 rounded-control bg-ink px-3 py-2 font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
        >
          立即更新
        </button>
      </div>
    </div>
  );
};
