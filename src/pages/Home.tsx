import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
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
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut', delay: index * 0.05 } }
  };

  const CategoryBadge = ({ text }: { text: string }) => (
    <span className="z-10 rounded-full border border-white/20 bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-ink shadow-sm backdrop-blur-md transition-transform group-hover:scale-105 dark:border-white/10 dark:bg-black/60 dark:text-white">
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
      <motion.div variants={cardVariants} className="col-span-full w-full">
        <Link to={`/post/${post.id}`} className="group block h-full">
          <div className="relative flex h-auto flex-col overflow-hidden rounded-[2rem] border border-zinc-200 bg-white transition-all duration-500 hover:shadow-2xl hover:shadow-accent/10 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-700 md:h-[480px] md:flex-row">
            <div className="relative h-64 w-full overflow-hidden md:h-full md:w-7/12">
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
            </div>
            <div className="relative flex w-full flex-col justify-center bg-white p-6 backdrop-blur-sm dark:bg-zinc-900/80 md:w-5/12 md:p-12">
              {post.top !== undefined && (
                <div className="absolute right-6 top-6 rounded-full border border-accent/10 bg-accent/5 p-2 text-accent">
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
                <button onClick={handleShareClick} className="ml-auto rounded-full p-2 transition-colors hover:bg-accent/10 hover:text-accent">
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
    <motion.div variants={cardVariants} className="flex h-full flex-col">
      <Link to={`/post/${post.id}`} className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white backdrop-blur-md transition-all duration-500 hover:border-zinc-300 hover:shadow-2xl hover:shadow-zinc-200/50 dark:border-zinc-800/80 dark:bg-zinc-900/40 dark:hover:border-zinc-700 dark:hover:shadow-accent/5 md:rounded-3xl">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          {post.coverImage ? (
            <ProgressiveImage src={post.coverImage} alt={post.title} loading="lazy" wrapperClassName="h-full w-full" className="h-full w-full object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-110" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-300">
              <Sparkles className="h-10 w-10 opacity-50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
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
        <div className="flex flex-grow flex-col p-4 md:p-7">
          <h3 className="mb-2 line-clamp-2 text-sm font-serif font-bold leading-tight text-ink transition-colors group-hover:text-accent dark:text-gray-100 dark:group-hover:text-accent-light md:mb-3 md:text-xl">
            {post.title}
          </h3>
          <p className="mb-6 hidden flex-grow line-clamp-2 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400 md:block">{post.excerpt}</p>
          <div className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-3 text-[10px] font-bold tracking-wide text-zinc-400 dark:border-zinc-800 md:pt-5 md:text-xs">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex items-center gap-1 md:gap-1.5">
                <Calendar size={12} className="md:h-[13px] md:w-[13px]" />
                <span>{post.date}</span>
              </div>
            </div>
            <button onClick={handleShareClick} className="rounded-md p-1.5 transition-colors hover:bg-accent/10 hover:text-accent">
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
    <div className="mb-12 flex flex-col items-center justify-between gap-4 px-2 md:flex-row">
      <div className="-mx-4 w-full overflow-x-auto px-4 pb-2 no-scrollbar md:mx-0 md:w-auto md:px-0 md:pb-0">
        <div className="flex space-x-2">
          {[ALL_CATEGORY, ...categories].map((category) => (
            <button
              key={category}
              onClick={() => onSelect(category)}
              className={`whitespace-nowrap rounded-full border px-5 py-2.5 text-sm font-bold tracking-wide transition-all duration-300 ${
                selected === category
                  ? 'scale-105 transform border-ink bg-ink text-white shadow-lg dark:border-white dark:bg-white dark:text-ink'
                  : 'border-zinc-200 bg-transparent text-zinc-500 hover:border-zinc-400 hover:text-ink dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:text-white'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
      <button onClick={onToggleSort} className="flex w-full items-center justify-center space-x-2 rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-bold tracking-wide text-zinc-500 transition-all duration-300 hover:border-zinc-400 hover:text-ink dark:border-zinc-800 dark:hover:border-zinc-600 dark:hover:text-white md:w-auto">
        {sortOrder === 'newest' ? <ArrowDownWideNarrow size={16} /> : <ArrowUpWideNarrow size={16} />}
        <span>{sortOrder === 'newest' ? '最新' : '最早'}</span>
      </button>
    </div>
  );
};

const Hero = ({ onSearch, searchQuery, onClearSearch }: { onSearch: (val: string) => void; searchQuery: string; onClearSearch: () => void }) => {
  return (
    <div className="relative z-10 flex flex-col items-center px-4 py-20 text-center md:py-32">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="relative mb-8">
        <span className="relative z-10 text-xs font-bold uppercase tracking-[0.3em] text-accent md:text-sm">{siteConfig.subtitle}</span>
        <div className="absolute -inset-4 rounded-full bg-accent/5 blur-xl" />
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.8, ease: 'easeOut' }} className="mb-8 font-serif text-5xl font-bold leading-[1.1] tracking-tight text-ink dark:text-white md:text-7xl lg:text-8xl">
        {siteConfig.title}
      </motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="mx-auto mb-12 max-w-2xl font-sans text-base leading-relaxed text-zinc-500 dark:text-zinc-400 md:text-xl">
        {siteConfig.description}
      </motion.p>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="flex w-full flex-col items-center gap-6">
        <div className="group relative w-full max-w-sm md:max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-5">
            <Search className="text-zinc-400 transition-colors group-focus-within:text-accent" size={20} />
          </div>
          <input
            type="text"
            placeholder="搜索文章..."
            value={searchQuery}
            onChange={(event) => onSearch(event.target.value)}
            className="w-full rounded-full border border-zinc-200 bg-white py-4 pl-12 pr-12 text-base text-ink outline-none transition-all duration-300 placeholder:text-zinc-400 focus:border-accent focus:ring-4 ring-accent/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-accent"
          />
          {searchQuery && (
            <button onClick={onClearSearch} className="absolute inset-y-0 right-0 flex items-center pr-5 text-zinc-400 transition-colors hover:text-accent">
              <X size={18} />
            </button>
          )}
        </div>
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

  return (
    <motion.div initial="initial" animate="animate" exit="exit" className="pb-10 md:pb-20">
      <Seo title="首页" />
      <Hero onSearch={handleSearch} searchQuery={searchQuery} onClearSearch={handleClearSearch} />

      {!loading && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
          {hasSearchQuery && (
            <div className="mb-6 px-2">
              <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                <Search size={16} className="text-accent" />
                <span>
                  搜索 "<span className="font-bold text-accent">{searchQuery}</span>" 找到 {displayedPosts.length} 篇文章
                </span>
                <button onClick={handleClearSearch} className="ml-auto rounded-full border border-zinc-200 px-3 py-1.5 text-xs transition-colors hover:border-accent hover:text-accent dark:border-zinc-800">
                  清除搜索
                </button>
              </div>
            </div>
          )}
          <FilterBar categories={categories} selected={selectedCategory} onSelect={handleSelectCategory} sortOrder={sortOrder} onToggleSort={() => setSortOrder((previous) => (previous === 'newest' ? 'oldest' : 'newest'))} />
        </motion.div>
      )}

      <div id="posts-grid" className="scroll-mt-32">
        {loading || isSearching ? (
          <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-80 animate-pulse rounded-3xl bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        ) : (
          <div className="space-y-16">
            <motion.div className="grid grid-cols-2 gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3" variants={{ animate: { transition: { staggerChildren: 0.1 } } }} initial="hidden" animate="visible" key={`${selectedCategory}-${sortOrder}-${currentPage}-${searchQuery}`}>
              {currentPosts.length > 0 ? (
                currentPosts.map((post, index) => <PostCard key={post.id} post={post} index={index} featured={!!post.featured} onShare={setSharePost} />)
              ) : (
                <div className="col-span-full py-32 text-center">
                  <p className="mb-2 font-serif text-xl text-zinc-400">{hasSearchQuery ? '未找到匹配的文章' : '暂无相关文章'}</p>
                  {hasSearchQuery && (
                    <button onClick={handleClearSearch} className="mt-4 text-sm text-accent hover:underline">
                      清除搜索条件
                    </button>
                  )}
                </div>
              )}
            </motion.div>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-4 md:mt-16">
                <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="rounded-full border border-zinc-200 p-3 transition-colors hover:border-accent hover:text-accent disabled:opacity-30 disabled:hover:border-zinc-200 dark:border-zinc-800">
                  <ChevronLeft size={20} />
                </button>
                <span className="font-mono text-sm font-bold text-zinc-500">
                  {currentPage} / {totalPages}
                </span>
                <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="rounded-full border border-zinc-200 p-3 transition-colors hover:border-accent hover:text-accent disabled:opacity-30 disabled:hover:border-zinc-200 dark:border-zinc-800">
                  <ChevronRight size={20} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ShareModal isOpen={!!sharePost} onClose={() => setSharePost(null)} title={sharePost?.title || ''} excerpt={sharePost?.excerpt || ''} url={sharePost ? `${window.location.origin}/post/${sharePost.id}` : ''} />
    </motion.div>
  );
};
