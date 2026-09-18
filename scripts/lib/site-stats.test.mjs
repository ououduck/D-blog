// @vitest-environment node
/**
 * site-stats.mjs 单测：统计口径（总数/运行天数/月度趋势/年度回顾）与边界输入。
 * now 固定注入，保证断言确定（不依赖真实时钟）。
 */
import { describe, expect, it } from 'vitest';
import { buildSiteStats, TREND_MONTHS } from './site-stats.mjs';

// 固定「构建时刻」：2026-09-18 (UTC)。
const NOW = new Date('2026-09-18T12:00:00Z');

const post = (overrides) => ({
  id: 'p1',
  title: '文章',
  excerpt: '摘要',
  date: '2026-08-01',
  updatedAt: undefined,
  category: '技术',
  tags: ['a'],
  coverImage: '',
  readTime: '1分钟阅读',
  wordCount: 100,
  imageCount: 2,
  ...overrides,
});

describe('buildSiteStats', () => {
  it('计算总数与排行（含同频次 zh-CN 排序）', () => {
    const stats = buildSiteStats(
      [
        post({ id: 'a', category: '技术', tags: ['x', 'y'] }),
        post({ id: 'b', category: '技术', tags: ['x'] }),
        post({ id: 'c', category: '随笔', tags: ['y'] }),
      ],
      { now: NOW },
    );

    expect(stats.totalPosts).toBe(3);
    expect(stats.totalWords).toBe(300);
    expect(stats.totalCategories).toBe(2);
    expect(stats.totalTags).toBe(2);
    expect(stats.totalImages).toBe(6);
    // 同 count=2 时 zh-CN 名称序：技术 < 随笔
    expect(stats.categoryStats).toEqual([
      { name: '技术', count: 2 },
      { name: '随笔', count: 1 },
    ]);
    expect(stats.tagStats[0]).toEqual({ name: 'x', count: 2 });
  });

  it('firstPostDate 取最早发布日期，非法日期被忽略', () => {
    const stats = buildSiteStats(
      [post({ date: '2026-05-10' }), post({ date: '2025-12-31' }), post({ date: 'not-a-date' }), post({})],
      { now: NOW },
    );

    expect(stats.firstPostDate).toBe('2025-12-31');
  });

  it('runningDays 含首日计数：当天发布计 1 天', () => {
    const stats = buildSiteStats([post({ date: '2026-09-18' })], { now: NOW });
    expect(stats.runningDays).toBe(1);

    const stats2 = buildSiteStats([post({ date: '2026-09-11' })], { now: NOW });
    expect(stats2.runningDays).toBe(8);
  });

  it('无有效文章时 runningDays 为 0、firstPostDate 为空串', () => {
    const stats = buildSiteStats([], { now: NOW });
    expect(stats.firstPostDate).toBe('');
    expect(stats.runningDays).toBe(0);
    expect(stats.monthlyPosts).toHaveLength(TREND_MONTHS);
    expect(stats.monthlyPosts.every((point) => point.count === 0)).toBe(true);
    expect(stats.yearReview.posts).toBe(0);
    expect(stats.yearReview.firstPost).toBeNull();
    expect(stats.yearReview.latestPost).toBeNull();
  });

  it('monthlyPosts 输出固定 12 个月窗口（含当月、0 也输出）', () => {
    const stats = buildSiteStats(
      [post({ date: '2026-09-02' }), post({ date: '2026-09-20' }), post({ date: '2025-10-05' })],
      { now: NOW },
    );

    expect(stats.monthlyPosts).toHaveLength(12);
    expect(stats.monthlyPosts[0]).toEqual({ month: '2025-10', count: 1 });
    expect(stats.monthlyPosts[11]).toEqual({ month: '2026-09', count: 2 });
    // 窗口外（更早）的发布不计入
    expect(stats.monthlyPosts.slice(1, 11).every((point) => point.count === 0)).toBe(true);
  });

  it('yearReview 按构建年份过滤并给出首末篇与分类/标签', () => {
    const stats = buildSiteStats(
      [
        post({ id: 'newest', date: '2026-09-10', category: '随笔', tags: ['t2', 't2', 't1'] }),
        post({ id: 'old-2025', date: '2025-01-01' }),
        post({ id: 'first-2026', date: '2026-02-01', category: '教程', tags: ['t2'] }),
        post({ id: 'mid', date: '2026-06-01', category: '教程', tags: ['t1'] }),
      ],
      { now: NOW },
    );

    expect(stats.yearReview.year).toBe(2026);
    expect(stats.yearReview.posts).toBe(3);
    expect(stats.yearReview.words).toBe(300);
    expect(stats.yearReview.firstPost?.id).toBe('first-2026');
    expect(stats.yearReview.latestPost?.id).toBe('newest');
    expect(stats.yearReview.category).toBe('教程');
    expect(stats.yearReview.tags).toEqual(['t2', 't1']);
  });

  it('非数组输入返回零值统计（不抛错）', () => {
    const stats = buildSiteStats(undefined, { now: NOW });
    expect(stats.totalPosts).toBe(0);
    expect(stats.totalWords).toBe(0);
  });
});
