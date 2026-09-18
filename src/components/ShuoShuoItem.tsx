/**
 * 说说条目：正文、九宫格图片（可预览）、日期与分享入口。
 * 正文 Markdown 图片与九宫格图片共用同一 ImageViewer 画廊（可连续浏览整条说说的全部图片）。
 */

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Link2, Share2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { siteConfig } from '@config/site.config';
import { assetUrl } from '@/utils/siteUrl';
import type { ShuoShuo as ShuoShuoEntry } from '../types';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { formatDate } from '@/utils/date';
import { stripMarkdown } from '@/utils/markdownText';
import { extractMarkdownImages } from '@/utils/markdownImages';
import { remarkAutolinkHttp } from '@/utils/remarkAutolinkHttp';
import type { ImageViewerImage } from '@/components/ImageViewer';

const getImageGridClass = (count: number) => {
  if (count === 1) return 'grid-cols-1';
  if (count === 2) return 'grid-cols-2';
  return 'grid-cols-3';
};

/** Markdown 内容图片的站点资源解析：本地路径补 basePath，外链保持原样。 */
const resolveContentImageSrc = (src: string): string => {
  if (/^https?:\/\//i.test(src)) {
    return src;
  }
  return assetUrl(src);
};

/** 画廊下标钳制（空画廊直接不开）。 */
const clampGalleryIndex = (index: number, length: number): number => {
  if (length <= 0) {
    return 0;
  }
  return Math.min(Math.max(0, index), length - 1);
};

interface ShuoShuoItemProps {
  item: ShuoShuoEntry;
  /** 打开统一图片查看器：传入该条说说的完整画廊与点击图片的下标。 */
  onPreview: (images: ImageViewerImage[], index: number) => void;
  onShare: (item: ShuoShuoEntry) => void;
  isHighlighted?: boolean;
  /** 列表页展示「永久链接」入口指向独立页；详情页隐藏（自身即独立页）。 */
  showDetailLink?: boolean;
  /**
   * 预计算的分享摘要（stripMarkdown 结果）：列表页由 ShuoShuo.tsx 的
   * strippedContents 缓存传入，避免每次击键重渲染对每条说说重跑 14 步正则链。
   * 未传时回退组件内计算（详情页单条场景无成本顾虑）。
   */
  shareSnippet?: string;
}

