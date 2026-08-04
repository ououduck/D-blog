import type { Post, PostMetadata } from '../types';
import { assetUrl } from '@/utils/siteUrl';

export const OFFLINE_POSTS_DB_NAME = 'd-blog-offline-posts';
export const OFFLINE_POSTS_DB_VERSION = 1;
export const OFFLINE_POSTS_STORE_NAME = 'posts';
export const OFFLINE_POSTS_SCHEMA = 'd-blog-offline-post';
export const OFFLINE_POSTS_SCHEMA_VERSION = 1;
export const OFFLINE_POSTS_STORAGE_KEY = 'd-blog-offline-posts-v1';
export const OFFLINE_POSTS_SYNC_KEY = `${OFFLINE_POSTS_STORAGE_KEY}:sync`;
export const OFFLINE_POSTS_EVENT_NAME = 'd-blog:offline-posts-change';
export const OFFLINE_POSTS_CHANNEL_NAME = 'd-blog-offline-posts';

export type OfflinePost = PostMetadata & {
  savedAt: number;
  schema: typeof OFFLINE_POSTS_SCHEMA;
  version: typeof OFFLINE_POSTS_SCHEMA_VERSION;
  content?: string;
};

export type OfflinePostInput = PostMetadata | Post;
export type OfflinePostsListener = () => void;

type UnknownRecord = Record<string, unknown>;

const OFFLINE_ASSET_CACHE_NAME = 'dblog-v5-assets';
const EXTERNAL_URL_PATTERN = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

const toOfflineAssetUrl = (value: string, postId: string): string | undefined => {
  const clean = value.trim().replace(/^<|>$/g, '').replace(/[?#].*$/, '');
  if (!clean || EXTERNAL_URL_PATTERN.test(clean)) {
    return undefined;
  }

  if (clean.startsWith('/posts-img/')) {
    return assetUrl(clean);
  }

  if (clean.startsWith('posts-img/')) {
    return assetUrl(`/${clean}`);
  }

  if (clean.startsWith('/')) {
    return assetUrl(clean);
  }

  return assetUrl(`/posts-img/${postId}/${clean.replace(/^\.\/?/, '')}`);
};

const collectOfflineAssetUrls = (post: OfflinePost): string[] => {
  const values = [post.coverImage || ''];
  if (post.content) {
    const markdownImagePattern = /!\[[^\]]*\]\(\s*<?([^\s)>]+)[^)]*\)/g;
    const htmlImagePattern = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = markdownImagePattern.exec(post.content)) !== null) {
      values.push(match[1]);
    }
    while ((match = htmlImagePattern.exec(post.content)) !== null) {
      values.push(match[1]);
    }
  }

  return [...new Set(values
    .map((value) => toOfflineAssetUrl(value, post.id))
    .filter((value): value is string => Boolean(value)))];
};

const cacheOfflineAssets = async (post: OfflinePost): Promise<void> => {
  const urls = collectOfflineAssetUrls(post);
  if (urls.length === 0 || typeof window === 'undefined') {
    return;
  }

  try {
    const worker = navigator.serviceWorker?.controller;
    worker?.postMessage({ type: 'CACHE_URLS', urls });
    if (worker) {
      return;
    }
  } catch {
    // Fall through to the Cache API when the worker is unavailable.
  }

  try {
    if (!('caches' in window)) {
      return;
    }
    const cache = await window.caches.open(OFFLINE_ASSET_CACHE_NAME);
    await Promise.all(urls.map(async (url) => {
      try {
        const response = await fetch(url, { credentials: 'same-origin' });
        if (response.ok && new URL(response.url || url, window.location.href).origin === window.location.origin) {
          await cache.put(url, response.clone());
        }
      } catch {
        // Individual image failures must not fail the article save.
      }
    }));
  } catch {
    // Offline asset caching is best effort.
  }
};

type OfflinePostsChange = {
  action: 'save' | 'remove';
  id?: string;
  timestamp: number;
};

let databasePromise: Promise<IDBDatabase> | null = null;
let indexedDbDisabled = false;
let syncListenersInitialized = false;
let broadcastChannel: BroadcastChannel | null = null;
const listeners = new Set<OfflinePostsListener>();

const isRecord = (value: unknown): value is UnknownRecord => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const isFiniteNumber = (value: unknown): value is number => (
  typeof value === 'number' && Number.isFinite(value)
);

const isNonNegativeTimestamp = (value: unknown): value is number => (
  isFiniteNumber(value) && Number.isInteger(value) && value >= 0
);

