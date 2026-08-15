import { useEffect, useRef, useState } from 'react';
import { MessageSquareText } from 'lucide-react';

import { siteConfig } from '@config/site.config';

const getGiscusTheme = () => (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

/** 距视口底部多少像素内开始预加载评论区脚本（过早加载没有意义，过晚则白屏等待）。 */
const NEAR_VIEWPORT_MARGIN_PX = 600;
/** 单次尝试的脚本加载超时。 */
const LOAD_TIMEOUT_MS = 12000;
/** 加载失败后的自动重试次数上限（giscus.app 偶发不可达/抖动时自动恢复，无需用户手动刷新）。 */
const MAX_AUTO_RETRIES = 2;
/** 自动重试间隔。 */
const RETRY_DELAY_MS = 2500;
/** giscus 脚本/iframe 来源：默认官方地址；自托管或镜像时通过 site.config.json comments.origin 覆盖。 */
const GISCUS_ORIGIN = (siteConfig.comments.origin || 'https://giscus.app').replace(/\/+$/, '');

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

    let retryTimer: number | undefined;
    let failed = false;
    // 统一的失败处理：脚本加载错误 / 超时都走这里，只触发一次；未到重试上限时自动重试。
    // 注意：loadTimeout 在 fail 之后初始化，但 fail 只会在异步事件（脚本 error / 超时）中触发，
    // 触发时 loadTimeout 必然已赋值，不存在 TDZ 问题。
    const fail = () => {
      if (failed) return;
      failed = true;
      if (loadTimeout !== undefined) window.clearTimeout(loadTimeout);
      if (autoRetryCount < MAX_AUTO_RETRIES) {
        retryTimer = window.setTimeout(() => setAutoRetryCount((count) => count + 1), RETRY_DELAY_MS);
      }
      setLoadFailed(true);
    };

    const script = document.createElement('script');
    script.src = `${GISCUS_ORIGIN}/client.js`;
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
    script.addEventListener('error', fail, { once: true });
    container.replaceChildren(script);

    const loadTimeout = window.setTimeout(fail, LOAD_TIMEOUT_MS);

    const syncTheme = () => {
      const iframe = container.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
      iframe?.contentWindow?.postMessage(
        {
          giscus: {
            setConfig: { theme: getGiscusTheme() },
          },
        },
        GISCUS_ORIGIN,
      );
    };
    const handleGiscusMessage = (event: MessageEvent) => {
      const iframe = container.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
      if (
        event.origin !== GISCUS_ORIGIN ||
        event.source !== iframe?.contentWindow ||
        typeof event.data?.giscus !== 'object'
      ) {
        return;
      }

      if (loadTimeout !== undefined) window.clearTimeout(loadTimeout);
      setIsLoaded(true);
      setLoadFailed(false);
    };
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    observer.observe(container, { childList: true, subtree: true });
    window.addEventListener('message', handleGiscusMessage);

    return () => {
      if (loadTimeout !== undefined) window.clearTimeout(loadTimeout);
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      script.removeEventListener('error', fail);
      observer.disconnect();
      window.removeEventListener('message', handleGiscusMessage);
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
      ) : isLoaded ? (
        <div aria-hidden="true" className="hidden" />
      ) : (
        // 未加载完成前的占位：保持区块高度，避免加载开始/结束时布局跳动。
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
