import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Archive, Calendar, FolderTree, ArrowUpRight, Search, X } from 'lucide-react';
import { getPosts, searchPosts } from '@/services/posts';
import { PostMetadata } from '../types';
import { Seo } from '../components/Seo';

interface ArchiveGroup {
  year: string;
  total: number;
  categories: string[];
  months: string[];
  posts: PostMetadata[];
}

const formatMonth = (dateText: string) => {
  const date = new Date(dateText);
  return `${date.getMonth() + 1}\u6708`;
};

const formatDay = (dateText: string) => {
  const date = new Date(dateText);
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const formatFullDate = (dateText: string) => {
  const date = new Date(dateText);
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
};

const buildArchiveGroups = (posts: PostMetadata[]) => {
  const groups = new Map<string, ArchiveGroup>();

  posts
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .forEach((post) => {
      const year = String(new Date(post.date).getFullYear());
      const existing = groups.get(year);

      if (!existing) {
        groups.set(year, {
          year,
          total: 1,
          categories: [post.category],
          months: [formatMonth(post.date)],
          posts: [post]
        });
        return;
      }

      existing.total += 1;
      existing.posts.push(post);

      if (!existing.categories.includes(post.category)) {
        existing.categories.push(post.category);
      }

      const month = formatMonth(post.date);
      if (!existing.months.includes(month)) {
        existing.months.push(month);
      }
    });

  // Sort months and categories for each group
  const sortedGroups = Array.from(groups.values()).map((group) => ({
    ...group,
    months: group.months.sort((a, b) => {
      const monthA = parseInt(a.replace('月', ''));
      const monthB = parseInt(b.replace('月', ''));
      return monthB - monthA; // Descending order (12月, 11月, ...)
    }),
    categories: group.categories.sort()
  }));

  return sortedGroups.sort((a, b) => Number(b.year) - Number(a.year));
};

export const ArchivePage = () => {
  const [allPosts, setAllPosts] = useState<PostMetadata[]>([]);
  const [groups, setGroups] = useState<ArchiveGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [latestDate, setLatestDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchRequestIdRef = useRef(0);

  useEffect(() => {
    getPosts().then((posts) => {
      setAllPosts(posts);
      const archiveGroups = buildArchiveGroups(posts);
      setGroups(archiveGroups);
      setLatestDate(posts[0]?.date || '');
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const performSearch = useCallback(async (query: string) => {
    const requestId = ++searchRequestIdRef.current;

    if (!query.trim()) {
      if (requestId !== searchRequestIdRef.current) {
        return;
      }
      const archiveGroups = buildArchiveGroups(allPosts);
      setGroups(archiveGroups);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const results = await searchPosts(query);
    if (requestId !== searchRequestIdRef.current) {
      return;
    }
    const archiveGroups = buildArchiveGroups(results);
    setGroups(archiveGroups);
    setIsSearching(false);
  }, [allPosts]);

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
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchRequestIdRef.current += 1;
    setSearchQuery('');
    setIsSearching(false);
    const archiveGroups = buildArchiveGroups(allPosts);
    setGroups(archiveGroups);
  }, [allPosts]);

  const totalPosts = groups.reduce((sum, group) => sum + group.total, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      className="pb-10 md:pb-20"
    >
      <Seo
        title="\u5f52\u6863"
        description="\u6309\u5e74\u4efd\u6574\u7406\u672c\u7ad9\u5168\u90e8\u6587\u7ae0\uff0c\u5feb\u901f\u67e5\u770b\u53d1\u5e03\u65f6\u95f4\u3001\u5206\u7c7b\u4e0e\u5386\u53f2\u66f4\u65b0\u8f68\u8ff9\u3002"
      />

      <section className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(192,57,43,0.12),_transparent_38%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(244,244,245,0.9))] p-8 md:p-12 dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(192,57,43,0.2),_transparent_40%),linear-gradient(135deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.96))]">
        <div className="absolute right-6 top-6 rounded-full border border-accent/20 bg-accent/10 p-3 text-accent">
          <Archive size={22} />
        </div>
        <div className="max-w-3xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-accent">Archive Index</p>
          <h1 className="mb-6 font-serif text-4xl font-bold tracking-tight text-ink dark:text-white md:text-6xl">
            {'\u6240\u6709\u6587\u7ae0\uff0c\u6309\u5e74\u4efd\u5f52\u62e2\u3002'}
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300 md:text-base">
            {'\u8fd9\u91cc\u96c6\u4e2d\u5c55\u793a\u5168\u90e8\u5386\u53f2\u5185\u5bb9\uff0c\u9002\u5408\u6309\u65f6\u95f4\u7ebf\u56de\u770b\u66f4\u65b0\u8282\u594f\uff0c\u4e5f\u65b9\u4fbf\u5feb\u901f\u8df3\u8f6c\u5230\u65e7\u6587\u7ae0\u3002'}
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-white/60 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="mb-3 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <Archive size={16} />
              <span className="text-xs font-bold uppercase tracking-[0.25em]">{'\u6587\u7ae0\u603b\u6570'}</span>
            </div>
            <div className="text-3xl font-bold text-ink dark:text-white">{totalPosts}</div>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="mb-3 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <Calendar size={16} />
              <span className="text-xs font-bold uppercase tracking-[0.25em]">{'\u5f52\u6863\u5e74\u4efd'}</span>
            </div>
            <div className="text-3xl font-bold text-ink dark:text-white">{groups.length}</div>
          </div>
          <div className="rounded-2xl border border-white/60 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="mb-3 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <FolderTree size={16} />
              <span className="text-xs font-bold uppercase tracking-[0.25em]">{'\u6700\u8fd1\u66f4\u65b0'}</span>
            </div>
            <div className="text-lg font-bold text-ink dark:text-white">{latestDate ? formatFullDate(latestDate) : '--'}</div>
          </div>
        </div>
      </section>

      <section className="mt-10 md:mt-14">
        <div className="mb-8">
          <div className="relative max-w-md group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Search className="text-zinc-400 group-focus-within:text-accent transition-colors" size={18} />
            </div>
            <input 
              type="text" 
              placeholder="搜索归档文章..." 
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)} 
              className="w-full pl-11 pr-11 py-3 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-accent dark:focus:border-accent outline-none transition-all duration-300 text-ink dark:text-white placeholder:text-zinc-400 text-sm focus:ring-4 ring-accent/10" 
            />
            {searchQuery && (
              <button 
                onClick={handleClearSearch}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-zinc-400 hover:text-accent transition-colors"
              >
                <X size={16} />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              搜索 "<span className="font-bold text-accent">{searchQuery}</span>" 找到 {totalPosts} 篇文章
            </div>
          )}
        </div>

        {loading || isSearching ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
            ))}
          </div>
        ) : (
          <div className="relative">
            {/* Timeline vertical line */}
            <div className="absolute left-[7px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-accent via-zinc-300 to-transparent dark:via-zinc-700 md:left-[9px]" />

            <div className="space-y-12">
              {groups.map((group, groupIndex) => (
                <motion.div
                  key={group.year}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: groupIndex * 0.08 }}
                >
                  {/* Year marker */}
                  <div className="relative flex items-center gap-4 mb-8">
                    <div className="relative z-10 flex h-4 w-4 items-center justify-center rounded-full bg-accent shadow-lg shadow-accent/30 md:h-5 md:w-5">
                      <div className="h-2 w-2 rounded-full bg-white md:h-2.5 md:w-2.5" />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-serif text-2xl font-bold text-ink dark:text-white md:text-3xl">
                        {group.year}
                      </h2>
                      <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-bold text-accent">
                        {group.total} 篇
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {group.categories.map((category) => (
                          <span
                            key={`${group.year}-${category}`}
                            className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                          >
                            {category}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Posts timeline */}
                  <div className="space-y-6 pl-8 md:pl-10">
                    {group.posts.map((post, postIndex) => (
                      <motion.div
                        key={post.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: groupIndex * 0.08 + postIndex * 0.03 }}
                        className="relative"
                      >
                        {/* Timeline dot */}
                        <div className="absolute -left-[30px] top-2 h-2 w-2 rounded-full border-2 border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900 md:-left-[38px]" />

                        <Link
                          to={`/post/${post.id}`}
                          className="group block rounded-xl border border-zinc-200 bg-white/50 p-4 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:bg-white hover:shadow-lg hover:shadow-accent/5 dark:border-zinc-800 dark:bg-zinc-900/30 dark:hover:bg-zinc-900/60 md:p-5"
                        >
                          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                            <time className="font-mono font-semibold">{formatDay(post.date)}</time>
                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                            <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                              {post.category}
                            </span>
                            <span className="text-zinc-300 dark:text-zinc-700">•</span>
                            <span>{post.readTime}</span>
                          </div>

                          <h3 className="mb-2 font-serif text-lg font-bold text-ink transition-colors group-hover:text-accent dark:text-white md:text-xl">
                            {post.title}
                          </h3>

                          <p className="line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                            {post.excerpt}
                          </p>

                          <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors group-hover:text-accent">
                            <span>阅读文章</span>
                            <ArrowUpRight size={14} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                          </div>
                        </Link>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </section>
    </motion.div>
  );
};
