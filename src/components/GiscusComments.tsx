import { useEffect, useRef } from 'react';
import { MessageSquareText } from 'lucide-react';

import { siteConfig } from '@config/site.config';

const getGiscusTheme = () => document.documentElement.classList.contains('dark') ? 'dark' : 'light';

export const GiscusComments = ({ postId }: { postId: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const script = document.createElement('script');
    script.src = 'https://giscus.app/client.js';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.repo = siteConfig.comments.repo;
    script.dataset.repoId = siteConfig.comments.repoId;
    script.dataset.category = siteConfig.comments.category;
    script.dataset.categoryId = siteConfig.comments.categoryId;
    script.dataset.mapping = 'pathname';
    script.dataset.strict = '1';
    script.dataset.reactionsEnabled = '1';
    script.dataset.emitMetadata = '0';
    script.dataset.inputPosition = 'top';
    script.dataset.theme = getGiscusTheme();
    script.dataset.lang = 'zh-CN';
    script.dataset.loading = 'lazy';
    container.replaceChildren(script);

    const syncTheme = () => {
      const iframe = container.querySelector<HTMLIFrameElement>('iframe.giscus-frame');
      iframe?.contentWindow?.postMessage({
        giscus: {
          setConfig: { theme: getGiscusTheme() }
        }
      }, 'https://giscus.app');
    };
    const observer = new MutationObserver(syncTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

    return () => {
      observer.disconnect();
      container.replaceChildren();
    };
  }, [postId]);

  return (
    <section className="giscus-comments mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800 md:mt-16 md:pt-10" aria-labelledby="comments-heading">
      <div className="mb-6 flex items-center gap-2">
        <MessageSquareText size={18} className="text-zinc-400" aria-hidden="true" />
        <h2 id="comments-heading" className="font-serif text-xl font-bold text-ink dark:text-white">评论</h2>
      </div>
      <div ref={containerRef} />
    </section>
  );
};
