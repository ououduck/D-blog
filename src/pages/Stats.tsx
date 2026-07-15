import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart3,
  Database,
  FileImage,
  FileText,
  FolderTree,
  Hash,
  Type,
  Activity
} from 'lucide-react';

import { Seo } from '../components/Seo';
import { ContentStatus, LoadingStatus } from '@/components/ContentStatus';
import { getSiteStats, SiteStats } from '../services/siteStats';

const EMPTY_SITE_STATS: SiteStats = {
  totalPosts: 0,
  totalWords: 0,
  totalCategories: 0,
  totalTags: 0,
  totalImages: 0,
  categoryStats: [],
  tagStats: [],
  yearlyStats: [],
  recentPosts: [],
  topWordCountPosts: [],
  topImageCountPosts: []
};

const formatValue = (value: number) => new Intl.NumberFormat('zh-CN').format(value);

const SummaryCard = ({
  icon: Icon,
  title,
  value,
  detail
}: {
  icon: React.ElementType;
  title: string;
  value: string | number;
  detail: string;
}) => (
  <div className="border-t border-zinc-200 py-5 dark:border-zinc-800 sm:py-6">
    <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 sm:h-12 sm:w-12">
      <Icon size={20} className="sm:size-[22px]" />
    </div>
    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:text-[11px]">{title}</div>
    <div className="mb-2 text-2xl font-bold leading-none text-zinc-900 dark:text-zinc-100 sm:text-3xl lg:text-4xl">{value}</div>
    <div className="text-xs leading-5 text-zinc-600 dark:text-zinc-400 sm:text-sm sm:leading-6">{detail}</div>
  </div>
);

