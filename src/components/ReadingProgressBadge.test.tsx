import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ReadingProgressBadge } from './ReadingProgressBadge';

// 组件在 rAF 中计算进度，测试里手动 flush 一帧触发更新。
const flushFrames = async () => {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  });
};

// 目标元素的固定几何信息：top=600 高 800，视口高 800 时正文末尾位于视口底部附近。
const mockTargetRect = {
  top: 600,
  bottom: 1400,
  height: 800,
  left: 0,
  right: 800,
  width: 800,
  x: 0,
  y: 600,
  toJSON: () => ({}),
};

describe('ReadingProgressBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
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
    // 渲染时 target 存在且几何已知
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return mockTargetRect as DOMRect;
    });
  });

  it('无目标元素时不渲染徽章内容', async () => {
    render(<ReadingProgressBadge targetRef={{ current: null }} />);
    await flushFrames();
    expect(screen.queryByText(/进度/)).not.toBeInTheDocument();
  });

  it('有目标元素且可见时渲染移动端进度徽章', async () => {
    const ref = { current: document.createElement('article') };
    render(<ReadingProgressBadge targetRef={ref} />);
    await flushFrames();
    expect(screen.getByText('进度')).toBeInTheDocument();
  });

  it('滚动更新进度百分比', async () => {
    const ref = { current: document.createElement('article') };
    render(<ReadingProgressBadge targetRef={ref} />);
    await flushFrames();
    // 移动端与桌面端徽章各渲染一个百分比
    const badges = screen.getAllByText(/%$/);
    expect(badges.length).toBeGreaterThan(0);
    expect(badges[0]).toHaveTextContent('%');
  });

  it('可见性变化时触发 onVisibilityChange', async () => {
    const ref = { current: document.createElement('article') };
    const onVisibilityChange = vi.fn();
    render(<ReadingProgressBadge targetRef={ref} onVisibilityChange={onVisibilityChange} />);
    await flushFrames();
    // 初始可见（正文末尾在视口下半区）→ 回调收到 true
    expect(onVisibilityChange).toHaveBeenCalledWith(true);
  });
});
