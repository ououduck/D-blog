import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Seo, buildSiteSchemas } from '../components/Seo';
import { siteConfig } from '@config/site.config';
import { absoluteSiteUrl, assetUrl } from '@/utils/siteUrl';
import { getInitialShuoShuo } from '@/services/shuoshuo';
import type { ShuoShuo as ShuoShuoEntry } from '../types';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { ImageViewer } from '@/components/ImageViewer';
import { Surface } from '@/components/ui/Surface';
import { formatDate } from '@/utils/date';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { fadeInUp, staggerContainer } from '@/utils/motion';

const SHUOSHUO_DESCRIPTION = 'D-blog 说说：类似朋友圈的短动态分享，用一句话、一张图记录当下的想法与生活片段，Markdown 书写，随性更新。';

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
  shouldReduceMotion: boolean;
}> = ({ item, onPreview, shouldReduceMotion }) => (
  <motion.li variants={shouldReduceMotion ? undefined : fadeInUp} className="relative flex gap-4 sm:gap-5">
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

      <div className="mt-2 rounded-surface border border-zinc-200 bg-paper p-4 shadow-none dark:border-zinc-800 dark:bg-zinc-900 sm:p-5">
        {item.content && (
          <div className="prose prose-stone max-w-none dark:prose-invert prose-p:my-1.5 prose-p:leading-7 prose-li:my-0.5 prose-blockquote:my-2 prose-blockquote:border-l-zinc-400 prose-blockquote:bg-zinc-100/70 prose-blockquote:px-3 prose-blockquote:py-1 prose-blockquote:not-italic prose-img:my-1.5 dark:prose-blockquote:border-l-zinc-500 dark:prose-blockquote:bg-zinc-900">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
          </div>
        )}

        {item.images && item.images.length > 0 && (
          <ImageGrid images={item.images} onPreview={onPreview} />
        )}
      </div>
    </div>
  </motion.li>
);

export const ShuoShuo = () => {
  const shouldReduceMotion = useReducedMotion();
  const items = getInitialShuoShuo();
  const [previewImage, setPreviewImage] = useState<{ src: string; alt?: string } | null>(null);

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
          类似朋友圈的短动态：一句话、一个想法、一张照片都可以在这里分享，使用 Markdown 书写即可。
        </p>
        {items.length > 0 && (
          <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">共 {items.length} 条 · 内容通过 PagesCMS 发布</p>
        )}
      </header>

      {items.length === 0 ? (
        <Surface variant="panel" className="flex flex-col items-center gap-3 p-8 text-center sm:p-10">
          <MessageCircle size={24} className="text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
          <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">还没有发布说说，去 PagesCMS 写一条吧。</p>
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
          {items.map((item) => (
            <ShuoShuoItem
              key={item.id}
              item={item}
              onPreview={(src, alt) => setPreviewImage({ src, alt })}
              shouldReduceMotion={shouldReduceMotion}
            />
          ))}
        </motion.ol>
      )}

      {previewImage && (
        <ImageViewer src={previewImage.src} alt={previewImage.alt} onClose={() => setPreviewImage(null)} />
      )}
    </div>
  );
};
