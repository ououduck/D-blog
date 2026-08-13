import type { Post, PostMetadata } from '../types';
import { assetUrl, routeUrl } from '@/utils/siteUrl';

export const OFFLINE_POSTS_DB_NAME = 'd-blog-offline-posts';
export const OFFLINE_POSTS_DB_VERSION = 2;
export const OFFLINE_POSTS_STORE_NAME = 'posts';
export const OFFLINE_POSTS_TOMBSTONE_STORE_NAME = 'tombstones';
export const OFFLINE_POSTS_SCHEMA = 'd-blog-offline-post';
export const OFFLINE_POSTS_SCHEMA_VERSION = 1;
export const OFFLINE_POSTS_STORAGE_KEY = 'd-blog-offline-posts-v1';
export const OFFLINE_POSTS_SYNC_KEY = `${OFFLINE_POSTS_STORAGE_KEY}:sync`;
export const OFFLINE_POSTS_TOMBSTONES_KEY = `${OFFLINE_POSTS_STORAGE_KEY}:tombstones`;
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
export type OfflinePostTombstones = Record<string, number>;

type UnknownRecord = Record<string, unknown>;
type OfflinePostTombstone = { id: string; deletedAt: number };

const EXTERNAL_URL_PATTERN = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;

const toOfflineAssetUrl = (value: string): string | undefined => {
  const clean = value.trim().replace(/^<|>$/g, '').replace(/[?#].*$/, '');
  if (!clean || EXTERNAL_URL_PATTERN.test(clean)) {
    return undefined;
  }

  // 站内绝对路径（/ 开头）可离线缓存；外链图床 URL 不缓存。
  if (clean.startsWith('/')) {
    return assetUrl(clean);
  }

  return undefined;
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

  const sourceUrls = values
    .map((value) => toOfflineAssetUrl(value))
    .filter((value): value is string => Boolean(value));

  return [...new Set(sourceUrls)];
};

const prepareOfflineCache = async (post: OfflinePost): Promise<void> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('当前浏览器不支持离线缓存。');
  }

  const worker = navigator.serviceWorker.controller
    ?? (await Promise.race([
      navigator.serviceWorker.ready.then((registration) => registration.active),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 8000))
    ]));
  if (!worker) {
    throw new Error('离线缓存尚未就绪，请刷新页面后重试。');
  }

  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timeout = window.setTimeout(() => {
      channel.port1.close();
      reject(new Error('离线缓存准备超时，请稍后重试。'));
    }, 15000);

    channel.port1.onmessage = (event: MessageEvent<unknown>) => {
      window.clearTimeout(timeout);
      channel.port1.close();
      if (isRecord(event.data) && event.data.ok === true) {
        resolve();
        return;
      }
      const message = isRecord(event.data) && typeof event.data.error === 'string'
        ? event.data.error
        : '离线缓存准备失败，请稍后重试。';
      reject(new Error(message));
    };

    worker.postMessage({
      type: 'CACHE_OFFLINE_POST',
      pageUrl: routeUrl(`/post/${encodeURIComponent(post.id)}`),
      assetUrls: collectOfflineAssetUrls(post)
    }, [channel.port2]);
  });
};

type OfflinePostsChange = {
  action: 'save' | 'remove';
  id?: string;
  timestamp: number;
};

let databasePromise: Promise<IDBDatabase> | null = null;
let activeDatabase: IDBDatabase | null = null;
let syncListenersInitialized = false;
let reconciliationPromise: Promise<void> | null = null;
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

