/**
 * 归档页：按年份/月份聚合的时间线视图，支持搜索过滤与 URL 年份定位。
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, ArrowUpRight, MessageCircle } from 'lucide-react';
import { siteConfig } from '@config/site.config';
import { getInitialPosts, getPosts } from '@/services/posts';
import type { PostMetadata } from '../types';
import { Seo, buildSiteSchemas } from '../components/Seo';
import { absoluteSiteUrl } from '@/utils/siteUrl';
import { clearSearchQueryParams, setSearchQueryParams } from '@/utils/searchParams';
import { ContentStatus, LoadingStatus } from '@/components/ContentStatus';
import { SearchField } from '@/components/SearchField';
import { usePostSearch } from '@/hooks/usePostSearch';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { formatDate } from '@/utils/date';
import { easeOut } from '@/utils/motion';
import {
  buildArchiveGroups,
  ensureYearExpanded,
  getAllExpansion,
  getInitialExpansion,
  getMonthKey,
  isAllVisibleExpanded,
} from './archive/archiveState';

const formatDay = (dateText: string) =>
  formatDate(dateText, 'zh-CN', {
    month: '2-digit',
    day: '2-digit',
  }).replace('/', '.');

// 构建期 SSG：posts.json 已通过 eager glob 内联进产物，模块加载时同步可读，
// 使 /archive 在 SSR 阶段即可渲染完整时间线（爬虫无需执行 JS 就能读到正文列表），
// 客户端水合首帧与 SSR 输出一致；异步重取仅用于“重新加载”。
const initialPosts = getInitialPosts();

export const ArchivePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFromUrl = searchParams.get('q') || '';
  const yearFromUrl = searchParams.get('year');
  const [allPosts, setAllPosts] = useState<PostMetadata[]>(initialPosts);
  const [loading, setLoading] = useState(initialPosts.length === 0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [initialExpansion] = useState(() => getInitialExpansion(buildArchiveGroups(initialPosts), null));
  const [expandedYears, setExpandedYears] = useState<Set<string>>(() => initialExpansion.years);
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => initialExpansion.months);
  // 渲染期同步的最新展开状态：toggleYear 基于它判断分支，避免连点两次
  // （第二次发生在重渲染前）都读到同一旧闭包值、净效果只切换一次。
  const expandedYearsRef = useRef(expandedYears);
  expandedYearsRef.current = expandedYears;
  const shouldReduceMotion = useReducedMotion();
  const initializedRef = useRef(false);
  const searchStartedRef = useRef<string | null>(null);
  const autoExpandedSearchRef = useRef<string | null>(null);
  // 用户最近一次通过输入框编辑的查询值：区分「URL 更新还在 startTransition
  // 延迟中」与「URL 确实来自导航」（与 Home 页同一竞态防护，见下）。
  const lastEditedQueryRef = useRef<string | null>(null);
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
        if (!cancelled) {
          console.error('归档数据加载失败:', error);
          setLoadError('归档数据加载失败，请稍后刷新重试。');
        }
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
    // 单向同步守卫：本次编辑落地前（URL 尚未提交），URL → state 回写必须被
    // 拦截，否则每次击键输入被回退一次（v7_startTransition 下 setSearchParams
    // 的提交是异步延迟的，期间 queryFromUrl 仍是旧值）。
    lastEditedQueryRef.current = query;
    handleSearch(query);
    // 搜索时删除 year：搜索结果按时间线展示，年份筛选与搜索语义冲突。
    setSearchParams((previous) => setSearchQueryParams(previous, query, ['year']), { replace: true });
  };

  const handleClearSearch = () => {
    lastEditedQueryRef.current = '';
    clearSearch();
    setSearchParams((previous) => clearSearchQueryParams(previous, ['year']), { replace: true });
  };

  const groups = useMemo(() => buildArchiveGroups(results), [results]);
  const totalPosts = useMemo(() => groups.reduce((sum, group) => sum + group.total, 0), [groups]);
  const allGroupsExpanded = isAllVisibleExpanded(groups, expandedYears, expandedMonths);

  useEffect(() => {
    // 单向同步（URL → 输入框），仅在「URL 值不是用户最近编辑产生」时生效：
    // 生产路由启用 v7_startTransition 后 setSearchParams 的提交是异步延迟的，
    // 用户击键期间 queryFromUrl 仍是旧值 —— 若此时按 queryFromUrl 回写
    // setSearchQuery，会把刚输入的内容回退掉（输入闪变/丢字），并让
    // usePostSearch 的空查询分支把结果重置回全量列表。lastEditedQueryRef 与
    // URL 一致说明本次编辑已落地（或本来就是导航带来的变化），才允许同步。
    if (lastEditedQueryRef.current !== null && lastEditedQueryRef.current !== queryFromUrl) {
      return;
    }
    if (queryFromUrl !== searchQuery) {
      setSearchQuery(queryFromUrl);
    }
  }, [queryFromUrl, searchQuery, setSearchQuery]);

  // 仅初始化一次：SSR/水合首帧由 useState 惰性初始化展开最新年份；
  // 仅当 URL 显式指定年份时，水合后再展开对应年份+首月，避免用户全部折叠后被默认状态反弹。
  useEffect(() => {
    if (!initializedRef.current && groups.length > 0 && !isSearching) {
      initializedRef.current = true;
      if (yearFromUrl) {
        const initial = getInitialExpansion(groups, yearFromUrl);
        setExpandedYears(initial.years);
        setExpandedMonths(initial.months);
      } else if (expandedYears.size === 0) {
        // 首帧 eager 数据缺失、数据异步加载完成后才首次分组：补一次默认展开
        // （最新年份首月），避免出现"全部折叠"的空白时间线。
        const initial = getInitialExpansion(groups, null);
        setExpandedYears(initial.years);
        setExpandedMonths(initial.months);
      }
    }
  }, [expandedYears.size, groups, isSearching, yearFromUrl]);

  // URL year 变化时始终确保对应年份展开；不存在的年份参数则从 URL 中移除。
  useEffect(() => {
    if (!initializedRef.current || !yearFromUrl) {
      return;
    }
    if (!groups.some((group) => group.year === yearFromUrl)) {
      setSearchParams(
        (previous) => {
          const nextParams = new URLSearchParams(previous);
          nextParams.delete('year');
          return nextParams;
        },
        { replace: true },
      );
      return;
    }
    setExpandedYears((previous) => ensureYearExpanded(groups, previous, yearFromUrl));
  }, [groups, setSearchParams, yearFromUrl]);

  // 每个已完成的搜索只自动展开一次；之后用户手动折叠不会反弹。
  useEffect(() => {
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      searchStartedRef.current = null;
      autoExpandedSearchRef.current = null;
      return;
    }
    if (isSearching) {
      searchStartedRef.current = normalizedQuery;
      return;
    }
    if (searchStartedRef.current === normalizedQuery && autoExpandedSearchRef.current !== normalizedQuery) {
      const expansion = getAllExpansion(groups);
      setExpandedYears(expansion.years);
      setExpandedMonths(expansion.months);
      autoExpandedSearchRef.current = normalizedQuery;
    }
  }, [groups, isSearching, searchQuery]);

  const toggleYear = (year: string) => {
    // 基于最新展开状态（ref 实时同步）决定分支：连点两次时第二次读到的是
    // 第一次更新后的状态，行为与旧版函数式更新一致（折叠又展开）。
    // 副作用（setSearchParams/setExpandedMonths）仍放在 updater 之外，
    // 避免在状态更新器内执行（StrictMode 下会重复执行）。
    const isExpanded = expandedYearsRef.current.has(year);
    const nextYears = new Set(expandedYearsRef.current);
    if (isExpanded) {
      nextYears.delete(year);
      setExpandedYears(nextYears);
      // 折叠年份时，同时折叠该年份下的所有月份
      setExpandedMonths((prevMonths) => {
        const nextMonths = new Set(prevMonths);
        groups
          .find((g) => g.year === year)
          ?.months.forEach((m) => {
            nextMonths.delete(getMonthKey(year, m.monthNum));
          });
        return nextMonths;
      });
      setSearchParams(
        (previous) => {
          const nextParams = new URLSearchParams(previous);
          if (nextParams.get('year') === year) {
            nextParams.delete('year');
          }
          return nextParams;
        },
        { replace: true },
      );
    } else {
      nextYears.add(year);
      setExpandedYears(nextYears);
      setSearchParams(
        (previous) => {
          const nextParams = new URLSearchParams(previous);
          nextParams.set('year', year);
          return nextParams;
        },
        { replace: true },
      );
    }
    expandedYearsRef.current = nextYears;
  };

  const toggleMonth = (year: string, monthNum: number) => {
    const monthKey = getMonthKey(year, monthNum);
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthKey)) {
        next.delete(monthKey);
      } else {
        next.add(monthKey);
      }
      return next;
    });
  };

  // 全部展开/折叠
  const toggleAll = () => {
    setSearchParams(
      (previous) => {
        const nextParams = new URLSearchParams(previous);
        nextParams.delete('year');
        return nextParams;
      },
      { replace: true },
    );

    if (allGroupsExpanded) {
      setExpandedYears(new Set());
      setExpandedMonths(new Set());
    } else {
      const expansion = getAllExpansion(groups);
      setExpandedYears(expansion.years);
      setExpandedMonths(expansion.months);
    }
  };

  // 归档页结构化数据：站点级 schema + CollectionPage + BreadcrumbList。
  // 页面级 schema 与 SSG 注入互补：SSG 静态页已标记 schemaFromSeo，不再重复注入。
  const archivePageDescription =
    'D-blog 全站文章时间线，按年份与月份归档全部技术分享、工具测评与折腾记录，快速回顾历史内容与更新轨迹，一键定位任意时期的文章。';
  const archiveStructuredData = [
    ...buildSiteSchemas(archivePageDescription),
    {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: `归档 - ${siteConfig.title}`,
      description: archivePageDescription,
      url: absoluteSiteUrl('/archive', siteConfig.url),
      inLanguage: 'zh-CN',
      isPartOf: {
        '@type': 'WebSite',
        name: siteConfig.title,
        url: absoluteSiteUrl('/', siteConfig.url),
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: absoluteSiteUrl('/', siteConfig.url) },
        { '@type': 'ListItem', position: 2, name: '归档', item: absoluteSiteUrl('/archive', siteConfig.url) },
      ],
    },
  ];

  return (
    <div className="pb-8 md:pb-14">
      <Seo title="归档" description={archivePageDescription} structuredData={archiveStructuredData} />

      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-zinc-200 pb-5 dark:border-zinc-800 md:pb-6">
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">Archive</p>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-4xl">
            归档
          </h1>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          共 {totalPosts} 篇文章 · {groups.length} 年
        </p>
      </header>

      <section className="mt-7 md:mt-9">
        <div className="mb-8 flex flex-col gap-3 border-b border-zinc-200 pb-6 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 flex-1">
            <SearchField
              value={searchQuery}
              onValueChange={handleSearchChange}
              onClear={handleClearSearch}
              placeholder="搜索归档文章..."
              aria-label="搜索归档文章"
              containerClassName="max-w-md"
            />
            {hasSearchQuery && (
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
                “<span className="font-semibold text-zinc-900 dark:text-zinc-100">{searchQuery}</span>” · {totalPosts}{' '}
                篇文章
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={toggleAll}
            disabled={groups.length === 0}
            aria-pressed={allGroupsExpanded}
            className="editorial-button inline-flex w-fit gap-1.5 px-3 py-2 text-sm font-medium disabled:opacity-40"
          >
            {allGroupsExpanded ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
            {allGroupsExpanded ? '全部折叠' : '全部展开'}
          </button>
        </div>

        {loading || isSearching ? (
          <div className="space-y-6" aria-busy="true">
            <LoadingStatus label={isSearching ? '正在搜索归档文章' : '正在加载归档文章'} />
            {Array.from({ length: 3 }).map((_, index) => (
              <div
                key={index}
                aria-hidden="true"
                className={`${shouldReduceMotion ? '' : 'animate-pulse '}h-32 rounded-surface border border-zinc-200 bg-paper dark:border-zinc-800 dark:bg-zinc-900`}
              />
            ))}
          </div>
        ) : loadError || searchError ? (
          <ContentStatus
            variant="error"
            title={loadError ? '归档加载失败' : '搜索失败'}
            description={loadError || searchError || undefined}
            actionLabel={loadError ? '重新加载' : '清除搜索'}
            onAction={loadError ? () => setLoadAttempt((attempt) => attempt + 1) : handleClearSearch}
          />
        ) : groups.length === 0 ? (
          <ContentStatus
            title={hasSearchQuery ? '未找到匹配文章' : '暂无归档文章'}
            description={
              hasSearchQuery ? '尝试缩短关键词，或清除搜索条件后查看全部文章。' : '发布文章后，归档时间线会显示在这里。'
            }
            actionLabel={hasSearchQuery ? '清除搜索' : undefined}
            onAction={hasSearchQuery ? handleClearSearch : undefined}
          />
        ) : (
          <div aria-live="polite">
            <div className="space-y-10 md:space-y-12">
              {groups.map((group, groupIndex) => {
                const isYearExpanded = expandedYears.has(group.year);

                return (
                  <motion.section
                    key={group.year}
                    initial={shouldReduceMotion ? false : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={
                      shouldReduceMotion
                        ? { duration: 0 }
                        : { duration: 0.2, delay: Math.min(groupIndex * 0.02, 0.08), ease: easeOut }
                    }
                  >
                    <button
                      onClick={() => toggleYear(group.year)}
                      className="group flex min-h-11 w-full items-center justify-between gap-4 border-b border-zinc-300 pb-3 text-left transition-colors hover:border-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:hover:border-zinc-500 dark:focus-visible:outline-zinc-100"
                      aria-expanded={isYearExpanded}
                      aria-label={`${isYearExpanded ? '折叠' : '展开'} ${group.year}的文章`}
                    >
                      <span className="flex items-center gap-3">
                        <motion.span
                          animate={{ rotate: isYearExpanded ? 0 : -90 }}
                          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: easeOut }}
                          className="text-zinc-400 transition-colors group-hover:text-zinc-700 dark:group-hover:text-zinc-300"
                        >
                          <ChevronDown size={17} />
                        </motion.span>
                        <h2 className="font-serif text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-3xl">
                          {group.year}
                        </h2>
                      </span>
                      <span className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">{group.total} 篇</span>
                    </button>

                    <AnimatePresence>
                      {isYearExpanded && (
                        <motion.div
                          initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: easeOut }}
                          className="overflow-hidden"
                        >
                          <div className="pt-6 md:pt-7">
                            {group.months.map((monthGroup, monthIndex) => {
                              const monthKey = getMonthKey(group.year, monthGroup.monthNum);
                              const isMonthExpanded = expandedMonths.has(monthKey);

                              return (
                                <motion.div
                                  key={monthKey}
                                  initial={shouldReduceMotion ? false : { opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={
                                    shouldReduceMotion
                                      ? { duration: 0 }
                                      : { duration: 0.16, delay: Math.min(monthIndex * 0.015, 0.06), ease: easeOut }
                                  }
                                  className={monthIndex < group.months.length - 1 ? 'mb-7 md:mb-8' : undefined}
                                >
                                  <button
                                    onClick={() => toggleMonth(group.year, monthGroup.monthNum)}
                                    className="group mb-2 flex min-h-11 w-full items-center gap-2 px-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100"
                                    aria-expanded={isMonthExpanded}
                                    aria-label={`${isMonthExpanded ? '折叠' : '展开'} ${monthGroup.month}的文章`}
                                  >
                                    <motion.span
                                      animate={{ rotate: isMonthExpanded ? 0 : -90 }}
                                      transition={
                                        shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: easeOut }
                                      }
                                      className="text-zinc-400 transition-colors group-hover:text-zinc-700 dark:group-hover:text-zinc-300"
                                    >
                                      <ChevronDown size={14} />
                                    </motion.span>
                                    <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">
                                      {monthGroup.month}
                                    </h3>
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                      {monthGroup.total} 篇
                                    </span>
                                  </button>

                                  <AnimatePresence>
                                    {isMonthExpanded && (
                                      <motion.div
                                        initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                                        transition={
                                          shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: easeOut }
                                        }
                                        className="overflow-hidden"
                                      >
                                        <div className="border-t border-zinc-200 dark:border-zinc-800">
                                          {monthGroup.posts.map((post, postIndex) => (
                                            <motion.div
                                              key={post.id}
                                              initial={shouldReduceMotion ? false : { opacity: 0 }}
                                              animate={{ opacity: 1 }}
                                              transition={
                                                shouldReduceMotion
                                                  ? { duration: 0 }
                                                  : {
                                                      duration: 0.14,
                                                      delay: Math.min(postIndex * 0.01, 0.05),
                                                      ease: easeOut,
                                                    }
                                              }
                                            >
                                              <Link
                                                to={`/post/${post.id}`}
                                                className="group grid min-w-0 gap-x-5 gap-y-1 border-b border-zinc-200 py-4 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600 md:grid-cols-[4.25rem_minmax(0,1fr)_auto] md:items-baseline md:py-4"
                                              >
                                                <time className="font-mono text-xs font-medium text-zinc-500 dark:text-zinc-400 md:pt-1">
                                                  {formatDay(post.date)}
                                                </time>
                                                <h4 className="min-w-0 break-words font-serif text-lg font-bold leading-snug text-zinc-900 transition-colors [overflow-wrap:anywhere] group-hover:text-zinc-600 dark:text-zinc-100 dark:group-hover:text-zinc-300 md:text-xl">
                                                  {post.title}
                                                  <ArrowUpRight
                                                    className="ml-1 inline-block -translate-y-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                                                    size={14}
                                                  />
                                                </h4>
                                                <p className="min-w-0 break-words text-xs text-zinc-500 [overflow-wrap:anywhere] dark:text-zinc-400 md:whitespace-nowrap">
                                                  {post.category}{' '}
                                                  <span className="mx-1 text-zinc-300 dark:text-zinc-700">·</span>{' '}
                                                  {post.readTime}
                                                  {typeof post.commentCount === 'number' && (
                                                    <>
                                                      <span className="mx-1 text-zinc-300 dark:text-zinc-700">·</span>
                                                      <span className="inline-flex items-center gap-1">
                                                        <MessageCircle size={11} />
                                                        {post.commentCount} 条评论
                                                      </span>
                                                    </>
                                                  )}
                                                </p>
                                              </Link>
                                            </motion.div>
                                          ))}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </motion.div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.section>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
