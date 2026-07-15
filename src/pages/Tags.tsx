import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock, Search, X } from 'lucide-react';
import { getPosts } from '@/services/posts';
import { PostMetadata } from '../types';
import { Seo } from '../components/Seo';
import { ContentStatus, LoadingStatus } from '@/components/ContentStatus';
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
  const [loadAttempt, setLoadAttempt] = useState(0);
  const selectedTag = searchParams.get('tag');
  const queryFromUrl = searchParams.get('q') || '';
  const { searchQuery, isSearching, searchError, results, handleSearch, setSearchQuery, clearSearch, hasSearchQuery } = usePostSearch({
    emptyResults: allPosts,
    initialQuery: queryFromUrl
  });

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
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
  }, [loadAttempt]);

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

      <header className="mb-10 border-b border-zinc-200 pb-8 dark:border-zinc-800 md:pb-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Tags Collection</p>
        <h1 className="font-serif text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl">标签集合</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-400 md:text-base">
          共 {allTags.length} 个标签，{allTags.reduce((sum, tag) => sum + tag.count, 0)} 篇文章
        </p>
      </header>

      {loading || isSearching ? (
        <div className="flex items-center justify-center py-20" aria-busy="true">
          <LoadingStatus label={isSearching ? '正在搜索标签和文章' : '正在加载标签'} />
          <div aria-hidden="true" className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-900 border-t-transparent dark:border-zinc-100" />
        </div>
      ) : loadError || searchError ? (
        <ContentStatus
          variant="error"
          title={loadError ? '标签加载失败' : '搜索失败'}
          description={loadError || searchError || undefined}
          actionLabel={loadError ? '重新加载' : '清除搜索'}
          onAction={loadError ? () => setLoadAttempt((attempt) => attempt + 1) : handleClearSearch}
        />
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
                className="w-full border border-zinc-300 bg-white py-3 pl-11 pr-11 text-sm text-ink outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-900 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white dark:focus:border-zinc-100"
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
              <div className="border-y border-zinc-200 py-8 dark:border-zinc-800 md:py-10">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 md:gap-6">
                  {tags.map((tag, index) => (
                    <motion.button
                      key={tag.name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2, delay: index * 0.015, ease: easeOut }}
                      onClick={() => updateTagParam(tag.name)}
                      className={`${getTagSize(tag.count)} relative border-b border-zinc-300 px-2 py-1.5 font-bold leading-tight text-zinc-700 transition-colors hover:border-zinc-900 hover:text-zinc-900 sm:px-3 sm:py-2 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100`}
                  aria-label={`查看标签 ${tag.name}，共 ${tag.count} 篇文章`}
                >
                  {tag.name}
                  <span className="ml-1.5 text-[10px] opacity-60 sm:ml-2 sm:text-xs">({tag.count})</span>
                </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="border-y border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                当前还没有可展示的标签内容。
              </div>
            )
          ) : (
            <div>
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="min-w-0 font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100 md:text-3xl">
                  标签: <span className="break-words text-accent dark:text-accent-light">{selectedTag}</span>
                  <span className="ml-3 text-base text-zinc-400">({selectedTagInfo?.count ?? 0} 篇)</span>
                </h2>
                <button
                  onClick={() => updateTagParam()}
                  className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/25 bg-accent/5 px-4 py-2 text-sm font-bold text-accent transition-colors hover:border-accent/50 hover:bg-accent/10 dark:border-accent-light/30 dark:bg-accent-light/10 dark:text-accent-light"
                >
                  <ArrowLeft size={15} />
                  返回全部标签
                </button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {filteredSelectedTagPosts.map((post, index) => (
                  <motion.div key={post.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: index * 0.02, ease: easeOut }}>
                    <Link to={`/post/${post.id}`} className="group block border-t border-zinc-200 py-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="border border-zinc-300 px-3 py-1 text-xs font-bold uppercase tracking-wider text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
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
                  <div className="border-y border-zinc-200 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    当前标签存在，但在当前搜索条件下没有匹配文章。你可以清除搜索后查看完整列表。
                  </div>
                )}

                {!selectedTagInfo && (
                  <div className="border-y border-zinc-200 py-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
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





