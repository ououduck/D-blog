import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Calendar, ArrowUpRight, Search, ArrowDownWideNarrow, ArrowUpWideNarrow, Pin } from 'lucide-react';
import { getPosts, searchPosts, getAllCategories } from '../services/posts';
import { Post } from '../types';
import { siteConfig } from '../site.config';

const PostCard: React.FC<{ post: Post; index: number; featured?: boolean }> = ({ post, index, featured }) => {
  const cardVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        duration: 0.8, 
        ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
        delay: index * 0.1 
      } 
    }
  };

  if (featured) {
    return (
      <motion.div
        variants={cardVariants}
        className="col-span-1 md:col-span-2 lg:col-span-3 relative group overflow-hidden rounded-3xl mb-12 cursor-pointer h-[500px]"
      >
        <Link to={`/post/${post.id}`} className="block w-full h-full">
          <div className="absolute inset-0 bg-ink dark:bg-zinc-900">
             {post.coverImage && (
               <motion.img 
                src={post.coverImage} 
                alt={post.title}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity duration-700"
                whileHover={{ scale: 1.05 }}
                transition={{ duration: 0.8 }}
               />
             )}
             <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
          </div>
          
          {post.top !== undefined && (
             <div className="absolute top-8 right-8 bg-accent text-white p-2 rounded-full shadow-lg z-20">
               <Pin size={20} fill="currentColor" />
             </div>
          )}

          <div className="absolute bottom-0 left-0 p-8 md:p-12 w-full max-w-4xl">
             <div className="flex gap-2 mb-4">
                <span className="px-3 py-1 text-xs font-bold tracking-wider uppercase bg-accent text-white rounded-full">
                   {post.category}
                </span>
             </div>
             <h2 className="text-3xl md:text-5xl font-serif font-bold text-white mb-4 leading-tight group-hover:translate-x-2 transition-transform duration-300">
               {post.title}
             </h2>
             <p className="text-lg text-gray-200 line-clamp-2 max-w-2xl mb-6 font-light">
               {post.excerpt}
             </p>
             <div className="flex items-center text-gray-300 text-sm font-medium tracking-wide">
               <span>{post.date}</span>
               <span className="mx-3">•</span>
               <span>{post.readTime}</span>
             </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={cardVariants}
      className="flex flex-col group"
    >
      <Link to={`/post/${post.id}`} className="block overflow-hidden rounded-2xl mb-5 relative aspect-[4/3] bg-zinc-100 dark:bg-zinc-800">
        {post.coverImage ? (
           <motion.img 
            src={post.coverImage} 
            alt={post.title} 
            className="w-full h-full object-cover" 
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.6 }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-300">
             <span className="text-4xl">🦆</span>
          </div>
        )}
        <div className="absolute top-4 left-4">
             <span className="px-2 py-1 bg-white/90 dark:bg-black/80 backdrop-blur rounded text-xs font-bold uppercase tracking-wide text-ink dark:text-white">
                {post.category}
             </span>
        </div>
        
        {post.top !== undefined && (
             <div className="absolute top-4 right-4 bg-accent/90 backdrop-blur text-white p-1.5 rounded-full z-10 shadow-sm">
               <Pin size={14} fill="currentColor" />
             </div>
        )}
        
        {post.top === undefined && (
            <div className="absolute top-4 right-4 bg-white/90 dark:bg-black/80 backdrop-blur rounded-full p-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-y-2 group-hover:translate-y-0">
               <ArrowUpRight size={20} className="text-ink dark:text-white" />
            </div>
        )}
      </Link>
      
      <div className="flex flex-col">
        <h3 className="text-2xl font-serif font-bold mb-3 text-ink dark:text-gray-100 leading-snug group-hover:text-accent dark:group-hover:text-accent-light transition-colors">
          <Link to={`/post/${post.id}`}>
            {post.title}
          </Link>
        </h3>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed line-clamp-2 mb-4">
          {post.excerpt}
        </p>
        <div className="mt-auto pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-xs font-medium text-zinc-400">
          <div className="flex items-center">
            <Calendar size={12} className="mr-2" /> {post.date}
          </div>
          <span>{post.readTime}</span>
        </div>
      </div>
    </motion.div>
  );
};

