import { describe, it, expect } from 'vitest';
import { EMPTY_SITE_STATS, getInitialSiteStats, getSiteStats, type SiteStats } from './siteStats';

// 完整校验全部统计字段（此前只校验 totalPosts/totalWords 两个字段，
// 缺 categoryStats 等字段的畸形对象也能通过）。
const isSiteStats = (value: unknown): value is SiteStats =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as SiteStats).totalPosts === 'number' &&
  typeof (value as SiteStats).totalWords === 'number' &&
  typeof (value as SiteStats).totalCategories === 'number' &&
  typeof (value as SiteStats).totalTags === 'number' &&
  typeof (value as SiteStats).totalImages === 'number' &&
  Array.isArray((value as SiteStats).categoryStats);

describe('siteStats 服务', () => {
  it('getInitialSiteStats 返回构建期内联的站点统计（或 null）', () => {
    const stats = getInitialSiteStats();
    // 数据源为构建期内联（generated/site-stats.json 经 eager glob），
    // 测试环境存在该产物，断言返回有效统计而非恒真分支。
    expect(stats).not.toBeNull();
    expect(isSiteStats(stats as SiteStats)).toBe(true);
    expect((stats as SiteStats).totalPosts).toBeGreaterThanOrEqual(0);
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
