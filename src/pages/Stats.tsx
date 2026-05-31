import React, { useEffect, useRef, useState } from 'react';
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
import { getSiteStats, SiteStats } from '../services/siteStats';

const EMPTY_SITE_STATS: SiteStats = {
  totalPosts: 0,
  totalWords: 0,
  totalCategories: 0,
  totalTags: 0,
  totalImages: 0
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
}) => {
  return (
    <div className="group relative overflow-hidden rounded-xl liquid-glass backdrop-blur-xl p-5 transition-all duration-200 dark:hover:border-zinc-700 sm:rounded-2xl sm:p-6">
      <div className="relative">
        <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 transition-transform duration-200 group-hover:scale-105 dark:bg-zinc-800 dark:text-zinc-300 sm:h-12 sm:w-12">
          <Icon size={20} className="sm:size-[22px]" />
        </div>
        
        <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
          {title}
        </div>
        
        <div className="mb-2 text-2xl font-bold leading-none text-zinc-900 dark:text-zinc-100 sm:text-3xl lg:text-4xl">
          {value}
        </div>
        
        <div className="text-xs leading-5 text-zinc-600 dark:text-zinc-400 sm:text-sm sm:leading-6">
          {detail}
        </div>
      </div>
    </div>
  );
};

export const Stats = () => {
  const shouldReduceMotion = useReducedMotion();
  const siteStatsLoadedRef = useRef(false);
  const [siteStats, setSiteStats] = useState<SiteStats>(EMPTY_SITE_STATS);
  const [siteStatsLoading, setSiteStatsLoading] = useState(true);

  const loadSiteStats = async () => {
    if (siteStatsLoadedRef.current) {
      return;
    }

    setSiteStatsLoading(true);

    try {
      const statsData = await getSiteStats();
      setSiteStats(statsData);
      siteStatsLoadedRef.current = true;
    } catch (error) {
      console.error('Failed to load site stats:', error);
    } finally {
      setSiteStatsLoading(false);
    }
  };

  useEffect(() => {
    void loadSiteStats();
  }, []);

  return (
    <div className="pb-10 md:pb-20">
      <Seo title="站点统计" description="D-blog 站点统计概览：文章数、总字数、分类标签、图片数量等核心数据一目了然。" />

      <section className="rounded-2xl liquid-glass backdrop-blur-xl p-4 sm:rounded-2xl sm:p-5 md:p-6 lg:p-8">
        <div className="mb-5 flex items-center gap-2.5 md:mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            <Database size={18} />
          </div>
          <h1 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100 md:text-2xl">站点概览</h1>
        </div>

        <div className="grid gap-4 sm:gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <SummaryCard icon={FileText} title="当前文章数" value={formatValue(siteStats.totalPosts)} detail="已公开发布的文章总数" />
          <SummaryCard icon={Type} title="总字数" value={formatValue(siteStats.totalWords)} detail="按正文内容累计的总阅读字数" />
          <SummaryCard icon={FolderTree} title="总分类数" value={formatValue(siteStats.totalCategories)} detail="当前启用的文章分类数量" />
          <SummaryCard icon={Hash} title="总标签数" value={formatValue(siteStats.totalTags)} detail="去重后的标签总数量" />
          <SummaryCard icon={FileImage} title="总图片数" value={formatValue(siteStats.totalImages)} detail="正文内 Markdown 图片累计数量" />
        </div>
      </section>

      <section className="mt-8 rounded-2xl liquid-glass backdrop-blur-xl p-4 sm:rounded-2xl sm:p-5 md:mt-12 md:p-6 lg:mt-14 lg:p-8">
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
            className="group inline-flex min-h-14 w-full max-w-xl items-center justify-center gap-3 rounded-2xl border border-zinc-300 bg-zinc-900 px-6 py-4 text-base font-bold text-white transition-all hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-white dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:ring-offset-zinc-950 sm:text-lg"
            title="查看 Umami 统计数据"
          >
            <BarChart3 size={20} />
            <span>查看 Umami 统计数据</span>
          </a>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl sm:p-5 md:mt-12 md:p-6 lg:mt-14 lg:p-8">
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
            className="group inline-flex min-h-14 w-full max-w-xl items-center justify-center gap-3 rounded-2xl border border-zinc-300 bg-zinc-900 px-6 py-4 text-base font-bold text-white transition-all hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-white dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:ring-offset-zinc-950 sm:text-lg"
            title="查看网站运行状态"
          >
            <Activity size={20} />
            <span>查看网站运行状态</span>
          </a>
        </div>
      </section>
    </div>
  );
};
