import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, ArrowUpRight } from 'lucide-react';
import { getPosts } from '@/services/posts';
import { PostMetadata } from '../types';
import { Seo } from '../components/Seo';
import { ContentStatus, LoadingStatus } from '@/components/ContentStatus';
import { SearchField } from '@/components/SearchField';
import { usePostSearch } from '@/hooks/usePostSearch';
import { formatDate } from '@/utils/date';
import { easeOut } from '@/utils/motion';
import {
  buildArchiveGroups,
  ensureYearExpanded,
  getAllExpansion,
  getInitialExpansion,
  getMonthKey,
  isAllVisibleExpanded
} from './archive/archiveState';

const formatDay = (dateText: string) => formatDate(dateText, 'zh-CN', {
  month: '2-digit',
  day: '2-digit'
}).replace('/', '.');

export const ArchivePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryFromUrl = searchParams.get('q') || '';
  const yearFromUrl = searchParams.get('year');
  const [allPosts, setAllPosts] = useState<PostMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const initializedRef = useRef(false);
  const searchStartedRef = useRef<string | null>(null);
  const autoExpandedSearchRef = useRef<string | null>(null);
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
        if (!cancelled) {
          console.error('Failed to load archive posts:', error);
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
    handleSearch(query);
    setSearchParams((previous) => {
      const nextParams = new URLSearchParams(previous);
      nextParams.delete('year');
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
      nextParams.delete('year');
      return nextParams;
    }, { replace: true });
  };

  const groups = useMemo(() => buildArchiveGroups(results), [results]);
  const totalPosts = useMemo(() => groups.reduce((sum, group) => sum + group.total, 0), [groups]);
  const allGroupsExpanded = isAllVisibleExpanded(groups, expandedYears, expandedMonths);

  useEffect(() => {
    if (queryFromUrl !== searchQuery) {
      setSearchQuery(queryFromUrl);
    }
  }, [queryFromUrl, searchQuery, setSearchQuery]);

  // 仅初始化一次，避免用户全部折叠后被默认状态反弹。
  useEffect(() => {
    if (!initializedRef.current && groups.length > 0 && !isSearching) {
      const initial = getInitialExpansion(groups, yearFromUrl);
      setExpandedYears(initial.years);
      setExpandedMonths(initial.months);
      initializedRef.current = true;
    }
  }, [groups, isSearching, yearFromUrl]);

  // URL year 变化时始终确保对应年份展开。
  useEffect(() => {
    if (!initializedRef.current || !yearFromUrl) {
      return;
    }
    setExpandedYears((previous) => ensureYearExpanded(groups, previous, yearFromUrl));
  }, [groups, yearFromUrl]);

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
    if (
      searchStartedRef.current === normalizedQuery
      && autoExpandedSearchRef.current !== normalizedQuery
    ) {
      const expansion = getAllExpansion(groups);
      setExpandedYears(expansion.years);
      setExpandedMonths(expansion.months);
      autoExpandedSearchRef.current = normalizedQuery;
    }
  }, [groups, isSearching, searchQuery]);

  // 切换年份展开状态
  const toggleYear = (year: string) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
        setSearchParams((previous) => {
          const nextParams = new URLSearchParams(previous);
          if (nextParams.get('year') === year) {
            nextParams.delete('year');
          }
          return nextParams;
        }, { replace: true });
        // 折叠年份时，同时折叠该年份下的所有月份
        setExpandedMonths(prevMonths => {
          const nextMonths = new Set(prevMonths);
          groups.find(g => g.year === year)?.months.forEach(m => {
            nextMonths.delete(getMonthKey(year, m.monthNum));
          });
          return nextMonths;
        });
      } else {
        next.add(year);
        setSearchParams((previous) => {
          const nextParams = new URLSearchParams(previous);
          nextParams.set('year', year);
          return nextParams;
        }, { replace: true });
      }
      return next;
    });
  };

  // 切换月份展开状态
  const toggleMonth = (year: string, monthNum: number) => {
    const monthKey = getMonthKey(year, monthNum);
    setExpandedMonths(prev => {
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
    setSearchParams((previous) => {
      const nextParams = new URLSearchParams(previous);
      nextParams.delete('year');
      return nextParams;
    }, { replace: true });

    if (allGroupsExpanded) {
      setExpandedYears(new Set());
      setExpandedMonths(new Set());
    } else {
      const expansion = getAllExpansion(groups);
      setExpandedYears(expansion.years);
      setExpandedMonths(expansion.months);
    }
  };

  return (
    <div className="pb-8 md:pb-14">
      <Seo title="归档" description="按年份归档 D-blog 全部历史文章，快速查看发布时间、分类与更新轨迹。" />

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
                “<span className="font-semibold text-zinc-900 dark:text-zinc-100">{searchQuery}</span>” · {totalPosts} 篇文章
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={toggleAll}
            disabled={groups.length === 0}
            aria-pressed={allGroupsExpanded}
            className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {allGroupsExpanded ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
            {allGroupsExpanded ? '全部折叠' : '全部展开'}
          </button>
        </div>

        {loading || isSearching ? (
          <div className="space-y-6" aria-busy="true">
            <LoadingStatus label={isSearching ? '正在搜索归档文章' : '正在加载归档文章'} />
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} aria-hidden="true" className="h-32 animate-pulse rounded-surface border border-zinc-200 bg-paper dark:border-zinc-800 dark:bg-zinc-900" />
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
            description={hasSearchQuery ? '尝试缩短关键词，或清除搜索条件后查看全部文章。' : '发布文章后，归档时间线会显示在这里。'}
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
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: groupIndex * 0.03, ease: easeOut }}
                  >
                    <button
                      onClick={() => toggleYear(group.year)}
                      className="group flex w-full items-center justify-between gap-4 border-b border-zinc-300 pb-3 text-left transition-colors hover:border-zinc-500 dark:border-zinc-700 dark:hover:border-zinc-500"
                      aria-expanded={isYearExpanded}
                      aria-label={`${isYearExpanded ? '折叠' : '展开'} ${group.year} 年的文章`}
                    >
                      <span className="flex items-center gap-3">
                        <motion.span
                          animate={{ rotate: isYearExpanded ? 0 : -90 }}
                          transition={{ duration: 0.21, ease: easeOut }}
                          className="text-zinc-400 transition-colors group-hover:text-zinc-700 dark:group-hover:text-zinc-300"
                        >
                          <ChevronDown size={17} />
                        </motion.span>
                        <h2 className="font-serif text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-3xl">
                          {group.year} 年
                        </h2>
                      </span>
                      <span className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">{group.total} 篇</span>
                    </button>

                    <AnimatePresence>
                      {isYearExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.21, ease: easeOut }}
                          className="overflow-hidden"
                        >
                          <div className="pt-6 md:pt-7">
                            {group.months.map((monthGroup, monthIndex) => {
                              const monthKey = `${group.year}-${monthGroup.monthNum}`;
                              const isMonthExpanded = expandedMonths.has(monthKey);

                              return (
                                <motion.div
                                  key={monthKey}
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.2, delay: monthIndex * 0.02, ease: easeOut }}
                                  className={monthIndex < group.months.length - 1 ? 'mb-7 md:mb-8' : undefined}
                                >
                                  <button
                                    onClick={() => toggleMonth(group.year, monthGroup.monthNum)}
                                    className="group mb-2 flex w-full items-center gap-2 text-left"
                                    aria-expanded={isMonthExpanded}
                                    aria-label={`${isMonthExpanded ? '折叠' : '展开'} ${monthGroup.month}的文章`}
                                  >
                                    <motion.span
                                      animate={{ rotate: isMonthExpanded ? 0 : -90 }}
                                      transition={{ duration: 0.21, ease: easeOut }}
                                      className="text-zinc-400 transition-colors group-hover:text-zinc-700 dark:group-hover:text-zinc-300"
                                    >
                                      <ChevronDown size={14} />
                                    </motion.span>
                                    <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">{monthGroup.month}</h3>
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{monthGroup.total} 篇</span>
                                  </button>

                                  <AnimatePresence>
                                    {isMonthExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.21, ease: easeOut }}
                                        className="overflow-hidden"
                                      >
                                        <div className="border-t border-zinc-200 dark:border-zinc-800">
                                          {monthGroup.posts.map((post, postIndex) => (
                                            <motion.div
                                              key={post.id}
                                              initial={{ opacity: 0, y: 4 }}
                                              animate={{ opacity: 1, y: 0 }}
                                              transition={{ duration: 0.18, delay: postIndex * 0.015, ease: easeOut }}
                                            >
                                              <Link
                                                to={`/post/${post.id}`}
                                                className="group grid gap-x-5 gap-y-1 border-b border-zinc-200 py-4 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600 md:grid-cols-[4.25rem_minmax(0,1fr)_auto] md:items-baseline md:py-4"
                                              >
                                                <time className="font-mono text-xs font-medium text-zinc-500 dark:text-zinc-400 md:pt-1">
                                                  {formatDay(post.date)}
                                                </time>
                                                <h4 className="min-w-0 font-serif text-lg font-bold leading-snug text-zinc-900 transition-colors group-hover:text-zinc-600 dark:text-zinc-100 dark:group-hover:text-zinc-300 md:text-xl">
                                                  {post.title}
                                                  <ArrowUpRight className="ml-1 inline-block -translate-y-0.5 opacity-0 transition-opacity group-hover:opacity-100" size={14} />
                                                </h4>
                                                <p className="text-xs text-zinc-500 dark:text-zinc-400 md:whitespace-nowrap">
                                                  {post.category} <span className="mx-1 text-zinc-300 dark:text-zinc-700">·</span> {post.readTime}
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

