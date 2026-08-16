import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { Search } from './Search';

// URL 探针：MemoryRouter 不更新 window.location，断言搜索参数必须经
// useSearchParams 读取（否则「清除搜索后参数移除」的断言恒真、无回归保护）。
let probeSearch = '';
const SearchParamsProbe = () => {
  const [searchParams] = useSearchParams();
  probeSearch = searchParams.toString();
  return null;
};

vi.mock('@/components/PostCard', () => ({
  PostCard: () => <div data-testid="mock-post-card" />,
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

  it('点击分类按钮切换搜索范围', async () => {
    const user = userEvent.setup();
    renderSearch();
    const titleScope = screen.getByRole('button', { name: '仅标题' });
    await user.click(titleScope);
    expect(titleScope).toHaveAttribute('aria-pressed', 'true');
  });
});
