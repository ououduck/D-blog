import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Home } from './Home';

// 弹层与工具组件用 stub 替代，聚焦 Home 自身行为。
vi.mock('@/components/ShareModal', () => ({
  ShareModal: () => <div data-testid="mock-share-modal" />,
}));
vi.mock('@/services/busuanzi', () => ({
  pingBusuanzi: vi.fn(),
  fillBusuanziSpans: vi.fn(),
}));
vi.mock('@/services/readingHistory', () => ({
  getReadingHistory: vi.fn(() => []),
  saveReadingHistory: vi.fn(),
  subscribeReadingHistory: vi.fn(() => () => {}),
  removeReadingHistory: vi.fn(),
}));

const renderHome = (initialEntry = '/') =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={[initialEntry]}>
      <Routes>
        <Route path="*" element={<Home />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Home', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom 不实现 matchMedia：PostCard 的 useSpotlight 等依赖媒体查询。
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

  it('渲染站点英雄区（标题与副标题）', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
  });

  it('渲染文章卡片列表（来自构建期数据）', () => {
    renderHome();
    // 首页应有至少一个文章链接（卡片标题链接）
    const postLinks = screen.getAllByRole('link', { name: /阅读文章：/ });
    expect(postLinks.length).toBeGreaterThan(0);
  });

  it('分类筛选：点击分类按钮后该分类被选中', async () => {
    const user = userEvent.setup();
    renderHome();
    const categoryButtons = screen.getAllByRole('button', { name: /^(分享|教程)$/ });
    expect(categoryButtons.length).toBeGreaterThan(0);

    await user.click(categoryButtons[0]);
    expect(categoryButtons[0]).toHaveAttribute('aria-pressed', 'true');
  });

  it('URL 带 ?category= 时应用 URL 分类筛选', async () => {
    renderHome('/?category=分享');
    // effect 同步 URL 分类后：分享选中、全部未选中
    const categoryButton = await screen.findByRole('button', { name: '分享' });
    expect(categoryButton).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '全部' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('打开分享弹层：点击卡片分享按钮', async () => {
    const user = userEvent.setup();
    renderHome();
    const shareButtons = screen.getAllByRole('button', { name: /分享文章：/ });
    expect(shareButtons.length).toBeGreaterThan(0);
    await user.click(shareButtons[0]);
    expect(await screen.findByTestId('mock-share-modal')).toBeInTheDocument();
  });
});
