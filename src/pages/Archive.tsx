import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Archive, Calendar, FolderTree, ArrowUpRight, Search, X, ChevronDown, ChevronRight } from 'lucide-react';
import { getPosts } from '@/services/posts';
import { PostMetadata } from '../types';
import { Seo } from '../components/Seo';
import { usePostSearch } from '@/hooks/usePostSearch';
import { formatDate, getDateTimestamp } from '@/utils/date';
import { easeOut } from '@/utils/motion';

interface MonthGroup {
  month: string;
  monthNum: number;
  total: number;
  posts: PostMetadata[];
}

interface ArchiveGroup {
  year: string;
  total: number;
  categories: string[];
  months: MonthGroup[];
}

const formatMonth = (dateText: string) => formatDate(dateText, 'zh-CN', { month: 'numeric' });

const formatDay = (dateText: string) => formatDate(dateText, 'zh-CN', {
  month: '2-digit',
  day: '2-digit'
}).replace('/', '-');

const formatFullDate = (dateText: string) => formatDate(dateText, 'zh-CN', {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
});

const buildArchiveGroups = (posts: PostMetadata[]) => {
  const groups = new Map<string, ArchiveGroup>();

  posts
    .slice()
    .sort((a, b) => getDateTimestamp(b.date) - getDateTimestamp(a.date))
    .forEach((post) => {
      const year = formatDate(post.date, 'zh-CN', { year: 'numeric' });
      const monthStr = formatMonth(post.date);
      const monthNum = Number.parseInt(monthStr.replace('月', ''), 10);

      let yearGroup = groups.get(year);
      
      if (!yearGroup) {
        yearGroup = {
          year,
          total: 0,
          categories: [],
          months: []
        };
        groups.set(year, yearGroup);
      }

      // 更新年份统计
      yearGroup.total += 1;
      if (!yearGroup.categories.includes(post.category)) {
        yearGroup.categories.push(post.category);
      }

      // 查找或创建月份分组
      let monthGroup = yearGroup.months.find(m => m.monthNum === monthNum);
      if (!monthGroup) {
        monthGroup = {
          month: `${monthNum}月`,
          monthNum,
          total: 0,
          posts: []
        };
        yearGroup.months.push(monthGroup);
      }

      // 添加文章到月份分组
      monthGroup.total += 1;
      monthGroup.posts.push(post);
    });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      categories: group.categories.sort(),
      months: group.months.sort((a, b) => b.monthNum - a.monthNum)
    }))
    .sort((a, b) => Number(b.year) - Number(a.year));
};

