/**
 * 说说条目：正文、九宫格图片（可预览）、日期与分享入口。
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Link2, Share2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { siteConfig } from '@config/site.config';
import { assetUrl } from '@/utils/siteUrl';
import type { ShuoShuo as ShuoShuoEntry } from '../types';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { formatDate } from '@/utils/date';
import { stripMarkdown } from '@/utils/markdownText';
import { fadeInUp } from '@/utils/motion';

const getImageGridClass = (count: number) => {
  if (count === 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-2';
  return 'grid-cols-3';
};

const ImageGrid: React.FC<{ images: string[]; onPreview: (src: string, alt?: string) => void }> = ({
  images,
  onPreview,
}) => {
  const count = images.length;

  return (
    <div className={`mt-4 grid ${getImageGridClass(count)} gap-1.5 sm:gap-2 ${count === 1 ? 'max-w-sm' : ''}`}>
      {images.map((src, index) => (
        <button
          key={`${src}-${index}`}
          type="button"
          onClick={() => onPreview(assetUrl(src), `说说图片 ${index + 1}`)}
          className={`group relative block w-full overflow-hidden rounded-control border border-zinc-200 bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-visible:outline-zinc-100 ${count === 1 ? 'aspect-[4/3]' : 'aspect-square'}`}
          aria-label={`查看图片 ${index + 1}`}
        >
          <ProgressiveImage
            src={assetUrl(src)}
            alt={`说说配图 ${index + 1}`}
            loading="lazy"
            effect="fade"
            sizes={
              count === 1
                ? '(max-width: 640px) 80vw, 384px'
                : count === 2
                  ? '(max-width: 640px) 45vw, 240px'
                  : '(max-width: 640px) 30vw, 160px'
            }
            wrapperClassName="h-full w-full"
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
          />
        </button>
      ))}
    </div>
  );
};

interface ShuoShuoItemProps {
  item: ShuoShuoEntry;
  onPreview: (src: string, alt?: string) => void;
  onShare: (item: ShuoShuoEntry) => void;
  isHighlighted?: boolean;
  shouldReduceMotion?: boolean;
  /** 列表页展示「永久链接」入口指向独立页；详情页隐藏（自身即独立页）。 */
  showDetailLink?: boolean;
}

export const ShuoShuoItem: React.FC<ShuoShuoItemProps> = ({
  item,
  onPreview,
  onShare,
  isHighlighted = false,
  shouldReduceMotion = false,
  showDetailLink = true,
}) => (
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

      <div
        className={`mt-2 rounded-surface border border-zinc-200 bg-paper p-4 shadow-none dark:border-zinc-800 dark:bg-zinc-900 sm:p-5 ${isHighlighted ? 'shuoshuo-highlight' : ''}`}
      >
        {item.content && (
          <div className="prose prose-stone max-w-none dark:prose-invert prose-p:my-1.5 prose-p:leading-7 prose-li:my-0.5 prose-blockquote:my-2 prose-blockquote:border-l-zinc-400 prose-blockquote:bg-zinc-100/70 prose-blockquote:px-3 prose-blockquote:py-1 prose-blockquote:not-italic prose-img:my-1.5 dark:prose-blockquote:border-l-zinc-500 dark:prose-blockquote:bg-zinc-900">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
          </div>
        )}

        {item.images && item.images.length > 0 && <ImageGrid images={item.images} onPreview={onPreview} />}

        {/* 卡片底部操作栏：永久链接（独立页入口，利于爬虫发现/收录）+ 分享按钮 */}
        <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2 dark:border-zinc-800">
          {showDetailLink ? (
            <Link
              to={`/shuoshuo/${item.id}`}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-control px-2.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 active:scale-[0.98] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:outline-zinc-100"
              aria-label={`查看这条说说：${stripMarkdown(item.content).slice(0, 24) || item.date}`}
            >
              <Link2 size={14} aria-hidden="true" />
              永久链接
            </Link>
          ) : (
            <span aria-hidden="true" />
          )}

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
