import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, ArrowUpRight, Search, ArrowDownWideNarrow, ArrowUpWideNarrow, Pin, Clock, Sparkles, ChevronLeft, ChevronRight, Share2 } from 'lucide-react';
import { getPosts } from '@/services/posts';
import { PostMetadata } from '../types';
import { siteConfig } from '@config/site.config';
import { Seo } from '../components/Seo';
import { usePostSearch } from '@/hooks/usePostSearch';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { getDateTimestamp } from '@/utils/date';
import { easeOut, easeSmooth, fadeInUp, staggerContainer, cardHover, chipHover } from '@/utils/motion';
import { preloadPage } from '@/utils/preload';

const ShareModal = lazy(() => import('../components/ShareModal').then((m) => ({ default: m.ShareModal })));


const ALL_CATEGORY = '全部';

const listSwapTransition = {
  duration: 0.2,
  ease: easeSmooth,
} as const;

const gridExitVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.025,
      delayChildren: 0.02,
    },
  },
  exit: {
    opacity: 0,
    y: 10,
    scale: 0.98,
    filter: 'blur(2px)',
    transition: { duration: 0.18, ease: easeSmooth },
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

const PostCard: React.FC<{ post: PostMetadata; index: number; featured?: boolean; onShare: (post: PostMetadata) => void }> = ({ post, index, featured, onShare }) => {
  const shouldReduceMotion = useReducedMotion();
  const cardVariants = {
    hidden: { opacity: 0, y: 16, scale: 0.97 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.35,
        ease: easeSmooth,
        delay: index * 0.025
      }
    }
  };
  const hoverMotion = shouldReduceMotion
    ? undefined
    : { y: -2 };


  const CategoryBadge = ({ text }: { text: string }) => (
    <span className="z-10 rounded-full bg-white/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink transition-transform group-hover:scale-105 dark:text-white">
      {text}
    </span>
  );

  const handleShareClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onShare(post);
  };

  if (featured) {
    return (
      <motion.article
        layout
        variants={cardVariants}
        whileHover={hoverMotion}
        transition={{ duration: 0.3, ease: easeOut }}
        className="col-span-full w-full"
        onMouseEnter={() => preloadPage(`/post/${post.id}`)}
      >
        <div className="relative flex h-auto flex-col overflow-hidden rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 transition-all duration-500 hover:-translate-y-1 dark:hover:border-zinc-700 md:h-[440px] md:flex-row md:rounded-3xl">
          <Link to={`/post/${post.id}`} className="group relative block h-56 w-full overflow-hidden md:h-full md:w-3/5" aria-label={`阅读文章：${post.title}`}>
            <div className="absolute inset-0 animate-pulse bg-zinc-200 dark:bg-zinc-800" />
            {post.coverImage ? (
              <ProgressiveImage src={post.coverImage} alt={post.title} loading="lazy" aspectRatio="16/9" sizes="(max-width: 767px) 100vw, 60vw" wrapperClassName="absolute inset-0" className="h-full w-full object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-105" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                <Sparkles className="h-16 w-16 text-zinc-300" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-black/5 to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-black/10" />
            <div className="absolute left-4 top-4 md:left-6 md:top-6">
              <CategoryBadge text={post.category} />
            </div>
          </Link>
          <div
            className="relative flex w-full flex-col justify-center bg-white/90 p-5 backdrop-blur-sm dark:bg-zinc-900/90 md:w-2/5 md:p-10"
          >
            {post.top !== undefined && (
              <div className="absolute right-4 top-4 md:right-6 md:top-6 flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-[10px] font-bold text-ink dark:bg-white/10 dark:text-white">
                <Pin size={10} fill="currentColor" />
                <span>置顶</span>
              </div>
            )}
            <div className="mb-3 md:mb-5">
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400 dark:text-zinc-500">Featured</span>
            </div>
            <Link to={`/post/${post.id}`} className="group/text" aria-label={`阅读文章：${post.title}`}>
              <h2 className="mb-3 font-serif text-lg font-bold leading-[1.2] text-ink transition-colors duration-300 group-hover/text:text-zinc-700 dark:text-white dark:group-hover/text:text-zinc-300 md:mb-5 md:text-3xl">
                {post.title}
              </h2>
            </Link>
            <p className="mb-5 font-sans text-xs leading-relaxed text-zinc-500 line-clamp-3 dark:text-zinc-400 md:mb-6 md:text-sm">{post.excerpt}</p>
            <div className="mt-auto flex items-center gap-3 text-[10px] font-semibold tracking-wide text-zinc-400 dark:text-zinc-500 md:text-xs">
              <div className="flex items-center gap-1.5">
                <Calendar size={12} />
                <span>{post.date}</span>
              </div>
              <div className="h-0.5 w-0.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <div className="flex items-center gap-1.5">
                <Clock size={12} />
                <span>{post.readTime}</span>
              </div>
              <button onClick={handleShareClick} className="ml-auto rounded-full p-1.5 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100" aria-label={`分享文章：${post.title}`}>
                <Share2 size={13} />
              </button>
            </div>
          </div>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article layout variants={cardVariants} whileHover={hoverMotion} transition={{ duration: 0.3, ease: easeOut }} className="flex h-full flex-col min-w-0" onMouseEnter={() => preloadPage(`/post/${post.id}`)}>
      <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 transition-all duration-500 hover:-translate-y-1 dark:hover:border-zinc-700">
        <Link to={`/post/${post.id}`} className="group/image relative aspect-[16/9] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 md:aspect-[16/10]" aria-label={`阅读文章：${post.title}`}>
          {post.coverImage ? (
            <ProgressiveImage src={post.coverImage} alt={post.title} loading="lazy" width={1600} height={1000} aspectRatio="16/10" sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 33vw" wrapperClassName="h-full w-full" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover/image:scale-105" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-300">
              <Sparkles className="h-10 w-10 opacity-50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity duration-500 group-hover/image:opacity-100" />
          <div className="absolute left-3 top-3">
            <CategoryBadge text={post.category} />
          </div>
          <div className="absolute right-3 top-3 z-10">
            {post.top !== undefined ? (
              <div className="flex items-center gap-1 rounded-full bg-ink/80 px-2 py-0.5 text-[9px] font-bold text-white backdrop-blur dark:bg-white/80 dark:text-ink">
                <Pin size={9} fill="currentColor" />
                <span>置顶</span>
              </div>
            ) : (
              <div className="rounded-full bg-white/90 p-2 opacity-0 shadow-lg backdrop-blur transition-all duration-300 group-hover/image:translate-y-0 group-hover/image:opacity-100 dark:bg-black/80">
                <ArrowUpRight size={14} className="text-ink dark:text-white" />
              </div>
            )}
          </div>
        </Link>
        <div className="flex flex-grow flex-col p-4 md:p-5">
          <Link to={`/post/${post.id}`} className="group/text" aria-label={`阅读文章：${post.title}`}>
            <h3 className="mb-1.5 line-clamp-2 text-sm font-serif font-bold leading-snug text-ink transition-colors group-hover/text:text-zinc-700 dark:text-gray-100 dark:group-hover/text:text-zinc-300 md:mb-2 md:text-lg">
              {post.title}
            </h3>
          </Link>
          <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 md:mb-5 md:text-sm">{post.excerpt}</p>
          <div className="mt-auto flex items-center justify-between border-t border-zinc-100/80 pt-3 text-[10px] font-semibold text-zinc-400 dark:border-zinc-800/80 dark:text-zinc-500 md:text-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1">
                <Calendar size={11} />
                <span>{post.date}</span>
              </div>
              <div className="h-0.5 w-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
              <div className="flex items-center gap-1">
                <Clock size={11} />
                <span>{post.readTime}</span>
              </div>
            </div>
            <button onClick={handleShareClick} className="rounded-md p-1 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100" aria-label={`分享文章：${post.title}`}>
              <Share2 size={11} />
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
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="mb-8 flex items-center justify-between gap-3 rounded-xl bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 px-3 py-2.5 md:mb-10 md:gap-4 md:rounded-2xl md:px-4 md:py-3">
      <div className="-mx-2 w-full overflow-x-auto px-2 no-scrollbar md:mx-0 md:w-auto md:px-0">
        <div className="flex space-x-1.5 md:space-x-2" role="tablist" aria-label="文章分类筛选">
          {[ALL_CATEGORY, ...categories].map((category) => (
            <button
              key={category}
              onClick={() => onSelect(category)}
              role="tab"
              aria-selected={selected === category}
              aria-controls="posts-grid"
              tabIndex={selected === category ? 0 : -1}
              className={`relative whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide transition-all duration-200 hover:-translate-y-px active:scale-95 md:px-4 md:py-2 md:text-sm ${
                selected === category
                  ? 'text-white dark:text-ink'
                  : 'text-zinc-500 hover:bg-zinc-100 hover:text-ink dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-white'
              }`}
            >
              {selected === category && (
                <motion.span
                  layoutId="activeCategoryPill"
                  className="absolute inset-0 rounded-full bg-ink shadow-md dark:bg-white"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}
              <span className="relative z-10">{category}</span>
            </button>
          ))}
        </div>
      </div>
      <button onClick={onToggleSort} aria-pressed={sortOrder === 'oldest'} aria-label={`当前排序：${sortOrder === 'newest' ? '最新优先' : '最早优先'}，点击切换`} className="flex shrink-0 items-center space-x-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-500 transition-all duration-200 hover:-translate-y-px hover:text-ink active:scale-95 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-white md:px-4 md:py-2 md:text-sm">
        {sortOrder === 'newest' ? <ArrowDownWideNarrow size={13} /> : <ArrowUpWideNarrow size={13} />}
        <span>{sortOrder === 'newest' ? '最新' : '最早'}</span>
      </button>
    </motion.div>
  );
};

const Hero = () => {
  return (
    <div className="relative z-10 flex flex-col items-center px-4 pt-6 pb-10 text-center md:pt-14 md:pb-16">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: easeOut }} className="mb-4 flex items-center gap-3">
        <div className="h-px w-8 bg-zinc-300 dark:bg-zinc-700" />
        <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400 md:text-xs">
          {siteConfig.subtitle}
        </span>
        <div className="h-px w-8 bg-zinc-300 dark:bg-zinc-700" />
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.04, duration: 0.4, ease: easeOut }} className="mb-4 font-serif text-6xl font-black leading-[0.95] tracking-tighter bg-gradient-to-br from-ink to-zinc-600 bg-clip-text text-transparent sm:text-7xl md:mb-5 md:text-8xl lg:text-9xl">
        {siteConfig.title}
      </motion.h1>
      <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.35, ease: easeOut }} className="mx-auto max-w-lg font-sans text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 md:max-w-xl md:text-base">
        {siteConfig.description}
      </motion.p>
    </div>
  );
};

