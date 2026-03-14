import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import {
  BarChart3,
  Clock3,
  Database,
  Eye,
  HardDrive,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users
} from 'lucide-react';

import { Seo } from '../components/Seo';
import { getCloudflareSnapshot } from '../services/cloudflare';
import { CloudflareSnapshot } from '../types';

const EMPTY_SNAPSHOT: CloudflareSnapshot = {
  enabled: false,
  fetchedAt: null,
  domain: '',
  timeWindows: []
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
}) => (
  <div className="rounded-[1.4rem] border border-zinc-200/80 bg-white/92 p-4 shadow-[0_18px_48px_-28px_rgba(24,24,27,0.22)] dark:border-zinc-800/90 dark:bg-zinc-950/72 dark:shadow-none sm:p-5">
    <div className="mb-3 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
      <Icon size={16} />
      <span className="text-[11px] font-bold uppercase tracking-[0.24em]">{title}</span>
    </div>
    <div className="text-2xl font-bold leading-none text-ink dark:text-white sm:text-3xl">{value}</div>
    <div className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{detail}</div>
  </div>
);

const InfoCard = ({
  title,
  value,
  icon: Icon
}: {
  title: string;
  value: string;
  icon: React.ElementType;
}) => (
  <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/92 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
    <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">{title}</div>
    <div className="mt-2 flex items-start gap-2 text-sm font-semibold leading-6 text-ink dark:text-white">
      <Icon size={16} className="mt-1 flex-shrink-0 text-accent" />
      <span className="break-all">{value}</span>
    </div>
  </div>
);

