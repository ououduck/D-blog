/**
 * 首页：精选/最新文章网格、站内搜索、分类/排序/分页筛选与继续阅读。
 */

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowDownWideNarrow, ArrowUpWideNarrow, ChevronRight, X } from 'lucide-react';
import { SearchField } from '@/components/SearchField';
import { getInitialPosts, getPosts } from '@/services/posts';
import { saveOfflinePost, removeOfflinePost } from '@/services/offlinePosts';
import type { PostMetadata } from '../types';
import { siteConfig } from '@config/site.config';
import { Seo } from '../components/Seo';
import { PostCard } from '@/components/PostCard';
import { usePostSearch } from '@/hooks/usePostSearch';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { ContentStatus, LoadingStatus } from '@/components/ContentStatus';
import { sortPosts } from '@/utils/postSorting';
import { easeSmooth, fadeInUp, staggerContainer } from '@/utils/motion';
import { getHeroPost } from '@/utils/postSelection';
import { useReadingHistory } from '@/hooks/useReadingHistory';
import { useOfflinePosts } from '@/hooks/useOfflinePosts';
import { removeReadingHistory } from '@/services/readingHistory';
import { isReadingComplete } from '@/utils/readingProgress';
import { absoluteSiteUrl, assetUrl } from '@/utils/siteUrl';
import { Pagination } from '@/components/Pagination';
import { canonicalizeHomeQuery, getHomeQueryState, setHomeQueryParam } from '@/utils/homeQuery';
import { clearSearchQueryParams, setSearchQueryParams } from '@/utils/searchParams';
import { Magnet } from '@/components/effects/Magnet';

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
} as const;

const getCategories = (posts: PostMetadata[]) => Array.from(new Set(posts.map((post) => post.category)));

const SkeletonBlock: React.FC<{ className?: string; shouldReduceMotion: boolean }> = ({
  className,
  shouldReduceMotion,
}) => (
  <div className={`${shouldReduceMotion ? '' : 'editorial-shimmer'} bg-zinc-200 dark:bg-zinc-800 ${className || ''}`} />
);

