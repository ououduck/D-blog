import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, ArrowDownWideNarrow, ArrowUpWideNarrow, Pin, Clock, Sparkles, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import { SearchField } from '@/components/SearchField';
import { getPosts } from '@/services/posts';
import { PostMetadata } from '../types';
import { siteConfig } from '@config/site.config';
import { Seo } from '../components/Seo';
import { usePostSearch } from '@/hooks/usePostSearch';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { ContentStatus, LoadingStatus } from '@/components/ContentStatus';
import { getDateTimestamp } from '@/utils/date';
import { easeOut, easeSmooth, fadeInUp, staggerContainer } from '@/utils/motion';
import { preloadPage } from '@/utils/preload';

const ShareModal = lazy(() => import('../components/ShareModal').then((m) => ({ default: m.ShareModal })));

const ALL_CATEGORY = '全部';

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

const sortPosts = (posts: PostMetadata[], sortOrder: 'newest' | 'oldest') =>
  posts.slice().sort((a, b) => {
    const priorityA = a.top !== undefined ? 0 : a.featured ? 1 : 2;
    const priorityB = b.top !== undefined ? 0 : b.featured ? 1 : 2;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    if (priorityA === 0) {
      return (a.top ?? 0) - (b.top ?? 0);
    }

    const dateA = getDateTimestamp(a.date);
    const dateB = getDateTimestamp(b.date);
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

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

type PaginationItem = number | 'ellipsis-start' | 'ellipsis-end';

const getPaginationItems = (currentPage: number, totalPages: number, isMobile: boolean): PaginationItem[] => {
  const maxVisible = isMobile ? 5 : 7;

  if (totalPages <= maxVisible) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const siblingCount = isMobile ? 0 : 1;
  const pages = new Set([1, totalPages, currentPage]);

  for (let offset = 1; offset <= siblingCount; offset += 1) {
    if (currentPage - offset > 1) pages.add(currentPage - offset);
    if (currentPage + offset < totalPages) pages.add(currentPage + offset);
  }

  const sortedPages = Array.from(pages).sort((a, b) => a - b);
  const items: PaginationItem[] = [];

  sortedPages.forEach((page, index) => {
    if (index > 0) {
      const previousPage = sortedPages[index - 1];
      if (page - previousPage === 2) {
        items.push(previousPage + 1);
      } else if (page - previousPage > 2) {
        items.push(index === 1 ? 'ellipsis-start' : 'ellipsis-end');
      }
    }

    items.push(page);
  });

  return items;
};

const PostCard: React.FC<{ post: PostMetadata; index: number; featured?: boolean; onShare: (post: PostMetadata) => void }> = ({ post, index, featured, onShare }) => {
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

  const Tags = () => post.tags.length > 0 ? (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
      {post.tags.slice(0, 3).map((tag) => (
        <Link
          key={tag}
          to={`/tags?tag=${encodeURIComponent(tag)}`}
          className="hover:text-ink hover:underline dark:hover:text-white"
          onClick={(event) => event.stopPropagation()}
        >
          #{tag}
        </Link>
      ))}
    </div>
  ) : null;

  if (featured) {
    return (
      <motion.article
        layout
        variants={cardVariants}
        transition={{ duration: 0.25, ease: easeOut }}
        className="col-span-full w-full"
        onMouseEnter={() => preloadPage(`/post/${post.id}`)}
      >
        <div className="overflow-hidden rounded-surface border border-zinc-200 bg-white transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 md:grid md:grid-cols-5">
          <Link to={`/post/${post.id}`} className="block aspect-[16/9] overflow-hidden bg-zinc-100 dark:bg-zinc-800 md:col-span-3 md:aspect-auto md:min-h-80" aria-label={`阅读文章：${post.title}`}>
            {post.coverImage ? (
              <ProgressiveImage src={post.coverImage} alt={post.title} loading="lazy" aspectRatio="16/9" sizes="(max-width: 767px) 100vw, 60vw" wrapperClassName="h-full w-full" className="h-full w-full object-cover" effect="fade" />
            ) : (
              <div className="flex h-full min-h-56 items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                <Sparkles className="h-12 w-12 text-zinc-300 dark:text-zinc-600" />
              </div>
            )}
          </Link>
          <div className="flex flex-col p-5 md:col-span-2 md:p-7">
            <div className="mb-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:text-zinc-400">
              <span>{post.category}</span>
              <span aria-hidden="true">/</span>
              <span>精选</span>
              {post.top !== undefined && (
                <span className="ml-auto flex items-center gap-1 normal-case tracking-normal text-zinc-600 dark:text-zinc-300">
                  <Pin size={11} />
                  置顶
                </span>
              )}
            </div>
            <Link to={`/post/${post.id}`} aria-label={`阅读文章：${post.title}`}>
              <h2 className="mb-3 font-serif text-xl font-bold leading-tight text-ink hover:underline dark:text-white md:text-3xl">
                {post.title}
              </h2>
            </Link>
            <p className="mb-4 line-clamp-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{post.excerpt}</p>
            <Tags />
            <div className="mt-5 flex items-center gap-3 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 md:mt-auto">
              <span className="flex items-center gap-1.5"><Calendar size={12} />{post.date}</span>
              <span className="flex items-center gap-1.5"><Clock size={12} />{post.readTime}</span>
              <button type="button" onClick={handleShareClick} className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-control transition-transform hover:text-ink active:scale-[.98] dark:hover:text-white" aria-label={`分享文章：${post.title}`}>
                <Share2 size={13} />
              </button>
            </div>
          </div>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article layout variants={cardVariants} transition={{ duration: 0.25, ease: easeOut }} className="flex h-full min-w-0 flex-col" onMouseEnter={() => preloadPage(`/post/${post.id}`)}>
      <div className="flex h-full flex-col overflow-hidden rounded-surface border border-zinc-200 bg-white transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600">
        <Link to={`/post/${post.id}`} className="block aspect-[16/10] overflow-hidden bg-zinc-100 dark:bg-zinc-800" aria-label={`阅读文章：${post.title}`}>
          {post.coverImage ? (
            <ProgressiveImage src={post.coverImage} alt={post.title} loading={index === 0 ? 'eager' : 'lazy'} fetchPriority={index === 0 ? 'high' : 'auto'} width={1600} height={1000} aspectRatio="16/10" sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw" wrapperClassName="h-full w-full" className="h-full w-full object-cover" effect="fade" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-300 dark:text-zinc-600">
              <Sparkles className="h-9 w-9" />
            </div>
          )}
        </Link>
        <div className="flex flex-grow flex-col p-4 md:p-5">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            <span>{post.category}</span>
            {post.top !== undefined && (
              <span className="ml-auto flex items-center gap-1 normal-case tracking-normal"><Pin size={10} />置顶</span>
            )}
          </div>
          <Link to={`/post/${post.id}`} aria-label={`阅读文章：${post.title}`}>
            <h3 className="mb-2 line-clamp-2 font-serif text-base font-bold leading-snug text-ink hover:underline dark:text-zinc-100 md:text-lg">
              {post.title}
            </h3>
          </Link>
          <p className="mb-3 line-clamp-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{post.excerpt}</p>
          <Tags />
          <div className="mt-4 flex items-center gap-3 border-t border-zinc-200 pt-3 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
            <span className="flex items-center gap-1"><Calendar size={11} />{post.date}</span>
            <span className="flex items-center gap-1"><Clock size={11} />{post.readTime}</span>
            <button type="button" onClick={handleShareClick} className="ml-auto inline-flex min-h-11 min-w-11 items-center justify-center rounded-control transition-transform hover:text-ink active:scale-[.98] dark:hover:text-white" aria-label={`分享文章：${post.title}`}>
              <Share2 size={12} />
            </button>
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

const FilterBar: React.FC<FilterBarProps> = ({ categories, selected, onSelect, sortOrder, onToggleSort }) => {
  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="flex items-center justify-between gap-3 border-y border-zinc-200 py-3 dark:border-zinc-800">
      <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-2" role="group" aria-label="文章分类筛选">
          {[ALL_CATEGORY, ...categories].map((category) => (
            <button
              key={category}
              onClick={() => onSelect(category)}
              aria-pressed={selected === category}
              className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors active:scale-[.98] ${
                selected === category
                  ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink'
                  : 'border-zinc-300 bg-paper text-zinc-700 hover:border-ink hover:text-ink dark:border-zinc-700 dark:bg-void dark:text-zinc-300 dark:hover:border-white dark:hover:text-white'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
      <button onClick={onToggleSort} aria-pressed={sortOrder === 'oldest'} aria-label={`当前排序：${sortOrder === 'newest' ? '最新优先' : '最早优先'}，点击切换`} className="flex shrink-0 items-center gap-1.5 rounded-control border border-zinc-300 active:scale-[.98] bg-paper px-3 py-1.5 text-sm font-semibold text-zinc-700 transition-colors hover:border-ink hover:text-ink dark:border-zinc-700 dark:bg-void dark:text-zinc-300 dark:hover:border-white dark:hover:text-white">
        {sortOrder === 'newest' ? <ArrowDownWideNarrow size={14} /> : <ArrowUpWideNarrow size={14} />}
        <span>{sortOrder === 'newest' ? '最新' : '最早'}</span>
      </button>
    </motion.div>
  );
};

const Hero = () => {
  return (
    <div className="px-4 pb-8 pt-5 text-center md:pb-10 md:pt-8">
      <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: easeOut }} className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
        {siteConfig.subtitle}
      </motion.p>
      <motion.h1 initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03, duration: 0.3, ease: easeOut }} className="mb-3 font-serif text-4xl font-bold tracking-tight text-ink dark:text-white sm:text-5xl md:text-6xl">
        {siteConfig.title}
      </motion.h1>
      <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: 0.25, ease: easeOut }} className="mx-auto max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-300 md:text-base">
        {siteConfig.description}
      </motion.p>
    </div>
  );
};

export const Home = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get('category');
  const queryFromUrl = searchParams.get('q') || '';
  const [allPosts, setAllPosts] = useState<PostMetadata[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(() => categoryFromUrl || ALL_CATEGORY);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [sharePost, setSharePost] = useState<PostMetadata | null>(null);
  const { searchQuery, isSearching, searchError, results, handleSearch, setSearchQuery, clearSearch, hasSearchQuery } = usePostSearch({
    emptyResults: allPosts,
    initialQuery: queryFromUrl
  });

  const isMobile = useMediaQuery('(max-width: 767px)', false);
  const postsPerPage = isMobile ? 5 : 9;

  useEffect(() => {
    let cancelled = false;

    const loadHomeData = async () => {
      setLoading(true);
      try {
        const posts = await getPosts();
        if (cancelled) {
          return;
        }

        setAllPosts(posts);
        setCategories(Array.from(new Set(posts.map((post) => post.category))));
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
  }, [loadAttempt]);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, sortOrder]);

  const displayedPosts = useMemo(() => filterAndSortPosts(results, selectedCategory, sortOrder), [results, selectedCategory, sortOrder]);

  const paginationData = useMemo(() => {
    const pinnedPosts = displayedPosts.filter(post => post.top !== undefined);
    const regularPosts = displayedPosts.filter(post => post.top === undefined);
    const pinnedPostsSlots = pinnedPosts.length * (isMobile ? 1 : 3);
    const totalSlots = pinnedPostsSlots + regularPosts.length;
    const totalPages = Math.max(1, Math.ceil(totalSlots / postsPerPage));

    return { pinnedPosts, regularPosts, totalSlots, totalPages };
  }, [displayedPosts, isMobile, postsPerPage]);

  const { totalPages } = paginationData;
  const paginationItems = useMemo(() => getPaginationItems(currentPage, totalPages, isMobile), [currentPage, totalPages, isMobile]);

  useEffect(() => {
    setCurrentPage((previous) => Math.min(previous, totalPages));
  }, [totalPages]);

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
    setSearchParams((previous) => {
      const nextParams = new URLSearchParams(previous);

      if (category === ALL_CATEGORY) {
        nextParams.delete('category');
      } else {
        nextParams.set('category', category);
      }

      return nextParams;
    }, { replace: true });
  };

  const handleToggleSort = () => {
    setSortOrder((current) => current === 'newest' ? 'oldest' : 'newest');
  };

  const handleSearchChange = (query: string) => {
    handleSearch(query);
    setSearchParams((previous) => {
      const nextParams = new URLSearchParams(previous);

      if (query.trim()) {
        nextParams.set('q', query);
      } else {
        nextParams.delete('q');
      }

      return nextParams;
    }, { replace: true });
  };

  const handleClearSearch = () => {
    clearSearch();
    setSearchParams((previous) => {
      const nextParams = new URLSearchParams(previous);
      nextParams.delete('q');
      return nextParams;
    }, { replace: true });
  };

  const currentPosts = useMemo(() => {
    const pageStart = (currentPage - 1) * postsPerPage;
    const pageEnd = pageStart + postsPerPage;

    if (isMobile) {
      return displayedPosts.slice(pageStart, pageEnd);
    }

    const pagedPosts: PostMetadata[] = [];
    let consumedSlots = 0;

    for (const post of displayedPosts) {
      const slots = post.top !== undefined ? 3 : 1;
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
  }, [currentPage, displayedPosts, isMobile, postsPerPage]);

  const paginate = (pageNumber: number) => {
    setCurrentPage(Math.min(Math.max(1, pageNumber), totalPages));
    const shouldReduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  };

  const featuredPost = useMemo(() => currentPosts.find((post) => post.featured) ?? null, [currentPosts]);
  const remainingPosts = useMemo(() => currentPosts.filter((post) => post !== featuredPost), [currentPosts, featuredPost]);

  return (
    <div className="pb-16 md:pb-24">
      <Seo title={siteConfig.title} description={siteConfig.description} url="/" />
      <Hero />

      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6 px-4 md:space-y-8 md:px-0">
        <FilterBar categories={categories} selected={selectedCategory} onSelect={handleSelectCategory} sortOrder={sortOrder} onToggleSort={handleToggleSort} />

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
          <motion.div variants={fadeInUp} className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            <LoadingStatus label={isSearching ? '正在搜索文章' : '正在加载文章列表'} className="col-span-full" />
            {Array.from({ length: postsPerPage }).map((_, index) => (
              <div key={index} aria-hidden="true" className="animate-pulse overflow-hidden rounded-surface border border-zinc-200 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                <div className="aspect-[16/10] bg-zinc-200 dark:bg-zinc-800" />
                <div className="space-y-3 p-4">
                  <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-4 w-4/5 bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3 w-full bg-zinc-200 dark:bg-zinc-800" />
                  <div className="h-3 w-2/3 bg-zinc-200 dark:bg-zinc-800" />
                </div>
              </div>
            ))}
          </motion.div>
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
          <div id="posts-panel" className="space-y-7" aria-live="polite">
            <motion.div
              layout
              id="posts-grid"
              className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3"
              variants={gridExitVariants}
              initial="hidden"
              animate="visible"
              transition={gridLayoutTransition}
            >
              {featuredPost && <PostCard key={featuredPost.id} post={featuredPost} index={0} featured onShare={setSharePost} />}
              {remainingPosts.length > 0 ? (
                remainingPosts.map((post, index) => <PostCard key={post.id} post={post} index={index + (featuredPost ? 1 : 0)} onShare={setSharePost} />)
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

            {totalPages > 1 && (
              <nav className="flex flex-wrap items-center justify-center gap-2 border-t border-zinc-200 pt-5 dark:border-zinc-800" aria-label="分页导航">
                <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="inline-flex h-9 items-center gap-1 rounded-full border border-zinc-300 active:scale-[.98] bg-paper px-3 text-sm font-semibold text-zinc-700 transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:bg-void dark:text-zinc-300 dark:hover:border-white dark:hover:text-white" aria-label="上一页">
                  <ChevronLeft size={15} />
                  <span className="hidden sm:inline">上一页</span>
                </button>
                <div className="flex items-center gap-1" aria-live="polite">
                  {paginationItems.map((item) => item === 'ellipsis-start' || item === 'ellipsis-end' ? (
                    <span key={item} className="flex h-9 min-w-9 items-center justify-center px-1 text-sm text-zinc-400 dark:text-zinc-600" aria-hidden="true">...</span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => paginate(item)}
                      aria-current={currentPage === item ? 'page' : undefined}
                      className={`h-9 min-w-9 rounded-full border px-3 text-sm font-semibold transition-colors active:scale-[.98] ${
                        currentPage === item
                          ? 'border-ink bg-ink text-white dark:border-white dark:bg-white dark:text-ink'
                          : 'border-zinc-300 bg-paper text-zinc-700 hover:border-ink hover:text-ink dark:border-zinc-700 dark:bg-void dark:text-zinc-300 dark:hover:border-white dark:hover:text-white'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="inline-flex h-9 items-center gap-1 rounded-full border border-zinc-300 active:scale-[.98] bg-paper px-3 text-sm font-semibold text-zinc-700 transition-colors hover:border-ink hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:bg-void dark:text-zinc-300 dark:hover:border-white dark:hover:text-white" aria-label="下一页">
                  <span className="hidden sm:inline">下一页</span>
                  <ChevronRight size={15} />
                </button>
              </nav>
            )}
          </div>
        )}
      </motion.div>

      {sharePost && (
        <Suspense fallback={null}>
          <ShareModal isOpen={!!sharePost} onClose={() => setSharePost(null)} title={sharePost.title} excerpt={sharePost.excerpt} url={`${window.location.origin}/post/${sharePost.id}`} />
        </Suspense>
      )}
    </div>
  );
};
