import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, ArrowDownWideNarrow, ArrowUpWideNarrow, Pin, Clock, Sparkles, ChevronRight, Share2, Bookmark, X } from 'lucide-react';
import { SearchField } from '@/components/SearchField';
import { getInitialPosts, getPosts } from '@/services/posts';
import { saveOfflinePost, removeOfflinePost } from '@/services/offlinePosts';
import { PostMetadata } from '../types';
import { siteConfig } from '@config/site.config';
import { Seo } from '../components/Seo';
import { usePostSearch } from '@/hooks/usePostSearch';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { ContentStatus, LoadingStatus } from '@/components/ContentStatus';
import { sortPosts } from '@/utils/postSorting';
import { easeOut, easeSmooth, fadeInUp, staggerContainer } from '@/utils/motion';
import { preloadPage } from '@/utils/preload';
import { getHeroPost, isPinnedFeaturedPost } from '@/utils/postSelection';
import { useReadingHistory } from '@/hooks/useReadingHistory';
import { useOfflinePosts } from '@/hooks/useOfflinePosts';
import { removeReadingHistory } from '@/services/readingHistory';
import { isReadingComplete } from '@/utils/readingProgress';
import { absoluteSiteUrl, assetUrl } from '@/utils/siteUrl';
import { Pagination } from '@/components/Pagination';
import { canonicalizeHomeQuery, getHomeQueryState, setHomeQueryParam } from '@/utils/homeQuery';

const ShareModal = lazy(() => import('../components/ShareModal').then((m) => ({ default: m.ShareModal })));

const ALL_CATEGORY = '全部';
// 分页与精选槽位固定为常量（不随视口变化）：SSR 与客户端水合后首帧完全一致，
// 避免媒体查询导致的文章数/布局重排（CLS）。网格列数由 Tailwind 响应式类原生控制。
const POSTS_PER_PAGE = 9;
const HERO_SLOTS = 3;
const initialPosts = getInitialPosts();

const listSwapTransition = {
  duration: 0.2,
  ease: easeSmooth,
} as const;

const gridLayoutTransition = {
  duration: 0.28,
  ease: easeSmooth,
} as const;

const gridExitVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.018,
      delayChildren: 0.01,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.14, ease: easeSmooth },
  },
} as const;

const getCategories = (posts: PostMetadata[]) => Array.from(new Set(posts.map((post) => post.category)));

const SkeletonBlock: React.FC<{ className?: string; shouldReduceMotion: boolean }> = ({ className, shouldReduceMotion }) => (
  <div className={`${shouldReduceMotion ? '' : 'editorial-shimmer'} bg-zinc-200 dark:bg-zinc-800 ${className || ''}`} />
);

const FeaturedPostSkeleton: React.FC<{ shouldReduceMotion: boolean }> = ({ shouldReduceMotion }) => (
  <div aria-hidden="true" className="col-span-full overflow-hidden rounded-surface border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
    <div className="md:grid md:min-h-80 md:grid-cols-5">
      <SkeletonBlock shouldReduceMotion={shouldReduceMotion} className="aspect-[16/9] md:col-span-3 md:aspect-auto" />
      <div className="flex flex-col p-4 md:col-span-2 md:p-7">
        <div className="mb-3 flex items-center gap-3 md:mb-4">
          <SkeletonBlock shouldReduceMotion={shouldReduceMotion} className="h-3 w-16" />
          <SkeletonBlock shouldReduceMotion={shouldReduceMotion} className="h-3 w-12" />
        </div>
        <SkeletonBlock shouldReduceMotion={shouldReduceMotion} className="mb-2 h-8 w-4/5 md:mb-3" />
        <SkeletonBlock shouldReduceMotion={shouldReduceMotion} className="mb-2 h-3 w-full" />
        <SkeletonBlock shouldReduceMotion={shouldReduceMotion} className="mb-3 h-3 w-3/4 md:mb-4" />
        <div className="mt-auto flex items-center gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800 md:pt-4">
          <SkeletonBlock shouldReduceMotion={shouldReduceMotion} className="h-3 w-20" />
          <SkeletonBlock shouldReduceMotion={shouldReduceMotion} className="h-3 w-16" />
        </div>
      </div>
    </div>
  </div>
);

