import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { SearchField } from '@/components/SearchField';
import { usePostSearch } from '@/hooks/usePostSearch';
import type { PostSearchScope } from '@/services/posts';
import { PostCard } from '@/pages/Home';
import { saveOfflinePost, removeOfflinePost } from '@/services/offlinePosts';
import { useOfflinePosts } from '@/hooks/useOfflinePosts';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { PostMetadata } from '../types';
import { Seo } from '../components/Seo';
import { ContentStatus, LoadingStatus } from '@/components/ContentStatus';
import { absoluteSiteUrl, assetUrl } from '@/utils/siteUrl';
import { siteConfig } from '@config/site.config';

const ShareModal = lazy(() => import('../components/ShareModal').then((m) => ({ default: m.ShareModal })));

const SEARCH_SCOPE_OPTIONS: Array<{ value: PostSearchScope; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'category', label: '分类' },
  { value: 'content', label: '正文内容' },
  { value: 'title', label: '仅标题' },
];

const SEARCH_SCOPE_HINTS: Record<PostSearchScope, string> = {
  all: '支持按标题、标签、分类、摘要与正文搜索',
  category: '仅搜索文章分类名称，适合快速缩小到专题目录',
  content: '只在摘要和正文内容中搜索，不匹配标题和分类',
  title: '只匹配文章标题，适合按标题关键字快速定位',
};

/**
 * 独立搜索页 /search?q=...：复用 searchPosts 评分排序与 usePostSearch 防抖逻辑，
 * 与弹窗搜索（SearchModal）完全一致，仅展示形态不同（整页网格 + 文章卡片）。
 * SSG 预渲染无 q 参数的默认搜索界面；带 q 的搜索结果在客户端执行（与首页 ?q= 一致）。
 */
export const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFromUrl = searchParams.get('q') || '';
  const [searchScope, setSearchScope] = useState<PostSearchScope>('all');
  const [sharePost, setSharePost] = useState<PostMetadata | null>(null);
  const { posts: savedPosts } = useOfflinePosts();
  const savedIds = useMemo(() => new Set(savedPosts.map((savedPost) => savedPost.id)), [savedPosts]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { searchQuery, isSearching, searchError, results, handleSearch, setSearchQuery, clearSearch, hasSearchQuery } =
    usePostSearch({
      initialQuery: queryFromUrl,
      scope: searchScope,
    });
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (queryFromUrl !== searchQuery) {
      setSearchQuery(queryFromUrl);
    }
  }, [queryFromUrl, searchQuery, setSearchQuery]);

  const handleSearchChange = (query: string) => {
    handleSearch(query);
    setSearchParams(
      (previous) => {
        const nextParams = new URLSearchParams(previous);
        if (query.trim()) {
          nextParams.set('q', query);
        } else {
          nextParams.delete('q');
        }
        return nextParams;
      },
      { replace: true },
    );
  };

  const handleClearSearch = () => {
    clearSearch();
    setSearchParams(
      (previous) => {
        const nextParams = new URLSearchParams(previous);
        nextParams.delete('q');
        return nextParams;
      },
      { replace: true },
    );
  };

  const handleToggleSave = async (post: PostMetadata) => {
    setSavingId(post.id);
    try {
      if (savedIds.has(post.id)) {
        await removeOfflinePost(post.id);
      } else {
        await saveOfflinePost(post);
      }
    } catch {
      // 收藏/取消收藏失败时静默：savedIds 不会更新，按钮自动恢复原样。
    } finally {
      setSavingId((current) => (current === post.id ? null : current));
    }
  };

  const activeScopeHint = SEARCH_SCOPE_HINTS[searchScope];

  return (
    <div className="pb-8 md:pb-14">
      {/* 带 q 参数时 Seo 组件自动输出 noindex（与首页内联搜索一致）；无 q 时正常索引 */}
      <Seo
        title={hasSearchQuery ? `搜索：${searchQuery}` : '搜索'}
        description={
          hasSearchQuery
            ? `在 D-blog 中搜索「${searchQuery}」的结果页，按相关度排序展示匹配文章。`
            : '在 D-blog 全站搜索文章：支持按标题、分类、标签、摘要与正文内容检索，快速定位感兴趣的技术分享。'
        }
      />

      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-zinc-200 pb-5 dark:border-zinc-800 md:pb-6">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Search</p>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-4xl">
            搜索
          </h1>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {hasSearchQuery ? `找到 ${results.length} 条结果` : '全站文章检索'}
        </p>
      </header>

      <section className="mt-7 md:mt-9">
        <div className="mb-8 flex flex-col gap-3 border-b border-zinc-200 pb-6 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <SearchField
              size="large"
              value={searchQuery}
              onValueChange={handleSearchChange}
              onClear={handleClearSearch}
              placeholder="搜索标题、摘要、分类与正文内容..."
              aria-label="搜索文章"
              containerClassName="max-w-2xl"
            />
          </div>

          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">
              搜索范围
            </div>
            <div className="flex flex-wrap gap-2">
              {SEARCH_SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSearchScope(option.value)}
                  aria-pressed={searchScope === option.value}
                  className={`min-h-11 rounded-control border px-3 py-2 text-xs font-semibold transition-colors active:scale-[.98] ${
                    searchScope === option.value
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:text-ink dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-700 dark:text-zinc-300">{activeScopeHint}</p>
          </div>
        </div>

        {isSearching ? (
          <div aria-busy="true">
            <LoadingStatus label="正在搜索文章" />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className={`${shouldReduceMotion ? '' : 'animate-pulse '}h-56 rounded-surface border border-zinc-200 bg-paper dark:border-zinc-800 dark:bg-zinc-900`}
                />
              ))}
            </div>
          </div>
        ) : searchError ? (
          <ContentStatus
            variant="error"
            title="搜索失败"
            description={searchError}
            actionLabel="清除搜索"
            onAction={handleClearSearch}
          />
        ) : hasSearchQuery ? (
          results.length > 0 ? (
            <div aria-live="polite">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {results.map((post, index) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    index={index}
                    onShare={setSharePost}
                    isSaved={savedIds.has(post.id)}
                    isSaving={savingId === post.id}
                    onToggleSave={handleToggleSave}
                  />
                ))}
              </div>
            </div>
          ) : (
            <ContentStatus
              title="未找到匹配文章"
              description={`没有找到与「${searchQuery}」相关的内容，尝试缩短关键词，或更换搜索范围。`}
              actionLabel="清除搜索"
              onAction={handleClearSearch}
            />
          )
        ) : (
          <ContentStatus
            title="输入关键词开始搜索"
            description="支持按标题、标签、分类、摘要与正文内容搜索，回车或点击结果即可打开文章。"
          />
        )}
      </section>

      {sharePost && (
        <Suspense fallback={null}>
          <ShareModal
            isOpen={!!sharePost}
            onClose={() => setSharePost(null)}
            title={sharePost.title}
            excerpt={sharePost.excerpt}
            url={absoluteSiteUrl(`/post/${sharePost.id}`, window.location.origin)}
            category={sharePost.category}
            date={sharePost.date}
            coverImage={sharePost.coverImage}
            siteName={siteConfig.title}
            siteSubtitle={siteConfig.subtitle}
            siteUrl={siteConfig.url}
            logo={assetUrl('/logo.png')}
          />
        </Suspense>
      )}
    </div>
  );
};
