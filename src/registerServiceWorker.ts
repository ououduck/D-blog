const LEGACY_CACHE_PREFIXES = ['dblog-v'];

const clearLegacyCaches = async () => {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return;
  }

  try {
    const cacheKeys = await caches.keys();
    await Promise.all(
      cacheKeys
        .filter((key) => LEGACY_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix)))
        .map((key) => caches.delete(key))
    );
  } catch {
    // 静默失败，避免生产环境输出无用日志
  }
};

const unregisterLegacyServiceWorkers = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  } catch {
    // 静默失败，避免生产环境输出无用日志
  }
}

export const registerServiceWorker = () => {
  if (typeof window === 'undefined') {
    return;
  }

  const cleanup = () => {
    void Promise.allSettled([unregisterLegacyServiceWorkers(), clearLegacyCaches()]);
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(cleanup, { timeout: 2000 });
    return;
  }

  window.setTimeout(cleanup, 1200);
};

