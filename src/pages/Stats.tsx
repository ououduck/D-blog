/**
 * 统计页：站点内容数据面板（文章/字数/分类/标签等）。
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Activity,
  BarChart3,
  Clock,
  Database,
  FileImage,
  FileText,
  FolderTree,
  Hash,
  Image,
  Layers,
  PenLine,
  Tags,
  Type,
} from 'lucide-react';

import { Seo } from '../components/Seo';
import { LoadingStatus } from '@/components/ContentStatus';
import { Surface } from '@/components/ui/Surface';
import { CountUp } from '@/components/effects/CountUp';
import { mergeClassName } from '@/utils/classNames';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { easeOut } from '@/utils/motion';
import { getSiteStats, getInitialSiteStats, EMPTY_SITE_STATS } from '../services/siteStats';
import type { SiteStats } from '../services/siteStats';

// 构建期 SSG：site-stats.json 已通过 eager glob 内联，SSR 阶段即可同步渲染全部统计卡片，
// 客户端水合首帧与 SSR 输出一致；异步加载仅作为初始数据缺失时的兜底。
const initialSiteStats = getInitialSiteStats();

// 非有限数值（NaN/Infinity，如生成数据异常）显示占位符，避免页面出现 "NaN"。
const NUMBER_FORMATTER = new Intl.NumberFormat('zh-CN');
const formatValue = (value: number) => (Number.isFinite(value) ? NUMBER_FORMATTER.format(value) : '—');

const SummaryCard = ({
  icon: Icon,
  title,
  value,
  detail,
  className,
}: {
  icon: React.ElementType;
  title: string;
  value: number;
  detail: string;
  className?: string;
}) => (
  <Surface className={mergeClassName('flex min-w-0 min-h-52 flex-col p-5 sm:min-h-56 sm:p-6', className)}>
    <div className="mb-5 inline-flex h-11 w-11 items-center justify-center rounded-icon bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 sm:h-12 sm:w-12">
      <Icon size={20} className="sm:size-[22px]" />
    </div>
    <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 sm:text-[11px]">
      {title}
    </div>
    {/* react-bits「CountUp」启发：进入视口后数字滚动到目标值；SSR 首帧直接
        渲染最终值，减弱动效偏好下静态显示。 */}
    <CountUp
      to={value}
      separator=","
      className="mb-2 text-2xl font-bold leading-none tabular-nums text-zinc-900 dark:text-zinc-100 sm:text-3xl lg:text-4xl"
    />
    <div className="mt-auto text-xs leading-5 text-zinc-600 dark:text-zinc-400 sm:text-sm sm:leading-6">{detail}</div>
  </Surface>
);

