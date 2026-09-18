import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { CommandPalette } from './CommandPalette';
import type { PostMetadata } from '@/types';

vi.mock('@/services/posts', () => ({
  getInitialPosts: vi.fn(),
  searchPosts: vi.fn(),
}));

vi.mock('@/services/readingHistory', () => ({
  getReadingHistory: vi.fn(() => []),
}));

import { getInitialPosts, searchPosts } from '@/services/posts';
import { getReadingHistory } from '@/services/readingHistory';

const makePost = (overrides: Partial<PostMetadata> = {}): PostMetadata =>
  ({
    id: 'post-1',
    title: 'React 性能优化',
    excerpt: '摘要',
    date: '2026-08-01',
    category: '技术',
    tags: [],
    readTime: '5分钟阅读',
    ...overrides,
  }) as PostMetadata;

const renderPalette = (onClose = vi.fn()) => {
  const onCloseFn = onClose;
  render(
    <MemoryRouter>
      <CommandPalette onClose={onCloseFn} />
    </MemoryRouter>,
  );
  return onCloseFn;
};

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getInitialPosts).mockReturnValue([makePost(), makePost({ id: 'post-2', title: 'TypeScript 类型体操' })]);
    vi.mocked(getReadingHistory).mockReturnValue([] as never);
    vi.mocked(searchPosts).mockResolvedValue([] as never);
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
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('空查询时渲染快速操作与操作分组', () => {
    renderPalette();
    expect(screen.getByText('快速操作')).toBeInTheDocument();
    expect(screen.getByText('操作')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '首页' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '切换深浅色模式' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '回到顶部' })).toBeInTheDocument();
  });

  it('无阅读历史时展示最近文章（构建期元数据）', () => {
    renderPalette();
    expect(screen.getByText('最近文章')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /React 性能优化/ })).toBeInTheDocument();
  });

  it('有阅读历史时优先展示最近阅读', () => {
    vi.mocked(getReadingHistory).mockReturnValue([{ postId: 'post-2', progress: 0.5, updatedAt: Date.now() }] as never);
    renderPalette();
    expect(screen.getByText('最近阅读')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /TypeScript 类型体操/ })).toBeInTheDocument();
  });

  it('输入查询后走 usePostSearch 搜索并展示结果', async () => {
    vi.mocked(searchPosts).mockResolvedValue([makePost({ id: 'hit', title: 'React 性能优化指南' })] as never);
    const user = userEvent.setup();
    renderPalette();
    await user.type(screen.getByRole('combobox', { name: '搜索文章或执行命令' }), 'react');
    await waitFor(
      () => {
        expect(screen.getByRole('option', { name: /React 性能优化指南/ })).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(searchPosts).toHaveBeenCalledWith('react', { scope: 'all' });
  });

  it('ArrowDown 移动选中项，Enter 执行并关闭面板', async () => {
    const user = userEvent.setup();
    const onClose = renderPalette();

    const input = screen.getByRole('combobox', { name: '搜索文章或执行命令' });
    await user.click(input); // 键盘导航前提：焦点在输入框
    const firstOptionId = input.getAttribute('aria-activedescendant');
    await user.keyboard('{ArrowDown}');
    const secondOptionId = input.getAttribute('aria-activedescendant');
    expect(secondOptionId).not.toBe(firstOptionId);

    // 选中「首页」所在位置不确定，直接回车执行当前选中项：面板关闭即为行为成功
    await user.keyboard('{Enter}');
    expect(onClose).toHaveBeenCalled();
  });

  it('Esc 关闭面板（焦点管理由 useModalOverlay 处理）', async () => {
    const user = userEvent.setup();
    const onClose = renderPalette();
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('切换深浅色命令派发主题事件', async () => {
    const user = userEvent.setup();
    renderPalette();
    const handler = vi.fn();
    window.addEventListener('dblog:toggle-theme', handler);
    await user.click(screen.getByRole('option', { name: '切换深浅色模式' }));
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener('dblog:toggle-theme', handler);
  });

  it('点击搜索结果时记录最近搜索（localStorage）', async () => {
    vi.mocked(searchPosts).mockResolvedValue([makePost({ id: 'hit', title: '命中文章' })] as never);
    const user = userEvent.setup();
    renderPalette();
    await user.type(screen.getByRole('combobox', { name: '搜索文章或执行命令' }), '静态博客');
    await waitFor(
      () => {
        expect(screen.getByRole('option', { name: /命中文章/ })).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    await user.click(screen.getByRole('option', { name: /命中文章/ }));
    expect(localStorage.getItem('dblog:recent-searches')).toContain('静态博客');
  });

  it('最近搜索分组在下次打开时出现并可回填输入', async () => {
    localStorage.setItem('dblog:recent-searches', JSON.stringify(['云flare']));
    const user = userEvent.setup();
    renderPalette();
    const recentEntry = screen.getByRole('option', { name: '云flare' });
    await user.click(recentEntry);
    const input = screen.getByRole('combobox', { name: '搜索文章或执行命令' }) as HTMLInputElement;
    expect(input.value).toBe('云flare');
  });
});
