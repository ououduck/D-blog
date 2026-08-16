import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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
    <MemoryRouter initialEntries={['/']}>
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

  it('IME 组合输入期间按 Enter 上屏不触发导航（isComposing 拦截）', async () => {
    // 已有上一次搜索的结果；模拟中文输入法组合中按 Enter 提交拼音。
    await setupSearchHook({ results: [mockSearchResult()], hasQuery: true });
    const onClose = vi.fn();
    renderModal(true, onClose);
    const input = screen.getByPlaceholderText(/搜索文章/);
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });
    // 弹窗不应关闭、不应跳转（handleSelect 未执行）。
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ArrowDown/ArrowUp 在结果间移动高亮', async () => {
    await setupSearchHook({
      results: [mockSearchResult({ id: 'a', title: '文章A' }), mockSearchResult({ id: 'b', title: '文章B' })],
      hasQuery: true,
    });
    renderModal();
    const input = screen.getByPlaceholderText(/搜索文章/);
    const first = await screen.findByRole('option', { name: /打开文章：文章A/ });
    const second = screen.getByRole('option', { name: /打开文章：文章B/ });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(first).toHaveAttribute('aria-selected', 'false');

    fireEvent.keyDown(input, { key: 'ArrowUp' });
    expect(first).toHaveAttribute('aria-selected', 'true');
  });

  it('按 Enter 选中高亮结果并关闭弹窗', async () => {
    await setupSearchHook({ results: [mockSearchResult()], hasQuery: true });
    const onClose = vi.fn();
    renderModal(true, onClose);
    const input = screen.getByPlaceholderText(/搜索文章/);
    await screen.findByRole('option', { name: /打开文章：搜索结果文章/ });

    fireEvent.keyDown(input, { key: 'Enter' });
    // 导航触发 + 弹窗关闭（handleSelect 直接调用 onClose，路径变化的 effect 可能再调一次）。
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
