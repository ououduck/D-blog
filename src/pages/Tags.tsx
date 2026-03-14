import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { Tag, Calendar, Clock, Search, X } from 'lucide-react';
import { getPosts } from '@/services/posts';
import { PostMetadata } from '../types';
import { Seo } from '../components/Seo';
import { usePostSearch } from '@/hooks/usePostSearch';

interface TagInfo {
  name: string;
  count: number;
  posts: PostMetadata[];
}

const buildTagList = (posts: PostMetadata[]) => {
  const tagMap = new Map<string, PostMetadata[]>();

  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      if (!tagMap.has(tag)) {
        tagMap.set(tag, []);
      }

      tagMap.get(tag)!.push(post);
    });
  });

  return Array.from(tagMap.entries())
    .map(([name, taggedPosts]) => ({
      name,
      count: taggedPosts.length,
      posts: taggedPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    }))
    .sort((a, b) => b.count - a.count);
};

export const Tags = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allPosts, setAllPosts] = useState<PostMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const selectedTag = searchParams.get('tag');
  const { searchQuery, isSearching, results, handleSearch, clearSearch, hasSearchQuery } = usePostSearch({
    emptyResults: allPosts
  });

  useEffect(() => {
    getPosts().then((posts) => {
      setAllPosts(posts);
      setLoading(false);
    });
  }, []);

  const tags = buildTagList(results);
  const selectedTagInfo = selectedTag ? tags.find((tag) => tag.name === selectedTag) : null;
  const maxCount = Math.max(...tags.map((tag) => tag.count), 1);

  const getTagSize = (count: number) => {
    const ratio = count / maxCount;
    if (ratio > 0.7) return 'text-2xl md:text-3xl';
    if (ratio > 0.4) return 'text-xl md:text-2xl';
    return 'text-base md:text-lg';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="pb-10 md:pb-20">
      <Seo title="标签" description="按标签浏览文章" />

      <section className="relative mb-10 overflow-hidden rounded-[2rem] border border-zinc-200 bg-gradient-to-br from-white via-zinc-50 to-white p-8 dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-900/50 dark:to-zinc-900 md:p-12">
        <div className="absolute right-6 top-6 rounded-full border border-accent/20 bg-accent/10 p-3 text-accent">
          <Tag size={22} />
        </div>
        <div className="max-w-3xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-accent">Tags Collection</p>
          <h1 className="mb-6 font-serif text-4xl font-bold tracking-tight text-ink dark:text-white md:text-6xl">标签集合</h1>
          <p className="max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300 md:text-base">
            共 {tags.length} 个标签，{tags.reduce((sum, tag) => sum + tag.count, 0)} 篇文章
          </p>
        </div>
      </section>

      {loading || isSearching ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="mb-8">
            <div className="group relative max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Search className="text-zinc-400 transition-colors group-focus-within:text-accent" size={18} />
              </div>
              <input
                type="text"
                placeholder="搜索标签或文章..."
                value={searchQuery}
                onChange={(event) => handleSearch(event.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-white py-3 pl-11 pr-11 text-sm text-ink outline-none transition-all duration-300 placeholder:text-zinc-400 focus:border-accent focus:ring-4 ring-accent/10 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:border-accent"
              />
              {searchQuery && (
                <button onClick={clearSearch} className="absolute inset-y-0 right-0 flex items-center pr-4 text-zinc-400 transition-colors hover:text-accent">
                  <X size={16} />
                </button>
              )}
            </div>
            {hasSearchQuery && (
              <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                搜索 "<span className="font-bold text-accent">{searchQuery}</span>" 找到 {tags.length} 个标签
              </div>
            )}
          </div>

          {!selectedTag ? (
            <div className="rounded-2xl border border-zinc-200 bg-white/80 p-8 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50 md:p-12">
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
                  <span className="ml-3 text-base text-zinc-400">({selectedTagInfo?.count ?? 0} 篇)</span>
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
                  <motion.div key={post.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.05 }}>
                    <Link to={`/post/${post.id}`} className="group block rounded-2xl border border-zinc-200 bg-white p-6 transition-all hover:border-zinc-300 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-zinc-700">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">
                          {post.category}
                        </span>
                      </div>
                      <h3 className="mb-3 font-serif text-xl font-bold text-ink transition-colors group-hover:text-accent dark:text-white dark:group-hover:text-accent">
                        {post.title}
                      </h3>
                      <p className="mb-4 line-clamp-2 text-sm text-zinc-500 dark:text-zinc-400">{post.excerpt}</p>
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

                {selectedTagInfo && selectedTagInfo.posts.length === 0 && (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
                    当前筛选条件下没有文章。
                  </div>
                )}

                {!selectedTagInfo && (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
                    当前标签在搜索结果中不可用，请清除搜索或查看全部标签。
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
};
