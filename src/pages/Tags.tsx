import React, { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { Tag, Calendar, Clock, Search, X } from 'lucide-react';
import { getPosts, searchPosts } from '@/services/posts';
import { PostMetadata } from '../types';
import { Seo } from '../components/Seo';

interface TagInfo {
  name: string;
  count: number;
  posts: PostMetadata[];
}

export const Tags = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allPosts, setAllPosts] = useState<PostMetadata[]>([]);
  const [tags, setTags] = useState<TagInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const selectedTag = searchParams.get('tag');

  const buildTagList = useCallback((posts: PostMetadata[]) => {
    const tagMap = new Map<string, PostMetadata[]>();
    
    posts.forEach(post => {
      post.tags.forEach(tag => {
        if (!tagMap.has(tag)) {
          tagMap.set(tag, []);
        }
        tagMap.get(tag)!.push(post);
      });
    });

    return Array.from(tagMap.entries())
      .map(([name, posts]) => ({
        name,
        count: posts.length,
        posts: posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      }))
      .sort((a, b) => b.count - a.count);
  }, []);

  useEffect(() => {
    getPosts().then(posts => {
      setAllPosts(posts);
      const tagList = buildTagList(posts);
      setTags(tagList);
      setLoading(false);
    });
  }, [buildTagList]);

  const performSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      const tagList = buildTagList(allPosts);
      setTags(tagList);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const results = await searchPosts(query);
    const tagList = buildTagList(results);
    setTags(tagList);
    setIsSearching(false);
  }, [allPosts, buildTagList]);

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
    const tagList = buildTagList(allPosts);
    setTags(tagList);
  }, [allPosts, buildTagList]);

  const selectedTagInfo = selectedTag ? tags.find(t => t.name === selectedTag) : null;
  const maxCount = Math.max(...tags.map(t => t.count), 1);

  const getTagSize = (count: number) => {
    const ratio = count / maxCount;
    if (ratio > 0.7) return 'text-2xl md:text-3xl';
    if (ratio > 0.4) return 'text-xl md:text-2xl';
    return 'text-base md:text-lg';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="pb-10 md:pb-20"
    >
      <Seo title="标签" description="按标签浏览文章" />

      <section className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-gradient-to-br from-white via-zinc-50 to-white p-8 md:p-12 dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900/50 dark:to-zinc-900 mb-10">
        <div className="absolute right-6 top-6 rounded-full border border-accent/20 bg-accent/10 p-3 text-accent">
          <Tag size={22} />
        </div>
        <div className="max-w-3xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-accent">Tags Collection</p>
          <h1 className="mb-6 font-serif text-4xl font-bold tracking-tight text-ink dark:text-white md:text-6xl">
            标签云
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300 md:text-base">
            共 {tags.length} 个标签，{tags.reduce((sum, t) => sum + t.count, 0)} 篇文章
          </p>
        </div>
      </section>

      {loading || isSearching ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent"></div>
        </div>
      ) : (
        <>
          <div className="mb-8">
            <div className="relative max-w-md group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="text-zinc-400 group-focus-within:text-accent transition-colors" size={18} />
              </div>
              <input 
                type="text" 
                placeholder="搜索标签或文章..." 
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
                搜索 "<span className="font-bold text-accent">{searchQuery}</span>" 找到 {tags.length} 个标签
              </div>
            )}
          </div>

          {!selectedTag ? (
            <div className="rounded-2xl border border-zinc-200 bg-white/80 p-8 md:p-12 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex flex-wrap items-center justify-center gap-4 md:gap-6">
                {tags.map((tag, index) => (
                  <motion.button
                    key={tag.name}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => setSearchParams({ tag: tag.name })}
                    className={`${getTagSize(tag.count)} group relative rounded-full border-2 border-zinc-200 bg-white px-5 py-2.5 font-bold text-zinc-700 transition-all hover:scale-110 hover:border-accent hover:text-accent dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-accent dark:hover:text-accent`}
                  >
                    {tag.name}
                    <span className="ml-2 text-xs opacity-60">({tag.count})</span>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-8 flex items-center justify-between">
                <h2 className="font-serif text-2xl font-bold text-ink dark:text-white md:text-3xl">
                  标签: {selectedTag}
                  <span className="ml-3 text-base text-zinc-400">({selectedTagInfo?.count} 篇)</span>
                </h2>
                <button
                  onClick={() => setSearchParams({})}
                  className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-bold text-zinc-600 transition-colors hover:border-accent hover:text-accent dark:border-zinc-800 dark:text-zinc-400"
                >
                  查看全部
                </button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {selectedTagInfo?.posts.map((post, index) => (
                  <motion.div
                    key={post.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Link
                      to={`/post/${post.id}`}
                      className="group block rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700"
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
                          {post.category}
                        </span>
                      </div>
                      <h3 className="mb-3 font-serif text-xl font-bold text-ink transition-colors group-hover:text-accent dark:text-white dark:group-hover:text-accent">
                        {post.title}
                      </h3>
                      <p className="mb-4 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">
                        {post.excerpt}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {post.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {post.readTime}
                        </span>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};
