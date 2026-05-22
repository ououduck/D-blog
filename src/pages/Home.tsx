import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, ArrowUpRight, Search, ArrowDownWideNarrow, ArrowUpWideNarrow, Pin, Clock, Sparkles, ChevronLeft, ChevronRight, Share2, ChevronDown } from 'lucide-react';
import { getPosts } from '@/services/posts';
import { PostMetadata } from '../types';
import { siteConfig } from '@config/site.config';
import { Seo } from '../components/Seo';
import { ShareModal } from '../components/ShareModal';
import { usePostSearch } from '@/hooks/usePostSearch';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { getDateTimestamp } from '@/utils/date';

const ALL_CATEGORY = '全部';

const easeOutQuint = [0.16, 1, 0.3, 1] as const;
const easeOutSoft = [0.22, 1, 0.36, 1] as const;
const springCardLayout = {
  type: 'spring',
  stiffness: 220,
  damping: 26,
  mass: 0.72
} as const;

const sectionFadeIn = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.62,
      ease: easeOutQuint
    }
  }
} as const;

const chipMotion = {
  rest: { y: 0, scale: 1 },
  hover: {
    y: -1.5,
    scale: 1.008,
    transition: {
      duration: 0.28,
      ease: [0.22, 1, 0.36, 1]
    }
  },
  tap: {
    scale: 0.992,
    transition: {
      duration: 0.16,
      ease: [0.3, 0, 0.2, 1]
    }
  }
} as const;

const pageBlockVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.64,
      ease: [0.16, 1, 0.3, 1]
    }
  }
} as const;

const listContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.03
    }
  }
} as const;