/** 校验并克隆来自 IndexedDB/localStorage 的不可信数据。 */
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
      if (!database.objectStoreNames.contains(OFFLINE_POSTS_TOMBSTONE_STORE_NAME)) {
        database.createObjectStore(OFFLINE_POSTS_TOMBSTONE_STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      activeDatabase = database;
      const invalidateConnection = () => {
        if (activeDatabase === database) {
          activeDatabase = null;
          databasePromise = null;
        }
      };
      database.onversionchange = () => {
        database.close();
        invalidateConnection();
      };
      database.onclose = invalidateConnection;
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

const readIndexedDbPosts = async (): Promise<OfflinePost[]> => {
  const database = await openDatabase();
  const posts = await new Promise<OfflinePost[]>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(
        [OFFLINE_POSTS_STORE_NAME, OFFLINE_POSTS_TOMBSTONE_STORE_NAME],
        'readonly'
      );
      const postsRequest = transaction.objectStore(OFFLINE_POSTS_STORE_NAME).getAll();
      const tombstonesRequest = transaction.objectStore(OFFLINE_POSTS_TOMBSTONE_STORE_NAME).getAll();
      let rawPosts: unknown[] = [];
      let rawTombstones: unknown[] = [];
      postsRequest.onsuccess = () => { rawPosts = Array.isArray(postsRequest.result) ? postsRequest.result : []; };
      tombstonesRequest.onsuccess = () => { rawTombstones = Array.isArray(tombstonesRequest.result) ? tombstonesRequest.result : []; };
      transaction.oncomplete = () => {
        const tombstones = Object.fromEntries(rawTombstones
          .filter((value): value is OfflinePostTombstone => isRecord(value) && typeof value.id === 'string' && isNonNegativeTimestamp(value.deletedAt))
          .map((value) => [value.id, value.deletedAt]));
        resolve(applyTombstones(rawPosts
          .map(validateOfflinePost)
          .filter((post): post is OfflinePost => Boolean(post)), tombstones)
          .sort((a, b) => b.savedAt - a.savedAt));
      };
      transaction.onerror = () => reject(transaction.error || new Error('离线文章事务失败。'));
      transaction.onabort = () => reject(transaction.error || new Error('离线文章事务已中止。'));
    } catch (error) {
      reject(error);
    }
  });

  // 保留完整的最近已知快照：IndexedDB 短暂不可用时，降级日志不会被误当作完整集合。
  try {
    writeFallbackPosts(posts);
  } catch {
    // localStorage 不可用时 IndexedDB 仍是权威数据源。
  }
  return posts;
};

const runOfflineMutation = async (
  operation: (posts: IDBObjectStore, tombstones: IDBObjectStore) => void
): Promise<void> => {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(
        [OFFLINE_POSTS_STORE_NAME, OFFLINE_POSTS_TOMBSTONE_STORE_NAME],
        'readwrite'
      );
      operation(
        transaction.objectStore(OFFLINE_POSTS_STORE_NAME),
        transaction.objectStore(OFFLINE_POSTS_TOMBSTONE_STORE_NAME)
      );
    } catch (error) {
      if (activeDatabase === database) {
        activeDatabase = null;
        databasePromise = null;
      }
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error('离线文章事务失败。'));
    transaction.onabort = () => reject(transaction.error || new Error('离线文章事务已中止。'));
  });
};

const persistIndexedDbDelete = async (id: string, deletedAt: number): Promise<void> => {
  await runOfflineMutation((postsStore, tombstonesStore) => {
    const postRequest = postsStore.get(id);
    const tombstoneRequest = tombstonesStore.get(id);
    let currentPost: OfflinePost | undefined;
    let currentDeletedAt = -1;
    let completedRequests = 0;

    const commit = () => {
      completedRequests += 1;
      if (completedRequests < 2 || currentDeletedAt > deletedAt) return;
      if (!currentPost || currentPost.savedAt <= deletedAt) postsStore.delete(id);
      tombstonesStore.put({ id, deletedAt } satisfies OfflinePostTombstone);
    };
    postRequest.onsuccess = () => {
      currentPost = validateOfflinePost(postRequest.result);
      commit();
    };
    tombstoneRequest.onsuccess = () => {
      const value: unknown = tombstoneRequest.result;
      if (isRecord(value) && isNonNegativeTimestamp(value.deletedAt)) {
        currentDeletedAt = value.deletedAt;
      }
      commit();
    };
  });
};

/**
 * 尝试把文章写入 IndexedDB，但受墓碑保护：若存在不早于本次保存的新删除则拒绝。
 * 返回被拒时用于降级镜像写前检查的墓碑时间（newerDelete）。
 */
const saveIndexedDbPostIfCurrent = async (post: OfflinePost): Promise<{ accepted: boolean; newerDelete?: number }> => {
  const database = await openDatabase();
  return new Promise<{ accepted: boolean; newerDelete?: number }>((resolve, reject) => {
    let accepted = false;
    let newerDelete: number | undefined;
    let transaction: IDBTransaction;
    try {
      transaction = database.transaction(
        [OFFLINE_POSTS_STORE_NAME, OFFLINE_POSTS_TOMBSTONE_STORE_NAME],
        'readwrite'
      );
      const postsStore = transaction.objectStore(OFFLINE_POSTS_STORE_NAME);
      const tombstonesStore = transaction.objectStore(OFFLINE_POSTS_TOMBSTONE_STORE_NAME);
      const postRequest = postsStore.get(post.id);
      const tombstoneRequest = tombstonesStore.get(post.id);
      let currentPost: OfflinePost | undefined;
      let deletedAt = -1;
      let completedRequests = 0;

      const commit = () => {
        completedRequests += 1;
        if (completedRequests < 2) return;
        if (deletedAt >= post.savedAt) {
          // 拒绝：存在不早于本次保存的删除。把墓碑时间带回调用方，
          // 供降级镜像的写前检查使用（见 saveOfflinePost）。
          newerDelete = deletedAt;
          return;
        }

        accepted = true;
        if (!currentPost || post.savedAt >= currentPost.savedAt) {
          postsStore.put(post);
        }
        tombstonesStore.delete(post.id);
      };
      postRequest.onsuccess = () => {
        currentPost = validateOfflinePost(postRequest.result);
        commit();
      };
      tombstoneRequest.onsuccess = () => {
        const value: unknown = tombstoneRequest.result;
        if (isRecord(value) && isNonNegativeTimestamp(value.deletedAt)) {
          deletedAt = value.deletedAt;
        }
        commit();
      };
    } catch (error) {
      if (activeDatabase === database) {
        activeDatabase = null;
        databasePromise = null;
      }
      reject(error);
      return;
    }
    transaction.oncomplete = () => resolve({ accepted, ...(newerDelete !== undefined ? { newerDelete } : {}) });
    transaction.onerror = () => reject(transaction.error || new Error('离线文章事务失败。'));
    transaction.onabort = () => reject(transaction.error || new Error('离线文章事务已中止。'));
  });
};

