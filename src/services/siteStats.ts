import type { PostMetadata } from '@/types';

export interface StatCountItem {
  name: string;
  count: number;
}

export interface SiteStatsPostSummary extends Pick<PostMetadata, 'id' | 'title' | 'excerpt' | 'date' | 'updatedAt' | 'category' | 'tags' | 'coverImage' | 'readTime'> {
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

const EMPTY_SITE_STATS: SiteStats = {
  totalPosts: 0,
  totalWords: 0,
  totalCategories: 0,
  totalTags: 0,
  totalImages: 0,
  categoryStats: [],
  tagStats: [],
  recentPosts: [],
  topWordCountPosts: [],
  topImageCountPosts: []
};

let siteStatsCache: SiteStats | null = null;

// 构建期 SSG：site-stats.json 通过 eager glob 内联进产物，SSR 阶段即可同步渲染
// 站点统计数据，爬虫无需执行 JS 即可读取（与 posts.ts 的 posts.json 模式一致）。
const generatedStatsModules = import.meta.glob<SiteStats>('../../generated/site-stats.json', {
  eager: true,
  import: 'default'
});
const initialSiteStats = Object.values(generatedStatsModules)[0] ?? null;

/** 同步读取构建期内联的站点统计数据（SSG / 首帧渲染用）；无数据时返回 null。 */
export const getInitialSiteStats = (): SiteStats | null => initialSiteStats;

export const getSiteStats = async (): Promise<SiteStats> => {
  // 数据已由构建期 eager glob 静态内联（getInitialSiteStats），无需动态 import。
  if (siteStatsCache) {
    return siteStatsCache;
  }
  siteStatsCache = initialSiteStats ?? EMPTY_SITE_STATS;
  return siteStatsCache;
};

