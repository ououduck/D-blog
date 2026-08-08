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
  const [promptElement, setPromptElement] = useState<HTMLDivElement | null>(null);

  useEffect(() => subscribeToServiceWorker(setState), []);

  useEffect(() => {
    if (state.status === 'update-available') {
      setDismissed(false);
    }
  }, [state.status]);

  useEffect(() => {
    const root = document.documentElement;

    if (!promptElement) {
      root.style.removeProperty('--service-worker-prompt-height');
      return;
    }

    const syncPromptHeight = () => {
      const promptHeight = promptElement.getBoundingClientRect().height + 16;
      root.style.setProperty('--service-worker-prompt-height', `${promptHeight}px`);
    };

    syncPromptHeight();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncPromptHeight);
    observer?.observe(promptElement);

    return () => {
      observer?.disconnect();
      root.style.removeProperty('--service-worker-prompt-height');
    };
  }, [promptElement]);

  if (state.status !== 'update-available' || dismissed) {
    return null;
  }

  return (
    <div
      ref={setPromptElement}
      role="status"
      aria-live="polite"
      className="service-worker-prompt-bottom fixed left-4 right-4 z-[120] mx-auto flex max-w-lg flex-col gap-3 rounded-control border border-zinc-300 bg-paper p-4 text-sm text-ink shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="font-semibold">发现新版本，刷新后即可使用最新功能。</span>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="editorial-button px-3"
        >
          稍后
        </button>
        <button
          type="button"
          onClick={() => applyServiceWorkerUpdate()}
          className="editorial-button-primary px-3"
        >
          立即更新
        </button>
      </div>
    </div>
  );
};
