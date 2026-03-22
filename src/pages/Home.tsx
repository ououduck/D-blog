import React, { useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { Calendar, ArrowUpRight, Search, ArrowDownWideNarrow, ArrowUpWideNarrow, Pin, Clock, Sparkles, ChevronLeft, ChevronRight, Share2, X } from 'lucide-react';
import { getPosts, getAllCategories } from '@/services/posts';
import { PostMetadata } from '../types';
import { siteConfig } from '@config/site.config';
import { Seo } from '../components/Seo';
import { ShareModal } from '../components/ShareModal';
import { usePostSearch } from '@/hooks/usePostSearch';
import { ProgressiveImage } from '@/components/ProgressiveImage';

const ALL_CATEGORY = '全部';

const viewportConfig = { once: true, amount: 0.2 } as const;

const pageVariants = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] }
  }
} as const;

const sectionVariants = {
  hidden: { opacity: 0, y: 32, filter: 'blur(10px)' },
  visible: {
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] }
  }
} as const;

const softStagger = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.08
    }
  }
} as const;

const floatingOrbTransition = {
  duration: 16,
  repeat: Infinity,
  repeatType: 'mirror' as const,
  ease: 'easeInOut' as const
};

const sortPosts = (posts: PostMetadata[], sortOrder: 'newest' | 'oldest') => {
  const pinnedPosts = posts
    .filter((post) => post.top !== undefined)
    .sort((a, b) => (a.top ?? 0) - (b.top ?? 0));

  const regularPosts = posts
    .filter((post) => post.top === undefined)
    .sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

  return [...pinnedPosts, ...regularPosts];
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

const PostCard: React.FC<{ post: PostMetadata; index: number; featured?: boolean; onShare: (post: PostMetadata) => void }> = ({ post, index, featured, onShare }) => {
  const shouldReduceMotion = useReducedMotion();
  const cardVariants = {
    hidden: { opacity: 0, y: 26, scale: 0.985 },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.58,
        ease: [0.22, 1, 0.36, 1],
        delay: index * 0.06
      }
    }
  };

  const hoverLift = shouldReduceMotion
    ? undefined
    : {
        y: -8,
        transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] }
      };

  const CategoryBadge = ({ text }: { text: string }) => (
    <span className="z-10 rounded-full border border-white/20 bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink shadow-sm backdrop-blur-md transition-transform duration-300 group-hover:scale-105 dark:border-white/10 dark:bg-black/60 dark:text-white">
      {text}
    </span>
  );

  const handleShareClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    onShare(post);
  };

  if (featured) {
    return (
      <motion.div variants={cardVariants} whileHover={hoverLift} className="col-span-full w-full">
        <Link to={`/post/${post.id}`} className="group block h-full">
          <div className="relative flex h-auto flex-col overflow-hidden rounded-[2rem] border border-zinc-200 bg-white transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-accent/10 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700 md:h-[480px] md:flex-row">
            <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
              <div className="absolute inset-0 bg-gradient-to-r from-accent/5 via-transparent to-transparent" />
            </div>
            <div className="relative h-64 w-full overflow-hidden md:h-full md:w-7/12">
              <div className="absolute inset-0 animate-pulse bg-zinc-200 dark:bg-zinc-800" />
              {post.coverImage ? (
                <ProgressiveImage src={post.coverImage} alt={post.title} loading="lazy" wrapperClassName="absolute inset-0" className="h-full w-full object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-[1.06]" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800">
                  <Sparkles className="h-16 w-16 text-zinc-300" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-60 transition-opacity duration-500 group-hover:opacity-80" />
              <div className="absolute left-6 top-6">
                <CategoryBadge text={post.category} />
              </div>
            </div>
            <div className="relative flex w-full flex-col justify-center bg-white p-6 backdrop-blur-sm dark:bg-zinc-900/80 md:w-5/12 md:p-12">
              {post.top !== undefined && (
                <div className="absolute right-6 top-6 rounded-full border border-accent/10 bg-accent/5 p-2 text-accent shadow-[0_14px_32px_-20px_rgba(192,57,43,0.9)]">
                  <Pin size={16} fill="currentColor" />
                </div>
              )}
              <div className="mb-4 md:mb-6">
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Featured Post</span>
              </div>
              <h2 className="mb-4 font-serif text-xl font-bold leading-[1.1] text-ink transition-colors duration-300 group-hover:text-accent dark:text-white md:mb-6 md:text-4xl">
                {post.title}
              </h2>
              <p className="mb-6 font-sans text-sm leading-relaxed text-zinc-500 line-clamp-3 dark:text-zinc-400 md:mb-8 md:text-base">{post.excerpt}</p>
              <div className="mt-auto flex items-center gap-4 text-xs font-bold tracking-wider text-zinc-400">
                <div className="flex items-center gap-2">
                  <Calendar size={14} />
                  <span>{post.date}</span>
                </div>
                <div className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                <div className="flex items-center gap-2">
                  <Clock size={14} />
                  <span>{post.readTime}</span>
                </div>
                <button onClick={handleShareClick} className="ml-auto rounded-full p-2 transition-all duration-300 hover:scale-110 hover:bg-accent/10 hover:text-accent">
                  <Share2 size={16} />
                </button>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div variants={cardVariants} whileHover={hoverLift} className="flex h-full flex-col">
      <Link to={`/post/${post.id}`} className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white backdrop-blur-md transition-all duration-500 hover:border-zinc-300 hover:shadow-2xl hover:shadow-zinc-200/50 dark:border-zinc-800/80 dark:bg-zinc-900/40 dark:hover:border-zinc-700 dark:hover:shadow-accent/5 md:rounded-3xl">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(192,57,43,0.12),_transparent_36%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          {post.coverImage ? (
            <ProgressiveImage src={post.coverImage} alt={post.title} loading="lazy" wrapperClassName="h-full w-full" className="h-full w-full object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-[1.12]" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-300">
              <Sparkles className="h-10 w-10 opacity-50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
          <div className="absolute inset-x-6 bottom-4 h-px origin-left scale-x-0 bg-gradient-to-r from-white/90 to-transparent transition-transform duration-500 group-hover:scale-x-100" />
          <div className="absolute left-2 top-2 md:left-4 md:top-4">
            <CategoryBadge text={post.category} />
          </div>
          <div className="absolute right-2 top-2 z-10 md:right-4 md:top-4">
            {post.top !== undefined ? (
              <div className="rounded-full bg-accent p-1 text-white shadow-lg shadow-accent/20 md:p-1.5">
                <Pin size={12} className="md:h-3.5 md:w-3.5" fill="currentColor" />
              </div>
            ) : (
              <div className="rounded-full bg-white/90 p-2 opacity-0 shadow-lg backdrop-blur transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 dark:bg-black/80 md:p-2.5">
                <ArrowUpRight size={14} className="text-ink dark:text-white md:h-4 md:w-4" />
              </div>
            )}
          </div>
        </div>
        <div className="relative flex flex-grow flex-col p-4 md:p-7">
          <h3 className="mb-2 line-clamp-2 text-sm font-serif font-bold leading-tight text-ink transition-colors group-hover:text-accent dark:text-gray-100 dark:group-hover:text-accent-light md:mb-3 md:text-xl">
            {post.title}
          </h3>
          <p className="mb-6 hidden flex-grow line-clamp-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 md:block">{post.excerpt}</p>
          <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-3 text-[10px] font-bold tracking-wide text-zinc-400 transition-colors duration-300 group-hover:border-accent/20 dark:border-zinc-800 md:pt-5 md:text-xs">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex items-center gap-1 md:gap-1.5">
                <Calendar size={12} className="md:h-[13px] md:w-[13px]" />
                <span>{post.date}</span>
              </div>
            </div>
            <button onClick={handleShareClick} className="rounded-md p-1.5 transition-all duration-300 hover:scale-110 hover:bg-accent/10 hover:text-accent">
              <Share2 size={12} className="md:h-[14px] md:w-[14px]" />
            </button>
          </div>
        </div>
      </Link>
    </motion.div>
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
    <motion.div
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={viewportConfig}
      className="mb-12 flex flex-col items-center justify-between gap-4 px-2 md:flex-row"
    >
      <div className="-mx-4 w-full overflow-x-auto px-4 pb-2 no-scrollbar md:mx-0 md:w-auto md:px-0 md:pb-0">
        <div className="flex space-x-2">
          {[ALL_CATEGORY, ...categories].map((category) => (
            <motion.button
              key={category}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => onSelect(category)}
              className={`whitespace-nowrap rounded-full border px-5 py-2.5 text-sm font-bold tracking-wide transition-all duration-300 ${
                selected === category
                  ? 'scale-105 transform border-ink bg-ink text-white shadow-lg shadow-zinc-900/10 dark:border-white dark:bg-white dark:text-ink'
                  : 'border-zinc-200 bg-white/60 text-zinc-500 hover:-translate-y-0.5 hover:border-zinc-400 hover:text-ink dark:border-zinc-800 dark:bg-zinc-900/35 dark:hover:border-zinc-600 dark:hover:text-white'
              }`}
            >
              {category}
            </motion.button>
          ))}
        </div>
      </div>
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={onToggleSort}
        className="flex w-full items-center justify-center space-x-2 rounded-full border border-zinc-200 bg-white/70 px-5 py-2.5 text-sm font-bold tracking-wide text-zinc-500 transition-all duration-300 hover:-translate-y-0.5 hover:border-zinc-400 hover:text-ink hover:shadow-lg hover:shadow-zinc-200/40 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-600 dark:hover:text-white md:w-auto"
      >
        {sortOrder === 'newest' ? <ArrowDownWideNarrow size={16} /> : <ArrowUpWideNarrow size={16} />}
        <span>{sortOrder === 'newest' ? '最新' : '最早'}</span>
      </motion.button>
    </motion.div>
  );
};


const Hero = ({ onSearch, searchQuery, onClearSearch }: { onSearch: (val: string) => void; searchQuery: string; onClearSearch: () => void }) => {
  const shouldReduceMotion = useReducedMotion();
  const heroStats = useMemo(
    () => [
      { label: '持续输出', value: '33+' },
      { label: '专题标签', value: '20+' },
      { label: '阅读节奏', value: '慢火熬制' }
    ],
    []
  );

  return (
    <motion.section
      variants={sectionVariants}
      initial="hidden"
      whileInView="visible"
      viewport={viewportConfig}
      className="relative isolate overflow-hidden rounded-[2.5rem] border border-white/60 bg-white/70 px-4 py-16 shadow-[0_35px_120px_-50px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/55 md:px-8 md:py-24"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(192,57,43,0.16),_transparent_32%),radial-gradient(circle_at_85%_20%,_rgba(244,114,182,0.12),_transparent_22%),linear-gradient(135deg,rgba(255,255,255,0.88),rgba(255,255,255,0.58))] dark:bg-[radial-gradient(circle_at_top,_rgba(192,57,43,0.2),_transparent_28%),radial-gradient(circle_at_85%_20%,_rgba(244,114,182,0.12),_transparent_20%),linear-gradient(135deg,rgba(24,24,27,0.88),rgba(9,9,11,0.72))]" />
      <motion.div
        aria-hidden="true"
        animate={shouldReduceMotion ? undefined : { x: [-16, 28, -10], y: [0, 18, -12], scale: [1, 1.08, 0.96] }}
        transition={shouldReduceMotion ? undefined : floatingOrbTransition}
        className="absolute -left-16 top-8 h-40 w-40 rounded-full bg-accent/15 blur-3xl md:h-56 md:w-56"
      />
      <motion.div
        aria-hidden="true"
        animate={shouldReduceMotion ? undefined : { x: [12, -18, 8], y: [0, -16, 12], scale: [1, 0.92, 1.06] }}
        transition={shouldReduceMotion ? undefined : { ...floatingOrbTransition, duration: 18 }}
        className="absolute right-0 top-1/3 h-36 w-36 rounded-full bg-amber-300/20 blur-3xl dark:bg-orange-500/10 md:h-52 md:w-52"
      />
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-accent/50 to-transparent" />

      <motion.div variants={softStagger} initial="hidden" whileInView="visible" viewport={viewportConfig} className="relative z-10 flex flex-col items-center text-center">
        <motion.div variants={sectionVariants} className="relative mb-8 inline-flex items-center gap-3 rounded-full border border-accent/15 bg-white/80 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.32em] text-accent shadow-lg shadow-accent/5 dark:bg-white/5">
          <Sparkles size={14} className="opacity-80" />
          <span>{siteConfig.subtitle}</span>
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-accent/10 via-transparent to-accent/5 opacity-80" />
        </motion.div>

        <motion.h1
          variants={sectionVariants}
          className="mx-auto mb-6 max-w-5xl bg-gradient-to-br from-ink via-zinc-700 to-zinc-500 bg-clip-text font-serif text-5xl font-bold leading-[0.98] tracking-tight text-transparent dark:from-white dark:via-zinc-100 dark:to-zinc-400 md:text-7xl lg:text-[5.75rem]"
        >
          {siteConfig.title}
        </motion.h1>

        <motion.p variants={sectionVariants} className="mx-auto mb-10 max-w-3xl text-base leading-relaxed text-zinc-600 dark:text-zinc-300 md:text-xl md:leading-9">
          {siteConfig.description}
        </motion.p>

        <motion.div variants={sectionVariants} className="mb-10 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
          {heroStats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={viewportConfig}
              transition={{ duration: 0.55, delay: 0.12 + index * 0.08, ease: [0.22, 1, 0.36, 1] }}
              className="group relative overflow-hidden rounded-2xl border border-white/70 bg-white/75 px-5 py-4 text-left shadow-[0_20px_50px_-30px_rgba(15,23,42,0.35)] backdrop-blur-md dark:border-white/10 dark:bg-white/5"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
              <div className="relative">
                <p className="text-[11px] font-bold uppercase tracking-[0.26em] text-zinc-400">{stat.label}</p>
                <p className="mt-2 font-serif text-2xl font-bold text-ink dark:text-white">{stat.value}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div variants={sectionVariants} className="flex w-full flex-col items-center gap-6">
          <div className="group relative w-full max-w-sm md:max-w-xl">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5">
              <Search className="text-zinc-400 transition-colors duration-300 group-focus-within:text-accent group-hover:text-accent" size={20} />
            </div>
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-accent/12 via-transparent to-accent/8 opacity-0 blur-lg transition-opacity duration-500 group-focus-within:opacity-100 group-hover:opacity-100" />
            <input
              type="text"
              placeholder="搜索文章..."
              value={searchQuery}
              onChange={(event) => onSearch(event.target.value)}
              className="relative w-full rounded-full border border-zinc-200/80 bg-white/90 py-4 pl-12 pr-12 text-base text-ink outline-none transition-all duration-500 placeholder:text-zinc-400 focus:-translate-y-0.5 focus:border-accent focus:shadow-[0_16px_40px_-24px_rgba(192,57,43,0.65)] focus:ring-4 ring-accent/10 dark:border-zinc-800 dark:bg-zinc-900/85 dark:text-white dark:focus:border-accent"
            />
            {searchQuery && (
              <button onClick={onClearSearch} className="absolute inset-y-0 right-0 flex items-center pr-5 text-zinc-400 transition-all duration-300 hover:scale-110 hover:text-accent">
                <X size={18} />
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </motion.section>
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
  const [currentPage, setCurrentPage] = useState(1);
  const [postsPerPage, setPostsPerPage] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768 ? 5 : 9));
  const [sharePost, setSharePost] = useState<PostMetadata | null>(null);
  const { searchQuery, isSearching, results, handleSearch, clearSearch, hasSearchQuery } = usePostSearch({
    emptyResults: allPosts
  });

  useEffect(() => {
    let cancelled = false;
    const mediaQuery = window.matchMedia('(max-width: 767px)');

    const syncPostsPerPage = () => {
      setPostsPerPage(mediaQuery.matches ? 5 : 9);
    };

    const loadHomeData = async () => {
      try {
        const [posts, categoryList] = await Promise.all([getPosts(), getAllCategories()]);
        if (cancelled) {
          return;
        }

        setAllPosts(posts);
        setCategories(categoryList);
      } catch (error) {
        console.error('Failed to load home data:', error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadHomeData();
    syncPostsPerPage();
    mediaQuery.addEventListener('change', syncPostsPerPage);

    return () => {
      cancelled = true;
      mediaQuery.removeEventListener('change', syncPostsPerPage);
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

  const displayedPosts = filterAndSortPosts(results, selectedCategory, sortOrder);

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
  };

  const handleClearSearch = () => {
    clearSearch();
    setCurrentPage(1);
  };

  const indexOfLastPost = currentPage * postsPerPage;
  const indexOfFirstPost = indexOfLastPost - postsPerPage;
  const currentPosts = displayedPosts.slice(indexOfFirstPost, indexOfLastPost);
  const totalPages = Math.ceil(displayedPosts.length / postsPerPage);

  const paginate = (pageNumber: number) => {
    setCurrentPage(pageNumber);
    document.getElementById('posts-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const featuredPostsCount = displayedPosts.filter((post) => post.featured).length;
  const heroSummary = `${displayedPosts.length} 篇内容 · ${categories.length} 个分类 · ${featuredPostsCount} 篇精选`;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="pb-10 md:pb-20">
      <Seo title="首页" />
      <Hero onSearch={handleSearch} searchQuery={searchQuery} onClearSearch={handleClearSearch} />

      {!loading && (
        <motion.div
          variants={sectionVariants}
          initial="hidden"
          whileInView="visible"
          viewport={viewportConfig}
          className="mt-10 rounded-[2rem] border border-zinc-200/70 bg-white/70 px-4 py-5 shadow-[0_24px_80px_-48px_rgba(15,23,42,0.35)] backdrop-blur-md dark:border-zinc-800/70 dark:bg-zinc-950/35 md:px-6"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <motion.div initial={{ opacity: 0, x: -12 }} whileInView={{ opacity: 1, x: 0 }} viewport={viewportConfig} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
              <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-zinc-400">Content pulse</p>
              <p className="mt-2 font-serif text-xl text-ink dark:text-white md:text-2xl">{heroSummary}</p>
            </motion.div>
            {hasSearchQuery && (
              <motion.div initial={{ opacity: 0, x: 12 }} whileInView={{ opacity: 1, x: 0 }} viewport={viewportConfig} transition={{ duration: 0.5, delay: 0.08, ease: [0.22, 1, 0.36, 1] }} className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                <Search size={16} className="text-accent" />
                <span>
                  搜索 "<span className="font-bold text-accent">{searchQuery}</span>" 找到 {displayedPosts.length} 篇文章
                </span>
                <button onClick={handleClearSearch} className="ml-auto rounded-full border border-zinc-200 bg-white/80 px-3 py-1.5 text-xs transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:text-accent dark:border-zinc-800 dark:bg-zinc-900/40">
                  清除搜索
                </button>
              </motion.div>
            )}
          </div>
          <div className="mt-5 h-px bg-gradient-to-r from-transparent via-zinc-300/80 to-transparent dark:via-zinc-700/80" />
          <div className="mt-5">
            <FilterBar categories={categories} selected={selectedCategory} onSelect={handleSelectCategory} sortOrder={sortOrder} onToggleSort={() => setSortOrder((previous) => (previous === 'newest' ? 'oldest' : 'newest'))} />
          </div>
        </motion.div>
      )}

      <div id="posts-grid" className="scroll-mt-32 pt-2 md:pt-6">
        {loading || isSearching ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-80 animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        ) : (
          <div className="space-y-16">
            <motion.div
              className="grid grid-cols-2 gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3"
              variants={softStagger}
              initial="hidden"
              animate="visible"
              key={`${selectedCategory}-${sortOrder}-${currentPage}-${searchQuery}`}
            >
              {currentPosts.length > 0 ? (
                currentPosts.map((post, index) => <PostCard key={post.id} post={post} index={index} featured={!!post.featured} onShare={setSharePost} />)
              ) : (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="col-span-full py-32 text-center">
                  <p className="mb-2 font-serif text-xl text-zinc-400">{hasSearchQuery ? '未找到匹配的文章' : '暂无相关文章'}</p>
                  {hasSearchQuery && (
                    <button onClick={handleClearSearch} className="mt-4 text-sm text-accent hover:underline">
                      清除搜索条件
                    </button>
                  )}
                </motion.div>
              )}
            </motion.div>

            {totalPages > 1 && (
              <motion.div
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={viewportConfig}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="mt-8 flex items-center justify-center gap-4 md:mt-16"
              >
                <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="rounded-full border border-zinc-200 bg-white/70 p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:text-accent hover:shadow-lg hover:shadow-zinc-200/40 disabled:opacity-30 disabled:hover:border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <ChevronLeft size={20} />
                </button>
                <span className="rounded-full border border-zinc-200/80 bg-white/70 px-4 py-2 font-mono text-sm font-bold text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
                  {currentPage} / {totalPages}
                </span>
                <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="rounded-full border border-zinc-200 bg-white/70 p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent hover:text-accent hover:shadow-lg hover:shadow-zinc-200/40 disabled:opacity-30 disabled:hover:border-zinc-200 dark:border-zinc-800 dark:bg-zinc-900/40">
                  <ChevronRight size={20} />
                </button>
              </motion.div>
            )}
          </div>
        )}
      </div>

      <ShareModal isOpen={!!sharePost} onClose={() => setSharePost(null)} title={sharePost?.title || ''} excerpt={sharePost?.excerpt || ''} url={sharePost ? `${window.location.origin}/post/${sharePost.id}` : ''} />
    </motion.div>
  );
};
