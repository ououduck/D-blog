import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Search as SearchIcon, Share2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Seo, buildSiteSchemas } from '../components/Seo';
import { siteConfig } from '@config/site.config';
import { absoluteSiteUrl, assetUrl } from '@/utils/siteUrl';
import { getInitialShuoShuo } from '@/services/shuoshuo';
import type { ShuoShuo as ShuoShuoEntry } from '../types';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { ImageViewer } from '@/components/ImageViewer';
import { Surface } from '@/components/ui/Surface';
import { SearchField } from '@/components/SearchField';
import { ShuoShuoShareModal } from '@/components/ShuoShuoShareModal';
import { copyTextToClipboard } from '@/utils/clipboard';
import { formatDate } from '@/utils/date';
import { stripMarkdown } from '@/utils/markdownText';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fadeInUp, staggerContainer } from '@/utils/motion';

const SHUOSHUO_DESCRIPTION = 'D-blog 说说：类似朋友圈的短动态分享，用一句话、一张图记录当下的想法与生活片段，Markdown 书写，随性更新。';

/** URL 定位参数名：/shuoshuo?id=<说说 id> 打开页面后自动滚动定位到该条说说。 */
const LOCATE_PARAM = 'id';

const getImageGridClass = (count: number) => {
  if (count === 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-2';
  return 'grid-cols-3';
};

const ImageGrid: React.FC<{ images: string[]; onPreview: (src: string, alt?: string) => void }> = ({ images, onPreview }) => {
  const count = images.length;

  return (
    <div className={`mt-4 grid ${getImageGridClass(count)} gap-1.5 sm:gap-2 ${count === 1 ? 'max-w-sm' : ''}`}>
      {images.map((src, index) => (
        <button
          key={`${src}-${index}`}
          type="button"
          onClick={() => onPreview(src, `说说图片 ${index + 1}`)}
          className={`group relative block w-full overflow-hidden rounded-control border border-zinc-200 bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-visible:outline-zinc-100 ${count === 1 ? 'aspect-[4/3]' : 'aspect-square'}`}
          aria-label={`查看图片 ${index + 1}`}
        >
          <ProgressiveImage
            src={assetUrl(src)}
            alt={`说说配图 ${index + 1}`}
            loading="lazy"
            effect="fade"
            sizes={count === 1 ? '(max-width: 640px) 80vw, 384px' : count === 2 ? '(max-width: 640px) 45vw, 240px' : '(max-width: 640px) 30vw, 160px'}
            wrapperClassName="h-full w-full"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        </button>
      ))}
    </div>
  );
};

const ShuoShuoItem: React.FC<{
  item: ShuoShuoEntry;
  onPreview: (src: string, alt?: string) => void;
  onShare: (item: ShuoShuoEntry) => void;
  isHighlighted: boolean;
  shouldReduceMotion: boolean;
}> = ({ item, onPreview, onShare, isHighlighted, shouldReduceMotion }) => (
  <motion.li
    variants={shouldReduceMotion ? undefined : fadeInUp}
    id={`shuoshuo-${item.id}`}
    data-shuoshuo-id={item.id}
    className="relative flex gap-4 scroll-mt-24 sm:gap-5"
  >
    {/* 头像：左列固定，朋友圈式布局 */}
    <div className="relative z-10 mt-0.5 h-10 w-10 flex-shrink-0 overflow-hidden rounded-full border border-zinc-300 bg-zinc-100 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <ProgressiveImage
        src={assetUrl(siteConfig.author.avatar)}
        alt={siteConfig.author.name}
        wrapperClassName="h-full w-full"
        className="h-full w-full object-cover"
        effect="fade"
      />
    </div>

    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
        <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{siteConfig.author.name}</span>
        <time dateTime={item.date} className="text-xs text-zinc-500 dark:text-zinc-400">
          {formatDate(item.date, 'zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
        </time>
      </div>

      <div className={`mt-2 rounded-surface border border-zinc-200 bg-paper p-4 shadow-none dark:border-zinc-800 dark:bg-zinc-900 sm:p-5 ${isHighlighted ? 'shuoshuo-highlight' : ''}`}>
        {item.content && (
          <div className="prose prose-stone max-w-none dark:prose-invert prose-p:my-1.5 prose-p:leading-7 prose-li:my-0.5 prose-blockquote:my-2 prose-blockquote:border-l-zinc-400 prose-blockquote:bg-zinc-100/70 prose-blockquote:px-3 prose-blockquote:py-1 prose-blockquote:not-italic prose-img:my-1.5 dark:prose-blockquote:border-l-zinc-500 dark:prose-blockquote:bg-zinc-900">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
          </div>
        )}

        {item.images && item.images.length > 0 && (
          <ImageGrid images={item.images} onPreview={onPreview} />
        )}

        {/* 卡片底部操作栏：分享按钮，点击自动复制链接并弹出分享弹窗 */}
        <div className="mt-3 flex justify-end border-t border-zinc-100 pt-2 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => onShare(item)}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-control px-2.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 active:scale-[0.98] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:outline-zinc-100"
            aria-label={`分享这条说说：${stripMarkdown(item.content).slice(0, 24) || item.date}`}
          >
            <Share2 size={14} aria-hidden="true" />
            分享
          </button>
        </div>
      </div>
    </div>
  </motion.li>
);

export const ShuoShuo = () => {
  const shouldReduceMotion = useReducedMotion();
  const allItems = getInitialShuoShuo();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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
    let rafId: number | undefined;

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

    rafId = window.requestAnimationFrame(scrollToTarget);

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

  // ── 分享：自动复制链接 + 弹出分享框，同时把定位参数写入地址栏 ──
  const handleShare = async (item: ShuoShuoEntry) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : siteConfig.url;
    const url = absoluteSiteUrl(`/shuoshuo?${LOCATE_PARAM}=${item.id}`, origin);

    setShareUrl(url);
    setShareTarget(item);
    setAutoCopied(null);
    navigate(`/shuoshuo?${LOCATE_PARAM}=${item.id}`, { replace: true });

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
              url: absoluteSiteUrl('/', siteConfig.url)
            }
          }
        ]}
      />

      <header className="mb-10 border-b border-zinc-200 pb-8 dark:border-zinc-800 md:pb-10">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          <MessageCircle size={14} aria-hidden="true" />
          ShuoShuo · Moments
        </p>
        <h1 className="font-serif text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl">说说</h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400 md:text-base">
          这里是一块类似PLDDUCK朋友圈的短动态小天地
        </p>
        {allItems.length > 0 && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">共 {allItems.length} 条 · 内容通过 PagesCMS 发布</p>
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
