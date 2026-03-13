import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Calendar, ArrowUpRight, Search, ArrowDownWideNarrow, ArrowUpWideNarrow, Pin, Clock, Sparkles, Rss, ChevronLeft, ChevronRight, Share2, X } from 'lucide-react';
import { getPosts, searchPosts, getAllCategories } from '@/services/posts';
import { PostMetadata } from '../types';
import { siteConfig } from '@config/site.config';
import { Seo } from '../components/Seo';
import { ShareModal } from '../components/ShareModal';

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
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut", delay: index * 0.05 } }
  };

  const CategoryBadge = ({ text }: { text: string }) => (
    <span className="backdrop-blur-md bg-white/80 dark:bg-black/60 border border-white/20 dark:border-white/10 text-ink dark:text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-sm z-10 transition-transform group-hover:scale-105">
      {text}
    </span>
  );

  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onShare(post);
  };

  if (featured) {
    return (
      <motion.div variants={cardVariants} className="col-span-full w-full">
        <Link to={`/post/${post.id}`} className="group block h-full">
          <div className="relative overflow-hidden rounded-[2rem] bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 transition-all duration-500 hover:shadow-2xl hover:shadow-accent/10 dark:hover:border-zinc-700 flex flex-col md:flex-row h-auto md:h-[480px]">
            <div className="relative w-full md:w-7/12 h-64 md:h-full overflow-hidden">
              <div className="absolute inset-0 bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
              {post.coverImage ? (
                <motion.img src={post.coverImage} alt={post.title} loading="lazy" decoding="async" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-105" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-800"><Sparkles className="text-zinc-300 w-16 h-16" /></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-60" />
              <div className="absolute top-6 left-6"><CategoryBadge text={post.category} /></div>
            </div>
            <div className="relative w-full md:w-5/12 p-6 md:p-12 flex flex-col justify-center bg-white dark:bg-zinc-900/80 backdrop-blur-sm">
               {post.top !== undefined && (
                <div className="absolute top-6 right-6 text-accent bg-accent/5 border border-accent/10 p-2 rounded-full">
                  <Pin size={16} fill="currentColor" />
                </div>
              )}
              <div className="mb-4 md:mb-6"><span className="text-xs font-bold tracking-[0.2em] uppercase text-accent">Featured Post</span></div>
              <h2 className="text-xl md:text-4xl font-serif font-bold text-ink dark:text-white mb-4 md:mb-6 leading-[1.1] group-hover:text-accent transition-colors duration-300">{post.title}</h2>
              <p className="text-sm md:text-base text-zinc-500 dark:text-zinc-400 line-clamp-3 mb-6 md:mb-8 font-sans leading-relaxed">{post.excerpt}</p>
              <div className="flex items-center text-zinc-400 text-xs font-bold tracking-wider gap-4 mt-auto">
                <div className="flex items-center gap-2"><Calendar size={14} /><span>{post.date}</span></div>
                <div className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-700"></div>
                <div className="flex items-center gap-2"><Clock size={14} /><span>{post.readTime}</span></div>
                <button onClick={handleShareClick} className="ml-auto p-2 hover:text-accent hover:bg-accent/10 rounded-full transition-colors"><Share2 size={16} /></button>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div variants={cardVariants} className="flex flex-col h-full">
      <Link to={`/post/${post.id}`} className="group relative flex flex-col h-full bg-white dark:bg-zinc-900/40 backdrop-blur-md rounded-2xl md:rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-2xl hover:shadow-zinc-200/50 dark:hover:shadow-accent/5 transition-all duration-500">
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          {post.coverImage ? (
             <motion.img src={post.coverImage} alt={post.title} loading="lazy" decoding="async" className="w-full h-full object-cover transition-transform duration-700 ease-out will-change-transform group-hover:scale-110" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-300">
              <Sparkles className="h-10 w-10 opacity-50" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="absolute top-2 left-2 md:top-4 md:left-4"><CategoryBadge text={post.category} /></div>
          <div className="absolute top-2 right-2 md:top-4 md:right-4 z-10">
             {post.top !== undefined ? (
               <div className="bg-accent text-white p-1 md:p-1.5 rounded-full shadow-lg shadow-accent/20"><Pin size={12} className="md:w-3.5 md:h-3.5" fill="currentColor" /></div>
             ) : (
               <div className="bg-white/90 dark:bg-black/80 backdrop-blur rounded-full p-2 md:p-2.5 opacity-0 group-hover:opacity-100 -translate-y-2 group-hover:translate-y-0 transition-all duration-300 shadow-lg"><ArrowUpRight size={14} className="md:w-4 md:h-4 text-ink dark:text-white" /></div>
             )}
          </div>
        </div>
        <div className="flex flex-col flex-grow p-4 md:p-7">
          <h3 className="text-sm md:text-xl font-serif font-bold mb-2 md:mb-3 text-ink dark:text-gray-100 leading-tight group-hover:text-accent dark:group-hover:text-accent-light transition-colors line-clamp-2">{post.title}</h3>
          <p className="hidden md:block text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed line-clamp-2 mb-6 flex-grow">{post.excerpt}</p>
          <div className="pt-3 md:pt-5 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-[10px] md:text-xs text-zinc-400 font-bold tracking-wide mt-auto">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="flex items-center gap-1 md:gap-1.5"><Calendar size={12} className="md:w-[13px] md:h-[13px]" /><span>{post.date}</span></div>
            </div>
            <button onClick={handleShareClick} className="p-1.5 hover:text-accent hover:bg-accent/10 rounded-md transition-colors"><Share2 size={12} className="md:w-[14px] md:h-[14px]" /></button>
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
    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-12 px-2">
        <div className="overflow-x-auto pb-2 md:pb-0 no-scrollbar w-full md:w-auto -mx-4 md:mx-0 px-4 md:px-0">
          <div className="flex space-x-2">
            {[ALL_CATEGORY, ...categories].map((cat) => (
              <button key={cat} onClick={() => onSelect(cat)} className={`px-5 py-2.5 rounded-full text-sm font-bold tracking-wide transition-all duration-300 border whitespace-nowrap ${selected === cat ? 'bg-ink text-white border-ink dark:bg-white dark:text-ink dark:border-white shadow-lg transform scale-105' : 'bg-transparent text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 hover:text-ink dark:hover:text-white'}`}>{cat}</button>
            ))}
          </div>
        </div>
        <button onClick={onToggleSort} className="flex items-center space-x-2 px-5 py-2.5 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-ink dark:hover:text-white hover:border-zinc-400 dark:hover:border-zinc-600 transition-all duration-300 text-sm font-bold tracking-wide w-full md:w-auto justify-center">
           {sortOrder === 'newest' ? <ArrowDownWideNarrow size={16} /> : <ArrowUpWideNarrow size={16} />}
           <span>{sortOrder === 'newest' ? '最新' : '最早'}</span>
        </button>
    </div>
  );
};

const Hero = ({ onSearch, searchQuery, onClearSearch }: { onSearch: (val: string) => void; searchQuery: string; onClearSearch: () => void }) => {
  return (
    <div className="py-20 md:py-32 flex flex-col items-center text-center relative z-10 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="mb-8 relative">
           <span className="text-accent font-bold tracking-[0.3em] uppercase text-xs md:text-sm relative z-10">{siteConfig.subtitle}</span>
           <div className="absolute -inset-4 bg-accent/5 blur-xl rounded-full z-0"></div>
      </motion.div>
      <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.8, ease: "easeOut" }} className="text-5xl md:text-7xl lg:text-8xl font-serif font-bold text-ink dark:text-white mb-8 tracking-tight leading-[1.1]">{siteConfig.title}</motion.h1>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="text-base md:text-xl text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed mb-12 font-sans">{siteConfig.description}</motion.p>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }} className="w-full flex flex-col items-center gap-6">
         <div className="relative w-full max-w-sm md:max-w-md group">
           <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none"><Search className="text-zinc-400 group-focus-within:text-accent transition-colors" size={20} /></div>
           <input 
             type="text" 
             placeholder="搜索文章..." 
             value={searchQuery}
             onChange={(e) => onSearch(e.target.value)} 
             className="w-full pl-12 pr-12 py-4 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-accent dark:focus:border-accent outline-none shadow-xl shadow-zinc-200/20 dark:shadow-none transition-all duration-300 text-ink dark:text-white placeholder:text-zinc-400 text-base focus:ring-4 ring-accent/10" 
           />
           {searchQuery && (
             <button 
               onClick={onClearSearch}
               className="absolute inset-y-0 right-0 pr-5 flex items-center text-zinc-400 hover:text-accent transition-colors"
             >
               <X size={18} />
             </button>
           )}
         </div>
         <a href="/feed.xml" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-900/50 hover:bg-orange-100 dark:hover:bg-orange-900/50 hover:scale-105 transition-all duration-300 text-xs font-bold tracking-wider uppercase shadow-sm"><Rss size={14} /><span>订阅 RSS</span></a>
      </motion.div>
    </div>
  );
};