export const ArchivePage = () => {
  const [allPosts, setAllPosts] = useState<PostMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const latestDate = allPosts[0]?.date || '';
  const { searchQuery, isSearching, results, handleSearch, clearSearch, hasSearchQuery } = usePostSearch({
    emptyResults: allPosts
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
  }, []);

  const groups = buildArchiveGroups(results);
  const totalPosts = groups.reduce((sum, group) => sum + group.total, 0);

  // 初始化展开状态：默认展开最新的年份
  useEffect(() => {
    if (groups.length > 0 && expandedYears.size === 0) {
      const latestYear = groups[0].year;
      setExpandedYears(new Set([latestYear]));
      
      // 默认展开最新年份的第一个月
      if (groups[0].months.length > 0) {
        const latestMonth = `${latestYear}-${groups[0].months[0].monthNum}`;
        setExpandedMonths(new Set([latestMonth]));
      }
    }
  }, [groups]);

  // 搜索时自动展开所有匹配项
  useEffect(() => {
    if (hasSearchQuery && groups.length > 0) {
      const allYears = new Set(groups.map(g => g.year));
      const allMonths = new Set<string>();
      groups.forEach(g => {
        g.months.forEach(m => {
          allMonths.add(`${g.year}-${m.monthNum}`);
        });
      });
      setExpandedYears(allYears);
      setExpandedMonths(allMonths);
    }
  }, [hasSearchQuery, groups]);

  // 切换年份展开状态
  const toggleYear = (year: string) => {
    setExpandedYears(prev => {
      const next = new Set(prev);
      if (next.has(year)) {
        next.delete(year);
        // 折叠年份时，同时折叠该年份下的所有月份
        setExpandedMonths(prevMonths => {
          const nextMonths = new Set(prevMonths);
          groups.find(g => g.year === year)?.months.forEach(m => {
            nextMonths.delete(`${year}-${m.monthNum}`);
          });
          return nextMonths;
        });
      } else {
        next.add(year);
      }
      return next;
    });
  };

  // 切换月份展开状态
  const toggleMonth = (year: string, monthNum: number) => {
    const monthKey = `${year}-${monthNum}`;
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
    const allExpanded = expandedYears.size === groups.length;
    if (allExpanded) {
      setExpandedYears(new Set());
      setExpandedMonths(new Set());
    } else {
      const allYears = new Set(groups.map(g => g.year));
      const allMonths = new Set<string>();
      groups.forEach(g => {
        g.months.forEach(m => {
          allMonths.add(`${g.year}-${m.monthNum}`);
        });
      });
      setExpandedYears(allYears);
      setExpandedMonths(allMonths);
    }
  };

  return (
    <div className="pb-8 md:pb-14">
      <Seo title="文章归档" description="按年份归档 D-blog 全部历史文章，快速查看发布时间、分类与更新轨迹。" />

      <section className="relative overflow-hidden rounded-2xl liquid-glass backdrop-blur-xl p-8 md:p-12">
        <div className="absolute right-6 top-6 rounded-lg border border-zinc-200 bg-zinc-100 p-3 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
          <Archive size={22} />
        </div>
        <div className="max-w-3xl">
          <p className="mb-4 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:text-xs">Archive Index</p>
          <h1 className="mb-6 font-serif text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-6xl">
            所有文章，按年份归档。
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-400 md:text-base">
            这里集中展示全部历史内容，适合按时间线回看更新节奏，也方便快速跳转到旧文章。
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl liquid-glass backdrop-blur-xl p-5">
            <div className="mb-3 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <Archive size={16} />
              <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-[11px]">文章总数</span>
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{totalPosts}</div>
          </div>
          <div className="rounded-2xl liquid-glass backdrop-blur-xl p-5">
            <div className="mb-3 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <Calendar size={16} />
              <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-[11px]">归档年份</span>
            </div>
            <div className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">{groups.length}</div>
          </div>
          <div className="rounded-2xl liquid-glass backdrop-blur-xl p-5">
            <div className="mb-3 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
              <FolderTree size={16} />
              <span className="text-[10px] font-semibold uppercase tracking-wider sm:text-[11px]">最近更新</span>
            </div>
            <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{latestDate ? formatFullDate(latestDate) : '--'}</div>
          </div>
        </div>
      </section>

      <section className="mt-10 md:mt-14">
        <div className="mb-8">
          <div className="group relative max-w-md">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Search className="text-zinc-400 transition-colors group-focus-within:text-zinc-900 dark:group-focus-within:text-zinc-100" size={18} />
            </div>
            <input
              type="text"
              placeholder="搜索归档文章..."
              value={searchQuery}
              onChange={(event) => handleSearch(event.target.value)}
              className="w-full rounded-2xl liquid-glass backdrop-blur-xl py-3 pl-11 pr-11 text-sm text-ink outline-none transition-all duration-300 placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-4 ring-zinc-900/10 dark:text-white dark:focus:border-zinc-100 dark:ring-zinc-100/10"
              aria-label="搜索归档文章"
            />
            {searchQuery && (
              <button onClick={clearSearch} className="absolute inset-y-0 right-0 flex items-center pr-4 text-zinc-400 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100" aria-label="清除搜索">
                <X size={16} />
              </button>
            )}
          </div>
          {hasSearchQuery && (
            <div className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">
              搜索 "<span className="font-bold text-zinc-900 dark:text-zinc-100">{searchQuery}</span>" 找到 {totalPosts} 篇文章
            </div>
          )}
        </div>

        {loading || isSearching ? (
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-32 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
            ))}
          </div>
        ) : loadError ? (
          <div className="rounded-2xl border border-dashed border-zinc-200 liquid-glass backdrop-blur-xl p-8 text-sm text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
            {loadError}
          </div>
        ) : (
          <div className="relative">
            <div className="absolute bottom-0 left-[7px] top-0 w-[2px] bg-gradient-to-b from-zinc-900 via-zinc-300 to-transparent dark:from-zinc-100 dark:via-zinc-700 md:left-[9px]" />

            <div className="space-y-12">
              {groups.map((group, groupIndex) => {
                const isYearExpanded = expandedYears.has(group.year);
                
                return (
                  <motion.div
                    key={group.year}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: groupIndex * 0.03, ease: easeOut }}
                  >
                    {/* 年份标题 - 可点击折叠 */}
                    <button
                      onClick={() => toggleYear(group.year)}
                      className="relative mb-6 flex w-full items-center gap-4 text-left transition-opacity hover:opacity-80"
                      aria-expanded={isYearExpanded}
                      aria-label={`${isYearExpanded ? '折叠' : '展开'} ${group.year} 年的文章`}
                    >
                      <div className="relative z-10 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 dark:bg-zinc-100 md:h-5 md:w-5">
                        <div className="h-2 w-2 rounded-full bg-white dark:bg-zinc-900 md:h-2.5 md:w-2.5" />
                      </div>
                      <div className="flex flex-1 flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2">
                          <motion.div
                            animate={{ rotate: isYearExpanded ? 0 : -90 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ChevronDown size={20} className="text-zinc-400" />
                          </motion.div>
                          <h2 className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100 md:text-3xl">
                            {group.year}
                          </h2>
                        </div>
                        <span className="rounded-full liquid-glass backdrop-blur-md px-3 py-1 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                          {group.total} 篇
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {group.categories.map((category) => (
                            <span 
                              key={`${group.year}-${category}`} 
                              className="rounded-full liquid-glass backdrop-blur-sm px-2.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300"
                            >
                              {category}
                            </span>
                          ))}
                        </div>
                      </div>
                    </button>

                    {/* 月份列表 - 带折叠动画 */}
                    <AnimatePresence>
                      {isYearExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-8 pl-8 md:pl-10">
                            {group.months.map((monthGroup, monthIndex) => {
                              const monthKey = `${group.year}-${monthGroup.monthNum}`;
                              const isMonthExpanded = expandedMonths.has(monthKey);
                              
                              return (
                                <motion.div
                                  key={monthKey}
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.2, delay: monthIndex * 0.02, ease: easeOut }}
                                >
                                  {/* 月份标题 - 可点击折叠 */}
                                  <button
                                    onClick={() => toggleMonth(group.year, monthGroup.monthNum)}
                                    className="relative mb-4 flex w-full items-center gap-3 text-left transition-opacity hover:opacity-80"
                                    aria-expanded={isMonthExpanded}
                                    aria-label={`${isMonthExpanded ? '折叠' : '展开'} ${monthGroup.month}的文章`}
                                  >
                                    <div className="absolute -left-[30px] top-1 h-2 w-2 rounded-full border-2 border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900 md:-left-[38px]" />
                                    <motion.div
                                      animate={{ rotate: isMonthExpanded ? 0 : -90 }}
                                      transition={{ duration: 0.2 }}
                                    >
                                      <ChevronDown size={16} className="text-zinc-400" />
                                    </motion.div>
                                    <h3 className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100 md:text-xl">
                                      {monthGroup.month}
                                    </h3>
                                    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                      {monthGroup.total} 篇
                                    </span>
                                  </button>

                                  {/* 文章列表 - 带折叠动画 */}
                                  <AnimatePresence>
                                    {isMonthExpanded && (
                                      <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.25 }}
                                        className="overflow-hidden"
                                      >
                                        <div className="space-y-4 pl-6">
                                          {monthGroup.posts.map((post, postIndex) => (
                                            <motion.div
                                              key={post.id}
                                              initial={{ opacity: 0, y: 4 }}
                                              animate={{ opacity: 1, y: 0 }}
                                              transition={{ duration: 0.18, delay: postIndex * 0.015, ease: easeOut }}
                                              className="relative"
                                            >
                                              <div className="absolute -left-[22px] top-3 h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />

                                              <Link 
                                                to={`/post/${post.id}`} 
                                                className="group block rounded-xl border border-zinc-200 bg-white p-4 transition-all duration-300 hover:-translate-y-1 hover:border-zinc-300 hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.04)] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] md:p-5"
                                              >
                                                <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                                                  <time className="font-mono font-semibold">{formatDay(post.date)}</time>
                                                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-bold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                                                    {post.category}
                                                  </span>
                                                  <span className="text-zinc-300 dark:text-zinc-700">•</span>
                                                  <span>{post.readTime}</span>
                                                </div>

                                                <h4 className="mb-2 font-serif text-lg font-bold text-zinc-900 transition-colors group-hover:text-zinc-700 dark:text-zinc-100 dark:group-hover:text-zinc-300 md:text-xl">
                                                  {post.title}
                                                </h4>

                                                <p className="line-clamp-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                                                  {post.excerpt}
                                                </p>

                                                <div className="mt-3 flex items-center gap-1.5 text-xs font-medium text-zinc-400 transition-colors group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
                                          <span>阅读文章</span>
                                                  <ArrowUpRight size={14} className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
                                                </div>
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
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

