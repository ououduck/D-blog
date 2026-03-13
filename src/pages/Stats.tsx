import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Database, ShieldCheck, RefreshCcw, Eye, Users, MousePointer, TrendingUp, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { Seo } from '../components/Seo';
import { ClarityMetric, ClarityMetricRow, ClaritySnapshot, ClarityTimeWindow } from '../types';
import { getClaritySnapshot } from '../services/clarity';

const EMPTY_SNAPSHOT: ClaritySnapshot = {
  enabled: false,
  fetchedAt: null,
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

const formatValue = (value: string | number | null) => {
  if (value === null || value === undefined || value === '') {
    return '--';
  }

  if (typeof value === 'number') {
    return new Intl.NumberFormat('zh-CN').format(value);
  }

  return String(value);
};

const getMetricColumns = (metric: ClarityMetric) => {
  const keys = new Set<string>();

  metric.information.forEach((row) => {
    Object.keys(row).forEach((key) => keys.add(key));
  });

  return Array.from(keys);
};

const extractKeyMetrics = (timeWindow: ClarityTimeWindow | null) => {
  const metrics = {
    pageViews: 0,
    users: 0,
    sessions: 0,
    clicks: 0,
    topPages: [] as { page: string; views: number }[]
  };

  if (!timeWindow) return metrics;

  timeWindow.metrics.forEach((metric) => {
    const name = metric.metricName.toLowerCase();

    // Extract all numeric values from each metric
    metric.information.forEach((row) => {
      Object.entries(row).forEach(([key, value]) => {
        const keyLower = key.toLowerCase();
        const numValue = Number(value);

        if (isNaN(numValue) || numValue === 0) return;

        // Page views - look for any view-related field
        if (keyLower.includes('pageview') || keyLower.includes('page view') ||
            (keyLower.includes('page') && keyLower.includes('count'))) {
          metrics.pageViews += numValue;
        }

        // Users - look for user/visitor related fields
        if (keyLower.includes('user') || keyLower.includes('visitor')) {
          metrics.users += numValue;
        }

        // Sessions
        if (keyLower.includes('session')) {
          metrics.sessions += numValue;
        }

        // Clicks
        if (keyLower.includes('click')) {
          metrics.clicks += numValue;
        }
      });

      // Extract top pages - look for URL/Page field
      const urlField = Object.keys(row).find(k =>
        k.toLowerCase().includes('url') ||
        k.toLowerCase().includes('page') ||
        k.toLowerCase() === 'dimension'
      );

      const countField = Object.keys(row).find(k => {
        const kl = k.toLowerCase();
        return kl.includes('pageview') || kl.includes('count') || kl.includes('view');
      });

      if (urlField && countField && typeof row[urlField] === 'string') {
        const views = Number(row[countField]) || 0;
        if (views > 0) {
          metrics.topPages.push({
            page: String(row[urlField]),
            views
          });
        }
      }
    });
  });

  // Sort and limit top pages, remove duplicates
  const pageMap = new Map<string, number>();
  metrics.topPages.forEach(({ page, views }) => {
    pageMap.set(page, (pageMap.get(page) || 0) + views);
  });

  metrics.topPages = Array.from(pageMap.entries())
    .map(([page, views]) => ({ page, views }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  return metrics;
};

const SummaryCard = ({ icon: Icon, title, value, detail }: { icon: React.ElementType; title: string; value: string | number; detail: string }) => (
  <div className="rounded-2xl border border-white/60 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5">
    <div className="mb-3 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
      <Icon size={16} />
      <span className="text-xs font-bold uppercase tracking-[0.25em]">{title}</span>
    </div>
    <div className="text-3xl font-bold text-ink dark:text-white">{value}</div>
    <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{detail}</div>
  </div>
);

const MetricTable = ({ metric }: { metric: ClarityMetric }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const columns = getMetricColumns(metric);
  const rows = metric.information.slice(0, 10);

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white/80 shadow-xl shadow-zinc-200/20 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50 dark:shadow-none">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full border-b border-zinc-100 px-5 py-4 text-left transition-colors hover:bg-zinc-50/50 dark:border-zinc-800 dark:hover:bg-zinc-800/30"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-serif text-2xl font-bold text-ink dark:text-white">{metric.metricName}</h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {`${metric.information.length} 行原始数据`}
            </p>
          </div>
          {isExpanded ? <ChevronUp size={20} className="text-zinc-400" /> : <ChevronDown size={20} className="text-zinc-400" />}
        </div>
      </button>

      {isExpanded && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
        >
          {rows.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                <thead className="bg-zinc-50/80 dark:bg-zinc-950/50">
                  <tr>
                    {columns.map((column) => (
                      <th key={column} className="whitespace-nowrap px-5 py-3 text-left text-xs font-bold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {rows.map((row, index) => (
                    <tr key={`${metric.metricName}-${index}`} className="align-top">
                      {columns.map((column) => (
                        <td key={`${metric.metricName}-${index}-${column}`} className="px-5 py-4 text-zinc-600 dark:text-zinc-300">
                          {formatValue((row as ClarityMetricRow)[column])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-8 text-sm text-zinc-500 dark:text-zinc-400">这个指标暂无可展示的记录</div>
          )}
        </motion.div>
      )}
    </div>
  );
};

export const Stats = () => {
  const [snapshot, setSnapshot] = useState<ClaritySnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState(7);

  useEffect(() => {
    getClaritySnapshot().then((data) => {
      setSnapshot(data);
      setLoading(false);
    });
  }, []);

  const currentTimeWindow = snapshot.timeWindows.find(tw => tw.numOfDays === selectedDays) || snapshot.timeWindows[0] || null;
  const totalRows = currentTimeWindow?.metrics.reduce((sum, metric) => sum + metric.information.length, 0) || 0;
  const keyMetrics = extractKeyMetrics(currentTimeWindow);

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} className="pb-10 md:pb-20">
      <Seo
        title="统计"
        description="基于 Microsoft Clarity Export API 生成的站点统计面板，数据在构建期拉取，不暴露 API Token。"
      />

      <section className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(192,57,43,0.12),_transparent_38%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(244,244,245,0.9))] p-8 md:p-12 dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(192,57,43,0.2),_transparent_40%),linear-gradient(135deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.96))]">
        <div className="absolute right-6 top-6 rounded-full border border-accent/20 bg-accent/10 p-3 text-accent">
          <BarChart3 size={22} />
        </div>
        <div className="max-w-3xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-accent">Analytics Dashboard</p>
          <h1 className="mb-6 font-serif text-4xl font-bold tracking-tight text-ink dark:text-white md:text-6xl">
            站点访问统计
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300 md:text-base">
            基于 Microsoft Clarity 的访问数据分析，在构建时安全拉取，展示关键指标与详细数据。
          </p>
        </div>

        {!loading && snapshot.enabled && snapshot.timeWindows.length > 0 && (
          <>
            <div className="mt-8 flex flex-wrap gap-2">
              {snapshot.timeWindows.map((tw) => (
                <button
                  key={tw.numOfDays}
                  onClick={() => setSelectedDays(tw.numOfDays)}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
                    selectedDays === tw.numOfDays
                      ? 'border-2 border-accent bg-accent text-white'
                      : 'border-2 border-white/60 bg-white/70 text-zinc-600 hover:border-accent/40 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300'
                  }`}
                >
                  最近 {tw.numOfDays} 天
                </button>
              ))}
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-4">
              <SummaryCard
                icon={Eye}
                title="页面浏览"
                value={keyMetrics.pageViews > 0 ? formatValue(keyMetrics.pageViews) : '--'}
                detail={`最近 ${selectedDays} 天的浏览量`}
              />
              <SummaryCard
                icon={Users}
                title="访问用户"
                value={keyMetrics.users > 0 ? formatValue(keyMetrics.users) : '--'}
                detail="独立访客数量"
              />
              <SummaryCard
                icon={TrendingUp}
                title="会话数"
                value={keyMetrics.sessions > 0 ? formatValue(keyMetrics.sessions) : '--'}
                detail="用户访问会话总数"
              />
              <SummaryCard
                icon={MousePointer}
                title="点击次数"
                value={keyMetrics.clicks > 0 ? formatValue(keyMetrics.clicks) : '--'}
                detail="用户交互点击统计"
              />
            </div>

            {keyMetrics.topPages.length > 0 && (
              <div className="mt-6 rounded-2xl border border-white/60 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5">
                <div className="mb-4 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                  <Globe size={16} />
                  <span className="text-xs font-bold uppercase tracking-[0.25em]">热门页面</span>
                </div>
                <div className="space-y-3">
                  {keyMetrics.topPages.map((page, index) => (
                    <div key={index} className="flex items-center justify-between rounded-xl border border-zinc-200/60 bg-white/60 px-4 py-3 dark:border-zinc-700/60 dark:bg-zinc-900/40">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-ink dark:text-white">{page.page}</div>
                      </div>
                      <div className="ml-4 flex items-center gap-2">
                        <Eye size={14} className="text-zinc-400" />
                        <span className="text-sm font-bold text-accent">{formatValue(page.views)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!loading && !snapshot.enabled && (
          <div className="mt-10 rounded-2xl border border-white/60 bg-white/70 p-8 text-center backdrop-blur dark:border-white/10 dark:bg-white/5">
            <ShieldCheck size={48} className="mx-auto mb-4 text-zinc-400" />
            <h3 className="mb-2 font-serif text-xl font-bold text-ink dark:text-white">未配置 Clarity API</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              请在环境变量中配置 CLARITY_API_TOKEN 后重新构建
            </p>
          </div>
        )}
      </section>

      <section className="mt-10 space-y-8 md:mt-14">
        {!loading && snapshot.enabled && currentTimeWindow && (
          <div className="rounded-[1.75rem] border border-zinc-200 bg-white/80 p-6 shadow-xl shadow-zinc-200/20 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50 dark:shadow-none md:p-8">
            <div className="mb-4 flex items-center gap-2">
              <Database size={18} className="text-accent" />
              <h2 className="font-serif text-xl font-bold text-ink dark:text-white">数据源信息</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">统计窗口</div>
                <div className="mt-2 text-lg font-bold text-ink dark:text-white">{selectedDays} 天</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">更新时间</div>
                <div className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">{formatDateTime(snapshot.fetchedAt)}</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">原始指标</div>
                <div className="mt-2 text-lg font-bold text-ink dark:text-white">{currentTimeWindow.metrics.length} 个</div>
              </div>
            </div>

            {currentTimeWindow.error && (
              <div className="mt-6 rounded-2xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300">
                {currentTimeWindow.error}
              </div>
            )}
          </div>
        )}

        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-60 animate-pulse rounded-[1.75rem] bg-zinc-100 dark:bg-zinc-900" />
          ))
        ) : currentTimeWindow && currentTimeWindow.metrics.length > 0 ? (
          <>
            <div className="rounded-[1.75rem] border border-zinc-200 bg-white/80 p-6 shadow-xl shadow-zinc-200/20 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50 dark:shadow-none md:p-8">
              <div className="mb-2 flex items-center gap-2">
                <BarChart3 size={18} className="text-accent" />
                <h2 className="font-serif text-xl font-bold text-ink dark:text-white">原始数据详情</h2>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                点击展开查看各项指标的详细数据表格
              </p>
            </div>
            {currentTimeWindow.metrics.map((metric, index) => (
              <motion.div key={metric.metricName} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.05 }}>
                <MetricTable metric={metric} />
              </motion.div>
            ))}
          </>
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-zinc-300 bg-white/60 px-6 py-16 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
            暂无 Clarity 统计数据。请配置环境变量后重新执行 npm run build。
          </div>
        )}
      </section>
    </motion.div>
  );
};