export const Home = () => {
  const [allPosts, setAllPosts] = useState<PostMetadata[]>([]);
  const [displayedPosts, setDisplayedPosts] = useState<PostMetadata[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORY);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [postsPerPage, setPostsPerPage] = useState(9);
  const [sharePost, setSharePost] = useState<PostMetadata | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    Promise.all([getPosts(), getAllCategories()]).then(([posts, cats]) => {
      setAllPosts(posts);
      setCategories(cats);
      setLoading(false);
    });

    const handleResize = () => {
      setPostsPerPage(window.innerWidth < 768 ? 5 : 9);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (allPosts.length === 0) {
      return;
    }

    if (!searchQuery) {
      setDisplayedPosts(filterAndSortPosts(allPosts, selectedCategory, sortOrder));
      setCurrentPage(1);
    }
  }, [allPosts, selectedCategory, sortOrder, searchQuery]);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setDisplayedPosts(filterAndSortPosts(allPosts, selectedCategory, sortOrder));
      setIsSearching(false);
      setCurrentPage(1);
      return;
    }

    setIsSearching(true);
    const results = await searchPosts(query);
    const filteredResults = filterAndSortPosts(results, selectedCategory, sortOrder);
    setDisplayedPosts(filteredResults);
    setIsSearching(false);
    setCurrentPage(1);
  }, [allPosts, selectedCategory, sortOrder]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch(query);
    }, 300);
  }, [performSearch]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setDisplayedPosts(filterAndSortPosts(allPosts, selectedCategory, sortOrder));
    setCurrentPage(1);
  }, [allPosts, selectedCategory, sortOrder]);

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
          {searchQuery && (
            <div className="mb-6 px-2">
              <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
                <Search size={16} className="text-accent" />
                <span>搜索 "<span className="font-bold text-accent">{searchQuery}</span>" 找到 {displayedPosts.length} 篇文章</span>
                <button 
                  onClick={handleClearSearch}
                  className="ml-auto text-xs px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800 hover:border-accent hover:text-accent transition-colors"
                >
                  清除搜索
                </button>
              </div>
            </div>
          )}
          <FilterBar categories={categories} selected={selectedCategory} onSelect={setSelectedCategory} sortOrder={sortOrder} onToggleSort={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')} />
        </motion.div>
      )}

      <div id="posts-grid" className="scroll-mt-32">
        {loading || isSearching ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => <div key={i} className="h-80 bg-zinc-100 dark:bg-zinc-800 rounded-3xl animate-pulse"></div>)}
          </div>
        ) : (
          <div className="space-y-16">
            <motion.div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8" variants={{ animate: { transition: { staggerChildren: 0.1 } } }} initial="hidden" animate="visible" key={`${selectedCategory}-${sortOrder}-${currentPage}-${searchQuery}`}>
              {currentPosts.length > 0 ? (
                  currentPosts.map((post, index) => <PostCard key={post.id} post={post} index={index} featured={!!post.featured} onShare={setSharePost} />)
              ) : (
                  <div className="col-span-full text-center py-32">
                    <p className="text-xl text-zinc-400 font-serif mb-2">
                      {searchQuery ? '未找到匹配的文章' : '暂无相关文章'}
                    </p>
                    {searchQuery && (
                      <button 
                        onClick={handleClearSearch}
                        className="mt-4 text-sm text-accent hover:underline"
                      >
                        清除搜索条件
                      </button>
                    )}
                  </div>
              )}
            </motion.div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8 md:mt-16">
                <button onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1} className="p-3 rounded-full border border-zinc-200 dark:border-zinc-800 hover:border-accent hover:text-accent disabled:opacity-30 disabled:hover:border-zinc-200 transition-colors"><ChevronLeft size={20} /></button>
                <span className="text-sm font-bold text-zinc-500 font-mono">{currentPage} / {totalPages}</span>
                <button onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages} className="p-3 rounded-full border border-zinc-200 dark:border-zinc-800 hover:border-accent hover:text-accent disabled:opacity-30 disabled:hover:border-zinc-200 transition-colors"><ChevronRight size={20} /></button>
              </div>
            )}
          </div>
        )}
      </div>

      <ShareModal 
        isOpen={!!sharePost} 
        onClose={() => setSharePost(null)} 
        title={sharePost?.title || ''} 
        excerpt={sharePost?.excerpt || ''} 
        url={sharePost ? `${window.location.origin}/post/${sharePost.id}` : ''} 
      />
    </motion.div>
  );
};