export const ShuoShuoItem: React.FC<ShuoShuoItemProps> = ({
  item,
  onPreview,
  onShare,
  isHighlighted = false,
  showDetailLink = true,
  shareSnippet,
}) => {
  // 分享/永久链接的 aria-label 共用同一段文本，只计算一次。
  const snippet = shareSnippet ?? (stripMarkdown(item.content).slice(0, 24) || item.date);

  // 画廊：正文 Markdown 图片在前（文档顺序），九宫格图片在后 —— 与卡片内
  // 视觉顺序一致；点击任一图片都能在该条说说的全部图片间连续浏览。
  const gallery = useMemo<ImageViewerImage[]>(() => {
    const contentImages = extractMarkdownImages(item.content ?? '').map((image) => ({
      src: resolveContentImageSrc(image.src),
      alt: image.alt,
      title: image.title,
    }));
    const gridImages = (item.images ?? []).map((src, index) => ({
      src: assetUrl(src),
      alt: `说说图片 ${index + 1}`,
    }));
    return [...contentImages, ...gridImages];
  }, [item.content, item.images]);

  // 正文 Markdown 图片渲染器（画廊下标取自 gallery，随 gallery 重建）。
  // 下标钳制走模块级纯函数，useMemo 无需引用组件级闭包。
  const markdownComponents = useMemo<Components>(
    () => ({
      // 正文 Markdown 图片：与九宫格同一 ProgressiveImage + 画廊预览体验。
      img: ({ src, alt, title, node: _node, ...props }) => {
        const rawSrc = typeof src === 'string' ? src : '';
        const resolvedSrc = rawSrc ? resolveContentImageSrc(rawSrc) : '';
        const galleryIndex = gallery.findIndex((image) => image.src === resolvedSrc);
        return (
          <button
            type="button"
            onClick={() => onPreview(gallery, clampGalleryIndex(galleryIndex >= 0 ? galleryIndex : 0, gallery.length))}
            className="block w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100"
            aria-label={alt ? `预览图片：${alt}` : '预览图片'}
          >
            <ProgressiveImage
              {...props}
              src={resolvedSrc}
              alt={alt || ''}
              loading="lazy"
              effect="fade"
              wrapperClassName="w-full rounded-control"
              className="w-full cursor-zoom-in rounded-control"
            />
          </button>
        );
      },
      // 裸 URL 自动成链后的外链安全属性（GFM 显式链接同样走这里）。
      a: ({ href, children, node: _node, ...props }) => {
        const isExternal = /^https?:\/\//i.test(href ?? '');
        if (!isExternal) {
          return (
            <a href={href} {...props}>
              {children}
            </a>
          );
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
            {children}
          </a>
        );
      },
    }),
    [gallery, onPreview],
  );

  return (
    <li id={`shuoshuo-${item.id}`} data-shuoshuo-id={item.id} className="relative flex gap-4 scroll-mt-24 sm:gap-5">
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
            <div className="prose prose-stone max-w-none dark:prose-invert prose-p:my-1.5 prose-p:leading-7 prose-a:break-all prose-li:my-0.5 prose-blockquote:my-2 prose-blockquote:border-l-zinc-400 prose-blockquote:bg-zinc-100/70 prose-blockquote:px-3 prose-blockquote:py-1 prose-blockquote:not-italic prose-img:my-1.5 dark:prose-blockquote:border-l-zinc-500 dark:prose-blockquote:bg-zinc-900">
              <ReactMarkdown remarkPlugins={[remarkGfm, remarkAutolinkHttp]} components={markdownComponents}>
                {item.content}
              </ReactMarkdown>
            </div>
          )}

          {item.images && item.images.length > 0 && (
            <div className="relative">
              {/* 图片数量徽标：多图时一眼可见总量 */}
              {item.images.length > 1 && (
                <span
                  className="pointer-events-none absolute right-2 top-2 z-10 rounded-full border border-white/20 bg-black/55 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-white/90"
                  aria-hidden="true"
                >
                  {item.images.length} 图
                </span>
              )}
              <div
                className={`mt-4 grid ${getImageGridClass(item.images.length)} gap-1.5 sm:gap-2 ${item.images.length === 1 ? 'max-w-sm' : ''}`}
              >
                {item.images.map((src, index) => (
                  <button
                    key={`${src}-${index}`}
                    type="button"
                    onClick={() =>
                      onPreview(
                        gallery,
                        clampGalleryIndex(gallery.length - item.images!.length + index, gallery.length),
                      )
                    }
                    className={`group relative block w-full overflow-hidden rounded-control border border-zinc-200 bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:focus-visible:outline-zinc-100 ${item.images!.length === 1 ? 'aspect-[4/3]' : 'aspect-square'}`}
                    aria-label={`查看图片 ${index + 1}，共 ${gallery.length} 张`}
                  >
                    <ProgressiveImage
                      src={assetUrl(src)}
                      alt={`说说图片 ${index + 1}`}
                      loading="lazy"
                      effect="fade"
                      sizes={
                        item.images!.length === 1
                          ? '(max-width: 640px) 80vw, 384px'
                          : item.images!.length === 2
                            ? '(max-width: 640px) 45vw, 240px'
                            : '(max-width: 640px) 30vw, 160px'
                      }
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 卡片底部操作栏：永久链接（独立页入口，利于爬虫发现/收录）+ 分享按钮 */}
          <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2 dark:border-zinc-800">
            {showDetailLink ? (
              <Link
                to={`/shuoshuo/${item.id}`}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-control px-2.5 text-xs font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 active:scale-[0.98] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:outline-zinc-100"
                aria-label={`查看这条说说：${snippet}`}
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
              aria-label={`分享这条说说：${snippet}`}
            >
              <Share2 size={14} aria-hidden="true" />
              分享
            </button>
          </div>
        </div>
      </div>
    </li>
  );
};
