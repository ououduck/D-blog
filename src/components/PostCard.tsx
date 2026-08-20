/**
 * 文章卡片组件：首页网格与搜索结果的统一卡片（精选大卡 + 普通卡两种形态）。
 * 从 pages/Home 下沉为公共组件，避免搜索结果页反向依赖大体积首页模块
 * （首页若做路由级懒加载会连锁影响搜索页）。
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Clock, MessageCircle, Bookmark, Share2, Pin, Sparkles } from 'lucide-react';
import type { PostMetadata } from '@/types';
import { assetUrl } from '@/utils/siteUrl';
import { preloadPage } from '@/utils/preload';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { isPinnedFeaturedPost } from '@/utils/postSelection';

// 组件 props 类型（全仓库仅本文件使用，不导出避免公共 API 承诺）。
interface PostCardProps {
  post: PostMetadata;
  featured?: boolean;
  onShare: (post: PostMetadata) => void;
  isSaved: boolean;
  isSaving: boolean;
  onToggleSave: (post: PostMetadata) => void;
}

/**
 * 文章卡片的标签行（最多展示 3 个）。模块级组件而非 PostCard 内联定义：
 * 内联组件每次渲染都会创建新的组件类型，导致标签子树（含 Link）被
 * 卸载并重新挂载，浪费 DOM 重建且使 memo 失效。
 */
const PostCardTags: React.FC<{ tags: string[] }> = ({ tags }) =>
  tags.length > 0 ? (
    <div className="flex flex-wrap gap-1.5">
      {tags.slice(0, 3).map((tag) => (
        <Link
          key={tag}
          to={`/tags?tag=${encodeURIComponent(tag)}`}
          className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-100/70 px-2 py-0.5 text-[11px] font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:bg-zinc-900 hover:text-white dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-100 dark:hover:text-zinc-950"
          onClick={(event) => event.stopPropagation()}
        >
          {tag}
        </Link>
      ))}
    </div>
  ) : null;

