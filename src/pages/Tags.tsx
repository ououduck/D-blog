import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { Tag, Calendar, Clock, Search, X } from 'lucide-react';
import { getPosts } from '@/services/posts';
import { PostMetadata } from '../types';
import { Seo } from '../components/Seo';
import { usePostSearch } from '@/hooks/usePostSearch';
import { getDateTimestamp } from '@/utils/date';
import { easeOut } from '@/utils/motion';

interface TagInfo {
  name: string;
  count: number;
  posts: PostMetadata[];
}

const buildTagList = (posts: PostMetadata[]) => {
  const tagMap = new Map<string, PostMetadata[]>();

  posts.forEach((post) => {
    (Array.isArray(post.tags) ? post.tags : [])
      .map((tag) => (typeof tag === 'string' ? tag.trim() : ''))
      .filter(Boolean)
      .forEach((tag) => {
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
      posts: taggedPosts.sort((a, b) => getDateTimestamp(b.date) - getDateTimestamp(a.date))
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
};

export const Tags = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allPosts, setAllPosts] = useState<PostMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const selectedTag = searchParams.get('tag');
  const queryFromUrl = searchParams.get('q') || '';
  const { searchQuery, isSearching, results, handleSearch, setSearchQuery, clearSearch, hasSearchQuery } = usePostSearch({
    emptyResults: allPosts,
    initialQuery: queryFromUrl
  });

  useEffect(() => {
    let cancelled = false;

    getPosts()
      .then((posts) => {
        if (cancelled) {
          return;
        }

        setAllPosts(posts);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.error('Failed to load tags posts:', error);
        setLoadError('标签数据加载失败，请稍后刷新重试。');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearchChange = (query: string) => {
    handleSearch(query);
    setSearchParams((previous) => {
      const nextParams = new URLSearchParams(previous);
      if (query.trim()) {
        nextParams.set('q', query);
      } else {
        nextParams.delete('q');
      }
      return nextParams;
    }, { replace: true });
  };

  const handleClearSearch = () => {
    clearSearch();
    setSearchParams((previous) => {
      const nextParams = new URLSearchParams(previous);
      nextParams.delete('q');
      return nextParams;
    }, { replace: true });
  };

  useEffect(() => {
    if (queryFromUrl !== searchQuery) {
      setSearchQuery(queryFromUrl);
    }
  }, [queryFromUrl, searchQuery, setSearchQuery]);

  const tags = useMemo(() => buildTagList(results), [results]);
  const allTags = useMemo(() => buildTagList(allPosts), [allPosts]);
  const selectedTagInfo = selectedTag ? allTags.find((tag) => tag.name === selectedTag) ?? null : null;
  const filteredSelectedTagPosts = selectedTagInfo
    ? selectedTagInfo.posts.filter((post) => results.some((result) => result.id === post.id))
    : [];
  const maxCount = Math.max(...tags.map((tag) => tag.count), 1);

  const getTagSize = (count: number) => {
    const ratio = count / maxCount;
    if (ratio > 0.7) return 'text-lg sm:text-2xl md:text-3xl';
    if (ratio > 0.4) return 'text-base sm:text-xl md:text-2xl';
    return 'text-sm sm:text-base md:text-lg';
  };

  const updateTagParam = (nextTag?: string) => {
    const nextParams = new URLSearchParams(searchParams);

    if (nextTag) {
      nextParams.set('tag', nextTag);
    } else {
      nextParams.delete('tag');
    }

    setSearchParams(nextParams);
  };

  return (
    <div className="pb-8 md:pb-14">
      <Seo title="标签" description="按标签浏览 D-blog 文章，通过标签快速筛选感兴趣的技术主题与内容。" />

      <section className="relative mb-10 overflow-hidden rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 p-8 md:p-12">
        <div className="absolute right-6 top-6 rounded-lg border border-zinc-200 bg-zinc-100 p-3 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
          <Tag size={22} />
        </div>
        <div className="max-w-3xl">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:text-xs">Tags Collection</p>
          <h1 className="mb-6 font-serif text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-6xl">标签集合</h1>
          <p className="max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-400 md:text-base">
            共 {allTags.length} 个标签，{allTags.reduce((sum, tag) => sum + tag.count, 0)} 篇文章
          </p>
        </div>
      </section>

      {loading || isSearching ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-900 border-t-transparent dark:border-zinc-100" />
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 p-8 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
          {loadError}
        </div>
      ) : (
        <>
          <div className="mb-8">
            <div className="group relative max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                <Search className="text-zinc-400 transition-colors group-focus-within:text-zinc-900 dark:group-focus-within:text-zinc-100" size={18} />
              </div>
              <input
                type="text"
                placeholder="搜索标签或文章..."
                value={searchQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
                className="w-full rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 py-3 pl-11 pr-11 text-sm text-ink outline-none transition-colors duration-150 placeholder:text-zinc-400 focus:border-zinc-400 dark:text-white dark:focus:border-zinc-600"
                aria-label="搜索标签或文章"
              />
              {searchQuery && (
                <button onClick={handleClearSearch} className="absolute inset-y-0 right-0 flex items-center pr-4 text-zinc-400 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100" aria-label="清除搜索">
                  <X size={16} />
                </button>
              )}
            </div>
            {hasSearchQuery && (
              <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
                搜索 "<span className="font-bold text-zinc-900 dark:text-zinc-100">{searchQuery}</span>" 找到 {tags.length} 个标签
              </div>
            )}
          </div>

          {!selectedTag ? (
            allTags.length > 0 ? (
              <div className="rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 p-4 sm:p-6 md:p-12">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 md:gap-6">
                  {tags.map((tag, index) => (
                    <motion.button
                      key={tag.name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: index * 0.015, ease: easeOut }}
                      onClick={() => updateTagParam(tag.name)}
                      className={`${getTagSize(tag.count)} relative rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 px-3 py-1.5 font-bold leading-tight text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 sm:rounded-xl sm:px-5 sm:py-2.5 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100`}
                  aria-label={`查看标签 ${tag.name}，共 ${tag.count} 篇文章`}
                >
                  {tag.name}
                  <span className="ml-1.5 text-[10px] opacity-60 sm:ml-2 sm:text-xs">({tag.count})</span>
                </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/90 dark:bg-zinc-900/90 p-8 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                当前还没有可展示的标签内容。
              </div>
            )
          ) : (
            <div>
              <div className="mb-8 flex items-center justify-between">
                <h2 className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100 md:text-3xl">
                  标签: {selectedTag}
                  <span className="ml-3 text-base text-zinc-400">({selectedTagInfo?.count ?? 0} 篇)</span>
                </h2>
                <button
                  onClick={() => updateTagParam()}
                  className="rounded-xl bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 px-4 py-2 text-sm font-bold text-zinc-600 transition-colors hover:border-zinc-900 hover:text-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-100 dark:hover:text-zinc-100"
                >
                  查看全部
                </button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {filteredSelectedTagPosts.map((post, index) => (
                  <motion.div key={post.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: index * 0.02, ease: easeOut }}>
                    <Link to={`/post/${post.id}`} className="group block rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800/80 p-6 transition-colors dark:hover:border-zinc-700">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="rounded-lg bg-white/80 dark:bg-zinc-800/80 border border-zinc-200/60 dark:border-zinc-700/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-zinc-900 dark:text-zinc-100">
                          {post.category}
                        </span>
                      </div>
                      <h3 className="mb-3 font-serif text-xl font-bold text-zinc-900 transition-colors group-hover:text-zinc-700 dark:text-zinc-100 dark:group-hover:text-zinc-300">
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

                {selectedTagInfo && filteredSelectedTagPosts.length === 0 && (
                  <div className="rounded-2xl bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 p-6 text-sm text-zinc-500 dark:text-zinc-400">
                    当前标签存在，但在当前搜索条件下没有匹配文章。你可以清除搜索后查看完整列表。
                  </div>
                )}

                {!selectedTagInfo && (
                  <div className="rounded-2xl border border-zinc-200 bg-white p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                    当前标签不存在或已失效，请返回查看全部标签。
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};





