import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SearchModal } from './SearchModal';
import type { PostSearchResult } from '@/services/posts';

// 搜索 hook 打桩：聚焦弹层自身的交互与状态管理。
vi.mock('@/hooks/usePostSearch', () => ({
  usePostSearch: vi.fn(),
}));

const mockSearchResult = (overrides: Partial<PostSearchResult> = {}): PostSearchResult => ({
  id: 'post-1',
  title: '搜索结果文章',
  excerpt: '摘要',
  date: '2026-01-01',
  category: '技术',
  filePath: '/posts/post-1.md',
  readTime: '3分钟阅读',
  tags: [],
  ...overrides,
});

const setupSearchHook = async ({
  results = [],
  isSearching = false,
  hasQuery = false,
}: {
  results?: PostSearchResult[];
  isSearching?: boolean;
  hasQuery?: boolean;
} = {}) => {
  const { usePostSearch } = await import('@/hooks/usePostSearch');
  vi.mocked(usePostSearch).mockReturnValue({
    searchQuery: hasQuery ? '测试' : '',
    isSearching,
    searchError: null,
    results,
    handleSearch: vi.fn(),
    setSearchQuery: vi.fn(),
    clearSearch: vi.fn(),
    hasSearchQuery: hasQuery,
  } as never);
};

const renderModal = (isOpen = true, onClose = vi.fn()) =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/']}>
      <Routes>
        <Route path="*" element={<SearchModal isOpen={isOpen} onClose={onClose} />} />
      </Routes>
    </MemoryRouter>,
  );

describe('SearchModal', () => {
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

  it('打开时渲染搜索对话框与输入框', async () => {
    await setupSearchHook();
    renderModal();
    expect(screen.getByRole('dialog', { name: '站内搜索' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/搜索文章/)).toBeInTheDocument();
  });

  it('关闭时渲染为空（不挂载弹层）', async () => {
    await setupSearchHook();
    renderModal(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('渲染搜索结果列表并支持点击导航', async () => {
    await setupSearchHook({ results: [mockSearchResult()], hasQuery: true });
    renderModal();
    const resultButton = await screen.findByRole('option', { name: /打开文章：搜索结果文章/ });
    expect(screen.getByText('搜索结果文章')).toBeInTheDocument();
    expect(resultButton).toBeInTheDocument();
  });

  it('无结果时展示空态提示', async () => {
    await setupSearchHook({ hasQuery: true });
    renderModal();
    expect(screen.getByText(/没有找到与/)).toBeInTheDocument();
  });

  it('渲染搜索范围选项（全部/分类/正文内容/仅标题）', async () => {
    await setupSearchHook();
    renderModal();
    expect(screen.getByRole('button', { name: '全部' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '分类' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '正文内容' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '仅标题' })).toBeInTheDocument();
  });

  it('提供到搜索页的入口链接', async () => {
    await setupSearchHook({ hasQuery: true });
    renderModal();
    expect(screen.getByRole('link', { name: /在搜索页查看全部结果/ })).toHaveAttribute(
      'href',
      '/search?q=%E6%B5%8B%E8%AF%95',
    );
  });

  it('关闭后清空搜索状态（onClose 触发）', async () => {
    await setupSearchHook();
    const onClose = vi.fn();
    renderModal(true, onClose);
    await userEvent.click(screen.getByRole('button', { name: '关闭站内搜索' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