const PostCardSkeleton: React.FC<{ shouldReduceMotion: boolean }> = ({ shouldReduceMotion }) => (
  <div aria-hidden="true" className="overflow-hidden rounded-surface border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
    <SkeletonBlock shouldReduceMotion={shouldReduceMotion} className="aspect-[16/9] md:aspect-[16/10]" />
    <div className="space-y-2.5 p-3.5 md:space-y-3 md:p-5">
      <SkeletonBlock shouldReduceMotion={shouldReduceMotion} className="h-3 w-20" />
      <SkeletonBlock shouldReduceMotion={shouldReduceMotion} className="h-4 w-4/5" />
      <SkeletonBlock shouldReduceMotion={shouldReduceMotion} className="h-3 w-full" />
      <SkeletonBlock shouldReduceMotion={shouldReduceMotion} className="h-3 w-2/3" />
      <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
        <SkeletonBlock shouldReduceMotion={shouldReduceMotion} className="h-3 w-28" />
      </div>
    </div>
  </div>
);

const LoadingGrid: React.FC<{ heroSlots: number; label: string; hasFeatured: boolean }> = ({ heroSlots, label, hasFeatured }) => {
  const shouldReduceMotion = useReducedMotion();
  const featuredSlots = hasFeatured ? heroSlots : 0;
  const regularSkeletonCount = Math.max(0, POSTS_PER_PAGE - featuredSlots);

  return (
    <motion.div variants={shouldReduceMotion ? undefined : fadeInUp} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
      <LoadingStatus label={label} className="col-span-full" />
      {hasFeatured && <FeaturedPostSkeleton shouldReduceMotion={shouldReduceMotion} />}
      {Array.from({ length: regularSkeletonCount }).map((_, index) => <PostCardSkeleton key={index} shouldReduceMotion={shouldReduceMotion} />)}
    </motion.div>
  );
};

const filterAndSortPosts = (
  posts: PostMetadata[],
  selectedCategory: string,
  sortOrder: 'newest' | 'oldest'
) => {
  const filteredPosts =
    selectedCategory === ALL_CATEGORY
      ? posts
      : posts.filter((post) => post.category === selectedCategory);

  return sortPosts(filteredPosts, sortOrder);
};

