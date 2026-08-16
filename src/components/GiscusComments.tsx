import { useEffect, useRef, useState } from 'react';
import { MessageSquareText } from 'lucide-react';

import { siteConfig } from '@config/site.config';

const getGiscusTheme = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

/** 距视口底部多少像素内开始预加载评论区脚本（过早加载没有意义，过晚则白屏等待）。 */
const NEAR_VIEWPORT_MARGIN_PX = 600;
/** 单个来源的单次加载超时：超时视为该来源不可达（DNS 污染/阻断的连接会一直挂起，不触发 error 事件）。 */
const LOAD_TIMEOUT_MS = 8000;
/** 整轮来源全部失败后的自动重试次数上限。 */
const MAX_AUTO_RETRIES = 1;
/** 自动重试间隔。 */
const RETRY_DELAY_MS = 2500;
/** 官方 giscus 地址：同源代理失败（未部署/上游异常/本地开发）时的兜底来源。 */
const GISCUS_OFFICIAL = 'https://giscus.app';

/**
 * 解析评论来源（有序回退链）。
 *
 * 默认直连官方 https://giscus.app（`config/site.config.json` 的 comments.origin，
 * 站点同源代理边缘函数已移除）。大陆网络下 giscus.app 被 DNS 污染/阻断，评论区
 * 可能无法加载；如需大陆可用的评论，可将 origin 配置为自托管 giscus 实例或
 * 可达镜像的完整 URL。配置项 comments.origin 支持：
 * - 绝对地址（如 "https://giscus.app"）：直接使用（默认）；
 * - 相对路径（如 "/giscus"）：解析为当前页面 origin + 路径（需自行部署同源代理）。
 */
const resolveGiscusOrigins = (): string[] => {
  const origins: string[] = [];
  const push = (origin: string) => {
    if (origin && !origins.includes(origin)) origins.push(origin);
  };

  const configured = (siteConfig.comments.origin || '/giscus').replace(/\/+$/, '');
  if (configured.startsWith('/')) {
    // 相对路径：模块在 SSR 下不解析，浏览器端才需要真实 origin。
    if (typeof window !== 'undefined') push(`${window.location.origin}${configured}`);
  } else {
    push(configured);
  }

  push(GISCUS_OFFICIAL);
  // origins 至少含官方兜底来源，恒非空，无需三元兜底。
  return origins;
};

interface GiscusCommentsProps {
  /** 文章 ID：pathname 映射下作为 effect 依赖；specific/number 映射下可不传。 */
  postId?: string;
  /**
   * 评论归属方式：文章评论按路径自动建 discussion；留言板固定指向一个 discussion。
   * 注意：specific 是按 term 文本搜索（搜不到会自动建讨论），number 才是按编号精确锁定、绝不自动创建。
   */
  mapping?: 'pathname' | 'specific' | 'number';
  /** mapping=specific/number 时的固定 Discussion 编号。 */
  term?: string | number;
}

