/**
 * 站点统计数据层：构建期 site-stats.json 经 eager glob 内联，SSR 阶段
 * 同步读取；数据缺失时以 EMPTY_SITE_STATS 兜底。
 */
import type { PostMetadata } from '@/types';

interface StatCountItem {
  name: string;
  count: number;
}

interface SiteStatsPostSummary extends Pick<
  PostMetadata,
  'id' | 'title' | 'excerpt' | 'date' | 'updatedAt' | 'category' | 'tags' | 'coverImage' | 'readTime'
> {
  wordCount?: number;
  imageCount?: number;
}

export interface SiteStats {
  totalPosts: number;
  totalWords: number;
  totalCategories: number;
  totalTags: number;
  totalImages: number;
  categoryStats?: StatCountItem[];
  tagStats?: StatCountItem[];
  recentPosts?: SiteStatsPostSummary[];
  topWordCountPosts?: SiteStatsPostSummary[];
  topImageCountPosts?: SiteStatsPostSummary[];
}

/** 空统计常量（数据缺失时的兜底值）。 */
export const EMPTY_SITE_STATS: SiteStats = {
  totalPosts: 0,
  totalWords: 0,
  totalCategories: 0,
  totalTags: 0,
  totalImages: 0,
  categoryStats: [],
  tagStats: [],
  recentPosts: [],
  topWordCountPosts: [],
  topImageCountPosts: [],
};

// 构建期 SSG：site-stats.json 通过 eager glob 内联进产物，SSR 阶段即可同步渲染
// 站点统计数据，爬虫无需执行 JS 即可读取（与 posts.ts 的 posts.json 模式一致）。
const generatedStatsModules = import.meta.glob<SiteStats>('../../generated/site-stats.json', {
  eager: true,
  import: 'default',
});
const initialSiteStats = Object.values(generatedStatsModules)[0] ?? null;

/** 同步读取构建期内联的站点统计数据（SSG / 首帧渲染用）；无数据时返回 null。 */
export const getInitialSiteStats = (): SiteStats | null => initialSiteStats;

/** 异步读取站点统计（保留 async 签名与调用方兼容），数据缺失时返回空统计。 */
export const getSiteStats = async (): Promise<SiteStats> => initialSiteStats ?? EMPTY_SITE_STATS;
