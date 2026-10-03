/**
 * 离线状态提示条：离线时提示当前处于离线模式，恢复网络后短暂显示「网络已恢复」。
 * 离线由 offline 事件（或首帧 navigator.onLine）判定；恢复则除了 online 事件，
 * 还在 visibilitychange 与离线期间的定时复查里以 navigator.onLine + 一次真实请求兜底确认
 * ——事件可能整体丢失、系统级连通性判定也可能长期滞后，否则离线提示会永久停在页面上。
 * 离线时提供「已缓存文章」入口：直接读取 Service Worker 的页面缓存
 * （Cache Storage，复用现有缓存不新增存储），列出可离线阅读的文章。
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { assetUrl } from '@/utils/siteUrl';

interface CachedPostEntry {
  url: string;
  title: string;
}

const PAGE_CACHE_KEY_PATTERN = /^dblog-.*-pages$/;
const POST_PATH_PATTERN = /\/post\/[^/]+\/?$/;
/** 单次列表最多展示的缓存文章数（防止极端缓存体积撑爆提示条）。 */
const MAX_CACHED_POSTS = 30;
/** 「网络已恢复」提示的停留时长。 */
const RECOVERED_TOAST_MS = 2400;
/** 离线期间的状态复查间隔：事件整体丢失时兜底，避免提示条永久停留。 */
const OFFLINE_RECHECK_MS = 5000;
/** 连通性探测请求的超时（卡死的连接不能让探测悬着）。 */
const PROBE_TIMEOUT_MS = 4000;

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

/**
 * 真实连通性探测：`navigator.onLine` 取的是操作系统的连通性判定，
 * 系统级探测（如 Windows NCSI）失败或被墙时会长期停在 false，浏览器据此
 * 永不派发 online 事件——离线提示就会永久停留。这里用一次同源请求取证：
 * 拿到任何 HTTP 响应（含 404）即链路可用，断网则 fetch 直接 reject。
 * 探测地址取必然 404 的路径：404 不会被 Service Worker 写进缓存，不留垃圾。
 */
const probeConnectivity = async (): Promise<boolean> => {
  const controller = new AbortController();
  let timer = 0;
  try {
    timer = window.setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    await fetch(assetUrl(`connectivity-probe-${Date.now()}`), {
      method: 'GET',
      cache: 'no-store',
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
};

export const OfflineStatus: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [showRecovered, setShowRecovered] = useState(false);
  const [showCachedList, setShowCachedList] = useState(false);
  const [cachedPosts, setCachedPosts] = useState<CachedPostEntry[] | null>(null);
  const recoveredTimerRef = useRef<number | null>(null);
  const loadRequestIdRef = useRef(0);
  /** 当前提示条认定的网络状态：复查与事件都据此去重。 */
  const offlineRef = useRef(false);
  /** 连通性探测的代际号：卸载或再次复查后丢弃过期的探测结果。 */
  const probeRequestIdRef = useRef(0);

  const enterOffline = useCallback(() => {
    offlineRef.current = true;
    setShowRecovered(false);
    setIsOffline(true);
    // 断网时收起列表并清空旧数据：下次离线重新读取。
    setShowCachedList(false);
    setCachedPosts(null);
  }, []);

  const enterOnline = useCallback(() => {
    offlineRef.current = false;
    setIsOffline(false);
    setShowRecovered(true);
    setShowCachedList(false);
    if (recoveredTimerRef.current !== null) {
      window.clearTimeout(recoveredTimerRef.current);
    }
    recoveredTimerRef.current = window.setTimeout(() => {
      recoveredTimerRef.current = null;
      setShowRecovered(false);
    }, RECOVERED_TOAST_MS);
  }, []);

  /**
   * 离线态的自愈复查：只负责「确认已恢复」，不负责判定离线（离线仍以 offline 事件
   * 与首帧 navigator.onLine 为准），避免把不可靠的 onLine=false 变成误报。
   */
  const recheckOnline = useCallback(() => {
    if (!offlineRef.current) {
      return;
    }
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      enterOnline();
      return;
    }
    // 标志位仍说离线：用一次真实请求取证，探测失败则维持提示条。
    const requestId = ++probeRequestIdRef.current;
    void probeConnectivity().then((online) => {
      if (online && probeRequestIdRef.current === requestId) {
        enterOnline();
      }
    });
  }, [enterOnline]);

  const handleOffline = useCallback(() => {
    if (!offlineRef.current) {
      enterOffline();
    }
  }, [enterOffline]);

  const handleOnline = useCallback(() => {
    if (offlineRef.current) {
      enterOnline();
    }
  }, [enterOnline]);

  useEffect(() => {
    // 水合后同步真实网络状态（SSR 首帧固定为在线，避免水合冲突）。
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      enterOffline();
    }
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    // 从后台或 bfcache 回到页面时 online 事件可能已经错过：立刻复查。
    document.addEventListener('visibilitychange', recheckOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', recheckOnline);
      if (recoveredTimerRef.current !== null) {
        window.clearTimeout(recoveredTimerRef.current);
      }
      probeRequestIdRef.current += 1;
      loadRequestIdRef.current += 1;
    };
  }, [enterOffline, handleOffline, handleOnline, recheckOnline]);

  // 离线期间持续复查：online 事件可能整体丢失（标签页被冻结、系统连通性判定滞后），
  // 提示条必须能自己收起来，不能永远停在页面上。
  useEffect(() => {
    if (!isOffline) {
      return;
    }
    const timer = window.setInterval(recheckOnline, OFFLINE_RECHECK_MS);
    return () => window.clearInterval(timer);
  }, [isOffline, recheckOnline]);

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
