import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Calendar, ArrowUpRight, Search, ArrowDownWideNarrow, ArrowUpWideNarrow, Pin, Clock, Sparkles } from 'lucide-react';
import { getPosts, searchPosts, getAllCategories } from '../services/posts';
import { Post } from '../types';
import { siteConfig } from '../site.config';

// --- 优化的文章卡片组件 ---
const PostCard: React.FC<{ post: Post; index: number; featured?: boolean }> = ({ post, index, featured }) => {
  const cardVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        duration: 0.6, 
        ease: [0.22, 1, 0.36, 1],
        delay: index * 0.05 
      } 
    }
  };

  // 统一的分类标签样式（毛玻璃效果）
  const CategoryBadge = ({ text }: { text: string }) => (
    <span className="backdrop-blur-md bg-white/70 dark:bg-black/60 border border-white/20 text-ink dark:text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm z-10">
      {text}
    </span>
  );

  // --- 置顶/推荐大卡片 ---
  if (featured) {
    return (
      <motion.div
        variants={cardVariants}
        className="col-span-1 md:col-span-2 lg:col-span-3 w-full"
      >
        <Link to={`/post/${post.id}`} className="group block h-full">
          <div className="relative overflow-hidden rounded-[2rem] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl shadow-zinc-200/50 dark:shadow-none transition-all duration-500 hover:shadow-xl dark:hover:border-zinc-700">
            
            {/* 移动端：上图下文；桌面端：全屏背景图模式 */}
            <div className="flex flex-col md:block h-full">
              
              {/* 图片区域 */}
              <div className="relative w-full h-64 md:h-[500px] overflow-hidden">
                {post.coverImage ? (
                  <motion.img 
                    src={post.coverImage} 
                    alt={post.title}
                    className="w-full h-full object-cover transition-transform duration-700 ease-out will-change-transform"
                    whileHover={{ scale: 1.05 }}
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                    <Sparkles className="text-zinc-300 w-16 h-16" />
                  </div>
                )}
                
                {/* 桌面端遮罩 (移动端隐藏) */}
                <div className="hidden md:block absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity" />
                
                {/* 左上角分类标签 */}
                <div className="absolute top-4 left-4 md:top-6 md:left-6">
                   <CategoryBadge text={post.category} />
                </div>

                {/* 右上角置顶图标 */}
                {post.top !== undefined && (
                  <div className="absolute top-4 right-4 md:top-6 md:right-6 bg-accent text-white p-2 rounded-full shadow-lg z-20">
                    <Pin size={18} fill="currentColor" />
                  </div>
                )}
              </div>

              {/* 内容区域 */}
              <div className="relative p-6 md:absolute md:bottom-0 md:left-0 md:p-12 w-full md:max-w-4xl z-20 bg-white dark:bg-zinc-900 md:bg-transparent md:dark:bg-transparent">
                <h2 className="text-2xl md:text-5xl font-serif font-bold text-ink dark:text-white md:text-white mb-3 md:mb-4 leading-tight group-hover:text-accent md:group-hover:text-white md:group-hover:translate-x-2 transition-all duration-300">
                  {post.title}
                </h2>
                <p className="text-sm md:text-lg text-zinc-500 dark:text-zinc-400 md:text-gray-200 line-clamp-2 md:line-clamp-2 mb-4 md:mb-6 font-sans">
                  {post.excerpt}
                </p>
                <div className="flex items-center text-zinc-400 md:text-gray-300 text-xs md:text-sm font-medium tracking-wide gap-4">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} />
                    <span>{post.date}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} />
                    <span>{post.readTime}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>
    );
  }

  // --- 普通卡片 ---
  return (
    <motion.div
      variants={cardVariants}
      className="flex flex-col h-full"
    >
      <Link 
        to={`/post/${post.id}`} 
        className="group relative flex flex-col h-full bg-white dark:bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm hover:shadow-xl transition-all duration-300"
      >
        {/* 图片容器 - 调整为 16:10 比例，视野更开阔 */}
        <div className="relative aspect-[16/10] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          {post.coverImage ? (
             <motion.img 
              src={post.coverImage} 
              alt={post.title} 
              className="w-full h-full object-cover transition-transform duration-700 ease-out will-change-transform" 
              whileHover={{ scale: 1.05 }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-300 bg-zinc-50 dark:bg-zinc-800/50">
               <span className="text-4xl opacity-50">🦆</span>
            </div>
          )}

          {/* 悬浮标签 */}
          <div className="absolute top-3 left-3">
             <CategoryBadge text={post.category} />
          </div>
          
          {/* 右上角图标 */}
          <div className="absolute top-3 right-3 z-10">
             {post.top !== undefined ? (
               <div className="bg-accent/90 backdrop-blur text-white p-1.5 rounded-full shadow-sm">
                 <Pin size={14} fill="currentColor" />
               </div>
             ) : (
               <div className="bg-white/90 dark:bg-black/60 backdrop-blur rounded-full p-2 opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                  <ArrowUpRight size={18} className="text-ink dark:text-white" />
               </div>
             )}
          </div>
        </div>
        
        {/* 文字内容 - 增加内边距 */}
        <div className="flex flex-col flex-grow p-5 md:p-6">
          <h3 className="text-xl font-serif font-bold mb-3 text-ink dark:text-gray-100 leading-snug group-hover:text-accent dark:group-hover:text-accent-light transition-colors line-clamp-2">
            {post.title}
          </h3>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm leading-relaxed line-clamp-2 mb-6 flex-grow">
            {post.excerpt}
          </p>
          
          {/* 底部信息栏 */}
          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-between items-center text-xs text-zinc-400 font-medium">
            <div className="flex items-center gap-1.5">
              <Calendar size={13} />
              <span>{post.date}</span>
            </div>
            <span className="bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-zinc-500 dark:text-zinc-400">
              {post.readTime}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
};

