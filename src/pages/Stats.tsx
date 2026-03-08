import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Database, ShieldCheck, RefreshCcw } from 'lucide-react';
import { Seo } from '../components/Seo';
import { ClarityMetric, ClarityMetricRow, ClaritySnapshot } from '../types';
import { getClaritySnapshot } from '../services/clarity';

const EMPTY_SNAPSHOT: ClaritySnapshot = {
  enabled: false,
  fetchedAt: null,
  request: {
    numOfDays: 1,
    dimensions: []
  },
  metrics: [],
  error: null
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
  const columns = getMetricColumns(metric);
  const rows = metric.information.slice(0, 10);

  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-zinc-200 bg-white/80 shadow-xl shadow-zinc-200/20 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50 dark:shadow-none">
      <div className="border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
        <h3 className="font-serif text-2xl font-bold text-ink dark:text-white">{metric.metricName}</h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {`\u5c55\u793a ${rows.length} / ${metric.information.length} \u884c\u6570\u636e`}
        </p>
      </div>

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
        <div className="px-5 py-8 text-sm text-zinc-500 dark:text-zinc-400">{'\u8fd9\u4e2a\u6307\u6807\u6682\u65e0\u53ef\u5c55\u793a\u7684\u8bb0\u5f55'}</div>
      )}
    </div>
  );
};

export const Stats = () => {
  const [snapshot, setSnapshot] = useState<ClaritySnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getClaritySnapshot().then((data) => {
      setSnapshot(data);
      setLoading(false);
    });
  }, []);

  const totalRows = snapshot.metrics.reduce((sum, metric) => sum + metric.information.length, 0);

  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -24 }} className="pb-10 md:pb-20">
      <Seo
        title="\u7edf\u8ba1"
        description="\u57fa\u4e8e Microsoft Clarity Export API \u751f\u6210\u7684\u7ad9\u70b9\u7edf\u8ba1\u9762\u677f\uff0c\u6570\u636e\u5728\u6784\u5efa\u671f\u62c9\u53d6\uff0c\u4e0d\u66b4\u9732 API Token\u3002"
      />

      <section className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(192,57,43,0.12),_transparent_38%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(244,244,245,0.9))] p-8 md:p-12 dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(192,57,43,0.2),_transparent_40%),linear-gradient(135deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.96))]">
        <div className="absolute right-6 top-6 rounded-full border border-accent/20 bg-accent/10 p-3 text-accent">
          <BarChart3 size={22} />
        </div>
        <div className="max-w-3xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-accent">Clarity Snapshot</p>
          <h1 className="mb-6 font-serif text-4xl font-bold tracking-tight text-ink dark:text-white md:text-6xl">
            {'\u7edf\u8ba1\u9875\uff0c\u57fa\u4e8e\u5b89\u5168\u7684\u6784\u5efa\u671f\u5feb\u7167\u3002'}
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300 md:text-base">
            {'\u524d\u7aef\u4e0d\u76f4\u63a5\u8bbf\u95ee Microsoft Clarity Export API\uff0c\u800c\u662f\u5728\u6784\u5efa\u65f6\u7531\u670d\u52a1\u7aef\u73af\u5883\u62c9\u53d6\u6570\u636e\uff0c\u518d\u751f\u6210\u9759\u6001\u7edf\u8ba1\u5feb\u7167\u3002'}
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-4">
          <SummaryCard icon={Database} title={'\u6307\u6807\u6570'} value={snapshot.metrics.length} detail={'\u5f53\u524d\u5feb\u7167\u5305\u542b\u7684 metric \u603b\u6570'} />
          <SummaryCard icon={BarChart3} title={'\u6570\u636e\u884c'} value={totalRows} detail={'\u6240\u6709 metric information \u884c\u6570\u7d2f\u8ba1'} />
          <SummaryCard icon={RefreshCcw} title={'\u66f4\u65b0\u65f6\u95f4'} value={loading ? '...' : formatDateTime(snapshot.fetchedAt)} detail={'\u9759\u6001\u6784\u5efa\u65f6\u62c9\u53d6'} />
          <SummaryCard
            icon={ShieldCheck}
            title={'\u5b89\u5168\u72b6\u6001'}
            value={snapshot.enabled ? '\u5df2\u542f\u7528' : '\u672a\u914d\u7f6e'}
            detail={snapshot.enabled ? '\u4ee4\u724c\u4ec5\u5b58\u5728\u4e8e\u6784\u5efa\u73af\u5883\u53d8\u91cf' : '\u672a\u68c0\u6d4b\u5230 Clarity API Token'}
          />
        </div>
      </section>

      <section className="mt-10 space-y-8 md:mt-14">
        {!loading && (
          <div className="rounded-[1.75rem] border border-zinc-200 bg-white/80 p-6 shadow-xl shadow-zinc-200/20 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/50 dark:shadow-none md:p-8">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">{'\u7edf\u8ba1\u7a97\u53e3'}</div>
                <div className="mt-2 text-lg font-bold text-ink dark:text-white">{`${snapshot.request.numOfDays} \u5929`}</div>
              </div>
              <div className="md:col-span-2">
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">{'\u7ef4\u5ea6'}</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {snapshot.request.dimensions.length > 0 ? (
                    snapshot.request.dimensions.map((dimension) => (
                      <span key={dimension} className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
                        {dimension}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">{'\u672a\u914d\u7f6e\u7ef4\u5ea6'}</span>
                  )}
                </div>
              </div>
            </div>

            {snapshot.error && (
              <div className="mt-6 rounded-2xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300">
                {snapshot.error}
              </div>
            )}
          </div>
        )}

        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-60 animate-pulse rounded-[1.75rem] bg-zinc-100 dark:bg-zinc-900" />
          ))
        ) : snapshot.metrics.length > 0 ? (
          snapshot.metrics.map((metric, index) => (
            <motion.div key={metric.metricName} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: index * 0.05 }}>
              <MetricTable metric={metric} />
            </motion.div>
          ))
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-zinc-300 bg-white/60 px-6 py-16 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
            {'\u6682\u65e0 Clarity \u7edf\u8ba1\u6570\u636e\u3002\u8bf7\u914d\u7f6e\u73af\u5883\u53d8\u91cf\u540e\u91cd\u65b0\u6267\u884c npm run build\u3002'}
          </div>
        )}
      </section>
    </motion.div>
  );
};
