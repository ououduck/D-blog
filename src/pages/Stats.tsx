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
import { Surface } from '@/components/ui/Surface';
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
  <Surface className="flex min-h-52 flex-col p-5 sm:min-h-56 sm:p-6">
    <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-icon bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 sm:h-12 sm:w-12">
      <Icon size={20} className="sm:size-[22px]" />
    </div>
    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:text-[11px]">{title}</div>
    <div className="mb-2 text-2xl font-bold leading-none text-zinc-900 dark:text-zinc-100 sm:text-3xl lg:text-4xl">{value}</div>
    <div className="mt-auto text-xs leading-5 text-zinc-600 dark:text-zinc-400 sm:text-sm sm:leading-6">{detail}</div>
  </Surface>
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
  <Surface className="p-5 sm:p-6">
    <h3 className="mb-5 font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
    {items.length === 0 ? (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">暂无可展示的数据。</p>
    ) : (
      <div className="space-y-4">
        {items.map((item, index) => {
          const max = Math.max(...items.map((entry) => entry.count), 1);
          return (
            <div key={item.name}>
              <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
                <span className="min-w-0 truncate font-medium text-zinc-700 dark:text-zinc-300">{index + 1}. {item.name}</span>
                <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">{formatValue(item.count)}{valueSuffix}</span>
              </div>
              <div className="h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100" style={{ width: `${Math.max(8, (item.count / max) * 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    )}
  </Surface>
);

const ExternalStatsCard = ({
  icon: Icon,
  title,
  description,
  href,
  buttonLabel
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
}) => (
  <Surface className="flex h-full flex-col p-5 sm:p-6">
    <div className="mb-5 flex items-center gap-2.5">
      <div className="flex h-10 w-10 items-center justify-center rounded-icon bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        <Icon size={18} />
      </div>
      <h2 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
    </div>
    <p className="mb-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400 md:text-base md:leading-7">{description}</p>
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-surface border border-zinc-900 bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:ring-offset-zinc-950"
      title={buttonLabel}
    >
      <Icon size={18} />
      <span>{buttonLabel}</span>
    </a>
  </Surface>
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
        <div className="grid gap-4 py-8 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 md:py-10" aria-busy="true">
          <LoadingStatus label="正在加载站点统计" className="col-span-full" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Surface key={index} aria-hidden="true" className="min-h-52 animate-pulse p-5 sm:min-h-56 sm:p-6">
              <div className="mb-5 h-10 w-10 rounded-icon bg-zinc-200 dark:bg-zinc-800" />
              <div className="mb-3 h-3 w-20 bg-zinc-200 dark:bg-zinc-800" />
              <div className="mb-3 h-8 w-24 bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-auto h-3 w-full bg-zinc-100 dark:bg-zinc-800" />
            </Surface>
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
            <div className="grid gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <SummaryCard icon={FileText} title="当前文章数" value={formatValue(siteStats.totalPosts)} detail="已公开发布的文章总数" />
              <SummaryCard icon={Type} title="总字数" value={formatValue(siteStats.totalWords)} detail="按正文内容累计的总阅读字数" />
              <SummaryCard icon={FolderTree} title="总分类数" value={formatValue(siteStats.totalCategories)} detail="当前启用的文章分类数量" />
              <SummaryCard icon={Hash} title="总标签数" value={formatValue(siteStats.totalTags)} detail="去重后的标签总数量" />
              <SummaryCard icon={FileImage} title="总图片数" value={formatValue(siteStats.totalImages)} detail="正文内 Markdown 图片累计数量" />
            </div>
          </section>

          <section className="mt-6 grid gap-4 md:mt-8 lg:grid-cols-2">
            <RankingCard title="分类文章数" items={siteStats.categoryStats || []} />
            <RankingCard title="热门标签 Top" items={(siteStats.tagStats || []).slice(0, 8)} />
          </section>

          <section className="mt-6 grid gap-4 md:mt-8 lg:grid-cols-3">
            <Surface className="p-5 sm:p-6">
              <h3 className="mb-4 font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">最近更新</h3>
              {(siteStats.recentPosts || []).length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">暂无可展示的数据。</p>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {(siteStats.recentPosts || []).map((post) => (
                    <Link key={post.id} to={`/post/${post.id}`} className="block py-3 first:pt-0 last:pb-0 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      <div className="line-clamp-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">{post.title}</div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{post.updatedAt || post.date}</div>
                    </Link>
                  ))}
                </div>
              )}
            </Surface>
            <RankingCard title="字数最多" valueSuffix="字" items={(siteStats.topWordCountPosts || []).map((post) => ({ name: post.title, count: post.wordCount || 0 }))} />
            <RankingCard title="图片最多" valueSuffix="张" items={(siteStats.topImageCountPosts || []).map((post) => ({ name: post.title, count: post.imageCount || 0 }))} />
          </section>

          <section className="mt-6 grid gap-4 md:mt-8 lg:grid-cols-2">
            <ExternalStatsCard
              icon={BarChart3}
              title="访问统计"
              description="查看详细的访问统计数据，包括访客数、访问次数和浏览量。"
              href="https://cloud.umami.is/share/lbt9NW1ZYgWpm1KO"
              buttonLabel="查看 Umami 统计数据"
            />
            <ExternalStatsCard
              icon={Activity}
              title="运行状态"
              description="实时监控网站的运行状态和可用性，查看历史运行时间和响应速度。"
              href="https://stats.uptimerobot.com/NcIOI9kfVP"
              buttonLabel="查看网站运行状态"
            />
          </section>
        </>
      )}
    </div>
  );
};