// --- 筛选栏组件 (保持大致不变，微调间距) ---
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
    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-12 px-2">
        <div className="overflow-x-auto pb-2 md:pb-0 no-scrollbar w-full md:w-auto -mx-4 md:mx-0 px-4 md:px-0">
          <div className="flex space-x-2">
            {['全部', ...categories].map((cat) => (
              <button
                key={cat}
                onClick={() => onSelect(cat)}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 border whitespace-nowrap
                  ${selected === cat 
                    ? 'bg-ink text-white border-ink dark:bg-white dark:text-ink dark:border-white shadow-md' 
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
           className="flex items-center space-x-2 px-4 py-2 rounded-full border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-ink dark:hover:text-white hover:border-ink dark:hover:border-white transition-all duration-300 text-sm font-medium w-full md:w-auto justify-center"
        >
           {sortOrder === 'newest' ? <ArrowDownWideNarrow size={16} /> : <ArrowUpWideNarrow size={16} />}
           <span>{sortOrder === 'newest' ? '最新发布' : '最早发布'}</span>
        </button>
    </div>
  );
};

// --- Hero 区域 (微调移动端间距) ---
const Hero = ({ onSearch }: { onSearch: (val: string) => void }) => {
  return (
    <div className="py-16 md:py-32 flex flex-col items-center text-center relative z-10 px-4">
      <motion.span
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-accent font-bold tracking-[0.2em] uppercase text-xs md:text-sm mb-6"
      >
        {siteConfig.subtitle}
      </motion.span>
      
      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
        className="text-5xl md:text-8xl font-serif font-bold text-ink dark:text-white mb-6 md:mb-8 tracking-tight leading-tight"
      >
        {siteConfig.title}
      </motion.h1>
      
      <motion.p 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-base md:text-lg text-zinc-600 dark:text-zinc-300 max-w-xl mx-auto leading-relaxed mb-10 font-sans"
      >
        {siteConfig.description}
      </motion.p>

      <motion.div 
         initial={{ opacity: 0, scale: 0.95 }}
         animate={{ opacity: 1, scale: 1 }}
         transition={{ delay: 0.5 }}
         className="relative w-full max-w-sm md:max-w-md group"
      >
         <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="text-zinc-400 group-focus-within:text-accent transition-colors" size={18} />
         </div>
         <input 
            type="text" 
            placeholder="搜索文章..." 
            onChange={(e) => onSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 md:py-4 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-accent dark:focus:border-accent outline-none shadow-lg shadow-zinc-200/20 dark:shadow-none transition-all duration-300 text-ink dark:text-white placeholder:text-zinc-400 text-sm md:text-base"
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
      setDisplayedPosts(allPosts); // Reset if empty
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-96 bg-zinc-100 dark:bg-zinc-800 rounded-3xl animate-pulse"></div>
          ))}
        </div>
      ) : (
        <div className="space-y-16">
          <motion.div 
             className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10"
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
                <div className="col-span-full text-center py-20 bg-zinc-50 dark:bg-zinc-900 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                    <p className="text-xl text-zinc-400">暂无相关文章</p>
                </div>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};
