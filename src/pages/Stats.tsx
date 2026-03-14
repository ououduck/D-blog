import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Database,
  Eye,
  Globe2,
  HardDrive,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  Users
} from 'lucide-react';
import { Seo } from '../components/Seo';
import { getCloudflareSnapshot } from '../services/cloudflare';
import { CloudflareCountryItem, CloudflareSnapshot, CloudflareTopItem } from '../types';

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
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
};

const formatPath = (path: string) => {
  if (!path || path === 'unknown') {
    return '/';
  }

  return path;
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
  <div className="rounded-[1.5rem] border border-white/70 bg-white/80 p-4 shadow-lg shadow-zinc-200/20 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:shadow-none sm:p-5">
    <div className="mb-3 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
      <Icon size={16} />
      <span className="text-[11px] font-bold uppercase tracking-[0.24em]">{title}</span>
    </div>
    <div className="text-2xl font-bold leading-none text-ink dark:text-white sm:text-3xl">{value}</div>
    <div className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{detail}</div>
  </div>
);

const RankedList = <T extends CloudflareTopItem | CloudflareCountryItem>({
  title,
  eyebrow,
  emptyText,
  items,
  valueLabel,
  renderName
}: {
  title: string;
  eyebrow: string;
  emptyText: string;
  items: T[];
  valueLabel: (item: T) => string;
  renderName: (item: T) => string;
}) => (
  <div className="rounded-[1.75rem] border border-zinc-200 bg-white/85 p-5 shadow-xl shadow-zinc-200/20 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50 dark:shadow-none md:p-6">
    <div className="mb-5 flex items-center justify-between gap-4">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-accent">{eyebrow}</p>
        <h2 className="mt-2 font-serif text-xl font-bold text-ink dark:text-white">{title}</h2>
      </div>
      <div className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
        Top {items.length}
      </div>
    </div>

    {items.length === 0 ? (
      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/80 px-4 py-8 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
        {emptyText}
      </div>
    ) : (
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={`${renderName(item)}-${index}`}
            className="flex items-start gap-3 rounded-2xl border border-zinc-200/80 bg-zinc-50/80 px-3 py-3 dark:border-zinc-800 dark:bg-zinc-950/50"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white dark:bg-white dark:text-ink">
              {index + 1}
            </div>
            <div className="min-w-0 flex-1">
              <div className="break-all text-sm font-semibold leading-6 text-ink dark:text-white">{renderName(item)}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.2em] text-zinc-400">{valueLabel(item)}</div>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export const Stats = () => {
  const [snapshot, setSnapshot] = useState<CloudflareSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDays, setSelectedDays] = useState(7);

  const loadData = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const data = await getCloudflareSnapshot(forceRefresh);
      setSnapshot(data);
    } catch (error) {
      console.error('Failed to load Cloudflare data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const currentTimeWindow =
    snapshot.timeWindows.find((timeWindow) => timeWindow.days === selectedDays) ??
    snapshot.timeWindows[0] ??
    null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      className="pb-10 md:pb-20"
    >
      <Seo title="统计" description="基于 Cloudflare Analytics API 生成的站点访问统计页，支持实时刷新与多时间窗口查看。" />

      <section className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(192,57,43,0.16),_transparent_36%),linear-gradient(135deg,_rgba(255,255,255,0.98),_rgba(244,244,245,0.92))] p-5 dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(192,57,43,0.26),_transparent_38%),linear-gradient(135deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.98))] sm:p-7 md:p-10 lg:p-12">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent opacity-70" />
        <div className="pointer-events-none absolute -right-16 bottom-0 h-44 w-44 rounded-full bg-accent/10 blur-3xl dark:bg-accent/20" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.35em] text-accent sm:text-xs">Analytics Dashboard</p>
            <h1 className="max-w-2xl font-serif text-3xl font-bold tracking-tight text-ink dark:text-white sm:text-4xl md:text-5xl lg:text-6xl">
              站点访问统计
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300 md:text-base">
              基于 Cloudflare Analytics 的访问数据看板，适合在手机和桌面端快速查看流量、访客与带宽变化。
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <button
              onClick={() => void loadData(true)}
              disabled={refreshing}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-accent/25 bg-accent/10 px-4 py-3 text-sm font-semibold text-accent transition-all hover:bg-accent/15 disabled:cursor-not-allowed disabled:opacity-50"
              title="刷新数据"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
              <span>{refreshing ? '刷新中...' : '刷新统计'}</span>
            </button>
            <div className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-zinc-200/80 bg-white/80 px-4 py-3 text-sm font-semibold text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
              <BarChart3 size={18} className="text-accent" />
              <span>{currentTimeWindow ? `最近 ${selectedDays} 天` : '等待数据'}</span>
            </div>
          </div>
        </div>

        <div className="relative mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1.4rem] border border-white/70 bg-white/75 px-4 py-4 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">数据源</div>
            <div className="mt-2 break-all text-sm font-semibold text-ink dark:text-white">{snapshot.domain || 'Cloudflare Analytics'}</div>
          </div>
          <div className="rounded-[1.4rem] border border-white/70 bg-white/75 px-4 py-4 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">最近更新</div>
            <div className="mt-2 text-sm font-semibold text-ink dark:text-white">{formatDateTime(snapshot.fetchedAt)}</div>
          </div>
          <div className="rounded-[1.4rem] border border-white/70 bg-white/75 px-4 py-4 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">时间窗口</div>
            <div className="mt-2 text-sm font-semibold text-ink dark:text-white">{snapshot.timeWindows.length || 0} 个可选区间</div>
          </div>
          <div className="rounded-[1.4rem] border border-white/70 bg-white/75 px-4 py-4 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">访问状态</div>
            <div className="mt-2 text-sm font-semibold text-ink dark:text-white">{snapshot.enabled ? '数据可用' : '等待配置'}</div>
          </div>
        </div>

        {loading && (
          <div className="mt-10 flex flex-col items-center justify-center rounded-[1.75rem] border border-white/60 bg-white/75 py-14 backdrop-blur dark:border-white/10 dark:bg-white/5">
            <Loader2 size={44} className="animate-spin text-accent" />
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">加载统计数据中...</p>
          </div>
        )}

        {!loading && snapshot.enabled && snapshot.timeWindows.length > 0 && (
          <>
            <div className="-mx-1 mt-8 flex gap-2 overflow-x-auto px-1 pb-2 no-scrollbar">
              {snapshot.timeWindows.map((timeWindow) => (
                <button
                  key={timeWindow.days}
                  onClick={() => setSelectedDays(timeWindow.days)}
                  className={`flex-shrink-0 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all ${
                    selectedDays === timeWindow.days
                      ? 'border-accent bg-accent text-white shadow-lg shadow-accent/15'
                      : 'border-white/70 bg-white/75 text-zinc-600 hover:border-accent/35 hover:text-accent dark:border-white/10 dark:bg-white/5 dark:text-zinc-300 dark:hover:border-accent/40'
                  }`}
                >
                  最近 {timeWindow.days} 天
                </button>
              ))}
            </div>

            {currentTimeWindow && (
              <>
                <div className="mt-8 grid gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
                  <SummaryCard icon={Eye} title="页面浏览" value={formatValue(currentTimeWindow.data.pageViews)} detail={`最近 ${selectedDays} 天总浏览量`} />
                  <SummaryCard icon={Users} title="独立访客" value={formatValue(currentTimeWindow.data.uniques)} detail="去重后的访问人数" />
                  <SummaryCard icon={TrendingUp} title="请求总数" value={formatValue(currentTimeWindow.data.requests)} detail="所有 HTTP 请求总量" />
                  <SummaryCard icon={HardDrive} title="带宽消耗" value={formatBytes(currentTimeWindow.data.bandwidth)} detail="本时间窗口内总流量" />
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

        {!loading && !snapshot.enabled && (
          <div className="mt-10 rounded-[1.75rem] border border-white/60 bg-white/75 p-8 text-center backdrop-blur dark:border-white/10 dark:bg-white/5">
            <ShieldCheck size={44} className="mx-auto mb-4 text-zinc-400" />
            <h3 className="mb-2 font-serif text-xl font-bold text-ink dark:text-white">未配置 Cloudflare API</h3>
            <p className="mx-auto max-w-xl text-sm leading-7 text-zinc-500 dark:text-zinc-400">
              请在环境变量中配置 `CLOUDFLARE_API_TOKEN` 与 `CLOUDFLARE_ZONE_ID`，然后重新构建站点以生成统计数据。
            </p>
          </div>
        )}
      </section>

      <section className="mt-10 space-y-6 md:mt-14 md:space-y-8">
        {loading && (
          <div className="flex flex-col items-center justify-center rounded-[1.75rem] border border-zinc-200 bg-white/80 py-20 shadow-xl shadow-zinc-200/20 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50 dark:shadow-none">
            <Loader2 size={44} className="animate-spin text-accent" />
            <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">加载数据详情中...</p>
          </div>
        )}

        {!loading && snapshot.enabled && currentTimeWindow && (
          <>
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
              <RankedList
                title="热门页面"
                eyebrow="Top Pages"
                emptyText="当前时间窗口暂无热门页面数据。"
                items={currentTimeWindow.topPages}
                valueLabel={(item) => `${formatValue(item.pageViews)} 次浏览 / ${formatValue(item.requests)} 次请求`}
                renderName={(item) => formatPath(item.path)}
              />
              <RankedList
                title="访客来源国家"
                eyebrow="Top Countries"
                emptyText="当前时间窗口暂无国家分布数据。"
                items={currentTimeWindow.topCountries}
                valueLabel={(item) => `${formatValue(item.requests)} 次请求`}
                renderName={(item) => item.country}
              />
            </div>

            <div className="rounded-[1.75rem] border border-zinc-200 bg-white/85 p-5 shadow-xl shadow-zinc-200/20 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50 dark:shadow-none md:p-6">
              <div className="mb-5 flex items-center gap-2">
                <Database size={18} className="text-accent" />
                <h2 className="font-serif text-xl font-bold text-ink dark:text-white">数据源信息</h2>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">站点域名</div>
                  <div className="mt-2 break-all text-sm font-semibold leading-6 text-ink dark:text-white">{snapshot.domain || '--'}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">统计窗口</div>
                  <div className="mt-2 text-sm font-semibold leading-6 text-ink dark:text-white">最近 {selectedDays} 天</div>
                </div>
                <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">更新时刻</div>
                  <div className="mt-2 text-sm font-semibold leading-6 text-ink dark:text-white">{formatDateTime(snapshot.fetchedAt)}</div>
                </div>
                <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-950/50">
                  <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400">数据覆盖</div>
                  <div className="mt-2 flex items-center gap-2 text-sm font-semibold leading-6 text-ink dark:text-white">
                    <Globe2 size={16} className="text-accent" />
                    <span>{currentTimeWindow.topCountries.length} 个国家 / {currentTimeWindow.topPages.length} 个页面</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {!loading && !snapshot.enabled && (
          <div className="rounded-[1.75rem] border border-dashed border-zinc-300 bg-white/60 px-6 py-16 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
            暂无 Cloudflare 统计数据。请配置环境变量后重新执行 `npm run build`。
          </div>
        )}
      </section>
    </motion.div>
  );
};
