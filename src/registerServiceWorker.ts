export const registerServiceWorker = () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const cleanupLegacyServiceWorker = async () => {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    } catch {
      // ignore
    }

    if ('caches' in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => key.startsWith('dblog-v')).map((key) => caches.delete(key)));
      } catch {
        // ignore
      }
    }
  };

  window.addEventListener('load', () => {
    void cleanupLegacyServiceWorker();
  });
};
