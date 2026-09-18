/**
 * Service Worker 新版本提示条：检测到更新时提示「立即更新/稍后」，并同步底部悬浮控件的高度变量。
 * 「稍后」在时间窗内抑制重复提示；更新失败显示错误反馈；其他标签页收到
 * 广播后显示轻量「内容已更新」提示（不自动刷新，避免打断用户）。
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  applyServiceWorkerUpdate,
  consumeReloadScrollRestore,
  getServiceWorkerState,
  subscribeToUpdateApplied,
  subscribeToServiceWorker,
  type ServiceWorkerState,
} from '@/registerServiceWorker';

/** 「稍后」后的重复提示抑制窗口（毫秒）。 */
const DISMISS_SUPPRESS_MS = 60 * 60 * 1000;
const DISMISS_STORAGE_KEY = 'dblog:sw-prompt-dismissed-at';

const isDismissSuppressed = (): boolean => {
  try {
    const raw = sessionStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const dismissedAt = Number.parseInt(raw, 10);
    if (!Number.isFinite(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_SUPPRESS_MS;
  } catch {
    return false;
  }
};

const markDismissed = () => {
  try {
    sessionStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
  } catch {
    // 存储不可用时仅失去抑制能力，不影响提示逻辑。
  }
};

export const ServiceWorkerUpdatePrompt: React.FC = () => {
  const [state, setState] = useState<ServiceWorkerState>(() => getServiceWorkerState());
  const [dismissed, setDismissed] = useState(false);
  const [otherTabUpdated, setOtherTabUpdated] = useState(false);
  const [promptElement, setPromptElement] = useState<HTMLDivElement | null>(null);
  const updatedToastTimerRef = useRef<number | null>(null);

  useEffect(() => subscribeToServiceWorker(setState), []);

  // 更新重载后恢复阅读位置（一次性消费 sessionStorage 中的记录）。
  useEffect(() => {
    consumeReloadScrollRestore();
  }, []);

  useEffect(() => {
    if (state.status === 'update-available') {
      // 「稍后」抑制窗口内的重复提示不再弹出（例如页面切换后重新触发检测）。
      setDismissed(isDismissSuppressed());
    }
  }, [state.status]);

  // 其他标签页应用了更新：显示轻量提示条，由用户决定是否刷新。
  useEffect(() => {
    const unsubscribe = subscribeToUpdateApplied(() => {
      setOtherTabUpdated(true);
      if (updatedToastTimerRef.current !== null) {
        window.clearTimeout(updatedToastTimerRef.current);
      }
      // 长驻提示会遮挡底部控件；由用户操作或较长时间后自动收起。
      updatedToastTimerRef.current = window.setTimeout(() => setOtherTabUpdated(false), 15000);
    });
    return () => {
      unsubscribe();
      if (updatedToastTimerRef.current !== null) {
        window.clearTimeout(updatedToastTimerRef.current);
        updatedToastTimerRef.current = null;
      }
    };
  }, []);

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

  const handleDismiss = () => {
    markDismissed();
    setDismissed(true);
  };

  const handleRefreshFromOtherTabUpdate = () => {
    // 用户主动刷新：同样保存滚动位置，重载后恢复阅读位置。
    try {
      sessionStorage.setItem('dblog:sw-reload-scroll', String(Math.round(window.scrollY)));
    } catch {
      // 忽略：仅丢失位置恢复。
    }
    window.location.reload();
  };

  if (state.status === 'update-available' && !dismissed) {
    const failed = state.updateFailed === true;
    return (
      <div
        ref={setPromptElement}
        role="status"
        aria-live="polite"
        className="service-worker-prompt-bottom fixed left-4 right-4 z-[120] mx-auto flex max-w-lg flex-col gap-3 rounded-control border border-zinc-300 bg-paper p-4 text-sm text-ink shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 sm:flex-row sm:items-center sm:justify-between"
      >
        <span className="font-semibold">
          {failed ? '更新失败，网络恢复后可重试。' : '发现新版本，网站内容已更新。'}
        </span>
        <div className="flex shrink-0 gap-2">
          <button type="button" onClick={handleDismiss} className="editorial-button px-3">
            稍后
          </button>
          <button type="button" onClick={() => applyServiceWorkerUpdate()} className="editorial-button-primary px-3">
            立即更新
          </button>
        </div>
      </div>
    );
  }

  if (otherTabUpdated) {
    return (
      <div
        ref={setPromptElement}
        role="status"
        aria-live="polite"
        className="service-worker-prompt-bottom fixed left-4 right-4 z-[120] mx-auto flex max-w-lg items-center justify-between gap-3 rounded-control border border-zinc-300 bg-paper p-4 text-sm text-ink shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <span className="font-semibold">网站内容已在其他标签页更新。</span>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setOtherTabUpdated(false)}
            className="editorial-button px-3"
            aria-label="忽略更新提示"
          >
            知道了
          </button>
          <button type="button" onClick={handleRefreshFromOtherTabUpdate} className="editorial-button-primary px-3">
            刷新查看
          </button>
        </div>
      </div>
    );
  }

  return null;
};
