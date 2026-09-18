/**
 * 离线状态提示条：监听 online/offline 事件，离线时提示当前处于离线模式，
 * 恢复网络后短暂显示「网络已恢复」。
 * 离线时提供「已缓存文章」入口：直接读取 Service Worker 的页面缓存
 * （Cache Storage，复用现有缓存不新增存储），列出可离线阅读的文章。
 */
import React, { useEffect, useRef, useState } from 'react';

interface CachedPostEntry {
  url: string;
  title: string;
}

const PAGE_CACHE_KEY_PATTERN = /^dblog-.*-pages$/;
const POST_PATH_PATTERN = /\/post\/[^/]+\/?$/;
/** 单次列表最多展示的缓存文章数（防止极端缓存体积撑爆提示条）。 */
const MAX_CACHED_POSTS = 30;

/** 最小 HTML 实体解码（SSG title 常见转义）。 */
const decodeEntities = (value: string) =>
  value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

/** 从缓存 HTML 的 <title> 提取文章标题（剥掉站点名后缀）。 */
const extractTitleFromHtml = (html: string): string => {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  if (!match) return '';
  const raw = decodeEntities(match[1]).trim();
  return raw.split(/\s*[|·-]\s*D-blog.*$/i)[0].trim();
};

const findPageCache = async (): Promise<Cache | null> => {
  if (typeof caches === 'undefined') {
    return null;
  }
  try {
    const keys = await caches.keys();
    const pageCacheKey = keys.find((key) => PAGE_CACHE_KEY_PATTERN.test(key));
    return pageCacheKey ? await caches.open(pageCacheKey) : null;
  } catch {
    return null;
  }
};

/** 列出页面缓存中的文章（本地读取，离线可用）；失败返回空数组。 */
const listCachedPosts = async (): Promise<CachedPostEntry[]> => {
  const cache = await findPageCache();
  if (!cache) {
    return [];
  }
  try {
    const requests = await cache.keys();
    const postRequests = requests.filter((request) => {
      try {
        return POST_PATH_PATTERN.test(new URL(request.url).pathname.replace(/\/+$/, '/'));
      } catch {
        return false;
      }
    });
    const entries = await Promise.all(
      postRequests.slice(0, MAX_CACHED_POSTS).map(async (request): Promise<CachedPostEntry> => {
        const { pathname, origin } = new URL(request.url);
        const slug = decodeURIComponent(pathname.split('/').filter(Boolean).pop() ?? '');
        let title = '';
        try {
          const response = await cache.match(request);
          const html = await response?.text();
          title = html ? extractTitleFromHtml(html) : '';
        } catch {
          // 单篇标题解析失败不影响列表：回退为 slug。
        }
        // 相对导航需兼容子路径部署：直接复用缓存里的绝对 URL。
        return { url: new URL(pathname, origin).href, title: title || slug };
      }),
    );
    return entries.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
  } catch {
    return [];
  }
};

export const OfflineStatus: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [showRecovered, setShowRecovered] = useState(false);
  const [showCachedList, setShowCachedList] = useState(false);
  const [cachedPosts, setCachedPosts] = useState<CachedPostEntry[] | null>(null);
  const recoveredTimerRef = useRef<number | null>(null);
  const loadRequestIdRef = useRef(0);

  useEffect(() => {
    // 水合后同步真实网络状态（SSR 首帧固定为在线，避免水合冲突）。
    setIsOffline(typeof navigator !== 'undefined' && !navigator.onLine);
    const handleOffline = () => {
      setShowRecovered(false);
      setIsOffline(true);
      // 断网时收起列表并清空旧数据：下次离线重新读取。
      setShowCachedList(false);
      setCachedPosts(null);
    };
    const handleOnline = () => {
      setIsOffline(false);
      setShowRecovered(true);
      setShowCachedList(false);
      if (recoveredTimerRef.current !== null) {
        window.clearTimeout(recoveredTimerRef.current);
      }
      recoveredTimerRef.current = window.setTimeout(() => {
        recoveredTimerRef.current = null;
        setShowRecovered(false);
      }, 2400);
    };

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      if (recoveredTimerRef.current !== null) {
        window.clearTimeout(recoveredTimerRef.current);
      }
      loadRequestIdRef.current += 1;
    };
  }, []);

  // 展开时懒加载缓存列表（只加载一次，收起不清空避免闪烁）。
  useEffect(() => {
    if (!isOffline || !showCachedList || cachedPosts !== null) {
      return;
    }
    const requestId = ++loadRequestIdRef.current;
    void listCachedPosts().then((entries) => {
      if (loadRequestIdRef.current === requestId) {
        setCachedPosts(entries);
      }
    });
  }, [isOffline, showCachedList, cachedPosts]);

  useEffect(() => {
    if (!showCachedList) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setShowCachedList(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showCachedList]);

  if (!isOffline && !showRecovered) {
    return null;
  }

  if (showRecovered) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-3 top-[max(calc(env(safe-area-inset-top,0px)+4.25rem),4.25rem)] z-[120] mx-auto max-w-md rounded-control border border-zinc-300 bg-paper px-4 py-3 text-center text-sm font-semibold text-ink shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 sm:top-[max(calc(env(safe-area-inset-top,0px)+4.75rem),4.75rem)]"
      >
        网络已恢复。
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 top-[max(calc(env(safe-area-inset-top,0px)+4.25rem),4.25rem)] z-[120] mx-auto max-w-md rounded-control border border-zinc-300 bg-paper px-4 py-3 text-center text-sm font-semibold text-ink shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 sm:top-[max(calc(env(safe-area-inset-top,0px)+4.75rem),4.75rem)]"
    >
      <p>当前处于离线模式，部分页面可能无法访问。</p>
      {(cachedPosts === null || cachedPosts.length > 0) && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowCachedList((value) => !value)}
            aria-expanded={showCachedList}
            aria-controls="cached-posts-list"
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-control border border-zinc-300 bg-paper px-3 py-1.5 text-xs font-semibold text-zinc-700 transition-colors hover:border-zinc-500 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100"
          >
            已缓存文章{cachedPosts !== null ? `（${cachedPosts.length}）` : ''}
          </button>
        </div>
      )}
      {showCachedList && (
        <nav
          id="cached-posts-list"
          aria-label="已缓存文章列表"
          className="mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-control border border-zinc-200 bg-zinc-50 p-2 text-left dark:border-zinc-800 dark:bg-zinc-950/60"
        >
          {cachedPosts === null ? (
            <p className="px-1 py-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">正在读取缓存…</p>
          ) : cachedPosts.length === 0 ? (
            <p className="px-1 py-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">暂无可离线阅读的文章缓存。</p>
          ) : (
            <ul className="space-y-0.5">
              {cachedPosts.map((post) => (
                <li key={post.url}>
                  <a
                    href={post.url}
                    className="block rounded-[6px] px-2 py-2 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:outline-zinc-100"
                  >
                    {post.title}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </nav>
      )}
    </div>
  );
};