export const Stats = () => {
  const shouldReduceMotion = useReducedMotion();
  const hasLoadedRef = useRef(false);
  const requestIdRef = useRef(0);
  const [snapshot, setSnapshot] = useState<CloudflareSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDays, setSelectedDays] = useState(7);

  const loadData = async (forceRefresh = false) => {
    const requestId = ++requestIdRef.current;

    if (forceRefresh) {
      setRefreshing(true);
    } else if (!hasLoadedRef.current) {
      setLoading(true);
    }

    try {
      const data = await getCloudflareSnapshot(forceRefresh);

      if (requestId !== requestIdRef.current) {
        return;
      }

      setSnapshot(data);
      hasLoadedRef.current = true;
    } catch (error) {
      if (requestId === requestIdRef.current) {
        console.error('Failed to load Cloudflare data:', error);
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  useEffect(() => {
    if (hasLoadedRef.current) {
      return;
    }

    void loadData();
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
  const isInitialLoading = loading && !hasLoadedRef.current;

  return (
    <motion.div
      initial={shouldReduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="pb-10 md:pb-20"
    >
      <Seo title="统计" description="基于 Cloudflare Analytics 生成的站点访问统计页，仅展示当前稳定可用的核心指标。" />

      <section className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(192,57,43,0.12),_transparent_34%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(244,244,245,0.96))] p-5 dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(192,57,43,0.18),_transparent_36%),linear-gradient(135deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.98))] sm:p-7 md:p-10 lg:p-12">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent opacity-70" />
        <div className="pointer-events-none absolute -right-10 top-10 h-32 w-32 rounded-full bg-accent/8 blur-2xl dark:bg-accent/14" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.35em] text-accent sm:text-xs">Analytics Dashboard</p>
            <h1 className="max-w-2xl font-serif text-3xl font-bold tracking-tight text-ink dark:text-white sm:text-4xl md:text-5xl lg:text-6xl">
              站点访问统计
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300 md:text-base">
              这里展示 Cloudflare 当前能稳定返回的聚合统计数据。页面保留最近一次成功结果，避免刷新或切换时整块闪烁。
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <button
              type="button"
              onClick={() => void loadData(true)}
              disabled={refreshing}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition-all hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
              title="刷新统计数据"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? '刷新中...' : '刷新统计'}</span>
            </button>

            <div className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-zinc-200/80 bg-white/92 px-4 py-3 text-sm font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-300">
              <BarChart3 size={18} className="text-accent" />
              <span>{currentTimeWindow ? `最近 ${currentTimeWindow.days} 天` : '等待数据'}</span>
            </div>
          </div>
        </div>

        <div className="relative mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.4rem] border border-zinc-200/80 bg-white/92 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/72">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">数据源</div>
            <div className="mt-2 break-all text-sm font-semibold text-ink dark:text-white">{snapshot.domain || 'pldduck.com'}</div>
          </div>
          <div className="rounded-[1.4rem] border border-zinc-200/80 bg-white/92 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/72">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">最近更新</div>
            <div className="mt-2 text-sm font-semibold text-ink dark:text-white">{formatDateTime(snapshot.fetchedAt)}</div>
          </div>
          <div className="rounded-[1.4rem] border border-zinc-200/80 bg-white/92 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/72">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">时间窗口</div>
            <div className="mt-2 text-sm font-semibold text-ink dark:text-white">{snapshot.timeWindows.length} 个可选区间</div>
          </div>
          <div className="rounded-[1.4rem] border border-zinc-200/80 bg-white/92 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/72">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">访问状态</div>
            <div className="mt-2 text-sm font-semibold text-ink dark:text-white">{snapshot.enabled ? '数据可用' : '等待配置'}</div>
          </div>
        </div>

        {isInitialLoading && (
          <div className="mt-10 flex min-h-52 flex-col items-center justify-center rounded-[1.75rem] border border-zinc-200/70 bg-white/92 py-14 dark:border-zinc-800 dark:bg-zinc-950/72">
            <Loader2 size={44} className="animate-spin text-accent" />
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">加载统计数据中...</p>
          </div>
        )}

        {!isInitialLoading && snapshot.enabled && snapshot.timeWindows.length > 0 && (
          <>
            <div className="-mx-1 mt-8 flex gap-2 overflow-x-auto px-1 pb-2 no-scrollbar">
              {snapshot.timeWindows.map((timeWindow) => (
                <button
                  key={timeWindow.days}
                  type="button"
                  onClick={() => setSelectedDays(timeWindow.days)}
                  className={`flex-shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all ${
                    selectedDays === timeWindow.days
                      ? 'border-accent bg-accent text-white shadow-lg shadow-accent/15'
                      : 'border-zinc-200/80 bg-white/92 text-zinc-600 hover:border-accent/35 hover:text-accent dark:border-zinc-800 dark:bg-zinc-950/72 dark:text-zinc-300 dark:hover:border-accent/40'
                  }`}
                >
                  最近 {timeWindow.days} 天
                </button>
              ))}
            </div>

            {currentTimeWindow && (
              <>
                <div className="mt-8 grid gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
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

        {!isInitialLoading && !snapshot.enabled && (
          <div className="mt-10 rounded-[1.75rem] border border-zinc-200/70 bg-white/92 p-8 text-center dark:border-zinc-800 dark:bg-zinc-950/72">
            <ShieldCheck size={44} className="mx-auto mb-4 text-zinc-400" />
            <h3 className="mb-2 font-serif text-xl font-bold text-ink dark:text-white">未配置 Cloudflare API</h3>
            <p className="mx-auto max-w-xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
              请在环境变量中配置 `CLOUDFLARE_API_TOKEN` 和 `CLOUDFLARE_ZONE_ID`，然后重新构建站点以生成统计数据。
            </p>
          </div>
        )}
      </section>

      <section className="mt-10 space-y-6 md:mt-14">
        {!isInitialLoading && hasData && currentTimeWindow && (
          <div className="rounded-[1.75rem] border border-zinc-200 bg-white/92 p-5 shadow-[0_20px_52px_-30px_rgba(24,24,27,0.22)] dark:border-zinc-800 dark:bg-zinc-950/72 dark:shadow-none md:p-6">
            <div className="mb-5 flex items-center gap-2">
              <Database size={18} className="text-accent" />
              <h2 className="font-serif text-xl font-bold text-ink dark:text-white">数据说明</h2>
              {refreshing && (
                <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                  <Loader2 size={12} className="animate-spin" />
                  同步中
                </span>
              )}
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <InfoCard title="统计域名" value={snapshot.domain || 'pldduck.com'} icon={Database} />
              <InfoCard title="统计窗口" value={`最近 ${currentTimeWindow.days} 天`} icon={BarChart3} />
              <InfoCard title="更新时间" value={formatDateTime(snapshot.fetchedAt)} icon={Clock3} />
              <InfoCard title="展示范围" value="仅显示 Cloudflare 当前可稳定获取的总览指标" icon={ShieldCheck} />
            </div>
          </div>
        )}

        {!isInitialLoading && !snapshot.enabled && (
          <div className="rounded-[1.75rem] border border-dashed border-zinc-300 bg-white/72 px-6 py-16 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
            暂无 Cloudflare 统计数据。请配置环境变量后重新执行 `npm run build`。
          </div>
        )}
      </section>
    </motion.div>
  );
};