const cloneAuthors = (value: unknown): PostMetadata['authors'] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!Array.isArray(value)) {
    return undefined;
  }

  const authors = value.map((author) => {
    if (!isRecord(author) || typeof author.name !== 'string' || !author.name.trim()) {
      return undefined;
    }

    return {
      name: author.name,
      ...(typeof author.avatar === 'string' ? { avatar: author.avatar } : {}),
      ...(typeof author.role === 'string' ? { role: author.role } : {}),
      ...(typeof author.bio === 'string' ? { bio: author.bio } : {}),
      ...(typeof author.url === 'string' ? { url: author.url } : {})
    };
  });

  return authors.every((author) => Boolean(author))
    ? authors as NonNullable<PostMetadata['authors']>
    : undefined;
};

const cloneImageDimensions = (value: unknown): PostMetadata['imageDimensions'] | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (!isRecord(value)) {
    return undefined;
  }

  const dimensions: NonNullable<PostMetadata['imageDimensions']> = {};
  for (const [key, item] of Object.entries(value)) {
    if (!key || !isRecord(item) || !isFiniteNumber(item.width) || !isFiniteNumber(item.height)) {
      return undefined;
    }
    dimensions[key] = { width: item.width, height: item.height };
  }
  return dimensions;
};

/** Validate and clone untrusted data from IndexedDB/localStorage. */
const validateOfflinePost = (value: unknown): OfflinePost | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  if (
    typeof value.id !== 'string' || !value.id.trim()
    || typeof value.title !== 'string' || !value.title.trim()
    || typeof value.excerpt !== 'string'
    || typeof value.date !== 'string' || !value.date.trim()
    || typeof value.category !== 'string' || !value.category.trim()
    || typeof value.filePath !== 'string' || !value.filePath.trim()
    || typeof value.readTime !== 'string' || !value.readTime.trim()
    || !Array.isArray(value.tags)
    || !value.tags.every((tag) => typeof tag === 'string')
    || !isNonNegativeTimestamp(value.savedAt)
    || value.schema !== OFFLINE_POSTS_SCHEMA
    || value.version !== OFFLINE_POSTS_SCHEMA_VERSION
    || (value.searchText !== undefined && typeof value.searchText !== 'string')
    || (value.updatedAt !== undefined && typeof value.updatedAt !== 'string')
    || (value.coverImage !== undefined && typeof value.coverImage !== 'string')
    || (value.coverWidth !== undefined && !isFiniteNumber(value.coverWidth))
    || (value.coverHeight !== undefined && !isFiniteNumber(value.coverHeight))
    || (value.featured !== undefined && typeof value.featured !== 'boolean')
    || (value['featured-top'] !== undefined && !isFiniteNumber(value['featured-top']))
    || (value.series !== undefined && typeof value.series !== 'boolean')
    || (value.seriesName !== undefined && typeof value.seriesName !== 'string')
    || (value.seriesOrder !== undefined && (!isFiniteNumber(value.seriesOrder) || !Number.isInteger(value.seriesOrder)))
    || (value.content !== undefined && typeof value.content !== 'string')
  ) {
    return undefined;
  }

  const authors = cloneAuthors(value.authors);
  const imageDimensions = cloneImageDimensions(value.imageDimensions);
  if ((value.authors !== undefined && !authors) || (value.imageDimensions !== undefined && !imageDimensions)) {
    return undefined;
  }

  return {
    id: value.id,
    title: value.title,
    excerpt: value.excerpt,
    date: value.date,
    ...(typeof value.updatedAt === 'string' ? { updatedAt: value.updatedAt } : {}),
    ...(authors ? { authors } : {}),
    tags: [...value.tags],
    category: value.category,
    filePath: value.filePath,
    ...(typeof value.searchText === 'string' ? { searchText: value.searchText } : {}),
    ...(typeof value.coverImage === 'string' ? { coverImage: value.coverImage } : {}),
    ...(isFiniteNumber(value.coverWidth) ? { coverWidth: value.coverWidth } : {}),
    ...(isFiniteNumber(value.coverHeight) ? { coverHeight: value.coverHeight } : {}),
    ...(imageDimensions ? { imageDimensions } : {}),
    readTime: value.readTime,
    ...(typeof value.featured === 'boolean' ? { featured: value.featured } : {}),
    ...(isFiniteNumber(value['featured-top']) ? { 'featured-top': value['featured-top'] } : {}),
    ...(value.series === true && typeof value.seriesName === 'string' && isFiniteNumber(value.seriesOrder) ? { series: true, seriesName: value.seriesName, seriesOrder: value.seriesOrder } : {}),
    ...(typeof value.content === 'string' ? { content: value.content } : {}),
    savedAt: value.savedAt,
    schema: OFFLINE_POSTS_SCHEMA,
    version: OFFLINE_POSTS_SCHEMA_VERSION
  };
};