const PostCard: React.FC<{ post: PostMetadata; index: number; featured?: boolean; onShare: (post: PostMetadata) => void; isSaved: boolean; isSaving: boolean; onToggleSave: (post: PostMetadata) => void }> = ({ post, index, featured, onShare, isSaved, isSaving, onToggleSave }) => {
  const shouldReduceMotion = useReducedMotion();
  const cardVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.25,
        ease: easeSmooth,
        delay: shouldReduceMotion ? 0 : index * 0.02
      }
    }
  };

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

  const Tags = () => post.tags.length > 0 ? (
    <div className="flex flex-wrap gap-1.5">
      {post.tags.slice(0, 3).map((tag) => (
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

  if (featured) {
    return (
      <motion.article
        layout={!shouldReduceMotion}
        variants={cardVariants}
        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.25, ease: easeOut }}
        className="col-span-full w-full"
        onMouseEnter={() => preloadPage(`/post/${post.id}`)}
      >
        <div className="overflow-hidden rounded-surface border border-zinc-200 bg-white transition-colors hover:border-zinc-400 focus-within:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:focus-within:border-zinc-500 md:grid md:grid-cols-5">
          <Link to={`/post/${post.id}`} className="block aspect-[16/9] overflow-hidden bg-zinc-100 dark:bg-zinc-800 md:col-span-3 md:aspect-auto md:min-h-80" aria-label={`阅读文章：${post.title}`}>
            {post.coverImage ? (
              <ProgressiveImage src={assetUrl(post.coverImage)} alt={post.title} loading="eager" fetchPriority="high" width={post.coverWidth} height={post.coverHeight} aspectRatio="16/9" sizes="(max-width: 767px) 100vw, 60vw" wrapperClassName="h-full w-full" className="h-full w-full object-cover" effect="fade" />
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
              <h2 className="mb-2 font-serif text-xl md:mb-3 font-bold leading-tight text-ink hover:underline dark:text-white md:text-3xl">
                {post.title}
              </h2>
            </Link>
            <p className="mb-3 line-clamp-3 text-sm leading-5 md:mb-4 md:leading-6 text-zinc-600 dark:text-zinc-300">{post.excerpt}</p>
            <Tags />
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-200 pt-3 text-xs md:pt-4 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 md:mt-auto">
              <span className="flex items-center gap-1.5"><Calendar size={12} />{post.date}</span>
              <span className="flex items-center gap-1.5"><Clock size={12} />{post.readTime}</span>
              <div className="ml-auto flex items-center gap-0.5">
                <button type="button" onClick={handleToggleSaveClick} disabled={isSaving} aria-pressed={isSaved} aria-label={isSaved ? `取消收藏：${post.title}` : `收藏文章：${post.title}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control transition-colors hover:text-ink active:scale-[.98] disabled:opacity-50 dark:hover:text-white">
                  <Bookmark size={13} fill={isSaved ? 'currentColor' : 'none'} />
                </button>
                <button type="button" onClick={handleShareClick} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control transition-transform hover:text-ink active:scale-[.98] dark:hover:text-white" aria-label={`分享文章：${post.title}`}>
                  <Share2 size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article layout variants={cardVariants} transition={{ duration: 0.25, ease: easeOut }} className="flex h-full min-w-0 flex-col" onMouseEnter={() => preloadPage(`/post/${post.id}`)}>
      <div className="flex h-full flex-col overflow-hidden rounded-surface border border-zinc-200 bg-white transition-[border-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:border-zinc-400 hover:shadow-[0_4px_12px_rgba(24,24,27,0.08)] focus-within:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:shadow-black/20 dark:focus-within:border-zinc-500">
        <Link to={`/post/${post.id}`} className="block aspect-[16/9] overflow-hidden bg-zinc-100 dark:bg-zinc-800 md:aspect-[16/10]" aria-label={`阅读文章：${post.title}`}>
          {post.coverImage ? (
              <ProgressiveImage src={assetUrl(post.coverImage)} alt={post.title} loading="lazy" fetchPriority="auto" width={post.coverWidth} height={post.coverHeight} aspectRatio="16/10" sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw" wrapperClassName="h-full w-full" className="h-full w-full object-cover" effect="fade" />
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
              <span className="ml-auto flex items-center gap-1 normal-case tracking-normal"><Pin size={10} />置顶</span>
            )}
          </div>
          <Link to={`/post/${post.id}`} aria-label={`阅读文章：${post.title}`}>
            <h3 className="mb-1.5 line-clamp-2 min-h-11 font-serif text-base font-bold leading-snug md:mb-2 text-ink hover:underline dark:text-zinc-100 md:text-lg">
              {post.title}
            </h3>
          </Link>
          <p className="mb-2 line-clamp-1 text-sm leading-5 text-zinc-600 md:mb-3 dark:text-zinc-300">{post.excerpt}</p>
          <Tags />
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-zinc-200 pt-2.5 text-[11px] md:mt-4 md:pt-3 text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <span className="flex items-center gap-1"><Calendar size={11} />{post.date}</span>
            <span className="flex items-center gap-1"><Clock size={11} />{post.readTime}</span>
            <div className="ml-auto flex items-center gap-0.5">
              <button type="button" onClick={handleToggleSaveClick} disabled={isSaving} aria-pressed={isSaved} aria-label={isSaved ? `取消收藏：${post.title}` : `收藏文章：${post.title}`} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control transition-colors hover:text-ink active:scale-[.98] disabled:opacity-50 dark:hover:text-white">
                <Bookmark size={12} fill={isSaved ? 'currentColor' : 'none'} />
              </button>
              <button type="button" onClick={handleShareClick} className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-control transition-transform hover:text-ink active:scale-[.98] dark:hover:text-white" aria-label={`分享文章：${post.title}`}>
                <Share2 size={12} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.article>
  );
};

interface FilterBarProps {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
  sortOrder: 'newest' | 'oldest';
  onToggleSort: () => void;
}

const FilterBar: React.FC<FilterBarProps & { shouldReduceMotion: boolean }> = ({ categories, selected, onSelect, sortOrder, onToggleSort, shouldReduceMotion }) => {
  return (
      <motion.div
        variants={fadeInUp}
        initial={shouldReduceMotion ? false : 'hidden'}
        animate="visible"
        transition={shouldReduceMotion ? { duration: 0 } : undefined}
        className="flex items-center justify-between gap-2 border-y border-zinc-200 py-3 sm:gap-3 dark:border-zinc-800"
      >

      <div className="filter-scroll-mask min-w-0 flex-1 overflow-x-auto overscroll-x-contain scroll-smooth no-scrollbar">
        <div className="flex items-center gap-2" role="group" aria-label="文章分类筛选">
          {[ALL_CATEGORY, ...categories].map((category) => (
            <button
              key={category}
              onClick={() => onSelect(category)}
              aria-pressed={selected === category}
              className={`min-h-11 whitespace-nowrap rounded-control border px-3.5 py-2 text-sm font-semibold transition-[background-color,border-color,color,transform,box-shadow] duration-150 active:scale-[.98] ${
                selected === category
                  ? 'border-ink bg-ink text-white shadow-[0_1px_3px_rgba(24,24,27,0.3)] dark:border-white dark:bg-white dark:text-ink dark:shadow-none'
                  : 'border-zinc-300 bg-paper text-zinc-700 shadow-none hover:border-ink hover:bg-zinc-100 hover:text-ink hover:shadow-[0_1px_2px_rgba(24,24,27,0.08)] dark:border-zinc-700 dark:bg-void dark:text-zinc-300 dark:hover:border-white dark:hover:bg-zinc-900 dark:hover:text-white dark:hover:shadow-none'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
      <div className="relative isolate grid grid-cols-2 shrink-0 items-center rounded-control border border-zinc-300 bg-paper p-0.5 dark:border-zinc-700 dark:bg-void" role="group" aria-label="文章排序">
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-control bg-ink shadow-[0_1px_3px_rgba(24,24,27,0.3)] transition-transform duration-200 ease-out dark:bg-white dark:shadow-none" style={{ transform: sortOrder === 'oldest' ? 'translateX(100%)' : 'translateX(0)' }} />
        {[
          { key: 'newest' as const, label: '最新', Icon: ArrowDownWideNarrow },
          { key: 'oldest' as const, label: '最早', Icon: ArrowUpWideNarrow },
        ].map(({ key, label, Icon }) => {
          const active = sortOrder === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => { if (!active) onToggleSort(); }}
              aria-pressed={active}
              aria-label={`按${label}优先排序`}
              className={`relative z-10 inline-flex min-h-11 items-center justify-center gap-1.5 rounded-control px-3 text-sm font-semibold transition-colors duration-150 active:scale-[.98] ${active ? 'text-white dark:text-zinc-950' : 'text-zinc-700 hover:text-ink dark:text-zinc-300 dark:hover:text-white'}`}
            >
              <Icon size={14} />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

const Hero = () => {
  // LCP 元素首帧即渲染最终可见状态：SSR HTML 中不可见（opacity:0）会拖慢
  // LCP 且 JS 失败时内容完全不可见，故不设入场动画。
  return (
    <div className="px-4 pb-8 pt-5 text-center md:pb-10 md:pt-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-400">
        {siteConfig.subtitle}
      </p>
      <h1 className="mb-3 text-balance font-serif text-5xl font-bold tracking-tight text-ink [overflow-wrap:anywhere] dark:text-white max-[400px]:text-4xl sm:text-6xl md:text-7xl">
        {siteConfig.title}
      </h1>
      <p className="mx-auto max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-300 md:text-base">
        {siteConfig.description}
      </p>
    </div>
  );
};

export const Home = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get('category');
  const queryFromUrl = searchParams.get('q') || '';
  const homeQueryState = useMemo(() => getHomeQueryState(searchParams), [searchParams]);
  const [allPosts, setAllPosts] = useState<PostMetadata[]>(initialPosts);
  const [categories, setCategories] = useState<string[]>(() => getCategories(initialPosts));
  const [selectedCategory, setSelectedCategory] = useState(() => categoryFromUrl || ALL_CATEGORY);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>(() => homeQueryState.sortOrder);
  const [loading, setLoading] = useState(initialPosts.length === 0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [currentPage, setCurrentPage] = useState(homeQueryState.page);
  const [sharePost, setSharePost] = useState<PostMetadata | null>(null);
  const { latest: latestReading, refresh: refreshReadingHistory } = useReadingHistory();
  const { posts: savedPosts } = useOfflinePosts();
  const savedIds = useMemo(() => new Set(savedPosts.map((savedPost) => savedPost.id)), [savedPosts]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const handleToggleSave = useCallback(async (post: PostMetadata) => {
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
  }, [savedIds]);
  const { searchQuery, isSearching, searchError, results, handleSearch, setSearchQuery, clearSearch, hasSearchQuery } = usePostSearch({
    emptyResults: allPosts,
    initialQuery: queryFromUrl
  });

  const shouldReduceMotion = useReducedMotion();
  const postsPerPage = POSTS_PER_PAGE;

  useEffect(() => {
    let cancelled = false;

    // 首帧数据已由 getInitialPosts() 同步提供，水合后无需重复异步重取
    // （避免多余的一次全列表重渲染与 loading 态闪烁）；仅“重新加载”
    // （loadAttempt > 0）或初始数据缺失时才走异步加载。
    if (loadAttempt === 0 && allPosts.length > 0) {
      return () => {
        cancelled = true;
      };
    }

    const loadHomeData = async () => {
      setLoading(true);
      try {
        const posts = await getPosts();
        if (cancelled) {
          return;
        }

        setAllPosts(posts);
        setCategories(getCategories(posts));
        setLoadError(null);
      } catch (error) {
        console.error('Failed to load home data:', error);
        if (!cancelled) {
          setLoadError('文章列表加载失败，请稍后刷新重试。');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadHomeData();

    return () => {
      cancelled = true;
    };
  }, [allPosts.length, loadAttempt]);

  useEffect(() => {
    const canonicalParams = canonicalizeHomeQuery(searchParams);
    if (canonicalParams.toString() !== searchParams.toString()) {
      setSearchParams(canonicalParams, { replace: true });
    }

    setSortOrder(homeQueryState.sortOrder);
    setCurrentPage(homeQueryState.page);
  }, [homeQueryState, searchParams, setSearchParams]);

  useEffect(() => {
    if (!categoryFromUrl) {
      setSelectedCategory(ALL_CATEGORY);
      return;
    }

    if (categories.includes(categoryFromUrl)) {
      setSelectedCategory(categoryFromUrl);
      return;
    }

    if (categories.length > 0) {
      setSearchParams((previous) => {
        const nextParams = new URLSearchParams(previous);
        nextParams.delete('category');
        nextParams.delete('page');
        return nextParams;
      }, { replace: true });
      setSelectedCategory(ALL_CATEGORY);
    }
  }, [categories, categoryFromUrl, setSearchParams]);

  useEffect(() => {
    if (queryFromUrl !== searchQuery) {
      setSearchQuery(queryFromUrl);
    }
  }, [queryFromUrl, searchQuery, setSearchQuery]);

  const displayedPosts = useMemo(() => filterAndSortPosts(results, selectedCategory, sortOrder), [results, selectedCategory, sortOrder]);
  const continueReading = useMemo(() => {
    if (!latestReading || isReadingComplete(latestReading.progress)) return null;
    const matchingPost = allPosts.find((post) => post.id === latestReading.postId);
    return matchingPost ? { post: matchingPost, entry: latestReading } : null;
  }, [allPosts, latestReading]);

  useEffect(() => {
    if (latestReading && allPosts.length > 0 && !allPosts.some((post) => post.id === latestReading.postId)) {
      removeReadingHistory(latestReading.postId);
      refreshReadingHistory();
    }
  }, [allPosts, latestReading, refreshReadingHistory]);

  const heroPost = useMemo(() => getHeroPost(displayedPosts), [displayedPosts]);
  const heroSlots = heroPost ? HERO_SLOTS : 0;

  const paginationData = useMemo(() => {
    const totalSlots = displayedPosts.reduce(
      (total, post) => total + (post.id === heroPost?.id ? heroSlots : 1),
      0
    );
    const totalPages = Math.max(1, Math.ceil(totalSlots / postsPerPage));

    return { totalSlots, totalPages };
  }, [displayedPosts, heroPost, heroSlots, postsPerPage]);

  const { totalPages } = paginationData;

  useEffect(() => {
    const categoryStateFromUrl = categoryFromUrl && categories.includes(categoryFromUrl)
      ? categoryFromUrl
      : ALL_CATEGORY;
    const filtersAreSynced = selectedCategory === categoryStateFromUrl && searchQuery === queryFromUrl;
    const initialSearchIsPending = Boolean(queryFromUrl.trim()) && results === allPosts;

    if (loading || isSearching || !filtersAreSynced || initialSearchIsPending || currentPage <= totalPages) {
      return;
    }

    setCurrentPage(totalPages);
    setSearchParams((previous) => setHomeQueryParam(previous, 'page', totalPages), { replace: true });
  }, [allPosts, categories, categoryFromUrl, currentPage, isSearching, loading, queryFromUrl, results, searchQuery, selectedCategory, setSearchParams, totalPages]);

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
    setSearchParams((previous) => {
      const nextParams = new URLSearchParams(previous);

      if (category === ALL_CATEGORY) {
        nextParams.delete('category');
      } else {
        nextParams.set('category', category);
      }
      nextParams.delete('page');

      return nextParams;
    }, { replace: true });
  };

  const handleAbandonReading = () => {
    if (!continueReading) return;
    removeReadingHistory(continueReading.post.id);
    refreshReadingHistory();
  };

  const handleToggleSort = () => {
    const nextSortOrder = sortOrder === 'newest' ? 'oldest' : 'newest';
    setSortOrder(nextSortOrder);
    setCurrentPage(1);
    setSearchParams((previous) => {
      const nextParams = setHomeQueryParam(previous, 'sort', nextSortOrder);
      nextParams.delete('page');
      return nextParams;
    }, { replace: false });
  };

  const handleSearchChange = (query: string) => {
    handleSearch(query);
    setCurrentPage(1);
    setSearchParams((previous) => {
      const nextParams = new URLSearchParams(previous);

      if (query.trim()) {
        nextParams.set('q', query);
      } else {
        nextParams.delete('q');
      }
      nextParams.delete('page');

      return nextParams;
    }, { replace: true });
  };

  const handleClearSearch = () => {
    clearSearch();
    setCurrentPage(1);
    setSearchParams((previous) => {
      const nextParams = new URLSearchParams(previous);
      nextParams.delete('q');
      nextParams.delete('page');
      return nextParams;
    }, { replace: true });
  };

  const currentPosts = useMemo(() => {
    const pageStart = (currentPage - 1) * postsPerPage;
    const pageEnd = pageStart + postsPerPage;

    const pagedPosts: PostMetadata[] = [];
    let consumedSlots = 0;

    for (const post of displayedPosts) {
      const slots = post.id === heroPost?.id ? heroSlots : 1;
      const nextConsumedSlots = consumedSlots + slots;

      if (nextConsumedSlots <= pageStart) {
        consumedSlots = nextConsumedSlots;
        continue;
      }

      if (consumedSlots >= pageEnd) {
        break;
      }

      pagedPosts.push(post);
      consumedSlots = nextConsumedSlots;
    }

    return pagedPosts;
  }, [currentPage, displayedPosts, heroPost, heroSlots, postsPerPage]);

  const paginate = (pageNumber: number) => {
    const nextPage = Math.min(Math.max(1, pageNumber), totalPages);
    setCurrentPage(nextPage);
    setSearchParams((previous) => setHomeQueryParam(previous, 'page', nextPage), { replace: false });
    window.requestAnimationFrame(() => {
      const postsPanel = document.getElementById('posts-panel');
      postsPanel?.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth', block: 'start' });
      postsPanel?.focus({ preventScroll: true });
    });
  };

  const featuredPost = useMemo(
    () => (heroPost && currentPosts.some((post) => post.id === heroPost.id) ? heroPost : null),
    [currentPosts, heroPost]
  );
  const hasFeaturedPost = Boolean(featuredPost);
  const remainingPosts = useMemo(
    () => currentPosts.filter((post) => post.id !== heroPost?.id),
    [currentPosts, heroPost]
  );

  return (
      <div className="pb-8 md:pb-12">
      {/* 站内搜索页（?q=xxx）统一 noindex：搜索过滤在客户端执行，静态 HTML 无法
          反映搜索意图；且搜索 URL 空间无限，收录会造成软重复与爬虫资源浪费
          （Google 官方对站内搜索结果页的建议即是不索引）。该 noindex 由 Seo 组件
          根据 URL 中的 q 参数自动输出，无需在此显式传入。 */}
      <Seo
        title={hasSearchQuery && results.length > 0 ? `搜索：${searchQuery}` : siteConfig.title}
        description={siteConfig.description}
      />
      <Hero />

      {continueReading && (
        <section className="continue-reading mx-4 mb-8 rounded-surface border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:mx-0 md:mb-10 md:p-5" aria-labelledby="continue-reading-heading">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">继续阅读</p>
              <h2 id="continue-reading-heading" className="truncate font-serif text-xl font-bold text-ink dark:text-white">{continueReading.post.title}</h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{continueReading.post.category} · 已阅读 {Math.round(continueReading.entry.progress * 100)}%</p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Link to={`/post/${continueReading.post.id}`} className="editorial-button-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 text-sm font-semibold" aria-label={`继续阅读：${continueReading.post.title}`}>
                继续阅读 <ChevronRight size={15} />
              </Link>
              <button
                type="button"
                onClick={handleAbandonReading}
                className="editorial-button inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 text-sm"
                aria-label={`放弃阅读：${continueReading.post.title}`}
                title="放弃阅读"
              >
                放弃阅读 <X size={15} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800" aria-hidden="true">
            <div className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100" style={{ width: `${Math.round(continueReading.entry.progress * 100)}%` }} />
          </div>
        </section>
      )}

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6 px-4 md:space-y-8 md:px-0">
          <FilterBar categories={categories} selected={selectedCategory} onSelect={handleSelectCategory} sortOrder={sortOrder} onToggleSort={handleToggleSort} shouldReduceMotion={shouldReduceMotion} />


        <div className="mx-auto max-w-2xl">
          <SearchField
            value={searchQuery}
            onValueChange={handleSearchChange}
            onClear={handleClearSearch}
            placeholder="搜索标题、摘要、分类与正文内容..."
            aria-label="搜索文章"
          />
        </div>

        {loading || isSearching ? (
          <LoadingGrid
            heroSlots={heroSlots}
            label={isSearching ? '正在搜索文章' : '正在加载文章列表'}
            hasFeatured={hasFeaturedPost}
          />
        ) : loadError || searchError ? (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={listSwapTransition}>
            <ContentStatus
              variant="error"
              title={loadError ? '文章加载失败' : '搜索失败'}
              description={loadError || searchError || undefined}
              actionLabel={loadError ? '重新加载' : '清除搜索'}
              onAction={loadError ? () => setLoadAttempt((attempt) => attempt + 1) : handleClearSearch}
            />
          </motion.div>
        ) : (
          <div id="posts-panel" className="space-y-7" aria-live="polite" tabIndex={-1}>
            <motion.div
              layout={!shouldReduceMotion}
              id="posts-grid"
              className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
              variants={gridExitVariants}
              initial="hidden"
              animate="visible"
              transition={shouldReduceMotion ? { duration: 0 } : gridLayoutTransition}
            >
              {featuredPost && <PostCard key={featuredPost.id} post={featuredPost} index={0} featured onShare={setSharePost} isSaved={savedIds.has(featuredPost.id)} isSaving={savingId === featuredPost.id} onToggleSave={handleToggleSave} />}
              {remainingPosts.length > 0 ? (
                remainingPosts.map((post, index) => <PostCard key={post.id} post={post} index={index + (featuredPost ? 1 : 0)} onShare={setSharePost} isSaved={savedIds.has(post.id)} isSaving={savingId === post.id} onToggleSave={handleToggleSave} />)
              ) : !featuredPost ? (
                <motion.div layout variants={fadeInUp} className="col-span-full border-y border-zinc-200 py-14 text-center dark:border-zinc-800">
                  <p className="text-base text-zinc-500 dark:text-zinc-400">{hasSearchQuery ? '未找到匹配的文章' : '暂无相关文章'}</p>
                  {hasSearchQuery && (
                    <button onClick={handleClearSearch} className="mt-3 text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300" aria-label="清除搜索条件">
                      清除搜索条件
                    </button>
                  )}
                </motion.div>
              ) : null}
            </motion.div>

            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={paginate} />
          </div>
        )}
      </motion.div>

      {sharePost && (
        <Suspense fallback={null}>
          <ShareModal isOpen={!!sharePost} onClose={() => setSharePost(null)} title={sharePost.title} excerpt={sharePost.excerpt} url={absoluteSiteUrl(`/post/${sharePost.id}`, window.location.origin)} />
        </Suspense>
      )}
    </div>
  );
};