export const GiscusComments = ({ postId, mapping = 'pathname', term }: GiscusCommentsProps) => {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  // 评论区是否已进入"即将可见"范围：未触发前不注入 giscus 脚本，也不加载 iframe，
  // 避免首屏/文章阅读主流程被评论相关资源拖慢。
  const [isNearViewport, setIsNearViewport] = useState(false);
  // 当前生效的来源（用于 postMessage 源校验与主题同步目标）。
  const activeOriginRef = useRef<string | null>(null);

  useEffect(() => {
    // 水合后同步真实网络状态（SSR 首帧固定为在线，避免水合冲突）。
    setIsOffline(typeof navigator !== 'undefined' && !navigator.onLine);
    const syncConnection = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', syncConnection);
    window.addEventListener('offline', syncConnection);
    return () => {
      window.removeEventListener('online', syncConnection);
      window.removeEventListener('offline', syncConnection);
    };
  }, []);

  // 懒加载触发：观察评论区块（含标题与占位，始终有高度；容器 div 本身高度为 0，
  // 零面积目标不会被 IntersectionObserver 判定为相交）。
  useEffect(() => {
    const section = sectionRef.current;
    if (!section || typeof IntersectionObserver === 'undefined') {
      // 不支持 IntersectionObserver 的旧环境直接加载，保证功能可用。
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsNearViewport(true);
          observer.disconnect();
        }
      },
      { rootMargin: `${NEAR_VIEWPORT_MARGIN_PX}px 0px` },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isOffline || !isNearViewport) return;

    setIsLoaded(false);
    setLoadFailed(false);

    const origins = resolveGiscusOrigins();
    let cancelled = false;
    let success = false;
    // 尝试序号：每次注入脚本自增，旧尝试的迟到回调（超时/错误）据此判定失效，避免误杀新尝试。
    let attemptSeq = 0;
    let loadTimeout: number | undefined;
    let retryTimer: number | undefined;

    const clearTimers = () => {
      if (loadTimeout !== undefined) window.clearTimeout(loadTimeout);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      loadTimeout = undefined;
      retryTimer = undefined;
    };

    const handleMessage = (event: MessageEvent) => {
      const activeOrigin = activeOriginRef.current;
      if (!activeOrigin) return;
      const iframe = container.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
      if (
        event.origin !== new URL(activeOrigin).origin ||
        event.source !== iframe?.contentWindow ||
        typeof event.data?.giscus !== 'object'
      ) {
        return;
      }

      // 成功消息到达：清除超时，并取消尚未触发的自动重试（避免"迟到的成功"后
      // 重试定时器再把已正常加载的评论区销毁重载）。
      if (success) return;
      success = true;
      clearTimers();
      setIsLoaded(true);
      setLoadFailed(false);
    };

    const syncTheme = () => {
      const activeOrigin = activeOriginRef.current;
      if (!activeOrigin) return;
      const iframe = container.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
      iframe?.contentWindow?.postMessage(
        {
          giscus: {
            setConfig: { theme: getGiscusTheme() },
          },
        },
        new URL(activeOrigin).origin,
      );
    };

    const failCycle = () => {
      if (cancelled || success) return;
      activeOriginRef.current = null;
      clearTimers();
      container.replaceChildren();
      if (autoRetryCount < MAX_AUTO_RETRIES) {
        retryTimer = window.setTimeout(() => setAutoRetryCount((count) => count + 1), RETRY_DELAY_MS);
      } else {
        setLoadFailed(true);
      }
    };

    const attemptOrigin = (index: number) => {
      if (cancelled || success) return;
      const origin = origins[index];
      if (!origin) {
        failCycle();
        return;
      }

      const seq = ++attemptSeq;
      activeOriginRef.current = origin;

      // 本次尝试的失败回调：seq 与当前尝试不匹配（迟到回调）时忽略。
      const failThisAttempt = () => {
        if (cancelled || success || seq !== attemptSeq) return;
        attemptOrigin(seq); // 下一个来源索引 = 已启动的尝试数
      };

      const script = document.createElement('script');
      script.src = `${origin}/client.js`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.repo = siteConfig.comments.repo;
      script.dataset.repoId = siteConfig.comments.repoId;
      script.dataset.category = siteConfig.comments.category;
      script.dataset.categoryId = siteConfig.comments.categoryId;
      script.dataset.mapping = mapping;
      script.dataset.strict = siteConfig.comments.strict ? '1' : '0';
      script.dataset.reactionsEnabled = '1';
      script.dataset.emitMetadata = '0';
      script.dataset.inputPosition = 'top';
      script.dataset.theme = getGiscusTheme();
      script.dataset.lang = 'zh-CN';
      script.dataset.loading = 'lazy';
      if ((mapping === 'specific' || mapping === 'number') && term !== undefined) {
        script.dataset.term = String(term);
      }
      script.addEventListener('error', failThisAttempt, { once: true });
      container.replaceChildren(script);
      // DNS 污染/阻断的连接会一直挂起（不触发 error），用超时兜底切换来源。
      loadTimeout = window.setTimeout(failThisAttempt, LOAD_TIMEOUT_MS);
    };

    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    observer.observe(container, { childList: true, subtree: true });
    window.addEventListener('message', handleMessage);

    attemptOrigin(0);

    return () => {
      cancelled = true;
      activeOriginRef.current = null;
      clearTimers();
      observer?.disconnect();
      window.removeEventListener('message', handleMessage);
      container.replaceChildren();
    };
  }, [isOffline, isNearViewport, loadAttempt, autoRetryCount, postId, mapping, term]);

  // 全局开关（site.config.ts giscusEnabled）：关闭时不渲染评论区块。
  // 放在所有 hooks 之后，保证 hooks 调用顺序稳定，所有调用点自动受控。
  if (!siteConfig.giscusEnabled) {
    return null;
  }

  return (
    <section
      ref={sectionRef}
      className="giscus-comments mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800 md:mt-16 md:pt-10"
      aria-labelledby="comments-heading"
    >
      <div className="mb-6 flex items-center gap-2">
        <MessageSquareText size={18} className="text-zinc-400" aria-hidden="true" />
        <h2 id="comments-heading" className="font-serif text-xl font-bold text-ink dark:text-white">
          评论
        </h2>
      </div>
      {isOffline ? (
        <div
          role="status"
          className="border-y border-zinc-200 px-4 py-6 text-sm leading-6 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
        >
          当前处于离线状态，恢复网络后评论区会自动加载。
        </div>
      ) : loadFailed ? (
        <div
          role="alert"
          className="border-y border-zinc-200 px-4 py-6 text-sm leading-6 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
        >
          <p>评论区加载失败，请检查网络连接后重试。</p>
          <button
            type="button"
            onClick={() => {
              // 手动重试：同时重置自动重试计数，让后续失败也能自动重试。
              setAutoRetryCount(0);
              setLoadAttempt((attempt) => attempt + 1);
            }}
            className="editorial-button mt-4"
          >
            重新加载评论
          </button>
        </div>
      ) : isLoaded ? null : (
        // 未加载完成前的占位：保持区块高度，避免加载开始/结束时布局跳动。
        // 加载成功后隐藏，避免"正在加载评论区…"常驻在评论区上方。
        <div
          role="status"
          aria-live="polite"
          className="border-y border-zinc-200 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
        >
          {isNearViewport ? '正在加载评论区…' : '评论将在滚动到此处时自动加载。'}
        </div>
      )}
      <div ref={containerRef} className={isOffline || !isNearViewport ? 'hidden' : undefined} />
    </section>
  );
};