const createOfflinePost = (post: OfflinePostInput): OfflinePost => {
  if (!isRecord(post)) {
    throw new Error('无法保存无效的离线文章。');
  }

  const candidate = {
    ...post,
    savedAt: Date.now(),
    schema: OFFLINE_POSTS_SCHEMA,
    version: OFFLINE_POSTS_SCHEMA_VERSION
  };
  const validated = validateOfflinePost(candidate);
  if (!validated) {
    throw new Error('无法保存无效的离线文章。');
  }
  return validated;
};

const openDatabase = (): Promise<IDBDatabase> => {
  if (databasePromise) {
    return databasePromise;
  }
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('当前浏览器不支持 IndexedDB。'));
  }

  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(OFFLINE_POSTS_DB_NAME, OFFLINE_POSTS_DB_VERSION);
    } catch (error) {
      reject(error instanceof Error ? error : new Error('无法打开离线文章数据库。'));
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      const transaction = request.transaction;
      if (!transaction) {
        throw new Error('无法升级离线文章数据库。');
      }

      const store = database.objectStoreNames.contains(OFFLINE_POSTS_STORE_NAME)
        ? transaction.objectStore(OFFLINE_POSTS_STORE_NAME)
        : database.createObjectStore(OFFLINE_POSTS_STORE_NAME, { keyPath: 'id' });

      if (store.keyPath !== 'id') {
        throw new Error('离线文章数据库结构无效。');
      }
      if (!store.indexNames.contains('savedAt')) {
        store.createIndex('savedAt', 'savedAt', { unique: false });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => {
        database.close();
        databasePromise = null;
      };
      resolve(database);
    };
    request.onerror = () => reject(request.error || new Error('无法打开离线文章数据库。'));
    request.onblocked = () => reject(new Error('离线文章数据库被其他页面占用。'));
  }).catch((error) => {
    databasePromise = null;
    throw error instanceof Error ? error : new Error('无法打开离线文章数据库。');
  });

  return databasePromise;
};

const runTransaction = <T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | undefined> => openDatabase().then((database) => new Promise<T | undefined>((resolve, reject) => {
  let transaction: IDBTransaction;
  let result: T | undefined;
  let settled = false;

  const rejectOnce = (error: unknown, fallback: string) => {
    if (settled) {
      return;
    }
    settled = true;
    reject(error instanceof Error ? error : new Error(fallback));
  };

  try {
    transaction = database.transaction(OFFLINE_POSTS_STORE_NAME, mode);
    const request = operation(transaction.objectStore(OFFLINE_POSTS_STORE_NAME));
    request.onsuccess = () => {
      result = request.result;
    };
    request.onerror = () => rejectOnce(request.error, '离线文章请求失败。');
    transaction.oncomplete = () => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    transaction.onerror = () => rejectOnce(transaction.error, '离线文章事务失败。');
    transaction.onabort = () => rejectOnce(transaction.error, '离线文章事务已中止。');
  } catch (error) {
    rejectOnce(error, '离线文章事务失败。');
  }
}));

const readIndexedDbPost = async (id: string): Promise<OfflinePost | undefined> => {
  const result = await runTransaction<unknown>('readonly', (store) => store.get(id));
  return validateOfflinePost(result);
};

const readIndexedDbPosts = async (): Promise<OfflinePost[]> => {
  const result = await runTransaction<unknown[]>('readonly', (store) => store.getAll());
  return (Array.isArray(result) ? result : [])
    .map(validateOfflinePost)
    .filter((post): post is OfflinePost => Boolean(post))
    .sort((a, b) => b.savedAt - a.savedAt);
};

const writeIndexedDbPost = async (post: OfflinePost): Promise<void> => {
  await runTransaction('readwrite', (store) => store.put(post));
};

const removeIndexedDbPost = async (id: string): Promise<void> => {
  await runTransaction('readwrite', (store) => store.delete(id));
};