const listSwapTransition = {
  duration: 0.32,
  ease: [0.16, 1, 0.3, 1]
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
    hidden: { opacity: 0, y: 24, scale: 0.985 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.58,
        ease: easeOutSoft,
        delay: index * 0.05
      }
    }
  };
  const hoverMotion = shouldReduceMotion
    ? undefined
    : featured
      ? { y: -4, scale: 1.003 }
      : { y: -6, scale: 1.01 };


  const CategoryBadge = ({ text }: { text: string }) => (
    <span className="z-10 rounded-full border border-white/20 bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink shadow-sm backdrop-blur-md transition-transform group-hover:scale-105 dark:border-white/10 dark:bg-black/60 dark:text-white">
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
        transition={springCardLayout}
        className="col-span-full w-full"
      >
        <div className="relative flex h-auto flex-col overflow-hidden rounded-[2rem] border border-zinc-200 bg-white transition-all duration-500 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-1 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700 dark:hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] md:h-[480px] md:flex-row">
          <Link to={`/post/${post.id}`} className="group relative block h-64 w-full overflow-hidden md:h-full md:w-7/12" aria-label={`阅读文章：${post.title}`}>
            <div className="absolute inset-0 animate-pulse bg-zinc-200 dark:bg-zinc-800" />
            {post.coverImage ? (
              <ProgressiveImage src={post.coverImage} alt={post.title} loading="lazy" wrapperClassName="absolute inset-0" className="h-full w-full object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-105" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                <Sparkles className="h-16 w-16 text-zinc-300" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-60" />
            <div className="absolute left-6 top-6">
              <CategoryBadge text={post.category} />
            </div>
          </Link>
          <motion.div
            className="relative flex w-full flex-col justify-center bg-white p-6 backdrop-blur-sm dark:bg-zinc-900/80 md:w-5/12 md:p-12"
            initial={shouldReduceMotion ? false : { opacity: 0, x: 18 }}
            animate={shouldReduceMotion ? undefined : { opacity: 1, x: 0 }}
            transition={shouldReduceMotion ? undefined : { duration: 0.56, delay: 0.08 + index * 0.04, ease: easeOutSoft }}
          >
            {post.top !== undefined && (
              <div className="absolute right-6 top-6 rounded-full border border-zinc-200 bg-zinc-100 p-2 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                <Pin size={16} fill="currentColor" />
              </div>
            )}
            <div className="mb-4 md:mb-6">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-700 dark:text-zinc-300">Featured Post</span>
            </div>
            <Link to={`/post/${post.id}`} className="group/text" aria-label={`阅读文章：${post.title}`}>
              <h2 className="mb-4 font-serif text-xl font-bold leading-[1.1] text-ink transition-colors duration-300 group-hover/text:text-zinc-700 dark:text-white dark:group-hover/text:text-zinc-300 md:mb-6 md:text-4xl">
                {post.title}
              </h2>
            </Link>
            <p className="mb-6 font-sans text-sm leading-relaxed text-zinc-600 line-clamp-3 dark:text-zinc-300 md:mb-8 md:text-base">{post.excerpt}</p>
            <div className="mt-auto flex items-center gap-4 text-xs font-bold tracking-wider text-zinc-700 dark:text-zinc-300">
              <div className="flex items-center gap-2">
                <Calendar size={14} />
                <span>{post.date}</span>
              </div>
              <div className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <div className="flex items-center gap-2">
                <Clock size={14} />
                <span>{post.readTime}</span>
              </div>
              <button onClick={handleShareClick} className="ml-auto rounded-full p-2 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100" aria-label={`分享文章：${post.title}`}>
                <Share2 size={16} />
              </button>
            </div>
          </motion.div>
        </div>
      </motion.article>
    );
  }

  return (
    <motion.article layout variants={cardVariants} whileHover={hoverMotion} transition={springCardLayout} className="flex h-full flex-col min-w-0">
      <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white backdrop-blur-md transition-all duration-500 hover:border-zinc-300 hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-1 dark:border-zinc-800/80 dark:bg-zinc-900/40 dark:hover:border-zinc-700 dark:hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] md:rounded-3xl">
        <Link to={`/post/${post.id}`} className="group/image relative aspect-[16/10] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800" aria-label={`阅读文章：${post.title}`}>
          {post.coverImage ? (
            <ProgressiveImage src={post.coverImage} alt={post.title} loading="lazy" width={1600} height={1000} wrapperClassName="h-full w-full" className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover/image:scale-110" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-300">
              <Sparkles className="h-10 w-10 opacity-50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity duration-500 group-hover/image:opacity-100" />
          <div className="absolute left-2 top-2 md:left-4 md:top-4">
            <CategoryBadge text={post.category} />
          </div>
          <div className="absolute right-2 top-2 z-10 md:right-4 md:top-4">
            {post.top !== undefined ? (
              <div className="rounded-full bg-zinc-900 p-1 text-white shadow-lg dark:bg-zinc-100 dark:text-zinc-900 md:p-1.5">
                <Pin size={12} className="md:h-3.5 md:w-3.5" fill="currentColor" />
              </div>
            ) : (
              <div className="rounded-full bg-white/90 p-2 opacity-0 shadow-lg backdrop-blur transition-all duration-300 group-hover/image:translate-y-0 group-hover/image:opacity-100 dark:bg-black/80 md:p-2.5">
                <ArrowUpRight size={14} className="text-ink dark:text-white md:h-4 md:w-4" />
              </div>
            )}
          </div>
        </Link>
        <div className="flex flex-grow flex-col p-4 md:p-7">
          <Link to={`/post/${post.id}`} className="group/text" aria-label={`阅读文章：${post.title}`}>
            <h3 className="mb-2 line-clamp-2 text-base font-serif font-bold leading-tight text-ink transition-colors group-hover/text:text-zinc-700 dark:text-gray-100 dark:group-hover/text:text-zinc-300 md:mb-3 md:text-xl">
              {post.title}
            </h3>
          </Link>
          <p className="mb-6 hidden flex-grow line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300 md:block">{post.excerpt}</p>
          <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-3 text-[10px] font-bold tracking-wide text-zinc-700 dark:border-zinc-800 dark:text-zinc-300 md:pt-5 md:text-xs">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex items-center gap-1 md:gap-1.5">
                <Calendar size={12} className="md:h-[13px] md:w-[13px]" />
                <span>{post.date}</span>
              </div>
            </div>
            <button onClick={handleShareClick} className="rounded-md p-1.5 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100" aria-label={`分享文章：${post.title}`}>
              <Share2 size={12} className="md:h-[14px] md:w-[14px]" />
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
    <motion.div variants={sectionFadeIn} initial="hidden" animate="visible" className="mb-12 flex flex-col items-center justify-between gap-4 rounded-[1.75rem] border border-zinc-200/70 bg-white/80 px-3 py-3 shadow-[0_20px_55px_-42px_rgba(28,25,23,0.55)] backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/50 md:flex-row md:px-4">
      <div className="-mx-4 w-full overflow-x-auto px-4 pb-2 no-scrollbar md:mx-0 md:w-auto md:px-0 md:pb-0">
        <div className="flex space-x-2" role="tablist" aria-label="文章分类筛选">
          {[ALL_CATEGORY, ...categories].map((category) => (
            <motion.button
              key={category}
              onClick={() => onSelect(category)}
              role="tab"
              aria-selected={selected === category}
              aria-controls="posts-grid"
              tabIndex={selected === category ? 0 : -1}
              variants={chipMotion}
              initial="rest"
              animate="rest"
              whileHover="hover"
              whileTap="tap"
              className={`whitespace-nowrap rounded-full border px-5 py-2.5 text-sm font-bold tracking-wide transition-all duration-300 ${
                selected === category
                  ? 'scale-[1.02] border-ink bg-ink text-white shadow-lg shadow-zinc-900/10 dark:border-white dark:bg-white dark:text-ink'
                  : 'border-transparent bg-transparent text-zinc-700 hover:border-zinc-200 hover:bg-zinc-50 hover:text-ink dark:hover:border-zinc-700 dark:hover:bg-zinc-800/80 dark:hover:text-white'
              }`}
            >
              {category}
            </motion.button>
          ))}
        </div>
      </div>
      <motion.button onClick={onToggleSort} aria-pressed={sortOrder === 'oldest'} aria-label={`当前排序：${sortOrder === 'newest' ? '最新优先' : '最早优先'}，点击切换`} variants={chipMotion} initial="rest" animate="rest" whileHover="hover" whileTap="tap" className="flex w-full items-center justify-center space-x-2 rounded-full border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold tracking-wide text-zinc-700 transition-all duration-300 hover:border-zinc-300 hover:text-ink dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:hover:text-white md:w-auto">
        {sortOrder === 'newest' ? <ArrowDownWideNarrow size={16} /> : <ArrowUpWideNarrow size={16} />}
        <span>{sortOrder === 'newest' ? '最新' : '最早'}</span>
      </motion.button>
    </motion.div>
  );
};

const Hero = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="relative z-10 flex flex-col items-center px-4 py-20 text-center md:py-32">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.64, ease: [0.16, 1, 0.3, 1] }} className="relative mb-8">
        <motion.span
          className="relative z-10 text-xs font-bold uppercase tracking-[0.3em] text-zinc-700 dark:text-zinc-300 md:text-sm"
          animate={shouldReduceMotion ? undefined : { opacity: [0.92, 1, 0.94] }}
          transition={shouldReduceMotion ? undefined : { duration: 6.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {siteConfig.subtitle}
        </motion.span>
        <motion.div
          className="absolute -inset-4 rounded-full bg-zinc-200/50 blur-xl dark:bg-zinc-800/50"
          animate={shouldReduceMotion ? undefined : { scale: [1, 1.05, 1], opacity: [0.62, 0.9, 0.66] }}
          transition={shouldReduceMotion ? undefined : { duration: 8.6, repeat: Infinity, ease: 'easeInOut' }}
        />
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.82, ease: [0.16, 1, 0.3, 1] }} className="mb-6 font-serif text-[5.5rem] font-black leading-[0.95] tracking-tighter bg-gradient-to-br from-ink to-zinc-600 bg-clip-text text-transparent drop-shadow-[0_12px_32px_rgba(28,25,23,0.18)] dark:from-white dark:to-zinc-400 dark:drop-shadow-[0_12px_36px_rgba(255,255,255,0.1)] sm:text-[7rem] md:mb-8 md:text-[9rem] lg:text-[11rem]">
        {siteConfig.title}
      </motion.h1>
      <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16, duration: 0.72, ease: [0.16, 1, 0.3, 1] }} className="mx-auto mb-12 max-w-2xl font-sans text-base leading-relaxed text-zinc-600 dark:text-zinc-300 md:text-xl">
        {siteConfig.description}
      </motion.p>
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.24, duration: 0.72, ease: [0.16, 1, 0.3, 1] }}
        className="mt-8 flex flex-col items-center gap-3"
      >
        <motion.button
          onClick={() => document.getElementById('posts-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="group flex flex-col items-center gap-2 rounded-xl px-10 py-3 transition-colors hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40"
          aria-label="向下浏览文章"
        >
          <motion.span
            className="text-sm font-medium tracking-wide text-zinc-400 transition-colors group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300"
            animate={shouldReduceMotion ? undefined : { opacity: [0.5, 1, 0.5] }}
            transition={shouldReduceMotion ? undefined : { duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            向下浏览
          </motion.span>
          <motion.div
            animate={shouldReduceMotion ? undefined : {
              y: [0, 8, 0],
              opacity: [0.45, 1, 0.45],
              scale: [0.92, 1.08, 0.92],
            }}
            transition={shouldReduceMotion ? undefined : {
              duration: 2.8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          >
            <ChevronDown
              size={28}
              className="text-zinc-400 transition-colors group-hover:text-zinc-600 dark:text-zinc-500 dark:group-hover:text-zinc-300"
              strokeWidth={2}
            />
          </motion.div>
        </motion.button>
      </motion.div>
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
  const postsPerPage = isMobile ? 6 : 9;

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
    
    // 计算顶置文章占用的位置：移动端双列展示占 2 个位置，大屏端占 3 个位置
    const pinnedPostsSlots = pinnedPosts.length * (isMobile ? 2 : 3);
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
      const postSlots = isMobile ? 2 : 3;
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
    <motion.div initial="initial" animate="animate" exit="exit" className="pb-10 md:pb-20">
      <Seo title="首页" />
      <Hero />

      {!loading && !loadError && (
        <motion.div variants={pageBlockVariants} initial="hidden" animate="visible" transition={{ delay: 0.05 }}>
          <AnimatePresence mode="wait" initial={false}>
            {hasSearchQuery && (
              <motion.div key={`search-summary-${searchQuery}-${activeCategoryLabel}`} initial={{ opacity: 0, y: 8, scale: 0.992 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6, scale: 0.992 }} transition={listSwapTransition} className="mb-6 px-2">
                <motion.div layout className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200/70 bg-white/72 px-4 py-3 text-sm text-zinc-700 shadow-[0_20px_45px_-38px_rgba(28,25,23,0.5)] backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-900/48 dark:text-zinc-300">
                  <motion.div initial={{ opacity: 0, scale: 0.86 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.34, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}>
                    <Search size={16} className="text-zinc-700 dark:text-zinc-300" />
                  </motion.div>
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">
                    搜索 "<span className="font-bold text-zinc-900 dark:text-zinc-100">{searchQuery}</span>" 共命中 {results.length} 篇文章，当前按 "<span className="font-bold text-ink dark:text-white">{activeCategoryLabel}</span>" 显示 {displayedPosts.length} 篇
                  </p>
                  <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }} onClick={handleClearSearch} className="ml-auto rounded-full border border-zinc-200/80 bg-white/90 px-3 py-1.5 text-xs transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/85 dark:hover:border-zinc-100 dark:hover:text-zinc-100" aria-label="清除搜索">
                    清除搜索
                  </motion.button>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          <FilterBar categories={categories} selected={selectedCategory} onSelect={handleSelectCategory} sortOrder={sortOrder} onToggleSort={() => setSortOrder((previous) => (previous === 'newest' ? 'oldest' : 'newest'))} />
        </motion.div>
      )}

      <motion.div id="posts-grid" className="scroll-mt-32" variants={pageBlockVariants} initial="hidden" animate="visible" transition={{ delay: 0.1 }}>
        {loading || isSearching ? (
          <motion.div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3" variants={listContainerVariants} initial="hidden" animate="visible">
            {[1, 2, 3].map((item) => (
              <motion.div key={item} variants={pageBlockVariants} className="h-80 animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </motion.div>
        ) : loadError ? (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={listSwapTransition} className="col-span-full rounded-[2rem] border border-dashed border-zinc-200 bg-zinc-50 py-16 text-center shadow-[0_18px_45px_-40px_rgba(28,25,23,0.55)] dark:border-zinc-800 dark:bg-zinc-900">
            <p className="mb-2 font-serif text-xl text-zinc-700 dark:text-zinc-300">加载失败</p>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{loadError}</p>
          </motion.div>
        ) : (
          <div className="space-y-16">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${selectedCategory}-${sortOrder}-${currentPage}-${searchQuery}`}
                className="grid grid-cols-2 gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3"
                variants={listContainerVariants}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: 8, transition: listSwapTransition }}
              >
                {currentPosts.length > 0 ? (
                  currentPosts.map((post, index) => <PostCard key={post.id} post={post} index={index} featured={!!post.featured} onShare={setSharePost} />)
                ) : (
                  <motion.div variants={pageBlockVariants} className="col-span-full rounded-[2rem] border border-dashed border-zinc-200 bg-white/60 py-24 text-center shadow-[0_18px_45px_-40px_rgba(28,25,23,0.55)] dark:border-zinc-800 dark:bg-zinc-900/40">
                    <p className="mb-2 font-serif text-xl text-zinc-400">{hasSearchQuery ? '未找到匹配的文章' : '暂无相关文章'}</p>
                    {hasSearchQuery && (
                      <motion.button whileHover={{ y: -1 }} whileTap={{ scale: 0.99 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }} onClick={handleClearSearch} className="mt-4 text-sm text-zinc-700 hover:underline dark:text-zinc-300" aria-label="清除搜索条件">
                        清除搜索条件
                      </motion.button>
                    )}
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>

            {totalPages > 1 && (
              <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="mt-8 flex items-center justify-center gap-4 md:mt-16" aria-label="分页导航">
                <motion.button whileHover={{ y: -1.5 }} whileTap={{ scale: 0.988 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }} onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="rounded-full border border-zinc-200 bg-white/80 p-3 shadow-[0_16px_30px_-24px_rgba(28,25,23,0.5)] transition-colors hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-30 disabled:hover:border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-zinc-100 dark:hover:text-zinc-100" aria-label="上一页">
                  <ChevronLeft size={20} />
                </motion.button>
                <motion.span layout transition={{ type: 'spring', stiffness: 280, damping: 30, mass: 0.8 }} className="rounded-full border border-zinc-200/80 bg-white/80 px-4 py-2 font-mono text-sm font-bold text-zinc-600 shadow-[0_12px_24px_-20px_rgba(28,25,23,0.4)] dark:border-zinc-800 dark:bg-zinc-900/70 dark:text-zinc-300" aria-live="polite">
                  {currentPage} / {totalPages}
                </motion.span>
                <motion.button whileHover={{ y: -1.5 }} whileTap={{ scale: 0.988 }} transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }} onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="rounded-full border border-zinc-200 bg-white/80 p-3 shadow-[0_16px_30px_-24px_rgba(28,25,23,0.5)] transition-colors hover:border-zinc-900 hover:text-zinc-900 disabled:opacity-30 disabled:hover:border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-zinc-100 dark:hover:text-zinc-100" aria-label="下一页">
                  <ChevronRight size={20} />
                </motion.button>
              </motion.div>
            )}
          </div>
        )}
      </motion.div>

      <ShareModal isOpen={!!sharePost} onClose={() => setSharePost(null)} title={sharePost?.title || ''} excerpt={sharePost?.excerpt || ''} url={sharePost ? `${window.location.origin}/post/${sharePost.id}` : ''} />
    </motion.div>
  );
};

