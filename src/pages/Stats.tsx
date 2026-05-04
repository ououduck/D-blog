import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BarChart3,
  Clock3,
  Database,
  Eye,
  FileImage,
  FileText,
  FolderTree,
  HardDrive,
  Hash,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Type,
  Users
} from 'lucide-react';

import { Seo } from '../components/Seo';
import { getCloudflareSnapshot } from '../services/cloudflare';
import { getSiteStats, SiteStats } from '../services/siteStats';
import { CloudflareSnapshot } from '../types';

const EMPTY_SITE_STATS: SiteStats = {
  totalPosts: 0,
  totalWords: 0,
  totalCategories: 0,
  totalTags: 0,
  totalImages: 0
};

const formatDateTime = (dateText: string | null) => {
  if (!dateText) {
    return '--';
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(dateText));
};

const formatValue = (value: number) => new Intl.NumberFormat('zh-CN').format(value);

const formatBytes = (bytes: number) => {
  if (bytes === 0) {
    return '0 B';
  }

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, index)).toFixed(2)} ${sizes[index]}`;
};

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
    <div className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white p-5 transition-all duration-200 hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 sm:rounded-2xl sm:p-6">
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

const InfoCard = ({
  title,
  value,
  icon: Icon
}: {
  title: string;
  value: string;
  icon: React.ElementType;
}) => (
  <div className="group rounded-xl border border-zinc-200 bg-white p-3.5 transition-all duration-200 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 sm:rounded-xl sm:p-4">
    <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:text-[11px]">{title}</div>
    <div className="flex min-w-0 items-center gap-2.5">
      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 transition-transform duration-200 group-hover:scale-105 dark:bg-zinc-800 dark:text-zinc-300 sm:h-9 sm:w-9">
        <Icon size={16} className="sm:size-[18px]" />
      </div>
      <span className="break-all text-sm font-semibold leading-5 text-zinc-900 dark:text-zinc-100 sm:text-[15px]">{value}</span>
    </div>
  </div>
);

export const Stats = () => {
  const shouldReduceMotion = useReducedMotion();
  const siteStatsLoadedRef = useRef(false);
  const cloudflareLoadedRef = useRef(false);
  const requestIdRef = useRef(0);
  const [siteStats, setSiteStats] = useState<SiteStats>(EMPTY_SITE_STATS);
  const [snapshot, setSnapshot] = useState<CloudflareSnapshot>({
    enabled: false,
    fetchedAt: null,
    domain: '',
    timeWindows: []
  });
  const [siteStatsLoading, setSiteStatsLoading] = useState(true);
  const [cloudflareLoading, setCloudflareLoading] = useState(false);
  const [cloudflareRequested, setCloudflareRequested] = useState(false);
  const [selectedDays, setSelectedDays] = useState(7);

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

  const loadCloudflareData = async (forceRefresh = false) => {
    const requestId = ++requestIdRef.current;

    setCloudflareRequested(true);
    setCloudflareLoading(true);

    try {
      const cloudflareData = await getCloudflareSnapshot(forceRefresh);

      if (requestId !== requestIdRef.current) {
        return;
      }

      setSnapshot(cloudflareData);
      cloudflareLoadedRef.current = true;
    } catch (error) {
      if (requestId === requestIdRef.current) {
        console.error('Failed to load Cloudflare stats:', error);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setCloudflareLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadSiteStats();
  }, []);

  useEffect(() => {
    if (snapshot.timeWindows.length === 0) {
      return;
    }

    const hasSelectedWindow = snapshot.timeWindows.some((timeWindow) => timeWindow.days === selectedDays);

    if (!hasSelectedWindow) {
      setSelectedDays(snapshot.timeWindows[0].days);
    }
  }, [selectedDays, snapshot.timeWindows]);

  const currentTimeWindow =
    snapshot.timeWindows.find((timeWindow) => timeWindow.days === selectedDays) ??
    snapshot.timeWindows[0] ??
    null;

  const hasData = snapshot.enabled && Boolean(currentTimeWindow);

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="pb-10 md:pb-20"
    >
      <Seo title="统计" description="基于 Cloudflare Analytics 生成的站点访问统计页，仅展示当前稳定可用的核心指标。" />

      <section className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl sm:p-7 md:p-10 lg:p-12">

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:mb-4 sm:text-xs dark:text-zinc-400">Analytics Dashboard</p>
            <h1 className="max-w-2xl font-serif text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl md:text-5xl lg:text-6xl">
              站点访问统计
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400 md:mt-4 md:text-base md:leading-7">
              这里展示 Cloudflare 当前能稳定返回的聚合统计数据。页面保留最近一次成功结果，避免刷新或切换时整块闪烁。
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
            <button
              type="button"
              onClick={() => void loadCloudflareData(cloudflareLoadedRef.current)}
              disabled={cloudflareLoading}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-zinc-300 bg-zinc-100 px-4 py-3 text-sm font-semibold text-zinc-900 transition-all hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 sm:w-auto"
              title={cloudflareRequested ? '刷新 Cloudflare 统计数据' : '获取 Cloudflare 统计数据'}
            >
              <RefreshCw size={18} className={cloudflareLoading ? 'animate-spin' : ''} />
              <span className="sm:hidden">
                {cloudflareLoading ? '获取中...' : cloudflareRequested ? '刷新数据' : '获取数据'}
              </span>
              <span className="hidden sm:inline">
                {cloudflareLoading ? '获取中...' : cloudflareRequested ? '刷新 Cloudflare 数据' : '获取 Cloudflare 访问数据'}
              </span>
            </button>

            <div className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-zinc-200 bg-white px-4 py-3 text-sm font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 sm:w-auto">
              <BarChart3 size={18} className="text-zinc-700 dark:text-zinc-300" />
              <span>
                {cloudflareRequested
                  ? currentTimeWindow
                    ? `最近 ${currentTimeWindow.days} 天`
                    : '暂无 Cloudflare 数据'
                  : '按需加载'}
              </span>
            </div>
          </div>
        </div>

        <div className="relative mt-6 grid gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          <InfoCard title="数据源" value={snapshot.domain || 'pldduck.com'} icon={Database} />
          <InfoCard title="最近更新" value={cloudflareRequested ? formatDateTime(snapshot.fetchedAt) : '尚未请求'} icon={Clock3} />
          <InfoCard title="时间窗口" value={cloudflareRequested ? `${snapshot.timeWindows.length} 个可选区间` : '点击后加载'} icon={BarChart3} />
          <InfoCard title="访问状态" value={cloudflareRequested ? (snapshot.enabled ? '数据可用' : '等待配置') : '未请求'} icon={ShieldCheck} />
        </div>

        {cloudflareLoading && (
          <div className="mt-10 flex min-h-52 flex-col items-center justify-center rounded-2xl border border-zinc-200 bg-white py-14 dark:border-zinc-800 dark:bg-zinc-900">
            <Loader2 size={44} className="animate-spin text-zinc-700 dark:text-zinc-300" />
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">获取 Cloudflare 统计数据中...</p>
          </div>
        )}

        {!cloudflareLoading && cloudflareRequested && snapshot.enabled && snapshot.timeWindows.length > 0 && (
          <>
            <div className="-mx-1 mt-6 flex gap-2 overflow-x-auto px-1 pb-2 no-scrollbar sm:mt-8">
              {snapshot.timeWindows.map((timeWindow) => (
                <button
                  key={timeWindow.days}
                  type="button"
                  onClick={() => setSelectedDays(timeWindow.days)}
                  className={`flex-shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold transition-all sm:px-4 sm:py-2.5 ${
                    selectedDays === timeWindow.days
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900'
                      : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800'
                  }`}
                >
                  最近 {timeWindow.days} 天
                </button>
              ))}
            </div>

            {currentTimeWindow && (
              <>
                <div className="mt-6 grid gap-4 sm:mt-8 sm:gap-5 min-[480px]:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard icon={Eye} title="页面浏览" value={formatValue(currentTimeWindow.data.pageViews)} detail={`最近 ${currentTimeWindow.days} 天总浏览量`} />
                  <SummaryCard icon={Users} title="独立访客" value={formatValue(currentTimeWindow.data.uniques)} detail="去重后的访问人数" />
                  <SummaryCard icon={TrendingUp} title="请求总数" value={formatValue(currentTimeWindow.data.requests)} detail="所有 HTTP 请求总量" />
                  <SummaryCard icon={HardDrive} title="带宽消耗" value={formatBytes(currentTimeWindow.data.bandwidth)} detail="当前时间窗口内的总流量" />
                </div>

                {currentTimeWindow.error && (
                  <div className="mt-6 rounded-2xl border border-amber-300/50 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-700 dark:border-amber-700/50 dark:bg-amber-950/30 dark:text-amber-300">
                    {currentTimeWindow.error}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {!cloudflareLoading && cloudflareRequested && !snapshot.enabled && (
          <div className="mt-10 rounded-2xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <ShieldCheck size={44} className="mx-auto mb-4 text-zinc-400" />
            <h3 className="mb-2 font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100">未配置 Cloudflare API</h3>
            <p className="mx-auto max-w-xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
              请在环境变量中配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ZONE_ID`，然后重新构建站点以生成统计数据。
            </p>
          </div>
        )}

        {!cloudflareRequested && (
          <div className="mt-10 flex justify-center">
            <button
              type="button"
              onClick={() => void loadCloudflareData(false)}
              className="group inline-flex min-h-16 w-full max-w-xl items-center justify-center gap-3 rounded-2xl border border-zinc-300 bg-zinc-900 px-6 py-5 text-base font-bold text-white transition-all hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-white dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:ring-offset-zinc-950 sm:text-lg"
              title="获取 Cloudflare 访问数据"
            >
              <RefreshCw size={22} className="transition-transform duration-300 group-hover:rotate-90" />
              <span>获取 Cloudflare 访问数据</span>
            </button>
          </div>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl sm:p-5 md:mt-12 md:p-6 lg:mt-14">
        <div className="mb-5 flex items-center gap-2.5 md:mb-6">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            <Database size={18} />
          </div>
          <h2 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100 md:text-2xl">站点概览</h2>
        </div>

        <div className="grid gap-4 sm:gap-5 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <SummaryCard icon={FileText} title="当前文章数" value={formatValue(siteStats.totalPosts)} detail="已公开发布的文章总数" />
          <SummaryCard icon={Type} title="总字数" value={formatValue(siteStats.totalWords)} detail="按正文内容累计的总阅读字数" />
          <SummaryCard icon={FolderTree} title="总分类数" value={formatValue(siteStats.totalCategories)} detail="当前启用的文章分类数量" />
          <SummaryCard icon={Hash} title="总标签数" value={formatValue(siteStats.totalTags)} detail="去重后的标签总数量" />
          <SummaryCard icon={FileImage} title="总图片数" value={formatValue(siteStats.totalImages)} detail="正文内 Markdown 图片累计数量" />
        </div>
      </section>

      <section className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl sm:p-7 md:mt-12 md:p-10 lg:mt-14 lg:p-12">
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 sm:mb-4 sm:text-xs dark:text-zinc-400">Umami Analytics</p>
            <h1 className="max-w-2xl font-serif text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl md:text-5xl lg:text-6xl">
              Umami 访问统计
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400 md:mt-4 md:text-base md:leading-7">
              查看详细的访问统计数据，包括访客数、访问次数和浏览量。
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col lg:items-end">
            <a
              href="https://cloud.umami.is/share/lbt9NW1ZYgWpm1KO"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-zinc-300 bg-zinc-900 px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-zinc-800 dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:w-auto"
              title="查看 Umami 统计数据"
            >
              <BarChart3 size={18} />
              <span className="sm:hidden">查看统计</span>
              <span className="hidden sm:inline">查看 Umami 统计数据</span>
            </a>
          </div>
        </div>

        <div className="mt-10 flex justify-center">
          <a
            href="https://cloud.umami.is/share/lbt9NW1ZYgWpm1KO"
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex min-h-16 w-full max-w-xl items-center justify-center gap-3 rounded-2xl border border-zinc-300 bg-zinc-900 px-6 py-5 text-base font-bold text-white transition-all hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-white dark:border-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:ring-offset-zinc-950 sm:text-lg"
            title="查看 Umami 统计数据"
          >
            <BarChart3 size={22} />
            <span>查看 Umami 统计数据</span>
          </a>
        </div>
      </section>

      <section className="mt-8 space-y-5 md:mt-12 md:space-y-6 lg:mt-14">
        {!cloudflareLoading && cloudflareRequested && hasData && currentTimeWindow && (
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl sm:p-5 md:p-6">
            <div className="mb-5 flex items-center gap-2.5 md:mb-6">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                <Database size={18} />
              </div>
              <h2 className="font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100 md:text-2xl">Cloudflare 数据说明</h2>
              {cloudflareLoading && (
                <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  <Loader2 size={12} className="animate-spin" />
                  同步中
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
              <InfoCard title="统计域名" value={snapshot.domain || 'pldduck.com'} icon={Database} />
              <InfoCard title="统计窗口" value={`最近 ${currentTimeWindow.days} 天`} icon={BarChart3} />
              <InfoCard title="更新时间" value={formatDateTime(snapshot.fetchedAt)} icon={Clock3} />
              <InfoCard title="展示范围" value="仅显示 Cloudflare 当前可稳定获取的总览指标" icon={ShieldCheck} />
            </div>
          </div>
        )}

        {!cloudflareLoading && cloudflareRequested && !snapshot.enabled && (
          <div className="rounded-2xl border border-dashed border-zinc-300 bg-white px-6 py-16 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
            暂无 Cloudflare 统计数据。请配置环境变量后重新执行 `npm run build`。
          </div>
        )}
      </section>
    </motion.div>
  );
};