const RankingCard = ({
  title,
  items,
  valueSuffix = '篇'
}: {
  title: string;
  items: Array<{ name: string; count: number }>;
  valueSuffix?: string;
}) => (
  <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800">
    <h3 className="mb-4 font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
    {items.length === 0 ? (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">暂无可展示的数据。</p>
    ) : (
    <div className="space-y-3">
      {items.map((item, index) => {
        const max = Math.max(...items.map((entry) => entry.count), 1);
        return (
          <div key={item.name}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">{index + 1}. {item.name}</span>
              <span className="text-xs text-zinc-500 dark:text-zinc-400">{formatValue(item.count)}{valueSuffix}</span>
            </div>
            <div className="h-1 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
              <div className="h-full bg-zinc-900 dark:bg-zinc-100" style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
    )}
  </div>
);

export const Stats = () => {
  const siteStatsLoadedRef = useRef(false);
  const [siteStats, setSiteStats] = useState<SiteStats>(EMPTY_SITE_STATS);
  const [siteStatsLoading, setSiteStatsLoading] = useState(true);
  const [siteStatsError, setSiteStatsError] = useState(false);

  const loadSiteStats = async () => {
    if (siteStatsLoadedRef.current) {
      return;
    }

    setSiteStatsLoading(true);
    setSiteStatsError(false);

    try {
      const statsData = await getSiteStats();
      setSiteStats(statsData);
      setSiteStatsError(false);
      siteStatsLoadedRef.current = true;
    } catch (error) {
      console.error('Failed to load site stats:', error);
      setSiteStatsError(true);
    } finally {
      setSiteStatsLoading(false);
    }
  };

  useEffect(() => {
    void loadSiteStats();
  }, []);

  return (
    <div className="pb-10 md:pb-20">
      <Seo title="统计" description="D-blog 站点统计概览：文章数、总字数、分类标签、图片数量等核心数据一目了然。" />

      <header className="border-b border-zinc-200 pb-8 dark:border-zinc-800 md:pb-10">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400"><Database size={15} />Site Statistics</p>
        <h1 className="font-serif text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl">站点统计</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-400 md:text-base">文章、字数、分类、标签与图片等内容数据概览。</p>
      </header>

      {siteStatsLoading ? (
        <div className="grid gap-x-6 py-10 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-busy="true">
          <LoadingStatus label="正在加载站点统计" className="col-span-full" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} aria-hidden="true" className="animate-pulse border-t border-zinc-200 py-6 dark:border-zinc-800">
              <div className="mb-5 h-10 w-10 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
              <div className="mb-3 h-3 w-20 bg-zinc-200 dark:bg-zinc-800" />
              <div className="mb-3 h-8 w-24 bg-zinc-200 dark:bg-zinc-800" />
              <div className="h-3 w-full bg-zinc-100 dark:bg-zinc-900" />
            </div>
          ))}
        </div>
      ) : siteStatsError ? (
        <ContentStatus
          variant="error"
          title="统计数据加载失败"
          description="统计数据暂时无法加载，请稍后重试。"
          actionLabel="重新加载"
          onAction={() => {
            siteStatsLoadedRef.current = false;
            void loadSiteStats();
          }}
          className="my-10"
        />
      ) : (
        <>
      <section className="mt-8 md:mt-10" aria-labelledby="site-overview-title">
        <h2 id="site-overview-title" className="mb-4 font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100">站点概览</h2>
        <div className="grid gap-x-6 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <SummaryCard icon={FileText} title="当前文章数" value={formatValue(siteStats.totalPosts)} detail="已公开发布的文章总数" />
          <SummaryCard icon={Type} title="总字数" value={formatValue(siteStats.totalWords)} detail="按正文内容累计的总阅读字数" />
          <SummaryCard icon={FolderTree} title="总分类数" value={formatValue(siteStats.totalCategories)} detail="当前启用的文章分类数量" />
          <SummaryCard icon={Hash} title="总标签数" value={formatValue(siteStats.totalTags)} detail="去重后的标签总数量" />
          <SummaryCard icon={FileImage} title="总图片数" value={formatValue(siteStats.totalImages)} detail="正文内 Markdown 图片累计数量" />
        </div>
      </section>

      <section className="mt-8 grid gap-5 md:mt-10 lg:grid-cols-2">
        <RankingCard title="分类文章数" items={siteStats.categoryStats || []} />
        <RankingCard title="热门标签 Top" items={(siteStats.tagStats || []).slice(0, 8)} />
      </section>

      <section className="mt-8 grid gap-5 md:mt-10 lg:grid-cols-3">
        <div className="border-t border-zinc-200 pt-5 dark:border-zinc-800 lg:col-span-1">
          <h3 className="mb-4 font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">最近更新</h3>
          <div className="space-y-3">
            {(siteStats.recentPosts || []).map((post) => (
              <Link key={post.id} to={`/post/${post.id}`} className="block border-b border-zinc-200 py-3 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600">
                <div className="line-clamp-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{post.title}</div>
                <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{post.updatedAt || post.date}</div>
              </Link>
            ))}
          </div>
        </div>
        <RankingCard title="字数最多" valueSuffix="字" items={(siteStats.topWordCountPosts || []).map((post) => ({ name: post.title, count: post.wordCount || 0 }))} />
        <RankingCard title="图片最多" valueSuffix="张" items={(siteStats.topImageCountPosts || []).map((post) => ({ name: post.title, count: post.imageCount || 0 }))} />
      </section>
      <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800 md:mt-12">
        <div className="mb-5 flex items-center gap-2.5 md:mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            <BarChart3 size={18} />
          </div>
          <h2 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100 md:text-2xl">访问统计</h2>
        </div>

        <p className="mb-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400 md:text-base md:leading-7">
          查看详细的访问统计数据，包括访客数、访问次数和浏览量。
        </p>

        <div className="flex justify-center">
          <a
            href="https://cloud.umami.is/share/lbt9NW1ZYgWpm1KO"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-14 w-full max-w-xl items-center justify-center gap-3 border border-zinc-900 bg-zinc-900 px-6 py-4 text-base font-bold text-white transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:ring-offset-zinc-950 sm:text-lg"
            title="查看 Umami 统计数据"
          >
            <BarChart3 size={20} />
            <span>查看 Umami 统计数据</span>
          </a>
        </div>
      </section>

      <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800 md:mt-12">
        <div className="mb-5 flex items-center gap-2.5 md:mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            <Activity size={18} />
          </div>
          <h2 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100 md:text-2xl">运行状态</h2>
        </div>

        <p className="mb-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400 md:text-base md:leading-7">
          实时监控网站的运行状态和可用性，查看历史运行时间和响应速度。
        </p>

        <div className="flex justify-center">
          <a
            href="https://stats.uptimerobot.com/NcIOI9kfVP"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-14 w-full max-w-xl items-center justify-center gap-3 border border-zinc-900 bg-zinc-900 px-6 py-4 text-base font-bold text-white transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:ring-offset-zinc-950 sm:text-lg"
            title="查看网站运行状态"
          >
            <Activity size={20} />
            <span>查看网站运行状态</span>
          </a>
        </div>
      </section>
        </>
      )}
    </div>
  );
};
