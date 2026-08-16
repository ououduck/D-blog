import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Search } from './Search';

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
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/search" element={<Search />} />
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
      expect(window.location.search).not.toContain('q=');
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
