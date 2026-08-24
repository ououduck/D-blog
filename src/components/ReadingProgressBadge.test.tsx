import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { ReadingProgressBadge } from './ReadingProgressBadge';

// 组件在 rAF 中计算进度，测试里手动 flush 一帧触发更新。
const flushFrames = async () => {
  await act(async () => {
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  });
};

// 目标元素的几何信息：文档绝对位置 top=600 高 800（视口 800 时正文末尾位于
// 视口底部附近）。getBoundingClientRect 返回视口相对坐标 —— 随 scrollY 联动
// （元素随滚动上移），否则模拟滚动时 articleTop = rect.top + scrollY 与
// startScrollTop 同步增长，进度恒 0，滚动测试无法断言变化。
const getMockRect = () => {
  const top = 600 - window.scrollY;
  return {
    top,
    bottom: top + 800,
    height: 800,
    left: 0,
    right: 800,
    width: 800,
    x: 0,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
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
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      return getMockRect();
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
    // 文档高度：让可滚动区间 > 0（jsdom 默认 scrollHeight=0，进度恒 0）。
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 2000 });
    render(<ReadingProgressBadge targetRef={ref} />);
    await flushFrames();
    // 移动端与桌面端徽章各渲染一个百分比；固定几何（top=600 高 800、视口 800、
    // 文档 2000）下 scrollY=0 → 0%。
    const readPercentage = () => screen.getAllByText(/%$/)[0].textContent ?? '';
    expect(readPercentage()).toBe('0%');

    // 真实模拟滚动：修改 scrollY 并派发 scroll 事件（组件经 rAF 重新计算）。
    // scrollY=600 → (600-456)/(1000-456) ≈ 26%。
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 600 });
    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
    });
    await flushFrames();
    expect(readPercentage()).toBe('26%');

    // 滚过正文末尾（end 越过视口中间 50%）→ 徽章常驻不隐藏（回归：此前
    // 进入评论区/推荐区后自动消失，用户反馈希望进度始终可见）。
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 1000 });
    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
    });
    await flushFrames();
    expect(screen.getAllByText(/%$/).length).toBeGreaterThan(0);
  });
});