// 卡片标题栏：图标 chip + 标题，与页面眉标/外部统计卡同一套视觉语言。
const CardTitle = ({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) => (
  <div className="mb-5 flex items-center gap-2.5">
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-icon bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      <Icon size={18} />
    </div>
    <h3 className="min-w-0 truncate text-lg font-bold text-zinc-900 dark:text-zinc-100">{children}</h3>
  </div>
);

const RankingCard = ({
  title,
  icon,
  items,
  valueSuffix = '篇',
}: {
  title: string;
  icon?: React.ElementType;
  items: Array<{ name: string; count: number }>;
  valueSuffix?: string;
}) => {
  // 用 reduce 而非 Math.max(...spread)：数千条分类/标签条目展开会触发
  // RangeError: Maximum call stack size exceeded（边界健壮性，防大站点崩溃）。
  const max = items.reduce((current, item) => Math.max(current, Number.isFinite(item.count) ? item.count : 0), 1);
  const shouldReduceMotion = useReducedMotion();

  return (
    <Surface className="min-w-0 p-5 sm:p-6">
      {icon ? (
        <CardTitle icon={icon}>{title}</CardTitle>
      ) : (
        <h3 className="mb-5 text-lg font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">暂无可展示的数据。</p>
      ) : (
        <div className="space-y-4">
          {items.map((item, index) => (
            <div key={item.name}>
              <div className="mb-1.5 flex items-center justify-between gap-4 text-sm">
                <span className="min-w-0 truncate font-medium text-zinc-700 dark:text-zinc-300">
                  {index + 1}. {item.name}
                </span>
                <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  {formatValue(item.count)}
                  {valueSuffix}
                </span>
              </div>
              {/* react-bits「FadeContent」启发：进入视口后进度条从 0 生长到目标宽度 */}
              <div className="h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800" aria-hidden="true">
                <motion.div
                  className="h-full rounded-full bg-zinc-900 dark:bg-zinc-100"
                  initial={shouldReduceMotion ? false : { width: 0 }}
                  whileInView={{
                    width: `${Math.max(8, ((Number.isFinite(item.count) ? item.count : 0) / max) * 100)}%`,
                  }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ duration: 0.65, ease: easeOut }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Surface>
  );
};

const ExternalStatsCard = ({
  icon: Icon,
  title,
  description,
  href,
  buttonLabel,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
}) => (
  <Surface className="flex h-full min-w-0 flex-col p-5 sm:p-6">
    <div className="mb-5 flex items-center gap-2.5">
      <div className="flex h-10 w-10 items-center justify-center rounded-icon bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        <Icon size={18} />
      </div>
      <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h2>
    </div>
    <p className="mb-6 text-sm leading-6 text-zinc-600 dark:text-zinc-400 md:text-base md:leading-7">{description}</p>
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-auto inline-flex min-h-12 w-full min-w-0 items-center justify-center gap-2 rounded-surface border border-zinc-900 bg-zinc-900 px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 dark:ring-offset-zinc-950"
      title={buttonLabel}
    >
      <Icon size={18} />
      <span className="min-w-0 break-words">{buttonLabel}</span>
    </a>
  </Surface>
);

// D-Umami 访问分析：统计页底部「外部统计」板块卡片之一（与运行状态等宽平分），
// 按钮跳转 D-Umami 共享看板（公开 URL，无需登录）。
const UMAMI_SHARE_URL = 'https://umami.pldduck.com/share/zWEt3cddtxLtAA0r';

export const Stats = () => {
  const siteStatsLoadedRef = useRef(false);
  const isMountedRef = useRef(true);
  const [siteStats, setSiteStats] = useState<SiteStats>(initialSiteStats ?? EMPTY_SITE_STATS);
  const [siteStatsLoading, setSiteStatsLoading] = useState(initialSiteStats === null);

  // 异步加载站点统计：useCallback 稳定引用，配合 effect 空依赖一次性加载；
  // isMountedRef 防护卸载后的迟到 setState（getSiteStats 内部已有 requestId 竞态保护）。
  const loadSiteStats = useCallback(async () => {
    if (siteStatsLoadedRef.current || !isMountedRef.current) {
      return;
    }

    setSiteStatsLoading(true);

    try {
      const statsData = await getSiteStats();
      if (!isMountedRef.current) return;
      setSiteStats(statsData);
      siteStatsLoadedRef.current = true;
    } catch (error) {
      // 防御性兜底：getSiteStats 目前不会 reject（缺失时返回 EMPTY_SITE_STATS），
      // 但异步加载一旦出现异常不应产生未处理的 promise rejection，
      // 页面保持初始空统计（全 0）即可，不再阻断渲染。
      console.warn('站点统计加载失败:', error);
    } finally {
      if (isMountedRef.current) setSiteStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    // 首次数据已由 eager glob 同步提供，跳过异步重取（避免水合后多余加载态闪烁）；
    // 仅在初始数据缺失时走异步加载。
    if (initialSiteStats) {
      siteStatsLoadedRef.current = true;
      setSiteStatsLoading(false);
      return () => {
        isMountedRef.current = false;
      };
    }
    void loadSiteStats();
    return () => {
      isMountedRef.current = false;
    };
  }, [loadSiteStats]);

  return (
    <div className="pb-10 md:pb-20">
      <Seo
        title="统计"
        description="D-blog 站点数据统计面板，展示文章总数、累计字数、分类与标签分布、图片与代码规模等核心内容数据。"
      />

      <header className="border-b border-zinc-200 pb-8 dark:border-zinc-800 md:pb-10">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          <Database size={15} />
          Site Statistics
        </p>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl">站点统计</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-400 md:text-base">
          文章、字数、分类、标签与图片等内容数据概览。
        </p>
      </header>

      {siteStatsLoading ? (
        <div
          className="grid min-w-0 gap-4 py-8 min-[400px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 md:py-10"
          aria-busy="true"
        >
          <LoadingStatus label="正在加载站点统计" className="col-span-full" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Surface key={index} aria-hidden="true" className="min-w-0 min-h-52 animate-pulse p-5 sm:min-h-56 sm:p-6">
              <div className="mb-5 h-10 w-10 rounded-icon bg-zinc-200 dark:bg-zinc-800" />
              <div className="mb-3 h-3 w-20 bg-zinc-200 dark:bg-zinc-800" />
              <div className="mb-3 h-8 w-24 bg-zinc-200 dark:bg-zinc-800" />
              <div className="mt-auto h-3 w-full bg-zinc-100 dark:bg-zinc-800" />
            </Surface>
          ))}
        </div>
      ) : (
        <>
          {/* 站点概览 / 排行面板：静态分区，不做入场动画 */}
          <section className="mt-8 md:mt-10" aria-labelledby="site-overview-title">
            <h2 id="site-overview-title" className="mb-4 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              站点概览
            </h2>
            <div className="grid min-w-0 gap-3 min-[400px]:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
              <SummaryCard
                icon={FileText}
                title="当前文章数"
                value={siteStats.totalPosts}
                detail="已公开发布的文章总数"
              />
              <SummaryCard
                icon={Type}
                title="总字数"
                value={siteStats.totalWords}
                detail="按正文内容累计的总阅读字数"
              />
              <SummaryCard
                icon={FolderTree}
                title="总分类数"
                value={siteStats.totalCategories}
                detail="当前启用的文章分类数量"
              />
              <SummaryCard icon={Hash} title="总标签数" value={siteStats.totalTags} detail="去重后的标签总数量" />
              {/* 两列断点（400–1023px）下最后一卡跨整行，避免孤悬第三行左侧 */}
              <SummaryCard
                icon={FileImage}
                title="总图片数"
                value={siteStats.totalImages}
                detail="正文内 Markdown 图片累计数量"
                className="min-[400px]:col-span-2 lg:col-span-1"
              />
            </div>
          </section>

          <section className="mt-6 grid min-w-0 gap-4 md:mt-8 lg:grid-cols-3">
            <RankingCard icon={Layers} title="分类文章数" items={siteStats.categoryStats || []} />
            <RankingCard icon={Tags} title="热门标签 Top" items={(siteStats.tagStats || []).slice(0, 8)} />
            <Surface className="min-w-0 p-5 sm:p-6">
              <CardTitle icon={Clock}>最近更新</CardTitle>
              {(siteStats.recentPosts || []).length === 0 ? (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">暂无可展示的数据。</p>
              ) : (
                <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {(siteStats.recentPosts || []).map((post) => (
                    <Link
                      key={post.id}
                      to={`/post/${post.id}`}
                      className="block py-3 first:pt-0 last:pb-0 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    >
                      <div className="line-clamp-1 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {post.title}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{post.updatedAt || post.date}</div>
                    </Link>
                  ))}
                </div>
              )}
            </Surface>
          </section>

          <section className="mt-6 grid min-w-0 gap-4 md:mt-8 lg:grid-cols-2">
            <RankingCard
              icon={PenLine}
              title="字数最多"
              valueSuffix="字"
              items={(siteStats.topWordCountPosts || []).map((post) => ({
                name: post.title,
                count: post.wordCount || 0,
              }))}
            />
            <RankingCard
              icon={Image}
              title="图片最多"
              valueSuffix="张"
              items={(siteStats.topImageCountPosts || []).map((post) => ({
                name: post.title,
                count: post.imageCount || 0,
              }))}
            />
          </section>

          <section className="mt-6 grid min-w-0 gap-4 md:mt-8 lg:grid-cols-2">
            <ExternalStatsCard
              icon={BarChart3}
              title="D-Umami 访问分析"
              description="由 D-Umami 自托管统计提供的站点访问数据，实时查看访客来源、热门页面与访问趋势。"
              href={UMAMI_SHARE_URL}
              buttonLabel="跳转D-Umami查看"
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
