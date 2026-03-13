import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Database, ShieldCheck, Eye, Users, Globe, TrendingUp, HardDrive, MapPin } from 'lucide-react';
import { Seo } from '../components/Seo';
import { CloudflareSnapshot, CloudflareTimeWindow } from '../types';
import { getCloudflareSnapshot } from '../services/cloudflare';

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

const formatValue = (value: number) => {
  return new Intl.NumberFormat('zh-CN').format(value);
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
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
  detail: string 
}) => (
  <div className="rounded-2xl border border-white/60 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5">
    <div className="mb-3 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
      <Icon size={16} />
      <span className="text-xs font-bold uppercase tracking-[0.25em]">{title}</span>
    </div>
    <div className="text-3xl font-bold text-ink dark:text-white">{value}</div>
    <div className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{detail}</div>
  </div>
);

export const Stats = () => {
  const [snapshot, setSnapshot] = useState<CloudflareSnapshot>(EMPTY_SNAPSHOT);
  const [loading, setLoading] = useState(true);
  const [selectedDays, setSelectedDays] = useState(7);

  useEffect(() => {
    getCloudflareSnapshot().then((data) => {
      setSnapshot(data);
      setLoading(false);
    });
  }, []);

  const currentTimeWindow = snapshot.timeWindows.find(tw => tw.days === selectedDays) || snapshot.timeWindows[0] || null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 24 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0, y: -24 }} 
      className="pb-10 md:pb-20"
    >
      <Seo
        title="统计"
        description="基于 Cloudflare Analytics API 生成的站点统计面板，数据在构建期拉取，不暴露 API Token。"
      />

      <section className="relative overflow-hidden rounded-[2rem] border border-zinc-200 bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.12),_transparent_38%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(244,244,245,0.9))] p-8 md:p-12 dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(249,115,22,0.2),_transparent_40%),linear-gradient(135deg,_rgba(24,24,27,0.96),_rgba(9,9,11,0.96))]">
        <div className="absolute right-6 top-6 rounded-full border border-accent/20 bg-accent/10 p-3 text-accent">
          <BarChart3 size={22} />
        </div>
        <div className="max-w-3xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-accent">Analytics Dashboard</p>
          <h1 className="mb-6 font-serif text-4xl font-bold tracking-tight text-ink dark:text-white md:text-6xl">
            站点访问统计
          </h1>
          <p className="max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300 md:text-base">
            基于 Cloudflare Analytics 的访问数据分析，在构建时安全拉取，展示关键指标与详细数据。
          </p>
        </div>

        {!loading && snapshot.enabled && snapshot.timeWindows.length > 0 && (
          <>
            <div className="mt-8 flex flex-wrap gap-2">
              {snapshot.timeWindows.map((tw) => (
                <button
                  key={tw.days}
                  onClick={() => setSelectedDays(tw.days)}
                  className={`rounded-full px-4 py-2 text-sm font-bold transition-all ${
                    selectedDays === tw.days
                      ? 'border-2 border-accent bg-accent text-white'
                      : 'border-2 border-white/60 bg-white/70 text-zinc-600 hover:border-accent/40 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300'
                  }`}
                >
                  最近 {tw.days} 天
                </button>
              ))}
            </div>

            {currentTimeWindow && (
              <>
                <div className="mt-10 grid gap-4 md:grid-cols-4">
                  <SummaryCard
                    icon={Eye}
                    title="页面浏览"
                    value={formatValue(currentTimeWindow.data.pageViews)}
                    detail={`最近 ${selectedDays} 天的浏览量`}
                  />
                  <SummaryCard
                    icon={Users}
                    title="独立访客"
                    value={formatValue(currentTimeWindow.data.uniques)}
                    detail="唯一访客数量"
                  />
                  <SummaryCard
                    icon={TrendingUp}
                    title="请求总数"
                    value={formatValue(currentTimeWindow.data.requests)}
                    detail="HTTP 请求统计"
                  />
                  <SummaryCard
                    icon={HardDrive}
                    title="流量消耗"
                    value={formatBytes(currentTimeWindow.data.bandwidth)}
                    detail="总带宽使用量"
                  />
                </div>

                {currentTimeWindow.topPages.length > 0 && (
                  <div className="mt-6 rounded-2xl border border-white/60 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5">
                    <div className="mb-4 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                      <Globe size={16} />
                      <span className="text-xs font-bold uppercase tracking-[0.25em]">热门页面</span>
                    </div>
                    <div className="space-y-3">
                      {currentTimeWindow.topPages.slice(0, 10).map((page, index) => (
                        <div 
                          key={index} 
                          className="flex items-center justify-between rounded-xl border border-zinc-200/60 bg-white/60 px-4 py-3 dark:border-zinc-700/60 dark:bg-zinc-900/40"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium text-ink dark:text-white">
                              {page.path}
                            </div>
                          </div>
                          <div className="ml-4 flex items-center gap-4">
                            <div className="flex items-center gap-1">
                              <Eye size={14} className="text-zinc-400" />
                              <span className="text-sm font-bold text-accent">{formatValue(page.pageViews)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <TrendingUp size={14} className="text-zinc-400" />
                              <span className="text-sm text-zinc-500 dark:text-zinc-400">{formatValue(page.requests)}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentTimeWindow.topCountries.length > 0 && (
                  <div className="mt-6 rounded-2xl border border-white/60 bg-white/70 p-5 backdrop-blur dark:border-white/10 dark:bg-white/5">
                    <div className="mb-4 flex items-center gap-2 text-zinc-500 dark:text-zinc-400">
                      <MapPin size={16} />
                      <span className="text-xs font-bold uppercase tracking-[0.25em]">访客地区</span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {currentTimeWindow.topCountries.slice(0, 10).map((country, index) => (
                        <div 
                          key={index} 
                          className="flex items-center justify-between rounded-xl border border-zinc-200/60 bg-white/60 px-4 py-3 dark:border-zinc-700/60 dark:bg-zinc-900/40"
                        >
                          <div className="text-sm font-medium text-ink dark:text-white">
                            {country.country}
                          </div>
                          <div className="text-sm font-bold text-accent">
                            {formatValue(country.requests)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentTimeWindow.error && (
                  <div className="mt-6 rounded-2xl border border-amber-300/40 bg-amber-50 px-4 py-3 text-sm text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300">
                    {currentTimeWindow.error}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {!loading && !snapshot.enabled && (
          <div className="mt-10 rounded-2xl border border-white/60 bg-white/70 p-8 text-center backdrop-blur dark:border-white/10 dark:bg-white/5">
            <ShieldCheck size={48} className="mx-auto mb-4 text-zinc-400" />
            <h3 className="mb-2 font-serif text-xl font-bold text-ink dark:text-white">未配置 Cloudflare API</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              请在环境变量中配置 CLOUDFLARE_API_TOKEN 和 CLOUDFLARE_ZONE_ID 后重新构建
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
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">域名</div>
                <div className="mt-2 text-lg font-bold text-ink dark:text-white">{snapshot.domain}</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">统计窗口</div>
                <div className="mt-2 text-lg font-bold text-ink dark:text-white">{selectedDays} 天</div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.25em] text-zinc-400">更新时间</div>
                <div className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-300">
                  {formatDateTime(snapshot.fetchedAt)}
                </div>
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="h-60 animate-pulse rounded-[1.75rem] bg-zinc-100 dark:bg-zinc-900" />
        )}

        {!loading && !snapshot.enabled && (
          <div className="rounded-[1.75rem] border border-dashed border-zinc-300 bg-white/60 px-6 py-16 text-center text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-400">
            暂无 Cloudflare 统计数据。请配置环境变量后重新执行 npm run build。
          </div>
        )}
      </section>
    </motion.div>
  );
};
