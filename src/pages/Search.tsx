/**
 * 搜索页：全文搜索独立页（q 参数驱动，带 q 时 noindex）。
 */

import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import { SearchField } from '@/components/SearchField';
import { usePostSearch } from '@/hooks/usePostSearch';
import type { PostSearchScope } from '@/services/posts';
import { PostCard } from '@/components/PostCard';
import { CompactPostCard } from '@/components/CompactPostCard';
import { saveOfflinePost, removeOfflinePost } from '@/services/offlinePosts';
import { useOfflinePosts } from '@/hooks/useOfflinePosts';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import type { PostMetadata } from '../types';
import { Seo, buildSiteSchemas } from '../components/Seo';
import { ContentStatus, LoadingStatus } from '@/components/ContentStatus';
import { absoluteSiteUrl, assetUrl } from '@/utils/siteUrl';
import { clearSearchQueryParams, setSearchQueryParams } from '@/utils/searchParams';
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
 * 是全站唯一的搜索入口（顶栏按钮 / Ctrl+K / 移动端导航均跳转到本页）。
 * SSG 预渲染无 q 参数的默认搜索界面；带 q 的搜索结果在客户端执行（与首页 ?q= 一致）。
 */
export const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFromUrl = searchParams.get('q') || '';
  // 搜索范围与 URL ?scope= 参数联动（ai-rules/search.md 约定）：刷新/分享/后退
  // 前进均保持范围选择；切换范围不丢查询（setSearchParams 基于现有参数增删）。
  const scopeFromUrl = searchParams.get('scope') as PostSearchScope | null;
  const isKnownScope = (scope: string | null): scope is PostSearchScope =>
    scope !== null && SEARCH_SCOPE_OPTIONS.some((option) => option.value === scope);
  // 非法/缺失的 scope 统一视为 'all'，供 URL→状态同步使用。注意状态初始化固定为
  // 'all'（与 SSG 预渲染的无参 /search 界面一致，避免带 ?scope= 直访时水合冲突），
  // 由下方 effect 在水合后把 URL 值同步进状态（与 ?q= 同一策略）。
  const normalizedScopeFromUrl: PostSearchScope = isKnownScope(scopeFromUrl) ? scopeFromUrl : 'all';
  // 用户最近一次点击的范围值：与 lastEditedQueryRef 同一竞态防护 ——
  // v7_startTransition 下 setSearchParams 提交延迟，快速连点两个范围时
  // 旧 URL 值回写会把状态回退（闪回旧范围）。
  const lastEditedScopeRef = useRef<PostSearchScope | null>(null);
  // 用户最近一次通过输入框编辑的查询值：区分「URL 更新还在 startTransition
  // 延迟中」与「URL 确实来自导航」（与 Home/Archive/Tags 页同一竞态防护）。
  const lastEditedQueryRef = useRef<string | null>(null);
  // 输入框聚焦标记：聚焦期间（用户正在输入/刚编辑完）URL 变化一律不回写
  // 输入框，杜绝任何事件交错下「输入内容被 URL 同步回退」的可能；失焦时
  // 同步清空 lastEditedQueryRef，恢复 URL 驱动的同步（后退/前进/粘贴链接）。
  const searchInputFocusedRef = useRef(false);
  const [searchScope, setSearchScope] = useState<PostSearchScope>('all');
  const [sharePost, setSharePost] = useState<PostMetadata | null>(null);
  const { posts: savedPosts } = useOfflinePosts();
  const savedIds = useMemo(() => new Set(savedPosts.map((savedPost) => savedPost.id)), [savedPosts]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const { searchQuery, isSearching, searchError, results, handleSearch, setSearchQuery, clearSearch, hasSearchQuery } =
    // 不把 URL 的 ?q= 作为 useState 初始值：SSG 预渲染的是无 q 的默认界面，
    // 首帧用空查询渲染可保证带 q 直访时客户端首帧与服务端 HTML 一致（水合无冲突）；
    // 下方 effect 在水合后把 queryFromUrl 同步进搜索。
    usePostSearch({
      scope: searchScope,
    });
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    // 单向同步（URL → 输入框），仅在「URL 值不是用户最近编辑产生」时生效：
    // v7_startTransition 下 setSearchParams 提交异步延迟，击键期间 queryFromUrl
    // 仍是旧值，若此时回写 setSearchQuery 会把刚输入的内容回退掉（闪变/丢字），
    // 并让 usePostSearch 空查询分支把结果重置回全量列表。
    // 焦点守卫：输入框聚焦期间一律跳过回写（用户正在编辑，URL 永不覆盖输入）。
    if (searchInputFocusedRef.current && lastEditedQueryRef.current !== null) {
      return;
    }
    if (lastEditedQueryRef.current !== null && lastEditedQueryRef.current !== queryFromUrl) {
      return;
    }
    if (queryFromUrl !== searchQuery) {
      setSearchQuery(queryFromUrl);
    }
    // URL 已追平最近编辑值：清空守卫，恢复 URL 驱动同步 —— 此前 ref 只写不重置，
    // 用户编辑过一次后浏览器后退/前进（同 pathname）与粘贴带 ?q= 的链接都会被
    // 永久短路，URL 与搜索 UI 失同步。
    if (lastEditedQueryRef.current !== null && lastEditedQueryRef.current === queryFromUrl) {
      lastEditedQueryRef.current = null;
    }
  }, [queryFromUrl, searchQuery, setSearchQuery]);

  // 范围参数（URL → 状态）：后退/前进/粘贴带 ?scope= 的链接时恢复范围选择。
  // 与 q 同步同构：最近编辑值未与 URL 追平前跳过回写，追平后清空守卫。
  useEffect(() => {
    if (lastEditedScopeRef.current !== null && lastEditedScopeRef.current !== normalizedScopeFromUrl) {
      return;
    }
    if (normalizedScopeFromUrl !== searchScope) {
      setSearchScope(normalizedScopeFromUrl);
    }
    if (lastEditedScopeRef.current !== null && lastEditedScopeRef.current === normalizedScopeFromUrl) {
      lastEditedScopeRef.current = null;
    }
  }, [normalizedScopeFromUrl, searchScope]);

  const handleSearchChange = (query: string) => {
    lastEditedQueryRef.current = query;
    handleSearch(query);
    setSearchParams((previous) => setSearchQueryParams(previous, query), { replace: true });
  };

  const handleClearSearch = () => {
    lastEditedQueryRef.current = '';
    clearSearch();
    setSearchParams((previous) => clearSearchQueryParams(previous), { replace: true });
  };

  const handleScopeChange = (scope: PostSearchScope) => {
    lastEditedScopeRef.current = scope;
    setSearchScope(scope);
    // 保留现有查询与其他参数，仅增删 scope：切换范围不丢查询。
    setSearchParams(
      (previous) => {
        const nextParams = new URLSearchParams(previous);
        if (scope === 'all') {
          nextParams.delete('scope');
        } else {
          nextParams.set('scope', scope);
        }
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

  // 与 SSG 的 schemaFromSeo 标记配套：/search 的页面级 schema 由 Seo 组件输出
  // （SSG 不再注入），与归档/标签/说说等页面模式一致。
  const searchPageDescription = hasSearchQuery
    ? `在 D-blog 中搜索「${searchQuery}」的结果页，按相关度排序展示匹配文章。`
    : '在 D-blog 全站搜索文章：支持按标题、分类、标签、摘要与正文内容检索，快速定位感兴趣的技术分享。';
  const searchStructuredData = [
    ...buildSiteSchemas(searchPageDescription),
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: hasSearchQuery ? `搜索：${searchQuery} - ${siteConfig.title}` : `搜索 - ${siteConfig.title}`,
      description: searchPageDescription,
      url: absoluteSiteUrl('/search', siteConfig.url),
      inLanguage: 'zh-CN',
      isPartOf: {
        '@type': 'WebSite',
        name: siteConfig.title,
        url: absoluteSiteUrl('/', siteConfig.url),
      },
    },
  ];

  return (
    <div className="pb-8 md:pb-14">
      {/* 带 q 参数时 Seo 组件自动输出 noindex（与首页内联搜索一致）；无 q 时正常索引 */}
      <Seo
        title={hasSearchQuery ? `搜索：${searchQuery}` : '搜索'}
        description={searchPageDescription}
        structuredData={searchStructuredData}
      />

      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-zinc-200 pb-5 dark:border-zinc-800 md:pb-6">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Search</p>
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-4xl">搜索</h1>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {hasSearchQuery
            ? isSearching && results.length === 0
              ? '正在搜索…'
              : `找到 ${results.length} 条结果`
            : '全站文章检索'}
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
              autoFocus
              onFocus={() => {
                searchInputFocusedRef.current = true;
              }}
              onBlur={() => {
                // 失焦 = 编辑结束：清除最近编辑守卫，恢复 URL 驱动的同步
                // （否则后退/前进/粘贴带 ?q= 的链接会被永久短路）。
                searchInputFocusedRef.current = false;
                lastEditedQueryRef.current = null;
              }}
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
                  aria-pressed={searchScope === option.value}
                  onClick={() => handleScopeChange(option.value)}
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

        {isSearching && results.length === 0 ? (
          <div aria-busy="true">
            <LoadingStatus label="正在搜索文章" />
            {/* 骨架屏与结果卡片同形：移动端横置扁形，sm 起为三列网格卡片 */}
            <div className="grid gap-3 sm:hidden" aria-hidden="true">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className={`${shouldReduceMotion ? '' : 'animate-pulse '}h-24 rounded-surface border border-zinc-200 bg-paper dark:border-zinc-800 dark:bg-zinc-900`}
                />
              ))}
            </div>
            <div className="hidden grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 sm:grid" aria-hidden="true">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className={`${shouldReduceMotion ? '' : 'animate-pulse '}h-56 rounded-surface border border-zinc-200 bg-paper dark:border-zinc-800 dark:bg-zinc-900`}
                />
              ))}
            </div>
          </div>
        ) : (
          <div aria-busy={isSearching || undefined}>
            {/* 重新搜索（已有旧结果）时保留旧结果展示，仅提示正在刷新，
                避免每次击键都整块闪回骨架屏（首次搜索无结果才显示骨架）。 */}
            {isSearching && results.length > 0 && (
              <div className="mb-4 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                <LoaderCircle size={14} className="animate-spin" aria-hidden="true" />
                <span>正在搜索「{searchQuery}」的最新结果…</span>
              </div>
            )}
            {searchError ? (
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
                  {/* 移动端：横置扁形卡片（与阅读页「你可能还喜欢」一致的排版） */}
                  <div className="grid gap-3 sm:hidden">
                    {results.map((post) => (
                      <CompactPostCard key={post.id} post={post} />
                    ))}
                  </div>
                  {/* sm 及以上：三列文章卡片网格（含收藏/分享操作） */}
                  <div className="hidden grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 sm:grid">
                    {results.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
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
          </div>
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
