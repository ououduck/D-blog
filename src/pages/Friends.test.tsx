import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Friends } from './Friends';
import { siteConfig } from '@config/site.config';

// 模块加载时 Friends.tsx 会调用 getInitialFriends() 捕获 initialFriends，
// 且水合后 effect 会调用 getFriends() 替换列表——两个 mock 必须返回同一份数据。
// vi.mock 被提升到文件顶部，外部常量处于 TDZ，须用 vi.hoisted 共享。
const { friendsFixture } = vi.hoisted(() => ({
  friendsFixture: [
    { name: '示例博客', description: '前端技术分享', avatar: '/a.png', url: 'https://example.com' },
    { name: 'DEV Blog', description: 'Web development', avatar: '/b.png', url: 'https://dev.example.org' },
    {
      name: '失联站点',
      description: '曾经的友链',
      avatar: '/c.png',
      url: 'https://gone.example.net',
      unavailable: true,
    },
  ],
}));

vi.mock('@/services/friends', () => ({
  getInitialFriends: vi.fn(() => friendsFixture),
  getFriends: vi.fn(async () => friendsFixture),
}));
vi.mock('@/services/busuanzi', () => ({
  pingBusuanzi: vi.fn(),
  fillBusuanziSpans: vi.fn(),
}));

const renderFriends = (initialEntry = '/friends') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/friends" element={<Friends />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Friends', () => {
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

  it('渲染友链列表', async () => {
    renderFriends();
    expect(await screen.findByText('示例博客')).toBeInTheDocument();
    expect(screen.getByText('DEV Blog')).toBeInTheDocument();
  });

  it('失联友链归入「已失联的博客」折叠板块，展开后可见', async () => {
    const user = userEvent.setup();
    renderFriends();
    await screen.findByText('示例博客');
    expect(screen.queryByText('失联站点')).not.toBeInTheDocument(); // 默认折叠
    // 展开失联板块。
    await user.click(screen.getByRole('button', { name: /已失联的博客/ }));
    expect(await screen.findByText('失联站点')).toBeInTheDocument();
  });

  it('搜索按名称/描述/域名过滤（大小写不敏感，locale 无关回归）', async () => {
    const user = userEvent.setup();
    renderFriends();
    await screen.findByText('示例博客');
    const input = screen.getByLabelText('搜索友链');

    // 大写 I 匹配 "DEV Blog"（土耳其语 locale 下 toLocaleLowerCase 会把 I 变 ı 导致失配）。
    await user.type(input, 'DEV');
    expect(screen.getByText('DEV Blog')).toBeInTheDocument();
    expect(screen.queryByText('示例博客')).not.toBeInTheDocument();

    // 域名搜索。
    await user.clear(input);
    await user.type(input, 'EXAMPLE');
    expect(screen.getByText('示例博客')).toBeInTheDocument();
  });

  it('清除搜索恢复全部', async () => {
    const user = userEvent.setup();
    renderFriends();
    await screen.findByText('示例博客');
    const input = screen.getByLabelText('搜索友链');

    await user.type(input, 'DEV');
    expect(screen.queryByText('示例博客')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '清除友链搜索' }));
    expect(screen.getByText('示例博客')).toBeInTheDocument();
  });

  it('申请/修改友链入口跳转外部表单', async () => {
    const user = userEvent.setup();
    renderFriends();
    await screen.findByText('示例博客');
    // 展开「申请友链」面板，第一步展示本站信息。
    await user.click(screen.getByRole('button', { name: /申请友链/ }));
    expect(screen.getByText('添加本站友链')).toBeInTheDocument();
    // 点击「我已添加」进入第二步。
    await user.click(screen.getByRole('button', { name: /我已添加/ }));
    const applyLink = await screen.findByRole('link', { name: /申请 \/ 修改友链/ });
    expect(applyLink).toHaveAttribute('href', siteConfig.friendsPage.applyUrl);
    expect(applyLink).toHaveAttribute('target', '_blank');
    expect(applyLink).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