const withFallbackLock = async <T>(operation: () => T | Promise<T>): Promise<T> => {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request(`${OFFLINE_POSTS_STORAGE_KEY}:lock`, operation);
  }
  return operation();
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
    return applyTombstones(parsed
      .map(validateOfflinePost)
      .filter((post): post is OfflinePost => Boolean(post)), readTombstones())
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

const readTombstones = (): OfflinePostTombstones => {
  try {
    if (typeof localStorage === 'undefined') return {};
    const parsed: unknown = JSON.parse(localStorage.getItem(OFFLINE_POSTS_TOMBSTONES_KEY) || '{}');
    if (!isRecord(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(([, value]) => isNonNegativeTimestamp(value)),
    ) as OfflinePostTombstones;
  } catch {
    return {};
  }
};

const writeTombstones = (tombstones: OfflinePostTombstones): void => {
  if (typeof localStorage === 'undefined') throw new Error('当前浏览器不支持本地存储。');
  localStorage.setItem(OFFLINE_POSTS_TOMBSTONES_KEY, JSON.stringify(tombstones));
};

const applyTombstones = (posts: OfflinePost[], tombstones: OfflinePostTombstones): OfflinePost[] => (
  posts.filter((post) => tombstones[post.id] === undefined || post.savedAt > tombstones[post.id])
);

const reconcileStores = async (): Promise<void> => {
  if (reconciliationPromise) return reconciliationPromise;
  reconciliationPromise = (async () => {
    const fallback = readFallbackPosts();
    const localTombstones = readTombstones();
    const fallbackById = new Map(fallback.map((post) => [post.id, post]));
    const ids = new Set([...fallbackById.keys(), ...Object.keys(localTombstones)]);

    await runOfflineMutation((postsStore, tombstonesStore) => {
      ids.forEach((id) => {
        const postRequest = postsStore.get(id);
        const tombstoneRequest = tombstonesStore.get(id);
        let currentPost: OfflinePost | undefined;
        let currentDeletedAt: number | undefined;
        let completedRequests = 0;

        const reconcileId = () => {
          completedRequests += 1;
          if (completedRequests < 2) return;

          const fallbackPost = fallbackById.get(id);
          const fallbackDeletedAt = localTombstones[id];
          const deletedAt = Math.max(currentDeletedAt ?? -1, fallbackDeletedAt ?? -1);
          const newestPost = [currentPost, fallbackPost]
            .filter((post): post is OfflinePost => Boolean(post))
            .sort((a, b) => b.savedAt - a.savedAt)[0];

          if (deletedAt >= (newestPost?.savedAt ?? -1)) {
            postsStore.delete(id);
            tombstonesStore.put({ id, deletedAt } satisfies OfflinePostTombstone);
          } else if (newestPost) {
            postsStore.put(newestPost);
            tombstonesStore.delete(id);
          }
        };

        postRequest.onsuccess = () => {
          currentPost = validateOfflinePost(postRequest.result);
          reconcileId();
        };
        tombstoneRequest.onsuccess = () => {
          const value: unknown = tombstoneRequest.result;
          if (isRecord(value) && isNonNegativeTimestamp(value.deletedAt)) {
            currentDeletedAt = value.deletedAt;
          }
          reconcileId();
        };
      });
    });

    try {
      // 保持降级副本为完整的最近已知镜像：IndexedDB 后续临时不可用时仍可读取。
      const currentTombstones = readTombstones();
      Object.entries(localTombstones).forEach(([id, deletedAt]) => {
        if (currentTombstones[id] === deletedAt) delete currentTombstones[id];
      });
      writeTombstones(currentTombstones);
    } catch {
      // localStorage 不可用时 IndexedDB 仍是权威数据源。
    }
  })().finally(() => { reconciliationPromise = null; });
  return reconciliationPromise;
};

const notifyListeners = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // 单个订阅者异常不得阻断其他标签页/组件的同步通知。
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
    // 降级：直接逐个通知下方订阅者。
  }
  if (!notifiedByEvent) {
    notifyListeners();
  }

  try {
    window.localStorage.setItem(OFFLINE_POSTS_SYNC_KEY, JSON.stringify(detail));
  } catch {
    // 存储被禁用时 BroadcastChannel 与同标签页事件仍可通知订阅者。
  }

  try {
    broadcastChannel?.postMessage(detail);
  } catch {
    // 同步通知为尽力而为；写入本身已完成。
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
  if (typeof id !== 'string' || !id.trim()) return undefined;
  try {
    await reconcileStores();
    return (await readIndexedDbPosts()).find((post) => post.id === id);
  } catch {
    return readFallbackPosts().find((post) => post.id === id);
  }
};