const FeaturedPostSkeleton: React.FC<{ shouldReduceMotion: boolean }> = ({ shouldReduceMotion }) => (
  <div
    aria-hidden="true"
    className="col-span-full overflow-hidden rounded-surface border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
  >
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
  <div
    aria-hidden="true"
    className="overflow-hidden rounded-surface border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
  >
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

const LoadingGrid: React.FC<{ heroSlots: number; label: string; hasFeatured: boolean }> = ({
  heroSlots,
  label,
  hasFeatured,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const featuredSlots = hasFeatured ? heroSlots : 0;
  const regularSkeletonCount = Math.max(0, POSTS_PER_PAGE - featuredSlots);

  return (
    <motion.div
      variants={shouldReduceMotion ? undefined : fadeInUp}
      className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
    >
      <LoadingStatus label={label} className="col-span-full" />
      {hasFeatured && <FeaturedPostSkeleton shouldReduceMotion={shouldReduceMotion} />}
      {Array.from({ length: regularSkeletonCount }).map((_, index) => (
        <PostCardSkeleton key={index} shouldReduceMotion={shouldReduceMotion} />
      ))}
    </motion.div>
  );
};

const filterAndSortPosts = (posts: PostMetadata[], selectedCategory: string, sortOrder: 'newest' | 'oldest') => {
  const filteredPosts =
    selectedCategory === ALL_CATEGORY ? posts : posts.filter((post) => post.category === selectedCategory);

  return sortPosts(filteredPosts, sortOrder);
};

interface FilterBarProps {
  categories: string[];
  selected: string;
  onSelect: (category: string) => void;
  sortOrder: 'newest' | 'oldest';
  onToggleSort: () => void;
}

const FilterBar: React.FC<FilterBarProps & { shouldReduceMotion: boolean }> = ({
  categories,
  selected,
  onSelect,
  sortOrder,
  onToggleSort,
  shouldReduceMotion,
}) => {
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
      <div
        className="relative isolate grid grid-cols-2 shrink-0 items-center rounded-control border border-zinc-300 bg-paper p-0.5 dark:border-zinc-700 dark:bg-void"
        role="group"
        aria-label="文章排序"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-control bg-ink shadow-[0_1px_3px_rgba(24,24,27,0.3)] transition-transform duration-200 ease-out dark:bg-white dark:shadow-none"
          style={{ transform: sortOrder === 'oldest' ? 'translateX(100%)' : 'translateX(0)' }}
        />
        {[
          { key: 'newest' as const, label: '最新', Icon: ArrowDownWideNarrow },
          { key: 'oldest' as const, label: '最早', Icon: ArrowUpWideNarrow },
        ].map(({ key, label, Icon }) => {
          const active = sortOrder === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => {
                if (!active) onToggleSort();
              }}
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
  const shouldReduceMotion = useReducedMotion();
  // 滚动视差：首屏内容随页面滚动轻微上移、淡出（react-bits「ScrollFloat」
  // 启发）。仅作用于滚动变换，不设入场动画——LCP 元素首帧即渲染最终可见
  // 状态：SSR HTML 中不可见（opacity:0）会拖慢 LCP 且 JS 失败时内容完全
  // 不可见。减弱动效偏好下跳过视差。
  const { scrollY } = useScroll();
  const heroY = useTransform(scrollY, [0, 520], [0, 56]);
  const heroOpacity = useTransform(scrollY, [0, 340], [1, 0.3]);

  return (
    <div className="relative overflow-hidden px-4 pb-8 pt-5 text-center md:pb-10 md:pt-8">
      {/* react-bits「Aurora」启发：纯 CSS 柔光渐变背景，零 JS、无额外请求，
          缓慢漂移仅在减弱动效偏好下关闭；光斑在内容层之下。 */}
      <div className="editorial-aurora" aria-hidden="true">
        <div className="editorial-aurora-blob" />
        <div className="editorial-aurora-blob" />
        <div className="editorial-aurora-blob" />
      </div>
      <motion.div className="relative" style={shouldReduceMotion ? undefined : { y: heroY, opacity: heroOpacity }}>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600 dark:text-zinc-400">
          {siteConfig.subtitle}
        </p>
        <h1 className="mb-3 text-balance font-serif text-5xl font-bold tracking-tight text-ink [overflow-wrap:anywhere] dark:text-white max-[400px]:text-4xl sm:text-6xl md:text-7xl">
          {siteConfig.title}
        </h1>
        <p className="mx-auto max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-300 md:text-base">
          {siteConfig.description}
        </p>
      </motion.div>
    </div>
  );
};

export const Home = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get('category');
  const queryFromUrl = searchParams.get('q') || '';
  // 用户最近一次通过输入框编辑的查询值：用于区分「URL 更新还在 startTransition
  // 延迟中」与「URL 确实来自导航（直访 ?q= / 浏览器前进后退）」。见下方同步 effect。
  const lastEditedQueryRef = useRef<string | null>(null);
  // 已处理过的 loadAttempt：防「重新加载成功 → length 变化 → 重复 fetch」。
  const handledLoadAttemptRef = useRef(-1);
  const homeQueryState = useMemo(() => getHomeQueryState(searchParams), [searchParams]);
  const [allPosts, setAllPosts] = useState<PostMetadata[]>(initialPosts);
  const [categories, setCategories] = useState<string[]>(() => getCategories(initialPosts));
  // 分类/排序/页码一律以默认值作为初始 state（SSG 预渲染的是无参首页，
  // 首帧用默认值可保证带参直访时客户端首帧与服务端 HTML 一致，水合无冲突）；
  // URL 中的真实状态由下方 effect 在水合后同步（与 ?q= 搜索框的处理一致）。
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [loading, setLoading] = useState(initialPosts.length === 0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [sharePost, setSharePost] = useState<PostMetadata | null>(null);
  const { latest: latestReading, refresh: refreshReadingHistory } = useReadingHistory();
  const { posts: savedPosts } = useOfflinePosts();
  const savedIds = useMemo(() => new Set(savedPosts.map((savedPost) => savedPost.id)), [savedPosts]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const handleToggleSave = useCallback(
    async (post: PostMetadata) => {
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
    },
    [savedIds],
  );
  const { searchQuery, isSearching, searchError, results, handleSearch, setSearchQuery, clearSearch, hasSearchQuery } =
    // 不把 URL 的 ?q= 作为 useState 初始值（与 Search 页一致）：SSG 预渲染的是
    // 无 q 的默认界面，首帧用空查询渲染可保证带 q 直访时客户端首帧与服务端
    // HTML 一致（水合无冲突）；下方 effect 在水合后把 queryFromUrl 同步进搜索。
    usePostSearch({
      emptyResults: allPosts,
    });

  const shouldReduceMotion = useReducedMotion();

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
    // 同一 loadAttempt 只发起一次请求：重新加载成功后 allPosts.length 变化
    // 会再次触发本 effect（依赖数组含 length），若不拦截会重复 fetch 并闪烁
    // loading 态；loadAttempt 递增（新的重试/重载）时正常放行。
    if (handledLoadAttemptRef.current === loadAttempt) {
      return () => {
        cancelled = true;
      };
    }
    handledLoadAttemptRef.current = loadAttempt;

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
        console.error('首页数据加载失败:', error);
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
      setSearchParams(
        (previous) => {
          const nextParams = new URLSearchParams(previous);
          nextParams.delete('category');
          nextParams.delete('page');
          return nextParams;
        },
        { replace: true },
      );
      setSelectedCategory(ALL_CATEGORY);
    }
  }, [categories, categoryFromUrl, setSearchParams]);

  useEffect(() => {
    // 单向同步（URL → 输入框），且仅在「URL 值不是用户最近编辑产生」时生效：
    // 生产路由启用 v7_startTransition 后 setSearchParams 的提交是异步延迟的，
    // 用户击键期间 queryFromUrl 仍是旧值 —— 若此时按 queryFromUrl 回写
    // setSearchQuery，会把刚输入的内容回退掉（输入闪变/丢字），并让 usePostSearch
    // 的空查询分支把结果重置回全量列表。lastEditedQueryRef 与 URL 一致说明
    // 本次编辑已落地（或本来就是导航带来的变化），此时才允许 URL → state 同步。
    if (lastEditedQueryRef.current !== null && lastEditedQueryRef.current !== queryFromUrl) {
      return;
    }
    if (queryFromUrl !== searchQuery) {
      setSearchQuery(queryFromUrl);
    }
    // URL 已追平最近编辑值：清空守卫，恢复 URL 驱动同步（后退/前进/粘贴链接）。
    if (lastEditedQueryRef.current !== null && lastEditedQueryRef.current === queryFromUrl) {
      lastEditedQueryRef.current = null;
    }
  }, [queryFromUrl, searchQuery, setSearchQuery]);

  const displayedPosts = useMemo(
    () => filterAndSortPosts(results, selectedCategory, sortOrder),
    [results, selectedCategory, sortOrder],
  );
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
    const totalSlots = displayedPosts.reduce((total, post) => total + (post.id === heroPost?.id ? heroSlots : 1), 0);
    const totalPages = Math.max(1, Math.ceil(totalSlots / POSTS_PER_PAGE));

    return { totalSlots, totalPages };
  }, [displayedPosts, heroPost, heroSlots]);

  const { totalPages } = paginationData;

  useEffect(() => {
    const categoryStateFromUrl =
      categoryFromUrl && categories.includes(categoryFromUrl) ? categoryFromUrl : ALL_CATEGORY;
    const filtersAreSynced = selectedCategory === categoryStateFromUrl && searchQuery === queryFromUrl;
    const initialSearchIsPending = Boolean(queryFromUrl.trim()) && results === allPosts;

    if (loading || isSearching || !filtersAreSynced || initialSearchIsPending || currentPage <= totalPages) {
      return;
    }

    setCurrentPage(totalPages);
    setSearchParams((previous) => setHomeQueryParam(previous, 'page', totalPages), { replace: true });
  }, [
    allPosts,
    categories,
    categoryFromUrl,
    currentPage,
    isSearching,
    loading,
    queryFromUrl,
    results,
    searchQuery,
    selectedCategory,
    setSearchParams,
    totalPages,
  ]);

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
    setCurrentPage(1);
    setSearchParams(
      (previous) => {
        const nextParams = new URLSearchParams(previous);

        if (category === ALL_CATEGORY) {
          nextParams.delete('category');
        } else {
          nextParams.set('category', category);
        }
        nextParams.delete('page');

        return nextParams;
      },
      { replace: true },
    );
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
    setSearchParams(
      (previous) => {
        const nextParams = setHomeQueryParam(previous, 'sort', nextSortOrder);
        nextParams.delete('page');
        return nextParams;
      },
      { replace: false },
    );
  };

  const handleSearchChange = (query: string) => {
    lastEditedQueryRef.current = query;
    handleSearch(query);
    setCurrentPage(1);
    // 搜索时删除 page 页码：搜索结果的页数与无搜索时不一致，保留会跳到错误页。
    setSearchParams((previous) => setSearchQueryParams(previous, query, ['page']), { replace: true });
  };

  const handleClearSearch = () => {
    lastEditedQueryRef.current = '';
    clearSearch();
    setCurrentPage(1);
    setSearchParams((previous) => clearSearchQueryParams(previous, ['page']), { replace: true });
  };

  const currentPosts = useMemo(() => {
    const pageStart = (currentPage - 1) * POSTS_PER_PAGE;
    const pageEnd = pageStart + POSTS_PER_PAGE;

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
  }, [currentPage, displayedPosts, heroPost, heroSlots]);

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
    [currentPosts, heroPost],
  );
  const hasFeaturedPost = Boolean(featuredPost);
  const remainingPosts = useMemo(
    () => currentPosts.filter((post) => post.id !== heroPost?.id),
    [currentPosts, heroPost],
  );

  // 分类筛选页（?category=xxx）为可索引内容页（robots: index,follow，canonical 自指），
  // 输出独立的 title/description，避免与首页共用同一套站点级标题造成软重复；
  // 无效分类（URL 直接拼写）回退首页标题。
  const activeCategory = categoryFromUrl && categories.includes(categoryFromUrl) ? categoryFromUrl : null;
  const categoryPostCount = activeCategory ? allPosts.filter((post) => post.category === activeCategory).length : 0;
  const seoTitle =
    hasSearchQuery && results.length > 0
      ? `搜索：${searchQuery}`
      : activeCategory
        ? `分类：${activeCategory} - ${siteConfig.title}`
        : siteConfig.title;
  const seoDescription = activeCategory
    ? `D-blog「${activeCategory}」分类下的全部文章（共 ${categoryPostCount} 篇），涵盖前端开发、后端运维、AI 工具与效率软件测评等主题。`
    : siteConfig.description;

  return (
    <div className="pb-8 md:pb-12">
      {/* 站内搜索页（?q=xxx）统一 noindex：搜索过滤在客户端执行，静态 HTML 无法
          反映搜索意图；且搜索 URL 空间无限，收录会造成软重复与爬虫资源浪费
          （Google 官方对站内搜索结果页的建议即是不索引）。该 noindex 由 Seo 组件
          根据 URL 中的 q 参数自动输出，无需在此显式传入。 */}
      <Seo title={seoTitle} description={seoDescription} />
      <Hero />

      {continueReading && (
        <section
          className="continue-reading mx-4 mb-8 rounded-surface border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:mx-0 md:mb-10 md:p-5"
          aria-labelledby="continue-reading-heading"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                继续阅读
              </p>
              <h2
                id="continue-reading-heading"
                className="truncate font-serif text-xl font-bold text-ink dark:text-white"
              >
                {continueReading.post.title}
              </h2>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                {continueReading.post.category} · 已阅读 {Math.round(continueReading.entry.progress * 100)}%
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Magnet>
                <Link
                  to={`/post/${continueReading.post.id}`}
                  className="editorial-button-primary inline-flex min-h-11 shrink-0 items-center justify-center gap-2 px-4 text-sm font-semibold"
                  aria-label={`继续阅读：${continueReading.post.title}`}
                >
                  继续阅读 <ChevronRight size={15} />
                </Link>
              </Magnet>
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
            <div
              className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
              style={{ width: `${Math.round(continueReading.entry.progress * 100)}%` }}
            />
          </div>
        </section>
      )}

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="space-y-6 px-4 md:space-y-8 md:px-0"
      >
        <FilterBar
          categories={categories}
          selected={selectedCategory}
          onSelect={handleSelectCategory}
          sortOrder={sortOrder}
          onToggleSort={handleToggleSort}
          shouldReduceMotion={shouldReduceMotion}
        />

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
            {hasSearchQuery && results.length > 0 && (
              <div className="flex items-center justify-end px-4 md:px-0">
                <Link
                  to={`/search?q=${encodeURIComponent(searchQuery)}`}
                  className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-zinc-600 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:decoration-zinc-700 dark:hover:text-white"
                >
                  在搜索页查看全部结果 <ChevronRight size={14} aria-hidden="true" />
                </Link>
              </div>
            )}

            <motion.div
              layout={!shouldReduceMotion}
              id="posts-grid"
              className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
              variants={gridExitVariants}
              initial="hidden"
              animate="visible"
              transition={shouldReduceMotion ? { duration: 0 } : gridLayoutTransition}
            >
              {featuredPost && (
                <PostCard
                  key={featuredPost.id}
                  post={featuredPost}
                  index={0}
                  featured
                  onShare={setSharePost}
                  isSaved={savedIds.has(featuredPost.id)}
                  isSaving={savingId === featuredPost.id}
                  onToggleSave={handleToggleSave}
                />
              )}
              {remainingPosts.length > 0 ? (
                remainingPosts.map((post, index) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    index={index + (featuredPost ? 1 : 0)}
                    onShare={setSharePost}
                    isSaved={savedIds.has(post.id)}
                    isSaving={savingId === post.id}
                    onToggleSave={handleToggleSave}
                  />
                ))
              ) : !featuredPost ? (
                <motion.div
                  layout
                  variants={fadeInUp}
                  className="col-span-full border-y border-zinc-200 py-14 text-center dark:border-zinc-800"
                >
                  <p className="text-base text-zinc-500 dark:text-zinc-400">
                    {hasSearchQuery ? '未找到匹配的文章' : '暂无相关文章'}
                  </p>
                  {hasSearchQuery && (
                    <button
                      onClick={handleClearSearch}
                      className="mt-3 text-sm font-medium text-zinc-700 hover:underline dark:text-zinc-300"
                      aria-label="清除搜索条件"
                    >
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
          <ShareModal
            isOpen={!!sharePost}
            onClose={() => setSharePost(null)}
            title={sharePost.title}
            excerpt={sharePost.excerpt}
            url={absoluteSiteUrl(`/post/${encodeURIComponent(sharePost.id)}`, window.location.origin)}
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
