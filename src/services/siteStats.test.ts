import { describe, it, expect } from 'vitest';
import { EMPTY_SITE_STATS, getInitialSiteStats, getSiteStats, type SiteStats } from './siteStats';

const isSiteStats = (value: unknown): value is SiteStats =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as SiteStats).totalPosts === 'number' &&
  typeof (value as SiteStats).totalWords === 'number';

describe('siteStats 服务', () => {
  it('getInitialSiteStats 返回构建期内联的站点统计（或 null）', () => {
    const stats = getInitialSiteStats();
    if (stats === null) {
      expect(stats).toBeNull();
    } else {
      expect(isSiteStats(stats)).toBe(true);
      expect(stats.totalPosts).toBeGreaterThanOrEqual(0);
    }
  });

  it('getSiteStats 异步返回统计或空统计兜底', async () => {
    const stats = await getSiteStats();
    expect(isSiteStats(stats)).toBe(true);
  });

  it('EMPTY_SITE_STATS 为全零空统计', () => {
    expect(EMPTY_SITE_STATS.totalPosts).toBe(0);
    expect(EMPTY_SITE_STATS.totalWords).toBe(0);
    expect(EMPTY_SITE_STATS.totalCategories).toBe(0);
    expect(EMPTY_SITE_STATS.totalTags).toBe(0);
    expect(EMPTY_SITE_STATS.totalImages).toBe(0);
    expect(EMPTY_SITE_STATS.categoryStats).toEqual([]);
  });
});
