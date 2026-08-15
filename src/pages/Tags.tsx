import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { SearchField } from '@/components/SearchField';
import { siteConfig } from '@config/site.config';
import { getInitialPosts, getPosts } from '@/services/posts';
import { PostMetadata } from '../types';
import { Seo, buildSiteSchemas } from '../components/Seo';
import { absoluteSiteUrl } from '@/utils/siteUrl';
import { ContentStatus, LoadingStatus } from '@/components/ContentStatus';
import { usePostSearch } from '@/hooks/usePostSearch';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { getDateTimestamp } from '@/utils/date';
import { easeOut } from '@/utils/motion';

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
      posts: taggedPosts.sort((a, b) => getDateTimestamp(b.date) - getDateTimestamp(a.date)),
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));
};

// 构建期 SSG：posts.json 已通过 eager glob 内联，SSR 阶段即可同步渲染标签云，
// 客户端水合首帧一致，爬虫无需执行 JS 即可读取全部标签与文章数。
const initialPosts = getInitialPosts();

export const Tags = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [allPosts, setAllPosts] = useState<PostMetadata[]>(initialPosts);
  const [loading, setLoading] = useState(initialPosts.length === 0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const selectedTag = searchParams.get('tag');
  const queryFromUrl = searchParams.get('q') || '';
  const { searchQuery, isSearching, searchError, results, handleSearch, setSearchQuery, clearSearch, hasSearchQuery } =
    // 不把 URL 的 ?q= 作为 useState 初始值（与 Search 页一致）：SSG 预渲染的是
    // 无 q 的默认界面，首帧用空查询渲染可保证带 q 直访时客户端首帧与服务端
    // HTML 一致（水合无冲突）；下方 effect 在水合后把 queryFromUrl 同步进搜索。
    usePostSearch({
      emptyResults: allPosts,
    });

  useEffect(() => {
    let cancelled = false;

    // 首次加载数据已由 eager glob 同步提供；仅“重新加载”（loadAttempt > 0）
    // 或初始数据缺失时才有必要走异步重取。
    if (loadAttempt === 0 && initialPosts.length > 0) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

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
    setSearchParams(
      (previous) => {
        const nextParams = new URLSearchParams(previous);
        if (query.trim()) {
          nextParams.set('q', query);
        } else {
          nextParams.delete('q');
        }
        return nextParams;
      },
      { replace: true },
    );
  };

  const handleClearSearch = () => {
    clearSearch();
    setSearchParams(
      (previous) => {
        const nextParams = new URLSearchParams(previous);
        nextParams.delete('q');
        return nextParams;
      },
      { replace: true },
    );
  };

  useEffect(() => {
    if (queryFromUrl !== searchQuery) {
      setSearchQuery(queryFromUrl);
    }
  }, [queryFromUrl, searchQuery, setSearchQuery]);

  const tags = useMemo(() => buildTagList(results), [results]);
  const allTags = useMemo(() => buildTagList(allPosts), [allPosts]);
  const selectedTagInfo = selectedTag ? (allTags.find((tag) => tag.name === selectedTag) ?? null) : null;
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

  // 标签筛选页（?tag=xxx）为可索引内容页（canonical 自指保留 tag 参数），
  // 输出独立的 title/description，避免所有标签筛选页共用「标签」这一泛化标题。
  const tagsPageDescription =
    'D-blog 标签导航页，按主题标签筛选全部文章，快速定位前端开发、后端运维、AI 工具与效率软件等感兴趣内容。';
  const seoTitle =
    selectedTag && selectedTagInfo ? `标签：${selectedTag} - ${siteConfig.title}` : `标签 - ${siteConfig.title}`;
  const seoDescription =
    selectedTag && selectedTagInfo
      ? `D-blog 标签「${selectedTag}」下的全部文章，共 ${selectedTagInfo.count} 篇，涵盖前端开发、后端运维、AI 工具与效率软件测评等主题。`
      : tagsPageDescription;

  // 站点级 schema 与页面级 CollectionPage / ItemList（枚举各 /tags?tag= 筛选页 URL，
  // 帮助爬虫发现子页）/ BreadcrumbList 一并输出，SSG 静态页不再重复注入。
  const tagsStructuredData = [
    ...buildSiteSchemas(seoDescription),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `标签 - ${siteConfig.title}`,
      description: tagsPageDescription,
      url: absoluteSiteUrl('/tags', siteConfig.url),
      inLanguage: 'zh-CN',
      isPartOf: {
        '@type': 'WebSite',
        name: siteConfig.title,
        url: absoluteSiteUrl('/', siteConfig.url),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: '标签列表',
      url: absoluteSiteUrl('/tags', siteConfig.url),
      itemListElement: allTags.map((tag, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: tag.name,
        url: absoluteSiteUrl(`/tags?tag=${encodeURIComponent(tag.name)}`, siteConfig.url),
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: absoluteSiteUrl('/', siteConfig.url) },
        ...(selectedTag && selectedTagInfo
          ? [
              { '@type': 'ListItem', position: 2, name: '标签', item: absoluteSiteUrl('/tags', siteConfig.url) },
              {
                '@type': 'ListItem',
                position: 3,
                name: selectedTag,
                item: absoluteSiteUrl(`/tags?tag=${encodeURIComponent(selectedTag)}`, siteConfig.url),
              },
            ]
          : [{ '@type': 'ListItem', position: 2, name: '标签', item: absoluteSiteUrl('/tags', siteConfig.url) }]),
      ],
    },
  ];

  return (
    <div className="pb-8 md:pb-14">
      <Seo title={seoTitle} description={seoDescription} structuredData={tagsStructuredData} />

      <header className="mb-10 border-b border-zinc-200 pb-8 dark:border-zinc-800 md:pb-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          Tags Collection
        </p>
        <h1 className="font-serif text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl">
          标签集合
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-400 md:text-base">
          共 {allTags.length} 个标签，{allTags.reduce((sum, tag) => sum + tag.count, 0)} 篇文章
        </p>
      </header>

      {/* 搜索框保持在条件渲染之外：搜索进行中（防抖/评分）输入框不随结果区一起卸载，
          避免用户无法继续输入或修改关键词。 */}
      <div className="mb-8">
        <SearchField
          value={searchQuery}
          onValueChange={handleSearchChange}
          onClear={handleClearSearch}
          placeholder="搜索标签或文章..."
          containerClassName="max-w-md"
          aria-label="搜索标签或文章"
        />
        {hasSearchQuery && (
          <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
            搜索 "<span className="font-bold text-zinc-900 dark:text-zinc-100">{searchQuery}</span>" 找到 {tags.length}{' '}
            个标签
          </div>
        )}
      </div>

      {loading || isSearching ? (
        <div className="flex items-center justify-center py-20" aria-busy="true">
          <LoadingStatus label={isSearching ? '正在搜索标签和文章' : '正在加载标签'} />
          <div
            aria-hidden="true"
            className={`${shouldReduceMotion ? '' : 'animate-spin '}h-8 w-8 rounded-full border-4 border-zinc-900 border-t-transparent dark:border-zinc-100`}
          />
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
          {!selectedTag ? (
            tags.length > 0 ? (
              <div className="mt-2 border-y border-zinc-200 py-8 dark:border-zinc-800 md:py-10">
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-6">
                  {tags.map((tag, index) => (
                    <motion.button
                      key={tag.name}
                      initial={shouldReduceMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={
                        shouldReduceMotion
                          ? { duration: 0 }
                          : { duration: 0.16, delay: Math.min(index * 0.012, 0.06), ease: easeOut }
                      }
                      onClick={() => updateTagParam(tag.name)}
                      className={`${getTagSize(tag.count)} relative inline-flex min-h-11 max-w-full items-center justify-center break-words border-b border-zinc-300 px-2 py-1.5 text-center font-bold leading-tight text-zinc-700 transition-colors [overflow-wrap:anywhere] hover:border-zinc-900 hover:text-zinc-900 focus-visible:border-zinc-900 focus-visible:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 sm:px-3 sm:py-2 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-100 dark:hover:text-zinc-100 dark:focus-visible:border-zinc-100 dark:focus-visible:text-zinc-100 dark:focus-visible:outline-zinc-100`}
                      aria-label={`查看标签 ${tag.name}，共 ${tag.count} 篇文章`}
                    >
                      <span className="min-w-0 break-words [overflow-wrap:anywhere]">{tag.name}</span>
                      <span className="ml-1.5 flex-shrink-0 text-[10px] opacity-60 sm:ml-2 sm:text-xs">
                        ({tag.count})
                      </span>
                    </motion.button>
                  ))}
                </div>
              </div>
            ) : (
              <ContentStatus
                title={hasSearchQuery ? '未找到匹配标签' : '当前还没有可展示的标签内容。'}
                description={hasSearchQuery ? '尝试缩短关键词，或清除搜索条件后查看全部标签。' : undefined}
                actionLabel={hasSearchQuery ? '清除搜索' : undefined}
                onAction={hasSearchQuery ? handleClearSearch : undefined}
                className="mt-2"
              />
            )
          ) : (
            <div>
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="min-w-0 font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100 md:text-3xl">
                  标签:{' '}
                  <span className="break-words underline decoration-zinc-400 underline-offset-4 dark:decoration-zinc-600">
                    {selectedTag}
                  </span>
                  <span className="ml-3 text-base text-zinc-400">
                    ({hasSearchQuery ? filteredSelectedTagPosts.length : (selectedTagInfo?.count ?? 0)} 篇)
                  </span>
                </h2>
                <button
                  onClick={() => updateTagParam()}
                  className="editorial-button inline-flex w-full gap-2 px-4 font-bold sm:w-fit"
                >
                  <ArrowLeft size={15} />
                  返回全部标签
                </button>
              </div>

              <div className="grid gap-6 md:grid-cols-2">
                {filteredSelectedTagPosts.map((post, index) => (
                  <motion.div
                    key={post.id}
                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { duration: 0.16, delay: Math.min(index * 0.015, 0.06), ease: easeOut }
                    }
                  >
                    <Link
                      to={`/post/${post.id}`}
                      className="group block border-t border-zinc-200 py-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                    >
                      <div className="mb-3 flex items-center gap-2">
                        <span className="rounded-full border border-zinc-300 px-3 py-1 text-xs font-bold uppercase tracking-wider text-zinc-900 dark:border-zinc-700 dark:text-zinc-100">
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
