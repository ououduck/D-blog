const SW_VERSION = 'dblog-v5';
const CORE_CACHE = `${SW_VERSION}-core`;
const PAGE_CACHE = `${SW_VERSION}-pages`;
const ASSET_CACHE = `${SW_VERSION}-assets`;
const CORE_ASSET_PATHS = [
  '',
  'favicon.ico',
  'pwa-192.png',
  'pwa-512.png',
  'manifest.webmanifest',
  'offline.html',
  'feed.xml',
];

const getRootUrl = () => {
  const rootUrl = new URL(self.registration.scope);
  if (!rootUrl.pathname.endsWith('/')) {
    rootUrl.pathname += '/';
  }
  rootUrl.search = '';
  rootUrl.hash = '';
  return rootUrl;
};

const getCoreAssetUrls = () => {
  const rootUrl = getRootUrl();
  return CORE_ASSET_PATHS.map((path) => new URL(path, rootUrl).href);
};

const isSameOrigin = (url) => new URL(url, self.location.href).origin === self.location.origin;

const isWithinScope = (url) => {
  const candidate = new URL(url, self.location.href);
  const scope = getRootUrl();
  return candidate.origin === scope.origin && candidate.pathname.startsWith(scope.pathname);
};

const isSuccessfulSameOriginResponse = (request, response) => {
  if (!response || !response.ok || !isSameOrigin(request.url)) {
    return false;
  }

  return isSameOrigin(response.url || request.url);
};

const cacheSuccessfulResponse = async (cache, request, response) => {
  if (isSuccessfulSameOriginResponse(request, response)) {
    try {
      await cache.put(request, response.clone());
    } catch {
      // Caching is best effort; never replace a successful network response.
    }
  }
  return response;
};

const cacheCoreAssets = async () => {
  let cache;
  try {
    cache = await caches.open(CORE_CACHE);
  } catch {
    // Cache Storage may be disabled; the worker can still serve the network.
    return;
  }

  await Promise.all(
    getCoreAssetUrls().map(async (url) => {
      try {
        const response = await fetch(url);
        await cacheSuccessfulResponse(cache, url, response);
      } catch {
        // A missing optional core asset must not prevent the worker installing.
      }
    }),
  );
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    cacheCoreAssets().then(() => {
      // Take control on the first install; leave later versions waiting for the user.
      if (!self.registration.active) {
        return self.skipWaiting();
      }
      return undefined;
    }),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('dblog-') && ![CORE_CACHE, PAGE_CACHE, ASSET_CACHE].includes(key))
          .map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  if (['audio', 'font', 'image', 'manifest', 'script', 'style', 'track', 'video', 'worker'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request, ASSET_CACHE));
    return;
  }

  event.respondWith(networkFirst(request, ASSET_CACHE));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
    return;
  }

  if (event.data?.type === 'CACHE_URLS' && Array.isArray(event.data.urls)) {
    event.waitUntil(cacheUrls(event.data.urls));
  }
});

const handleNavigationRequest = async (request) => {
  try {
    const response = await fetch(request);
    try {
      const cache = await caches.open(PAGE_CACHE);
      await cacheSuccessfulResponse(cache, request, response);
    } catch {
      // Cache Storage failures must not hide a successful navigation response.
    }
    return response;
  } catch {
    const cachedPage = await matchCachedPage(request);
    if (cachedPage) {
      return cachedPage;
    }

    try {
      const offlineUrl = new URL('offline.html', getRootUrl()).href;
      const offlineResponse = await caches.match(offlineUrl);
      return offlineResponse || Response.error();
    } catch {
      return Response.error();
    }
  }
};

const matchCachedPage = async (request) => {
  try {
    const cache = await caches.open(PAGE_CACHE);
    const directMatch = await cache.match(request);
    if (directMatch) {
      return directMatch;
    }

    const url = new URL(request.url);
    const normalizedPath = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
    return cache.match(new Request(`${url.origin}${normalizedPath}`, { method: 'GET' }));
  } catch {
    return undefined;
  }
};

const staleWhileRevalidate = async (request, cacheName) => {
  let cache;
  try {
    cache = await caches.open(cacheName);
  } catch {
    try {
      return await fetch(request);
    } catch {
      return Response.error();
    }
  }

  const cachedResponse = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => cacheSuccessfulResponse(cache, request, response))
    .catch(() => undefined);

  if (cachedResponse) {
    // Keep the response fast while allowing a later request to see fresh content.
    void networkPromise;
    return cachedResponse;
  }

  return (await networkPromise) || Response.error();
};

const networkFirst = async (request, cacheName) => {
  let cache;
  try {
    cache = await caches.open(cacheName);
  } catch {
    try {
      return await fetch(request);
    } catch {
      return (await caches.match(request)) || Response.error();
    }
  }

  try {
    const response = await fetch(request);
    return cacheSuccessfulResponse(cache, request, response);
  } catch {
    return (await cache.match(request)) || (await caches.match(request)) || Response.error();
  }
};

const cacheUrls = async (urls) => {
  let cache;
  try {
    cache = await caches.open(ASSET_CACHE);
  } catch {
    return;
  }
  const rootUrl = getRootUrl();

  await Promise.all(urls.map(async (value) => {
    if (typeof value !== 'string') {
      return;
    }

    try {
      const url = new URL(value, rootUrl);
      if (!isSameOrigin(url.href) || !isWithinScope(url.href)) {
        return;
      }

      const response = await fetch(url.href);
      await cacheSuccessfulResponse(cache, url.href, response);
    } catch {
      // Optional runtime caching is best effort.
    }
  }));
};
