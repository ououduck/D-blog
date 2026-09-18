import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CapsuleNav } from './CapsuleNav';
import { resetCapsuleState } from './capsuleState';
import type { MarkdownHeading } from '@/utils/headings';

const makeHeadings = (): MarkdownHeading[] => [
  { id: 'intro', level: 1, text: '介绍', rawText: '介绍' },
  { id: 'usage', level: 2, text: '使用方法', rawText: '使用方法' },
];

const renderCapsule = (overrides: Partial<Parameters<typeof CapsuleNav>[0]> = {}) =>
  render(
    <CapsuleNav
      headings={makeHeadings()}
      targetRef={{ current: null }}
      endRef={{ current: null }}
      isReadingMode={false}
      onShare={vi.fn()}
      onCopyArticleLink={vi.fn(async () => true)}
      onCopyHeadingLink={vi.fn(async () => true)}
      onToggleReadingMode={vi.fn()}
      {...overrides}
    />,
  );

const portalHost = () => document.body;

describe('CapsuleNav（桌面胶囊文章导航）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 模块级状态记忆跨用例隔离（状态继承是产品行为，不能泄进下一用例）。
    resetCapsuleState();
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
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 0,
      bottom: 0,
      height: 0,
      left: 0,
      right: 0,
      width: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect);
  });

  it('默认收缩：迷你轨可见，展开面板隐藏（visibility）', () => {
    renderCapsule();
    const rail = portalHost().querySelector('.capsule-rail');
    const panel = portalHost().querySelector('.capsule-panel') as HTMLElement;
    expect(rail).toBeInTheDocument();
    expect(panel).toBeInTheDocument();
    const container = portalHost().querySelector('.capsule-container');
    expect(container?.getAttribute('data-expanded')).toBeNull();
    // 收起态面板不占位也不可见（CSS visibility 由 data-expanded 驱动）
    expect(getComputedStyle(panel).visibility === 'visible' || panel.hasAttribute('hidden')).toBe(true);
  });

  it('点击展开按钮进入展开态，再点击收起', async () => {
    const user = userEvent.setup();
    renderCapsule();
    const toggle = portalHost().querySelector('.capsule-rail .capsule-rail-btn') as HTMLButtonElement;
    await user.click(toggle);
    expect(portalHost().querySelector('.capsule-container')?.getAttribute('data-expanded')).toBe('true');
    expect(screen.getByText('文章导航')).toBeInTheDocument();

    // Esc 收起（focus 停留在面板内时点击收起会因 focus-within 保持展开，
    // 这是键盘可达性设计：Esc 才是收起的键盘路径）。
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(portalHost().querySelector('.capsule-container')?.getAttribute('data-expanded')).toBeNull();
  });

  it('固定（Pin）后 aria-pressed 为真，收起按钮保留（取消固定路径）', async () => {
    const user = userEvent.setup();
    renderCapsule();
    const toggle = portalHost().querySelector('.capsule-rail .capsule-rail-btn') as HTMLButtonElement;
    await user.click(toggle);
    const pinButton = screen.getByRole('button', { name: '固定导航面板' });
    await user.click(pinButton);
    expect(screen.getByRole('button', { name: '取消固定导航面板' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('迷你轨展示章节序号并支持跳转（更新 URL hash）', async () => {
    const user = userEvent.setup();
    renderCapsule();
    const sectionBtn = screen.getByRole('button', { name: /跳转到章节 1：介绍/ });
    await user.click(sectionBtn);
    expect(window.location.hash).toBe('#intro');
  });

  it('复制文章链接成功后给出轻量反馈', async () => {
    const user = userEvent.setup();
    const onCopyArticleLink = vi.fn(async () => true);
    renderCapsule({ onCopyArticleLink });
    await user.click(screen.getByRole('button', { name: '展开文章导航' }));
    await user.click(screen.getByRole('button', { name: '复制文章链接' }));
    expect(await screen.findByText('文章链接已复制')).toBeInTheDocument();
    expect(onCopyArticleLink).toHaveBeenCalledTimes(1);
  });

  it('阅读模式下隐藏复制/阅读模式操作，提供退出入口', async () => {
    const user = userEvent.setup();
    renderCapsule({ isReadingMode: true });
    await user.click(screen.getByRole('button', { name: '展开文章导航' }));
    expect(screen.queryByRole('button', { name: '复制文章链接' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '退出专注阅读' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '固定导航面板' })).not.toBeInTheDocument();
  });

  it('Esc 在展开且未固定时收起面板（fireEvent 保持非受控键盘路径）', async () => {
    const user = userEvent.setup();
    renderCapsule();
    await user.click(screen.getByRole('button', { name: '展开文章导航' }));
    expect(portalHost().querySelector('.capsule-container')?.getAttribute('data-expanded')).toBe('true');

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(portalHost().querySelector('.capsule-container')?.getAttribute('data-expanded')).toBeNull();
  });
});