export const Home = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get('category');
  const [allPosts, setAllPosts] = useState<PostMetadata[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(() => categoryFromUrl || ALL_CATEGORY);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sharePost, setSharePost] = useState<PostMetadata | null>(null);
  const { searchQuery, isSearching, results, handleSearch, clearSearch, hasSearchQuery } = usePostSearch({
    emptyResults: allPosts
  });

  // 使用自定义 hook 监听媒体查询
  const isMobile = useMediaQuery('(max-width: 767px)', false);
  const postsPerPage = isMobile ? 5 : 9;

  useEffect(() => {
    let cancelled = false;

    const loadHomeData = async () => {
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
  }, []);

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
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, sortOrder]);

  const displayedPosts = useMemo(() => filterAndSortPosts(results, selectedCategory, sortOrder), [results, selectedCategory, sortOrder]);

  // 使用 useMemo 缓存分页相关计算
  const paginationData = useMemo(() => {
    const pinnedPosts = displayedPosts.filter(post => post.top !== undefined);
    const regularPosts = displayedPosts.filter(post => post.top === undefined);
    
    // 计算顶置文章占用的位置：移动端单列展示占 1 个位置，大屏端占 3 个位置
    const pinnedPostsSlots = pinnedPosts.length * (isMobile ? 1 : 3);
    // 总位置数 = 顶置文章占用的位置 + 普通文章数量
    const totalSlots = pinnedPostsSlots + regularPosts.length;
    const totalPages = Math.max(1, Math.ceil(totalSlots / postsPerPage));

    return { pinnedPosts, regularPosts, totalSlots, totalPages };
  }, [displayedPosts, isMobile, postsPerPage]);

  const { pinnedPosts, regularPosts, totalPages } = paginationData;

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
    });

    document.getElementById('posts-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleClearSearch = () => {
    clearSearch();
    setCurrentPage(1);
  };

  const activeCategoryLabel = selectedCategory === ALL_CATEGORY ? '全部分类' : selectedCategory;

  // 使用 useMemo 缓存当前页文章计算
  const currentPosts = useMemo(() => {
    const startSlot = (currentPage - 1) * postsPerPage;
    const endSlot = startSlot + postsPerPage;

    const result: PostMetadata[] = [];
    let currentSlot = 0;

    // 先处理顶置文章
    for (const post of pinnedPosts) {
      const postSlots = isMobile ? 1 : 3;
      const postEndSlot = currentSlot + postSlots;

      // 如果这个顶置文章的任何一个位置在当前页范围内，就显示它
      if (postEndSlot > startSlot && currentSlot < endSlot) {
        result.push(post);
      }

      currentSlot = postEndSlot;

      // 如果已经超出当前页范围，停止处理顶置文章
      if (currentSlot >= endSlot) {
        return result;
      }
    }

    // 再处理普通文章
    for (const post of regularPosts) {
      if (currentSlot >= endSlot) {
        break;
      }

      if (currentSlot >= startSlot) {
        result.push(post);
      }

      currentSlot++;
    }

    return result;
  }, [currentPage, postsPerPage, pinnedPosts, regularPosts, isMobile]);

  const paginate = (pageNumber: number) => {
    const nextPage = Math.min(Math.max(pageNumber, 1), totalPages);
    setCurrentPage(nextPage);
    document.getElementById('posts-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="pb-8 md:pb-14">
      <Seo title="D-blog" description="跑路的duck的个人博客，分享前端技术、编程教程与生活感悟，探索极致的静态页面体验。" />
      <Hero />

      {!loading && !loadError && (
        <motion.div variants={fadeInUp} initial="hidden" animate="visible" transition={{ delay: 0.03 }}>
          <AnimatePresence mode="wait" initial={false}>
            {hasSearchQuery && (
              <motion.div key={`search-summary-${searchQuery}-${activeCategoryLabel}`} initial={{ opacity: 0, y: 8, scale: 0.992 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.992 }} transition={listSwapTransition} className="mb-5 px-1 md:mb-6">
                <motion.div layout className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-800 dark:bg-zinc-900 md:rounded-2xl md:px-4 md:py-3">
                  <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.25, delay: 0.03, ease: easeOut }}>
                    <Search size={14} className="text-zinc-400 dark:text-zinc-500" />
                  </motion.div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 md:text-sm">
                    搜索 "<span className="font-semibold text-ink dark:text-zinc-200">{searchQuery}</span>" 共命中 {results.length} 篇，按 "<span className="font-semibold text-ink dark:text-zinc-200">{activeCategoryLabel}</span>" 显示 {displayedPosts.length} 篇
                  </p>
                  <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.18, ease: easeOut }} onClick={handleClearSearch} className="ml-auto rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-ink dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700 dark:hover:text-white md:text-xs" aria-label="清除搜索">
                    清除
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <FilterBar categories={categories} selected={selectedCategory} onSelect={handleSelectCategory} sortOrder={sortOrder} onToggleSort={() => setSortOrder((previous) => (previous === 'newest' ? 'oldest' : 'newest'))} />
        </motion.div>
      )}

      <motion.div id="posts-grid" className="scroll-mt-32" variants={fadeInUp} initial="hidden" animate="visible" transition={{ delay: 0.06 }}>
        {loading || isSearching ? (
          <motion.div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3" variants={staggerContainer} initial="hidden" animate="visible">
            {[1, 2, 3].map((item) => (
              <motion.div key={item} variants={fadeInUp} className="h-72 animate-pulse rounded-2xl bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </motion.div>
        ) : loadError ? (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={listSwapTransition} className="col-span-full rounded-[2rem] border border-dashed border-zinc-200 bg-white/90 dark:bg-zinc-900/90 py-16 text-center dark:border-zinc-800">
            <p className="mb-2 font-serif text-xl text-zinc-700 dark:text-zinc-300">加载失败</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{loadError}</p>
          </motion.div>
        ) : (
          <div className="space-y-8 md:space-y-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${selectedCategory}-${sortOrder}-${currentPage}-${searchQuery}`}
                className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3"
                variants={gridExitVariants}
                initial="hidden"
                animate="visible"
              >
                {currentPosts.length > 0 ? (
                  currentPosts.map((post, index) => <PostCard key={post.id} post={post} index={index} featured={!!post.featured} onShare={setSharePost} />)
                ) : (
                  <motion.div variants={fadeInUp} className="col-span-full rounded-2xl border border-dashed border-zinc-200 py-20 text-center dark:border-zinc-800">
                    <p className="mb-2 font-serif text-lg text-zinc-400">{hasSearchQuery ? '未找到匹配的文章' : '暂无相关文章'}</p>
                    {hasSearchQuery && (
                      <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.18, ease: easeOut }} onClick={handleClearSearch} className="mt-4 text-sm text-zinc-700 hover:underline dark:text-zinc-300" aria-label="清除搜索条件">
                        清除搜索条件
                      </motion.button>
                    )}
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>

            {totalPages > 1 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: easeOut }} className="flex items-center justify-center gap-3 pt-2" aria-label="分页导航">
                <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.18, ease: easeOut }} onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="rounded-full border border-zinc-200 bg-white p-2.5 text-zinc-500 transition-colors hover:border-zinc-300 hover:text-ink disabled:opacity-25 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white md:p-3" aria-label="上一页">
                  <ChevronLeft size={16} />
                </motion.button>
                <motion.span layout transition={{ type: 'spring', stiffness: 300, damping: 30, mass: 0.6 }} className="rounded-full border border-zinc-200 bg-white px-3.5 py-1.5 font-mono text-xs font-semibold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 md:px-4 md:py-2 md:text-sm" aria-live="polite">
                  {currentPage} / {totalPages}
                </motion.span>
                <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }} transition={{ duration: 0.18, ease: easeOut }} onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="rounded-full border border-zinc-200 bg-white p-2.5 text-zinc-500 transition-colors hover:border-zinc-300 hover:text-ink disabled:opacity-25 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white md:p-3" aria-label="下一页">
                  <ChevronRight size={16} />
                </motion.button>
              </motion.div>
            )}
          </div>
        )}
      </motion.div>

      {shareModal}
    </div>
  );
};


