import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Post } from './Post';
import { ReadingModeProvider } from '@/components/ReadingModeContext';
import { extractMarkdownHeadings } from '@/utils/headings';

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

    // jsdom 不实现 Alt+Arrow 的历史导航，断言 URL 不变是恒真（起不到回归保护）；
    // 真正的回归点是 preventDefault 被调用（拦截浏览器默认后退/前进行为，
    // 否则用户会意外离开当前页面）。dispatchEvent 返回 false 即表示
    // 监听器调用了 preventDefault（cancelable 事件）。
    const leftEvent = new KeyboardEvent('keydown', { key: 'ArrowLeft', altKey: true, cancelable: true });
    const rightEvent = new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, cancelable: true });
    expect(window.dispatchEvent(leftEvent)).toBe(false);
    expect(window.dispatchEvent(rightEvent)).toBe(false);
    // 且未发生导航（getPostById 不被再次调用）。
    await waitFor(() => {
      expect(postsService.getPostById).toHaveBeenCalledTimes(1);
    });
  });

  it('正文标题 id 在多次重渲染后保持与 headings 数组一致（目录点击跳转回归）', async () => {
    renderPost();
    await screen.findByText('测试文章标题');

    const headingIds = extractMarkdownHeadings(makePost().content as string).map((heading) => heading.id);
    expect(headingIds.length).toBeGreaterThan(0);
    const assertHeadingIdsInDom = () => headingIds.every((id) => document.getElementById(id) !== null);

    // 首帧渲染后 DOM 即包含与 TOC 一致的标题锚点 id。
    await waitFor(() => expect(assertHeadingIdsInDom()).toBe(true));
    // 等待异步增强（rehype-highlight）落定：插件加载会重建渲染组件（游标归零），
    // 之后任何状态变化触发的重渲染都复用同一闭包——这正是 id 漂移的触发条件。
    await waitFor(() => expect(document.querySelector('.post-prose .hljs')).toBeTruthy());

    // 触发多次 Post 重渲染（阅读模式开/关等状态变化）：若渲染组件对象被 useMemo
    // 缓存复用，resolveHeadingId 游标已走到末尾，标题 id 会退化为 slug-N 兜底并
    // 逐次递增（-1、-2…），与 headings 数组发散，目录点击找不到锚点。
    fireEvent.click(screen.getByRole('button', { name: '进入专注阅读' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '退出专注阅读' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '退出专注阅读' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '进入专注阅读' })).toBeInTheDocument());
    await waitFor(() => expect(assertHeadingIdsInDom()).toBe(true));
  });
});
