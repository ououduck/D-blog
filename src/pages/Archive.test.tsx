import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { ArchivePage } from './Archive';

// 非空固定数据集：空数据 mock 让年份分组/展开/URL 参数行为零覆盖
// （此前正是 ?year=2026 纯数字参数 bug 的漏网原因）。
// 注意 vi.hoisted：vi.mock 工厂提升执行，引用模块级常量会 TDZ。
const { MOCK_POSTS } = vi.hoisted(() => ({
  MOCK_POSTS: [
    {
      id: 'post-2026',
      title: '2026 年文章',
      excerpt: '摘要',
      date: '2026-03-14',
      category: '技术',
      filePath: '/posts/post-2026.md',
      readTime: '3分钟阅读',
      tags: [],
    },
    {
      id: 'post-2025',
      title: '2025 年文章',
      excerpt: '摘要',
      date: '2025-11-02',
      category: '分享',
      filePath: '/posts/post-2025.md',
      readTime: '2分钟阅读',
      tags: [],
    },
  ],
}));

vi.mock('@/services/posts', () => ({
  getInitialPosts: vi.fn(() => MOCK_POSTS),
  getPosts: vi.fn(async () => MOCK_POSTS),
  searchPosts: vi.fn(async () => MOCK_POSTS),
}));
vi.mock('@/services/busuanzi', () => ({
  pingBusuanzi: vi.fn(),
  fillBusuanziSpans: vi.fn(),
}));

// URL 探针：MemoryRouter 不更新 window.location，断言搜索参数必须经
// useSearchParams 读取（否则「清除搜索后参数移除」的断言恒真、无回归保护）。
let probeSearch = '';
const SearchParamsProbe = () => {
  const [searchParams] = useSearchParams();
  probeSearch = searchParams.toString();
  return null;
};

const renderArchive = (initialEntry = '/archive') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/archive"
          element={
            <>
              <ArchivePage />
              <SearchParamsProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe('Archive', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('URL 带 ?q= 时同步到搜索框', async () => {
    renderArchive('/archive?q=react');
    const input = await screen.findByRole('searchbox', { name: '搜索归档文章' });
    await waitFor(() => expect(input).toHaveValue('react'));
  });

  it('输入搜索词后输入框保持用户输入不被 URL 同步回退（v7_startTransition 竞态回归）', async () => {
    const user = userEvent.setup();
    renderArchive();
    const input = screen.getByRole('searchbox', { name: '搜索归档文章' });

    await user.type(input, 'vite');
    await waitFor(() => expect(input).toHaveValue('vite'));
    expect(input).toHaveValue('vite');
  });

  it('清除搜索后 URL 的 q 与 year 参数被移除', async () => {
    const user = userEvent.setup();
    renderArchive('/archive?q=react&year=2026');
    const input = await screen.findByRole('searchbox', { name: '搜索归档文章' });
    await waitFor(() => expect(input).toHaveValue('react'));
    await waitFor(() => expect(probeSearch).toContain('q=react'));

    await user.click(screen.getByRole('button', { name: '清除搜索' }));
    await waitFor(() => expect(input).toHaveValue(''));
    await waitFor(() => {
      expect(probeSearch).not.toContain('q=');
      expect(probeSearch).not.toContain('year=');
    });
  });

  it('?year=2026（纯数字）直访：对应年份展开，参数不被静默删除', async () => {
    // 回归：URL 写纯数字年份（展示层为「2026年」），归一化比较后互认。
    renderArchive('/archive?year=2026');
    await waitFor(() => expect(probeSearch).toContain('year=2026'));
    expect(await screen.findByText('2026 年文章')).toBeInTheDocument();
    // 2025 组未展开。
    expect(screen.queryByText('2025 年文章')).not.toBeInTheDocument();
  });

  it('点击年份切换写入纯数字 year 参数并展开该年份', async () => {
    const user = userEvent.setup();
    renderArchive();
    // 默认展开最新年份（2026）；点击 2025 组标题切换。
    await user.click(await screen.findByRole('button', { name: '展开 2025年的文章' }));
    await waitFor(() => expect(probeSearch).toContain('year=2025'));
    // 年份展开后显示月份（文章需再展开月份，钻取式交互）。
    expect(screen.getByRole('button', { name: '展开 11月的文章' })).toBeInTheDocument();
    // 2026 组折叠。
    expect(screen.getByRole('button', { name: '折叠 2026年的文章' })).toBeInTheDocument();
  });

  it('不存在的 year 参数从 URL 移除并回退最新年份', async () => {
    renderArchive('/archive?year=9999');
    await waitFor(() => expect(probeSearch).not.toContain('year='));
    // 回退展开最新年份（2026）。
    expect(await screen.findByText('2026 年文章')).toBeInTheDocument();
  });
});
