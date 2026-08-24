import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { Search } from './Search';
import { searchPosts } from '@/services/posts';
import type { PostMetadata } from '@/types';

// URL 探针：MemoryRouter 不更新 window.location，断言搜索参数必须经
// useSearchParams 读取（否则「清除搜索后参数移除」的断言恒真、无回归保护）。
let probeSearch = '';
const SearchParamsProbe = () => {
  const [searchParams] = useSearchParams();
  probeSearch = searchParams.toString();
  return null;
};

const mockPost: PostMetadata = {
  id: 'mock-post',
  title: 'React 性能优化实践',
  excerpt: '一篇关于 React 性能优化的实践总结。',
  date: '2026-01-15',
  tags: ['react'],
  category: '前端',
  filePath: 'posts/mock-post.md',
  readTime: '5 分钟',
};

vi.mock('@/components/PostCard', () => ({
  PostCard: () => <div data-testid="mock-post-card" />,
}));
vi.mock('@/components/CompactPostCard', () => ({
  CompactPostCard: () => <div data-testid="mock-compact-post-card" />,
}));
vi.mock('@/services/busuanzi', () => ({
  pingBusuanzi: vi.fn(),
  fillBusuanziSpans: vi.fn(),
}));
vi.mock('@/services/offlinePosts', () => ({
  getOfflinePosts: vi.fn(async () => []),
  getOfflinePost: vi.fn(async () => undefined),
  subscribeOfflinePosts: vi.fn(() => () => {}),
}));
vi.mock('@/services/posts', () => ({
  searchPosts: vi.fn(),
}));

const renderSearch = (initialEntry = '/search') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/search"
          element={
            <>
              <Search />
              <SearchParamsProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );

describe('Search', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 未输入搜索词时不触发 searchPosts；默认返回空结果避免未定义穿透。
    vi.mocked(searchPosts).mockResolvedValue([]);
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
    renderSearch('/search?q=react');
    const input = await screen.findByRole('searchbox', { name: '搜索文章' });
    await waitFor(() => expect(input).toHaveValue('react'));
  });

  it('输入搜索词后输入框保持用户输入不被 URL 同步回退（v7_startTransition 竞态回归）', async () => {
    const user = userEvent.setup();
    renderSearch();
    const input = screen.getByRole('searchbox', { name: '搜索文章' });

    await user.type(input, 'vite');
    await waitFor(() => expect(input).toHaveValue('vite'));
    expect(input).toHaveValue('vite');
  });

  it('清除搜索后 URL 的 q 参数被移除', async () => {
    const user = userEvent.setup();
    renderSearch('/search?q=react');
    const input = await screen.findByRole('searchbox', { name: '搜索文章' });
    await waitFor(() => expect(input).toHaveValue('react'));

    await user.click(screen.getByRole('button', { name: '清除搜索' }));
    await waitFor(() => expect(input).toHaveValue(''));
    await waitFor(() => {
      expect(probeSearch).not.toContain('q=');
    });
  });

  it('点击分类按钮切换搜索范围并写入 URL（scope 参数）', async () => {
    const user = userEvent.setup();
    renderSearch();
    const titleScope = screen.getByRole('button', { name: '仅标题' });
    await user.click(titleScope);
    expect(titleScope).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => {
      expect(probeSearch).toContain('scope=title');
    });
  });

  it('URL 带 ?scope= 时预选对应搜索范围', async () => {
    renderSearch('/search?scope=content');
    const contentScope = screen.getByRole('button', { name: '正文内容' });
    expect(contentScope).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '全部' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('切换范围不丢查询：输入关键词后切范围，q 参数保留且 scope 写入', async () => {
    const user = userEvent.setup();
    renderSearch();
    const input = screen.getByRole('searchbox', { name: '搜索文章' });
    await user.type(input, 'react');
    await waitFor(() => expect(input).toHaveValue('react'));

    await user.click(screen.getByRole('button', { name: '仅标题' }));
    await waitFor(() => {
      expect(probeSearch).toContain('q=react');
      expect(probeSearch).toContain('scope=title');
    });
  });

  it('搜索结果同时渲染移动端横置卡片与桌面端卡片网格', async () => {
    vi.mocked(searchPosts).mockResolvedValue([{ ...mockPost, searchMatch: undefined }]);
    const user = userEvent.setup();
    renderSearch();
    const input = screen.getByRole('searchbox', { name: '搜索文章' });

    await user.type(input, 'react');
    // 防抖（300ms）后 searchPosts 返回结果：移动端 CompactPostCard 与
    // 桌面端 PostCard 网格各渲染一份（CSS 断点控制显隐）。
    await waitFor(() => {
      expect(screen.getAllByTestId('mock-compact-post-card')).toHaveLength(1);
    });
    expect(screen.getAllByTestId('mock-post-card')).toHaveLength(1);
    expect(searchPosts).toHaveBeenCalledWith('react', { scope: 'all' });
  });
});
