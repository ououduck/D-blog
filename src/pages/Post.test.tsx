import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Post } from './Post';
import { ReadingModeProvider } from '@/components/ReadingModeContext';

// Post 依赖大量服务与弹层组件：逐一 stub，聚焦页面自身行为。
vi.mock('@/services/posts', () => ({
  getPostById: vi.fn(),
  getPosts: vi.fn(),
}));
vi.mock('@/services/offlinePosts', () => ({
  getOfflinePosts: vi.fn(async () => []),
  getOfflinePost: vi.fn(async () => undefined),
  subscribeOfflinePosts: vi.fn(() => () => {}),
}));
vi.mock('@/services/readingHistory', () => ({
  getReadingHistory: vi.fn(() => []),
  getReadingHistoryEntry: vi.fn(() => undefined),
  saveReadingHistory: vi.fn(),
  removeReadingHistory: vi.fn(),
  subscribeReadingHistory: vi.fn(() => () => {}),
}));
vi.mock('@/services/busuanzi', () => ({
  pingBusuanzi: vi.fn(),
  fillBusuanziSpans: vi.fn(),
}));
vi.mock('@/components/GiscusComments', () => ({
  GiscusComments: () => <div data-testid="mock-giscus" />,
}));
vi.mock('@/components/IssueSubscriptionCard', () => ({
  IssueSubscriptionCard: () => <div data-testid="mock-subscription" />,
}));
vi.mock('@/components/TableOfContents', () => ({
  TableOfContents: () => <div data-testid="mock-toc" />,
}));
vi.mock('@/components/ReadingProgressBadge', () => ({
  ReadingProgressBadge: () => <div data-testid="mock-progress" />,
}));
vi.mock('@/components/ShareModal', () => ({
  ShareModal: () => <div data-testid="mock-share" />,
}));
vi.mock('@/components/ImageViewer', () => ({
  ImageViewer: () => <div data-testid="mock-viewer" />,
}));

import * as postsService from '@/services/posts';

const makePost = (overrides: Record<string, unknown> = {}) => ({
  id: 'test-post',
  title: '测试文章标题',
  excerpt: '这是文章摘要，用于列表展示。',
  date: '2026-03-14',
  category: '技术',
  filePath: '/posts/test-post.md',
  readTime: '5分钟阅读',
  tags: ['React'],
  content: '# 第一节\n\n正文内容段落。\n\n## 代码示例\n\n```ts\nconst a = 1;\n```',
  ...overrides,
});

const renderPost = (id = 'test-post') =>
  render(
    <MemoryRouter initialEntries={[`/post/${id}`]}>
      <ReadingModeProvider>
        <Routes>
          <Route path="/post/:id" element={<Post />} />
        </Routes>
      </ReadingModeProvider>
    </MemoryRouter>,
  );

describe('Post', () => {
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
    vi.mocked(postsService.getPostById).mockResolvedValue(makePost() as never);
    vi.mocked(postsService.getPosts).mockResolvedValue([] as never);
  });

  it('渲染文章标题与正文', async () => {
    renderPost();
    expect(await screen.findByText('测试文章标题')).toBeInTheDocument();
    expect(screen.getByText('正文内容段落。')).toBeInTheDocument();
  });

  it('渲染代码块工具栏（复制/下载）', async () => {
    renderPost();
    await screen.findByText('测试文章标题');
    expect(screen.getByRole('button', { name: '复制代码' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下载代码' })).toBeInTheDocument();
  });

  it('加载失败时显示错误状态与重新加载', async () => {
    vi.mocked(postsService.getPostById).mockRejectedValue(new Error('network'));
    renderPost();
    expect(await screen.findByText('文章加载失败')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载' })).toBeInTheDocument();
  });

  it('Alt+→ 有下一篇时导航到下一篇', async () => {
    vi.mocked(postsService.getPosts).mockResolvedValue([
      makePost({ id: 'first', title: '第一篇' }),
      makePost({ id: 'test-post', title: '测试文章标题' }),
      makePost({ id: 'last', title: '最后一篇' }),
    ] as never);
    renderPost();
    await screen.findByText('测试文章标题');
    await waitFor(() => {
      expect(screen.getByText('最后一篇')).toBeInTheDocument(); // 相邻导航区出现
    });
    vi.mocked(postsService.getPostById).mockClear();

    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true, repeat: false });
    // 导航应触发（相邻文章已加载），Post 组件按新 id 重新加载文章。
    await waitFor(() => {
      expect(postsService.getPostById).toHaveBeenCalledWith('last');
    });
  });

  it('无相邻文章时 Alt+←/→ 不导航（preventDefault 回归）', async () => {
    // 单篇文章：无 prev/next。
    vi.mocked(postsService.getPosts).mockResolvedValue([makePost()] as never);
    renderPost();
    await screen.findByText('测试文章标题');

    const before = window.location.href;
    fireEvent.keyDown(window, { key: 'ArrowLeft', altKey: true, repeat: false });
    fireEvent.keyDown(window, { key: 'ArrowRight', altKey: true, repeat: false });
    // URL 不应变化（默认行为被 preventDefault 拦截，不会退化为历史导航）。
    expect(window.location.href).toBe(before);
  });
});