export const getOfflinePosts = async (): Promise<OfflinePost[]> => {
  try {
    await reconcileStores();
    return await readIndexedDbPosts();
  } catch {
    return readFallbackPosts();
  }
};

export const saveOfflinePost = async (post: OfflinePostInput): Promise<OfflinePost> => {
  const offlinePost = createOfflinePost(post);
  await prepareOfflineCache(offlinePost);
  let savedToIndexedDb = false;
  let rejectedByNewerDelete = false;
  let idbNewerDelete: number | undefined;
  try {
    await reconcileStores();
    const saveResult = await saveIndexedDbPostIfCurrent(offlinePost);
    savedToIndexedDb = saveResult.accepted;
    rejectedByNewerDelete = !saveResult.accepted;
    idbNewerDelete = saveResult.newerDelete;
  } catch {
    // 下次操作时重试 IndexedDB；localStorage 当前仍可用。
  }

  let newerDeleteToPersist: number | undefined;
  try {
    await withFallbackLock(() => {
      // 写降级镜像前同时检查 localStorage 与 IndexedDB 两处墓碑并取较新者：
      // reconcileStores 会把 localStorage 墓碑并入 IDB 后清掉本地副本，若只看
      // localStorage，并发保存/删除窗口内的删除决策会在此丢失，已删除文章会被
      // 重新写进降级镜像（跨标签页“复活”）。
      const tombstones = readTombstones();
      const newerDelete = Math.max(tombstones[offlinePost.id] ?? -1, idbNewerDelete ?? -1);
      if (newerDelete >= offlinePost.savedAt) {
        rejectedByNewerDelete = true;
        newerDeleteToPersist = newerDelete;
        tombstones[offlinePost.id] = newerDelete;
        writeTombstones(tombstones);
        return;
      }
      const fallbackPosts = readFallbackPosts()
        .filter((savedPost) => savedPost.id !== offlinePost.id);
      writeFallbackPosts([...fallbackPosts, offlinePost]);
      delete tombstones[offlinePost.id];
      writeTombstones(tombstones);
    });
  } catch (error) {
    if (!savedToIndexedDb) throw error;
  }
  if (newerDeleteToPersist !== undefined) {
    try { await persistIndexedDbDelete(offlinePost.id, newerDeleteToPersist); } catch { /* 降级墓碑记录仍然持久。 */ }
  }
  if (rejectedByNewerDelete) {
    throw new Error('文章已在其他页面取消收藏，请重新操作。');
  }
  emitChange('save', offlinePost.id);
  return offlinePost;
};

export const removeOfflinePost = async (id: string): Promise<void> => {
  if (typeof id !== 'string' || !id.trim()) return;
  const tombstones = readTombstones();
  const deletedAt = Math.max(tombstones[id] ?? -1, Date.now());
  tombstones[id] = deletedAt;
  let savedFallbackTombstone = false;
  try {
    writeTombstones(tombstones);
    savedFallbackTombstone = true;
  } catch {
    // localStorage 被禁用时 IndexedDB 仍可持久化删除操作。
  }

  let deletedFromIndexedDb = false;
  try {
    await persistIndexedDbDelete(id, deletedAt);
    deletedFromIndexedDb = true;
  } catch {
    if (!savedFallbackTombstone) {
      throw new Error('无法持久化收藏删除操作，请稍后重试。');
    }
  }

  try {
    await withFallbackLock(() => {
      const currentTombstones = readTombstones();
      currentTombstones[id] = Math.max(currentTombstones[id] ?? 0, deletedAt);
      writeTombstones(currentTombstones);
      writeFallbackPosts(readFallbackPosts().filter((post) => post.id !== id));
    });
  } catch {
    if (!deletedFromIndexedDb && !savedFallbackTombstone) {
      throw new Error('无法删除离线收藏。');
    }
  }
  emitChange('remove', id);
};
