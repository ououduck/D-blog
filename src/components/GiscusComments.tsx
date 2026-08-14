import { useEffect, useRef, useState } from 'react';
import { MessageSquareText } from 'lucide-react';

import { siteConfig } from '@config/site.config';

const getGiscusTheme = () => document.documentElement.classList.contains('dark') ? 'dark' : 'light';

/** 距视口底部多少像素内开始预加载评论区脚本（过早加载没有意义，过晚则白屏等待）。 */
const NEAR_VIEWPORT_MARGIN_PX = 600;

interface GiscusCommentsProps {
  /** 文章 ID：pathname 映射下作为 effect 依赖；specific 映射下可不传。 */
  postId?: string;
  /** 评论归属方式：文章评论按路径自动建 discussion；留言板固定指向一个 discussion。 */
  mapping?: 'pathname' | 'specific';
  /** mapping=specific 时的固定 Discussion 编号。 */
  term?: string | number;
}

export const GiscusComments = ({ postId, mapping = 'pathname', term }: GiscusCommentsProps) => {
  const sectionRef = useRef<HTMLElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
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
      { rootMargin: `${NEAR_VIEWPORT_MARGIN_PX}px 0px` }
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || isOffline || !isNearViewport) return;

    setIsLoaded(false);
    setLoadFailed(false);
    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.repo = siteConfig.comments.repo;
    script.dataset.repoId = siteConfig.comments.repoId;
    script.dataset.category = siteConfig.comments.category;
    script.dataset.categoryId = siteConfig.comments.categoryId;
    script.dataset.mapping = mapping;
    script.dataset.strict = '1';
    script.dataset.reactionsEnabled = '1';
    script.dataset.emitMetadata = '0';
    script.dataset.inputPosition = 'top';
    script.dataset.theme = getGiscusTheme();
    script.dataset.lang = 'zh-CN';
    script.dataset.loading = 'lazy';
    if (mapping === 'specific' && term !== undefined) {
      script.dataset.term = String(term);
    }
    const handleScriptError = () => setLoadFailed(true);
    script.addEventListener('error', handleScriptError, { once: true });
    container.replaceChildren(script);

    const loadTimeout = window.setTimeout(() => setLoadFailed(true), 12000);

    const syncTheme = () => {
      const iframe = container.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
      iframe?.contentWindow?.postMessage({
        giscus: {
          setConfig: { theme: getGiscusTheme() }
        }
      }, 'https://giscus.app');
    };
    const handleGiscusMessage = (event: MessageEvent) => {
      const iframe = container.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
      if (
        event.origin !== 'https://giscus.app'
        || event.source !== iframe?.contentWindow
        || typeof event.data?.giscus !== 'object'
      ) {
        return;
      }

      window.clearTimeout(loadTimeout);
      setIsLoaded(true);
      setLoadFailed(false);
    };
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    observer.observe(container, { childList: true, subtree: true });
    window.addEventListener('message', handleGiscusMessage);

    return () => {
      window.clearTimeout(loadTimeout);
      script.removeEventListener('error', handleScriptError);
      observer.disconnect();
      window.removeEventListener('message', handleGiscusMessage);
      container.replaceChildren();
    };
  }, [isOffline, isNearViewport, loadAttempt, postId, mapping, term]);

  return (
    <section ref={sectionRef} className="giscus-comments mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800 md:mt-16 md:pt-10" aria-labelledby="comments-heading">
      <div className="mb-6 flex items-center gap-2">
        <MessageSquareText size={18} className="text-zinc-400" aria-hidden="true" />
        <h2 id="comments-heading" className="font-serif text-xl font-bold text-ink dark:text-white">评论</h2>
      </div>
      {isOffline ? (
        <div role="status" className="border-y border-zinc-200 px-4 py-6 text-sm leading-6 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          当前处于离线状态，恢复网络后评论区会自动加载。
        </div>
      ) : loadFailed ? (
        <div role="alert" className="border-y border-zinc-200 px-4 py-6 text-sm leading-6 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          <p>评论区加载失败，请检查网络连接后重试。</p>
          <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)} className="editorial-button mt-4">重新加载评论</button>
        </div>
      ) : isLoaded ? (
        <div aria-hidden="true" className="hidden" />
      ) : (
        // 未加载完成前的占位：保持区块高度，避免加载开始/结束时布局跳动。
        <div role="status" aria-live="polite" className="border-y border-zinc-200 px-4 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
          {isNearViewport ? '正在加载评论区…' : '评论将在滚动到此处时自动加载。'}
        </div>
      )}
      <div ref={containerRef} className={isOffline || !isNearViewport ? 'hidden' : undefined} />
    </section>
  );
};
