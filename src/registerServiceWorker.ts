export const registerServiceWorker = () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const register = () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // 静默失败，避免生产环境输出无用日志
    });
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(register, { timeout: 2000 });
    return;
  }

  window.setTimeout(register, 1200);
};