const readFallbackPosts = (): OfflinePost[] => {
  try {
    if (typeof localStorage === 'undefined') {
      return [];
    }
    const raw = localStorage.getItem(OFFLINE_POSTS_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map(validateOfflinePost)
      .filter((post): post is OfflinePost => Boolean(post))
      .sort((a, b) => b.savedAt - a.savedAt);
  } catch {
    return [];
  }
};

const writeFallbackPosts = (posts: OfflinePost[]): void => {
  try {
    if (typeof localStorage === 'undefined') {
      throw new Error('当前浏览器不支持本地存储。');
    }
    localStorage.setItem(OFFLINE_POSTS_STORAGE_KEY, JSON.stringify(posts));
  } catch (error) {
    throw error instanceof Error ? error : new Error('无法写入本地离线文章。');
  }
};

const useFallback = () => {
  indexedDbDisabled = true;
  databasePromise = null;
};

const notifyListeners = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // One subscriber must not prevent other tabs/components from syncing.
    }
  });
};

const emitChange = (action: OfflinePostsChange['action'], id?: string) => {
  const detail: OfflinePostsChange = { action, ...(id ? { id } : {}), timestamp: Date.now() };
  if (typeof window === 'undefined') {
    notifyListeners();
    return;
  }

  ensureSyncListeners();
  let notifiedByEvent = false;
  try {
    if (typeof window.CustomEvent === 'function') {
      window.dispatchEvent(new CustomEvent(OFFLINE_POSTS_EVENT_NAME, { detail }));
      notifiedByEvent = true;
    }
  } catch {
    // Fall through to the direct notification below.
  }
  if (!notifiedByEvent) {
    notifyListeners();
  }

  try {
    window.localStorage.setItem(OFFLINE_POSTS_SYNC_KEY, JSON.stringify(detail));
  } catch {
    // BroadcastChannel and the same-tab event are still useful when storage is blocked.
  }

  try {
    broadcastChannel?.postMessage(detail);
  } catch {
    // Synchronization is best effort; the write itself has completed.
  }
};

const handleStorageEvent = (event: StorageEvent) => {
  if (event.key === OFFLINE_POSTS_SYNC_KEY) {
    notifyListeners();
  }
};

const ensureSyncListeners = () => {
  if (syncListenersInitialized || typeof window === 'undefined') {
    return;
  }
  syncListenersInitialized = true;
  window.addEventListener(OFFLINE_POSTS_EVENT_NAME, notifyListeners);
  window.addEventListener('storage', handleStorageEvent);

  if ('BroadcastChannel' in window) {
    try {
      broadcastChannel = new BroadcastChannel(OFFLINE_POSTS_CHANNEL_NAME);
      broadcastChannel.onmessage = notifyListeners;
    } catch {
      broadcastChannel = null;
    }
  }
};

export const subscribeOfflinePosts = (listener: OfflinePostsListener): (() => void) => {
  ensureSyncListeners();
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getOfflinePost = async (id: string): Promise<OfflinePost | undefined> => {
  if (typeof id !== 'string' || !id.trim()) {
    return undefined;
  }
  if (!indexedDbDisabled) {
    try {
      return await readIndexedDbPost(id);
    } catch {
      useFallback();
    }
  }
  return readFallbackPosts().find((post) => post.id === id);
};

export const getOfflinePosts = async (): Promise<OfflinePost[]> => {
  if (!indexedDbDisabled) {
    try {
      return await readIndexedDbPosts();
    } catch {
      useFallback();
    }
  }
  return readFallbackPosts();
};

export const saveOfflinePost = async (post: OfflinePostInput): Promise<OfflinePost> => {
  const offlinePost = createOfflinePost(post);
  if (!indexedDbDisabled) {
    try {
      await writeIndexedDbPost(offlinePost);
      emitChange('save', offlinePost.id);
      void cacheOfflineAssets(offlinePost);
      return offlinePost;
    } catch {
      useFallback();
    }
  }

  const posts = readFallbackPosts().filter((savedPost) => savedPost.id !== offlinePost.id);
  writeFallbackPosts([...posts, offlinePost]);
  emitChange('save', offlinePost.id);
  void cacheOfflineAssets(offlinePost);
  return offlinePost;
};

export const removeOfflinePost = async (id: string): Promise<void> => {
  if (typeof id !== 'string' || !id.trim()) {
    return;
  }
  if (!indexedDbDisabled) {
    try {
      await removeIndexedDbPost(id);
      emitChange('remove', id);
      return;
    } catch {
      useFallback();
    }
  }

  const posts = readFallbackPosts();
  writeFallbackPosts(posts.filter((post) => post.id !== id));
  emitChange('remove', id);
};
