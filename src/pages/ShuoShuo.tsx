import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Search as SearchIcon } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { Seo, buildSiteSchemas } from '../components/Seo';
import { siteConfig } from '@config/site.config';
import { absoluteSiteUrl } from '@/utils/siteUrl';
import { getInitialShuoShuo } from '@/services/shuoshuo';
import type { ShuoShuo as ShuoShuoEntry } from '../types';
import { ShuoShuoItem } from '@/components/ShuoShuoItem';
import { ImageViewer } from '@/components/ImageViewer';
import { Surface } from '@/components/ui/Surface';
import { SearchField } from '@/components/SearchField';
import { ShuoShuoShareModal } from '@/components/ShuoShuoShareModal';
import { copyTextToClipboard } from '@/utils/clipboard';
import { stripMarkdown } from '@/utils/markdownText';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { staggerContainer } from '@/utils/motion';

const SHUOSHUO_DESCRIPTION =
  'D-blog 说说：类似朋友圈的短动态分享，用一句话、一张图记录当下的想法与生活片段，Markdown 书写，随性更新。';

/** URL 定位参数名：/shuoshuo?id=<说说 id> 打开页面后自动滚动定位到该条说说（旧版分享链接兼容）。 */
const LOCATE_PARAM = 'id';

export const ShuoShuo = () => {
  const shouldReduceMotion = useReducedMotion();
  const allItems = getInitialShuoShuo();
  const [searchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<{ src: string; alt?: string } | null>(null);
  const [shareTarget, setShareTarget] = useState<ShuoShuoEntry | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [autoCopied, setAutoCopied] = useState<boolean | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  // ── 独立搜索：仅匹配说说正文内容（markdown 剥离后），大小写不敏感 ──
  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    if (!query) return allItems;
    return allItems.filter((item) => stripMarkdown(item.content).toLocaleLowerCase().includes(query));
  }, [allItems, searchQuery]);
  const hasSearchQuery = searchQuery.trim().length > 0;

  // ── 定位功能：URL ?id=<说说 id>，打开页面后自动滚动到对应说说并高亮 ──
  const locateTargetId = searchParams.get(LOCATE_PARAM);

  useEffect(() => {
    if (!locateTargetId) return;

    let cancelled = false;
    let attempt = 0;
    let timeoutId: number | undefined;

    const scrollToTarget = () => {
      if (cancelled) return;

      const escapedId = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(locateTargetId) : locateTargetId;
      const element = document.querySelector<HTMLElement>(`[data-shuoshuo-id="${escapedId}"]`);

      if (element) {
        element.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth', block: 'center' });
        setHighlightedId(locateTargetId);
        if (highlightTimerRef.current !== null) {
          window.clearTimeout(highlightTimerRef.current);
        }
        highlightTimerRef.current = window.setTimeout(() => setHighlightedId(null), 2600);
        return;
      }

      // 图片懒加载等可能引起布局变化，短暂重试直到元素可定位。
      if (attempt < 12) {
        attempt += 1;
        timeoutId = window.setTimeout(scrollToTarget, 150);
      }
    };

    const rafId = window.requestAnimationFrame(scrollToTarget);

    return () => {
      cancelled = true;
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      if (rafId !== undefined) window.cancelAnimationFrame(rafId);
      if (highlightTimerRef.current !== null) {
        window.clearTimeout(highlightTimerRef.current);
        highlightTimerRef.current = null;
      }
    };
  }, [locateTargetId, shouldReduceMotion]);

  // ── 分享：自动复制链接 + 弹出分享框，链接指向该条说说的独立页 /shuoshuo/<id> ──
  const handleShare = async (item: ShuoShuoEntry) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : siteConfig.url;
    const url = absoluteSiteUrl(`/shuoshuo/${item.id}`, origin);

    setShareUrl(url);
    setShareTarget(item);
    setAutoCopied(null);

    const copied = await copyTextToClipboard(url);
    setAutoCopied(copied);
  };

  const handleCloseShare = () => {
    setShareTarget(null);
    setAutoCopied(null);
  };

  return (
    <div className="mx-auto max-w-2xl pb-12 pt-6 md:pb-20 md:pt-10">
      <Seo
        title="说说"
        description={SHUOSHUO_DESCRIPTION}
        url="/shuoshuo"
        structuredData={[
          ...buildSiteSchemas(SHUOSHUO_DESCRIPTION),
          {
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: `说说 - ${siteConfig.title}`,
            description: SHUOSHUO_DESCRIPTION,
            url: absoluteSiteUrl('/shuoshuo', siteConfig.url),
            inLanguage: 'zh-CN',
            isPartOf: {
              '@type': 'WebSite',
              name: siteConfig.title,
              url: absoluteSiteUrl('/', siteConfig.url),
            },
          },
          // ItemList：枚举每条说说的独立页 URL，帮助爬虫从集合页发现所有子页面。
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: '说说列表',
            description: SHUOSHUO_DESCRIPTION,
            url: absoluteSiteUrl('/shuoshuo', siteConfig.url),
            itemListElement: allItems.map((item, index) => ({
              '@type': 'ListItem',
              position: index + 1,
              name:
                stripMarkdown(item.content)
                  .split('\n')
                  .map((line) => line.trim())
                  .find((line) => line.length > 0) || item.date,
              url: absoluteSiteUrl(`/shuoshuo/${item.id}`, siteConfig.url),
            })),
          },
        ]}
      />

      <header className="mb-10 border-b border-zinc-200 pb-8 dark:border-zinc-800 md:pb-10">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          <MessageCircle size={14} aria-hidden="true" />
          ShuoShuo · Moments
        </p>
        <h1 className="font-serif text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl">
          说说
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400 md:text-base">
          这里是一块类似PLDDUCK朋友圈的短动态小天地
        </p>
        {allItems.length > 0 && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
            共 {allItems.length} 条 · 内容通过 PagesCMS 发布
          </p>
        )}
      </header>

      {allItems.length > 0 && (
        <section aria-label="搜索说说" className="mb-8">
          <SearchField
            value={searchQuery}
            onValueChange={setSearchQuery}
            onClear={() => setSearchQuery('')}
            placeholder="搜索说说内容..."
            clearLabel="清除搜索"
            aria-label="搜索说说内容"
          />
          <p className="sr-only" role="status" aria-live="polite">
            {hasSearchQuery ? `找到 ${filteredItems.length} 条相关说说` : `共 ${allItems.length} 条说说`}
          </p>
          {hasSearchQuery && (
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              找到 {filteredItems.length} 条与 “{searchQuery.trim()}” 相关的说说
            </p>
          )}
        </section>
      )}

      {allItems.length === 0 ? (
        <Surface variant="panel" className="flex flex-col items-center gap-3 p-8 text-center sm:p-10">
          <MessageCircle size={24} className="text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
          <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">还没有发布说说，去 PagesCMS 写一条吧。</p>
        </Surface>
      ) : filteredItems.length === 0 ? (
        <Surface variant="panel" className="flex flex-col items-center gap-3 p-8 text-center sm:p-10">
          <SearchIcon size={24} className="text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
          <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            没有找到与 “{searchQuery.trim()}” 相关的说说
          </p>
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="editorial-button rounded-control active:scale-[0.98]"
          >
            清除搜索
          </button>
        </Surface>
      ) : (
        <motion.ol
          variants={shouldReduceMotion ? undefined : staggerContainer}
          initial={shouldReduceMotion ? false : 'hidden'}
          animate="visible"
          className="relative space-y-8"
        >
          {/* 时间轴竖线：贯穿整条动态流 */}
          <span aria-hidden="true" className="absolute bottom-2 left-5 top-2 w-px bg-zinc-200 dark:bg-zinc-800" />
          {filteredItems.map((item) => (
            <ShuoShuoItem
              key={item.id}
              item={item}
              onPreview={(src, alt) => setPreviewImage({ src, alt })}
              onShare={handleShare}
              isHighlighted={highlightedId === item.id}
              shouldReduceMotion={shouldReduceMotion}
            />
          ))}
        </motion.ol>
      )}

      {previewImage && (
        <ImageViewer src={previewImage.src} alt={previewImage.alt} onClose={() => setPreviewImage(null)} />
      )}

      {shareTarget && (
        <ShuoShuoShareModal
          isOpen={Boolean(shareTarget)}
          onClose={handleCloseShare}
          url={shareUrl}
          contentPreview={stripMarkdown(shareTarget.content)}
          date={shareTarget.date}
          autoCopied={autoCopied}
        />
      )}
    </div>
  );
};
