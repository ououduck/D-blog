import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { Layout } from './Layout';

// 懒加载子组件用简单 stub 替代，避免测试中等待 dynamic import 与动画。
// 注意：Layout 以命名导出方式解构（import('./X').then(m => m.X)），mock 需提供同名导出。
vi.mock('@/components/SearchModal', () => ({
  SearchModal: () => <div data-testid="mock-search-modal" />,
}));
vi.mock('@/components/BackToTop', () => ({
  BackToTop: () => <div data-testid="mock-back-to-top" />,
}));
vi.mock('@/components/CookieNotice', () => ({
  CookieNotice: () => <div data-testid="mock-cookie-notice" />,
}));
// 不蒜子统计：避免测试环境发起真实网络请求。
vi.mock('@/services/busuanzi', () => ({
  pingBusuanzi: vi.fn(),
  fillBusuanziSpans: vi.fn(),
}));

const renderLayout = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }} initialEntries={['/']}>
      <Layout>
        <div>页面内容</div>
      </Layout>
    </MemoryRouter>,
  );

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom 不实现 matchMedia：ThemeToggle / Navbar 的媒体查询依赖它。
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

  afterEach(() => {
    // 移动端导航锁定 body 滚动：重置避免跨用例污染。
    document.body.style.overflow = '';
  });

  it('渲染导航栏主导航项（桌面端可见）', () => {
    renderLayout();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /文章/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /归档/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /标签/ })).toBeInTheDocument();
  });

  it('渲染主题切换按钮（aria-label 含当前主题）', () => {
    renderLayout();
    expect(screen.getByRole('button', { name: /切换外观主题/ })).toBeInTheDocument();
  });

  it('渲染搜索入口按钮', () => {
    renderLayout();
    // 桌面端与移动端各有一个搜索按钮
    expect(screen.getAllByRole('button', { name: '打开站内搜索' }).length).toBeGreaterThanOrEqual(1);
  });

  it('渲染 children 内容', () => {
    renderLayout();
    expect(screen.getByText('页面内容')).toBeInTheDocument();
  });

  it('渲染页脚（站点标题与备案链接）', () => {
    renderLayout();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });
  it('Ctrl+K 打开搜索弹层', async () => {
    const user = userEvent.setup();
    renderLayout();
    expect(screen.queryByTestId('mock-search-modal')).not.toBeInTheDocument();
    await user.keyboard('{Control>}k{/Control}');
    // 弹层为 lazy 挂载，findBy 自动等待动态 import 完成
    expect(await screen.findByTestId('mock-search-modal')).toBeInTheDocument();
  });

  it('点击搜索按钮打开搜索弹层', async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getAllByRole('button', { name: '打开站内搜索' })[0]);
    expect(await screen.findByTestId('mock-search-modal')).toBeInTheDocument();
  });

  it('移动端菜单按钮打开导航面板并可关闭', async () => {
    const user = userEvent.setup();
    renderLayout();
    const menuButton = screen.getByRole('button', { name: '打开导航菜单' });
    await user.click(menuButton);
    expect(await screen.findByRole('dialog', { name: '移动端导航菜单' })).toBeInTheDocument();
    expect(menuButton).toHaveAttribute('aria-expanded', 'true');
    // 等待打开动画完成（340ms），否则切换关闭会被 isMobileNavAnimating 守卫忽略。
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    // 再次点击切换关闭。
    await user.click(menuButton);
    // 关闭动画后面板卸载。
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(screen.queryByRole('dialog', { name: '移动端导航菜单' })).not.toBeInTheDocument();
  });

  it('点击移动端导航项后菜单关闭（close-then-navigate 守卫回归）', async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole('button', { name: '打开导航菜单' }));
    await screen.findByRole('dialog', { name: '移动端导航菜单' });
    // 等待打开动画完成。
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    // 点击「归档」导航项：菜单应关闭且不吞掉导航动作。
    await user.click(screen.getByRole('button', { name: /归档/ }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(screen.queryByRole('dialog', { name: '移动端导航菜单' })).not.toBeInTheDocument();
  });
});
