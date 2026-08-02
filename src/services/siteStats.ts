import type { PostMetadata } from '@/types';

export interface StatCountItem {
  name: string;
  count: number;
}

export interface YearlyStatItem {
  year: string;
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
  yearlyStats?: YearlyStatItem[];
  recentPosts?: SiteStatsPostSummary[];
  topWordCountPosts?: SiteStatsPostSummary[];
  topImageCountPosts?: SiteStatsPostSummary[];
}

let siteStatsCache: SiteStats | null = null;

export const getSiteStats = async (): Promise<SiteStats> => {
  if (siteStatsCache) {
    return siteStatsCache;
  }

  const data = await import('../../generated/site-stats.json');
  siteStatsCache = data.default as SiteStats;
  return siteStatsCache;
};

