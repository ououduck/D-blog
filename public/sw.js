const SW_VERSION = 'dblog-v8';
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
const FAVORITES_PATH = 'favorites';
const SPA_ROUTE_PATTERNS = [
  /^\/post(?:\/|$)/,
  /^\/(?:archive|tags|stats|friends|about|cover|watermark|sponsor|favorites)(?:\/|$)/,
  /^\/$/
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

const getFavoriteUrls = () => {
  const rootUrl = getRootUrl();
  return [new URL(FAVORITES_PATH, rootUrl).href, ...getCoreAssetUrls()];
};

const isSameOrigin = (url) => new URL(url, self.location.href).origin === self.location.origin;

const isWithinScope = (url) => {
  const candidate = new URL(url, self.location.href);
  const scope = getRootUrl();
  return candidate.origin === scope.origin && candidate.pathname.startsWith(scope.pathname);
};

const getScopedPath = (url) => {
  const candidate = new URL(url, self.location.href);
  const scopePath = getRootUrl().pathname;
  const relativePath = candidate.pathname.slice(scopePath.length);
  return `/${relativePath}`.replace(/\/+/g, '/');
};

const isSpaRoute = (url) => isWithinScope(url)
  && SPA_ROUTE_PATTERNS.some((pattern) => pattern.test(getScopedPath(url)));

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

  try {
    const manifestUrl = new URL('offline-post-assets.json', getRootUrl()).href;
    const manifestResponse = await fetch(manifestUrl);
    const manifest = await manifestResponse.json();
    if (manifestResponse.ok && Array.isArray(manifest?.assets)) {
      const assets = await caches.open(ASSET_CACHE);
      await Promise.all([
        assets.put(manifestUrl, manifestResponse.clone()),
        ...manifest.assets.map((url) => cacheUrl(assets, url, getRootUrl()))
      ]);
    }
  } catch {
    // Route chunks are refreshed when an article is explicitly saved offline.
  }

  try {
    const pages = await caches.open(PAGE_CACHE);
    const favoriteUrl = getFavoriteUrls()[0];
    const response = await fetch(favoriteUrl);
    await cacheSuccessfulResponse(pages, favoriteUrl, response);
  } catch {
    // The favorites route is optional during installation.
  }
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
    return;
  }

  if (event.data?.type === 'CACHE_OFFLINE_POST') {
    const replyPort = event.ports?.[0];
    const task = cacheOfflinePost(event.data)
      .then(() => replyPort?.postMessage({ ok: true }))
      .catch((error) => replyPort?.postMessage({
        ok: false,
        error: error instanceof Error ? error.message : '离线缓存准备失败。'
      }));
    event.waitUntil(task);
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
      const rootUrl = getRootUrl();
      if (isSpaRoute(request.url)) {
        const appShell = await caches.match(rootUrl.href);
        if (appShell) {
          return appShell;
        }
      }
      const offlineUrl = new URL('offline.html', rootUrl).href;
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

const cacheUrl = async (cache, value, rootUrl) => {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value, rootUrl);
    if (!isSameOrigin(url.href) || !isWithinScope(url.href)) return false;
    const response = await fetch(url.href);
    if (!isSuccessfulSameOriginResponse({ url: url.href }, response)) return false;
    await cache.put(url.href, response.clone());
    return true;
  } catch {
    return false;
  }
};

const cacheOfflinePost = async ({ pageUrl, assetUrls }) => {
  const rootUrl = getRootUrl();
  const page = new URL(pageUrl, rootUrl);
  if (!isSpaRoute(page.href) || !getScopedPath(page.href).startsWith('/post/')) {
    throw new Error('离线文章地址无效。');
  }

  const pages = await caches.open(PAGE_CACHE);
  const assets = await caches.open(ASSET_CACHE);
  const shellResponse = await fetch(rootUrl.href);
  if (!isSuccessfulSameOriginResponse({ url: rootUrl.href }, shellResponse)) {
    throw new Error('无法缓存应用页面。');
  }

  const shellHtml = await shellResponse.clone().text();
  const shellAssetUrls = [...shellHtml.matchAll(/<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi)]
    .flatMap((match) => {
      try {
        const url = new URL(match[1], rootUrl);
        return isWithinScope(url.href) ? [url.href] : [];
      } catch {
        return [];
      }
    });
  let postRuntimeUrls = [];
  try {
    const manifestUrl = new URL('offline-post-assets.json', rootUrl);
    const manifestResponse = await fetch(manifestUrl.href);
    const manifest = await manifestResponse.json();
    if (!manifestResponse.ok || !Array.isArray(manifest?.assets)) {
      throw new Error('离线文章资源清单无效。');
    }
    postRuntimeUrls = [manifestUrl.href, ...manifest.assets.map((url) => new URL(url, rootUrl).href)];
  } catch {
    throw new Error('无法读取离线文章资源清单，请刷新页面后重试。');
  }
  const urls = [...new Set([
    ...shellAssetUrls,
    ...postRuntimeUrls,
    ...(Array.isArray(assetUrls) ? assetUrls : [])
  ])];
  const cacheResults = await Promise.all(urls.map((url) => cacheUrl(assets, url, rootUrl)));
  if (cacheResults.some((cached) => !cached)) {
    throw new Error('部分离线资源缓存失败，请检查网络后重试。');
  }

  await Promise.all([
    pages.put(page.href, shellResponse.clone()),
    caches.open(CORE_CACHE).then((cache) => cache.put(rootUrl.href, shellResponse.clone()))
  ]);
};

const cacheUrls = async (urls) => {
  let cache;
  try {
    cache = await caches.open(ASSET_CACHE);
  } catch {
    return;
  }
  const rootUrl = getRootUrl();

  await Promise.all(urls.map((value) => cacheUrl(cache, value, rootUrl)));
};
