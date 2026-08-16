import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { ArchivePage } from './Archive';

vi.mock('@/services/posts', () => ({
  getInitialPosts: vi.fn(() => []),
  getPosts: vi.fn(async () => []),
  searchPosts: vi.fn(async () => []),
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
});