const FilterBar = ({ 
  categories, 
  selected, 
  onSelect,
  sortOrder,
  onToggleSort
}: { 
  categories: string[], 
  selected: string, 
  onSelect: (cat: string) => void,
  sortOrder: 'newest' | 'oldest',
  onToggleSort: () => void
}) => {
  return (
    <div className="flex flex-col md:flex-row justify-center items-center gap-4 mb-12">
        <div className="overflow-x-auto pb-4 md:pb-0 no-scrollbar w-full md:w-auto flex justify-center">
          <div className="flex space-x-2 px-4">
            {['全部', ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => onSelect(cat)}
                className={`
                  px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 border whitespace-nowrap
                  ${selected === cat 
                    ? 'bg-ink text-white border-ink dark:bg-white dark:text-ink dark:border-white shadow-lg transform scale-105' 
                    : 'bg-transparent text-zinc-500 border-zinc-200 dark:border-zinc-800 hover:border-ink dark:hover:border-zinc-500 hover:text-ink dark:hover:text-white'}
                `}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <button 
           onClick={onToggleSort}
           className="flex items-center space-x-2 px-4 py-2 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-ink dark:hover:text-white hover:border-ink dark:hover:border-white transition-all duration-300 text-sm font-medium"
        >
           {sortOrder === 'newest' ? <ArrowDownWideNarrow size={16} /> : <ArrowUpWideNarrow size={16} />}
           <span>{sortOrder === 'newest' ? '由新到旧' : '由旧到新'}</span>
        </button>
    </div>
  );
};

const Hero = ({ onSearch }: { onSearch: (val: string) => void }) => {
  return (
    <div className="py-20 md:py-32 flex flex-col items-center text-center relative z-10">
      <motion.span
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-accent font-bold tracking-widest uppercase text-sm mb-6"
      >
        跑路的duck的胡言乱语
      </motion.span>
      
      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
        className="text-6xl md:text-8xl font-serif font-bold text-ink dark:text-white mb-8 tracking-tight"
      >
        {siteConfig.title} <br/><i className="font-light text-zinc-500 dark:text-zinc-400">{siteConfig.subtitle}</i>
      </motion.h1>
      
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-lg text-zinc-600 dark:text-zinc-300 max-w-xl mx-auto leading-relaxed mb-10 font-sans"
      >
        {siteConfig.description}
      </motion.p>

      <motion.div 
         initial={{ opacity: 0, scale: 0.9 }}
         animate={{ opacity: 1, scale: 1 }}
         transition={{ delay: 0.5 }}
         className="relative w-full max-w-md group"
      >
         <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Search className="text-zinc-400 group-focus-within:text-accent transition-colors" size={20} />
         </div>
         <input 
            type="text" 
            placeholder="搜索文章..." 
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 rounded-full bg-white dark:bg-zinc-900 border-2 border-zinc-100 dark:border-zinc-800 focus:border-accent dark:focus:border-accent outline-none shadow-lg shadow-zinc-200/50 dark:shadow-none transition-all duration-300 text-ink dark:text-white"
         />
      </motion.div>
    </div>
  );
};

export const Home = () => {
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [displayedPosts, setDisplayedPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('全部');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([getPosts(), getAllCategories()]).then(([posts, cats]) => {
      setAllPosts(posts);
      setCategories(cats);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (allPosts.length === 0) return;

    let filtered = allPosts;
    if (selectedCategory !== '全部') {
        filtered = allPosts.filter(p => p.category === selectedCategory);
    }

    const pinnedPosts = filtered.filter(p => p.top !== undefined);
    const regularPosts = filtered.filter(p => p.top === undefined);

    pinnedPosts.sort((a, b) => (a.top || 0) - (b.top || 0));

    regularPosts.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
    });

    setDisplayedPosts([...pinnedPosts, ...regularPosts]);

  }, [allPosts, selectedCategory, sortOrder]);


  const handleSearch = async (query: string) => {
    if (!query) {
      return; 
    }
    const results = await searchPosts(query);
    setDisplayedPosts(results);
  };

  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      className="pb-20"
    >
      <Hero onSearch={handleSearch} />
      
      {!loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <FilterBar 
            categories={categories} 
            selected={selectedCategory} 
            onSelect={setSelectedCategory} 
            sortOrder={sortOrder}
            onToggleSort={() => setSortOrder(prev => prev === 'newest' ? 'oldest' : 'newest')}
          />
        </motion.div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-80 bg-zinc-100 dark:bg-zinc-800 rounded-2xl animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="space-y-16">
          <motion.div 
             className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-16"
             variants={{ animate: { transition: { staggerChildren: 0.1 } } }}
             initial="hidden"
             animate="visible"
             key={`${selectedCategory}-${sortOrder}`}
          >
            {displayedPosts.length > 0 ? (
                displayedPosts.map((post, index) => (
                    <PostCard 
                        key={post.id} 
                        post={post} 
                        index={index} 
                        featured={!!post.featured} 
                    />
                ))
            ) : (
                <div className="col-span-full text-center py-20">
                    <p className="text-xl text-zinc-400">暂无相关文章</p>
                </div>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};