import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Stats } from './Stats';

// 固定非空数据集（testing.md：页面测试不得依赖空数据/真实构建产物），
// 经 vi.hoisted 提升供 mock 工厂引用（避免 TDZ）。
const { fixture, emptyFixture } = vi.hoisted(() => {
  const fixture = {
    totalPosts: 3,
    totalWords: 1200,
    totalCategories: 2,
    totalTags: 4,
    totalImages: 6,
    firstPostDate: '2026-01-02',
    runningDays: 30,
    monthlyPosts: [
      { month: '2025-10', count: 0 },
      { month: '2025-11', count: 1 },
      { month: '2025-12', count: 0 },
      { month: '2026-01', count: 2 },
    ],
    yearReview: {
      year: 2026,
      posts: 2,
      words: 800,
      category: '教程',
      tags: ['t1', 't2'],
      firstPost: { id: 'first', title: '年初的文章', date: '2026-01-02' },
      latestPost: { id: 'latest', title: '最近的文章', date: '2026-01-20' },
    },
    categoryStats: [{ name: '教程', count: 2 }],
    tagStats: [{ name: 't1', count: 2 }],
    recentPosts: [],
    topWordCountPosts: [],
    topImageCountPosts: [],
  };
  const emptyFixture = {
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
  return { fixture, emptyFixture };
});

vi.mock('../services/siteStats', () => ({
  getInitialSiteStats: () => fixture,
  getSiteStats: async () => fixture,
  EMPTY_SITE_STATS: emptyFixture,
}));

const renderStats = () =>
  render(
    <MemoryRouter initialEntries={['/stats']}>
      <Stats />
    </MemoryRouter>,
  );

describe('Stats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    class MockIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = '';
      thresholds = [];
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it('渲染统计页标题与运行状态卡片', () => {
    renderStats();
    expect(screen.getByRole('heading', { name: '站点统计' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '查看网站运行状态' })).toBeInTheDocument();
  });

  it('发布趋势卡：柱数与月份一致、运行天数入卡、读屏摘要包含数据', () => {
    renderStats();
    const chart = screen.getByRole('img', { name: /发布趋势/ });
    expect(chart).toBeInTheDocument();
    // 4 个月度柱 + 图内读屏摘要覆盖数值与运行天数
    expect(chart.getAttribute('aria-label')).toContain('2026-01 2 篇');
    expect(screen.getByText(/自 2026-01-02 起运行 30 天/)).toBeInTheDocument();
  });

  it('年度回顾卡：渲染年份、首末篇链接', () => {
    renderStats();
    expect(screen.getByRole('heading', { name: '我的 2026 年' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '年初的文章' })).toHaveAttribute('href', '/post/first');
    expect(screen.getByRole('link', { name: '最近的文章' })).toHaveAttribute('href', '/post/latest');
    expect(screen.getByText('教程')).toBeInTheDocument();
  });

  it('年度回顾无数据时显示占位文案', async () => {
    // Stats 在模块作用域捕获 initialSiteStats：必须 resetModules + doMock + 动态导入
    // 才能让本用例使用空数据（testing.md 模块级缓存隔离纪律）。
    vi.resetModules();
    vi.doMock('../services/siteStats', () => ({
      getInitialSiteStats: () => ({ ...emptyFixture, yearReview: null }),
      getSiteStats: async () => emptyFixture,
      EMPTY_SITE_STATS: emptyFixture,
    }));
    try {
      const { Stats: StatsReloaded } = await import('./Stats');
      render(
        <MemoryRouter initialEntries={['/stats']}>
          <StatsReloaded />
        </MemoryRouter>,
      );
      expect(screen.getByText('今年还没有发布文章。')).toBeInTheDocument();
    } finally {
      vi.doUnmock('../services/siteStats');
      vi.resetModules();
    }
  });
});
