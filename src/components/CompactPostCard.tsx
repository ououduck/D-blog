/**
 * 紧凑文章卡片：阅读页「你可能还喜欢」与搜索页移动端结果共用，保证两处排版严格一致。
 * 移动端横置扁形（左封面右文字，h-24）；sm 起竖置（封面在上、文字在下）。
 * 从 pages/Post 的内联实现下沉为公共组件：搜索结果页若各自复制一份，改版时必然漂移。
 */
import React from 'react';
import { Link } from 'react-router-dom';
import type { PostMetadata } from '@/types';
import { assetUrl } from '@/utils/siteUrl';
import { formatDate } from '@/utils/date';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { preloadPage } from '@/utils/preload';

const formatMetaDate = (dateText?: string) => {
  if (!dateText) {
    return '';
  }

  return formatDate(dateText, 'zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

interface CompactPostCardProps {
  post: PostMetadata;
}

export const CompactPostCard: React.FC<CompactPostCardProps> = ({ post }) => (
  <Link
    to={`/post/${post.id}`}
    onMouseEnter={() => preloadPage(`/post/${post.id}`)}
    className="group flex h-24 overflow-hidden rounded-surface border border-zinc-200 bg-white transition-colors hover:border-zinc-500 focus-visible:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:focus-visible:border-zinc-500 sm:block sm:h-auto"
  >
    {post.coverImage ? (
      <ProgressiveImage
        src={assetUrl(post.coverImage)}
        alt=""
        loading="lazy"
        width={post.coverWidth}
        height={post.coverHeight}
        wrapperClassName="aspect-video h-24 w-auto flex-none bg-zinc-100 dark:bg-zinc-800 sm:h-auto sm:w-full sm:aspect-[16/10]"
        className="h-full w-full object-cover"
      />
    ) : (
      <div className="flex aspect-video h-24 w-auto flex-none items-center justify-center bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 sm:h-auto sm:w-full sm:aspect-[16/10]">
        无封面
      </div>
    )}
    <div className="min-w-0 flex-1 overflow-hidden p-2 sm:p-3.5">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
        <span className="truncate">{post.category}</span>
        <span aria-hidden="true">·</span>
        <span className="shrink-0 normal-case tracking-normal">{formatMetaDate(post.date)}</span>
      </div>
      <h3 className="line-clamp-2 text-sm font-semibold leading-relaxed text-zinc-800 group-hover:text-black dark:text-zinc-200 dark:group-hover:text-white">
        {post.title}
      </h3>
      <p className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 sm:mt-2 sm:line-clamp-2">
        {post.excerpt}
      </p>
    </div>
  </Link>
);