const PostCardImpl: React.FC<PostCardProps> = ({ post, featured, onShare, isSaved, isSaving, onToggleSave }) => {
  const handleShareClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onShare(post);
  };

  const handleToggleSaveClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onToggleSave(post);
  };

  if (featured) {
    return (
      <article className="col-span-full w-full" onMouseEnter={() => preloadPage(`/post/${post.id}`)}>
        <div className="relative overflow-hidden rounded-surface border border-zinc-200 bg-white transition-colors hover:border-zinc-400 focus-within:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:focus-within:border-zinc-500 md:grid md:grid-cols-5">
          <Link
            to={`/post/${post.id}`}
            className="block aspect-[16/9] overflow-hidden bg-zinc-100 dark:bg-zinc-800 md:col-span-3 md:aspect-auto md:min-h-80"
            aria-label={`阅读文章：${post.title}`}
          >
            {post.coverImage ? (
              <ProgressiveImage
                src={assetUrl(post.coverImage)}
                alt={post.title}
                loading="eager"
                fetchPriority="high"
                width={post.coverWidth}
                height={post.coverHeight}
                aspectRatio="16/9"
                sizes="(max-width: 767px) 100vw, 60vw"
                wrapperClassName="h-full w-full"
                className="h-full w-full object-cover"
                effect="fade"
              />
            ) : (
              <div className="flex h-full min-h-56 items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                <Sparkles className="h-12 w-12 text-zinc-300 dark:text-zinc-600" />
              </div>
            )}
          </Link>
          <div className="flex flex-col p-4 md:col-span-2 md:p-7">
            <div className="mb-3 flex items-center gap-3 text-[11px] md:mb-4 font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              <span>{post.category}</span>
              <span aria-hidden="true">/</span>
              <span>精选</span>
              {isPinnedFeaturedPost(post) && (
                <span className="ml-auto flex items-center gap-1 normal-case tracking-normal text-zinc-600 dark:text-zinc-300">
                  <Pin size={11} />
                  置顶
                </span>
              )}
            </div>
            <Link to={`/post/${post.id}`} aria-label={`阅读文章：${post.title}`}>
              <h2 className="mb-2 text-xl md:mb-3 font-bold leading-tight text-ink hover:underline dark:text-white md:text-3xl">
                {post.title}
              </h2>
            </Link>
            <p className="mb-3 line-clamp-3 text-sm leading-5 md:mb-4 md:leading-6 text-zinc-600 dark:text-zinc-300">
              {post.excerpt}
            </p>
            <PostCardTags tags={post.tags} />
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-200 pt-3 text-xs md:pt-4 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 md:mt-auto">
              <span className="flex items-center gap-1.5">
                <Calendar size={12} />
                {post.date}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={12} />
                {post.readTime}
              </span>
              {typeof post.commentCount === 'number' && (
                <span className="flex items-center gap-1.5" title="来自 Giscus 评论区的评论数">
                  <MessageCircle size={12} />
                  {post.commentCount} 条评论
                </span>
              )}
              <div className="ml-auto flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={handleToggleSaveClick}
                  disabled={isSaving}
                  aria-pressed={isSaved}
                  aria-label={isSaved ? `取消收藏：${post.title}` : `收藏文章：${post.title}`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control transition-colors hover:text-ink active:scale-[.98] disabled:opacity-50 dark:hover:text-white"
                >
                  <Bookmark size={13} fill={isSaved ? 'currentColor' : 'none'} />
                </button>
                <button
                  type="button"
                  onClick={handleShareClick}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control transition-transform hover:text-ink active:scale-[.98] dark:hover:text-white"
                  aria-label={`分享文章：${post.title}`}
                >
                  <Share2 size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="flex h-full min-w-0 flex-col" onMouseEnter={() => preloadPage(`/post/${post.id}`)}>
      <div className="relative flex h-full flex-col overflow-hidden rounded-surface border border-zinc-200 bg-white transition-colors hover:border-zinc-400 focus-within:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:focus-within:border-zinc-500">
        <Link
          to={`/post/${post.id}`}
          className="block aspect-[16/9] overflow-hidden bg-zinc-100 dark:bg-zinc-800 md:aspect-[16/10]"
          aria-label={`阅读文章：${post.title}`}
        >
          {post.coverImage ? (
            <ProgressiveImage
              src={assetUrl(post.coverImage)}
              alt={post.title}
              loading="lazy"
              fetchPriority="auto"
              width={post.coverWidth}
              height={post.coverHeight}
              aspectRatio="16/10"
              sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw"
              wrapperClassName="h-full w-full"
              className="h-full w-full object-cover"
              effect="fade"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-300 dark:text-zinc-600">
              <Sparkles className="h-9 w-9" />
            </div>
          )}
        </Link>
        <div className="flex flex-grow flex-col p-3.5 md:p-5">
          <div className="mb-1.5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider md:mb-2 text-zinc-500 dark:text-zinc-400">
            <span>{post.category}</span>
            {isPinnedFeaturedPost(post) && (
              <span className="ml-auto flex items-center gap-1 normal-case tracking-normal">
                <Pin size={10} />
                置顶
              </span>
            )}
          </div>
          <Link to={`/post/${post.id}`} aria-label={`阅读文章：${post.title}`}>
            <h3 className="mb-1.5 line-clamp-2 min-h-11 text-base font-bold leading-snug md:mb-2 text-ink hover:underline dark:text-zinc-100 md:text-lg">
              {post.title}
            </h3>
          </Link>
          <p className="mb-2 line-clamp-1 text-sm leading-5 text-zinc-600 md:mb-3 dark:text-zinc-300">{post.excerpt}</p>
          <PostCardTags tags={post.tags} />
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-200 pt-2.5 text-[11px] md:mt-4 md:pt-3 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <span className="flex items-center gap-1">
              <Calendar size={11} />
              {post.date}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {post.readTime}
            </span>
            {typeof post.commentCount === 'number' && (
              <span className="flex items-center gap-1" title="来自 Giscus 评论区的评论数">
                <MessageCircle size={11} />
                {post.commentCount} 条评论
              </span>
            )}
            <div className="ml-auto flex items-center gap-0.5">
              <button
                type="button"
                onClick={handleToggleSaveClick}
                disabled={isSaving}
                aria-pressed={isSaved}
                aria-label={isSaved ? `取消收藏：${post.title}` : `收藏文章：${post.title}`}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control transition-colors hover:text-ink active:scale-[.98] disabled:opacity-50 dark:hover:text-white"
              >
                <Bookmark size={12} fill={isSaved ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                onClick={handleShareClick}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control transition-transform hover:text-ink active:scale-[.98] dark:hover:text-white"
                aria-label={`分享文章：${post.title}`}
              >
                <Share2 size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
};

// memo：Home 列表任一张卡片收藏切换会触发全部卡片重渲染，props 均为原始值或
// 稳定引用（post 引用不变、onShare=setState、onToggleSave=useCallback），
// 浅比较可跳过未受影响卡片。
export const PostCard = React.memo(PostCardImpl);
