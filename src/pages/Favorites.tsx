import React from 'react';
import { Calendar, Clock, Heart, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ContentStatus, LoadingStatus } from '@/components/ContentStatus';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { Seo } from '@/components/Seo';
import { useOfflinePosts } from '@/hooks/useOfflinePosts';
import { removeOfflinePost } from '@/services/offlinePosts';
import { formatDate } from '@/utils/date';
import { assetUrl } from '@/utils/siteUrl';

export const Favorites = () => {
  const navigate = useNavigate();
  const { posts, loading, error, refresh } = useOfflinePosts();
  const [removeError, setRemoveError] = React.useState<string | null>(null);

  const handleRemove = async (id: string) => {
    setRemoveError(null);
    try {
      // useOfflinePosts 已订阅变更并自动 refresh，无需手动刷新（避免重复读 IndexedDB）。
      await removeOfflinePost(id);
    } catch {
      setRemoveError('取消收藏失败，请稍后重试。');
    }
  };
  const hasFavorites = posts.length > 0;

  return (
    <div className="pb-8 md:pb-14">
      <Seo title="我的收藏" description="查看你收藏并离线保存的 D-blog 文章列表，支持离线阅读，随时重温感兴趣的技术分享与生活随笔内容。" noindex />

      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-zinc-200 pb-5 dark:border-zinc-800 md:pb-6">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Favorites</p>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-4xl">我的收藏</h1>
        </div>
        {!loading && !error && <p className="text-sm text-zinc-500 dark:text-zinc-400">共 {posts.length} 篇</p>}
      </header>

      <section className="mt-7 md:mt-9">
        {removeError && !loading && (
          <div role="alert" className="mb-4 flex items-center justify-between gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            <span>{removeError}</span>
            <button type="button" onClick={() => setRemoveError(null)} className="shrink-0 underline underline-offset-2">关闭</button>
          </div>
        )}
        {loading ? (
          <div className="space-y-4" aria-busy="true">
            <LoadingStatus label="正在加载本地收藏" />
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} aria-hidden="true" className="h-32 editorial-shimmer rounded-surface border border-zinc-200 bg-paper dark:border-zinc-800 dark:bg-zinc-900" />
            ))}
          </div>
        ) : error ? (
          <ContentStatus
            variant="error"
            title="收藏加载失败"
            description={error}
            actionLabel="重新加载"
            onAction={() => void refresh()}
          />
        ) : !hasFavorites ? (
          <ContentStatus
            title="还没有收藏文章"
            description="在文章页面点击收藏按钮后，文章会保存在此设备中供离线查看。"
            actionLabel="浏览文章"
            onAction={() => navigate('/')}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-live="polite">
            {posts.map((post) => (
              <article key={post.id} className="flex h-full min-w-0 flex-col overflow-hidden rounded-surface border border-zinc-200 bg-white transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-[0_4px_12px_rgba(24,24,27,0.08)] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:shadow-black/20">
                <Link to={`/post/${encodeURIComponent(post.id)}`} className="block aspect-[16/9] overflow-hidden bg-zinc-100 dark:bg-zinc-800 md:aspect-[16/10]" aria-label={`阅读文章：${post.title}`}>
                  {post.coverImage ? (
                    <ProgressiveImage src={assetUrl(post.coverImage)} alt={post.title} loading="lazy" width={post.coverWidth} height={post.coverHeight} aspectRatio="16/10" wrapperClassName="h-full w-full" className="h-full w-full object-cover" effect="fade" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-300 dark:text-zinc-600">
                      <Heart className="h-9 w-9" />
                    </div>
                  )}
                </Link>
                <div className="flex flex-grow flex-col p-3.5 md:p-5">
                  <div className="mb-1.5 flex items-center gap-2 text-[11px] md:mb-2 font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <span>{post.category}</span>
                    <span aria-hidden="true">/</span>
                    <span className="normal-case tracking-normal">已收藏</span>
                  </div>
                  <Link to={`/post/${encodeURIComponent(post.id)}`} aria-label={`阅读文章：${post.title}`}>
                    <h2 className="mb-1.5 line-clamp-2 min-h-11 md:mb-2 font-serif text-base font-bold leading-snug text-ink hover:underline dark:text-zinc-100 md:text-lg">{post.title}</h2>
                  </Link>
                  <p className="mb-2 line-clamp-1 text-sm leading-5 md:mb-3 text-zinc-600 dark:text-zinc-300">{post.excerpt}</p>
                  <div className="mt-auto flex items-center gap-3 border-t border-zinc-200 pt-2.5 text-[11px] md:pt-3 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(post.date, 'zh-CN', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                    <span className="flex items-center gap-1"><Clock size={11} />{post.readTime}</span>
                    <button
                      type="button"
                      onClick={() => void handleRemove(post.id)}
                      className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-control transition-colors hover:text-ink dark:hover:text-white"
                      aria-label={`取消收藏：${post.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
