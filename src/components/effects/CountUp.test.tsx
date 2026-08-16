import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CountUp } from './CountUp';

// framer-motion 的 useInView/useSpring 依赖 IntersectionObserver 与动画帧：
// jsdom 中不触发动画，挂载后 span 停在起始值（水合写回）——核心回归点是
// NaN/非法数字防御（不渲染 "NaN"）与组件不崩溃。
describe('CountUp', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    class MockIntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
      root = null;
      rootMargin = '';
      thresholds = [];
    }
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('挂载后渲染起始值（水合写回动画起点），不出现 NaN', () => {
    render(<CountUp to={12345} />);
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
    // 默认 from=0：挂载后 span 显示 0（动画未在 jsdom 中运行）。
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('自定义 from 时挂载后显示起始值（未传 separator 不加千分位）', () => {
    render(<CountUp to={500} from={1000} />);
    expect(screen.getByText('1000')).toBeInTheDocument();
  });

  it('传 separator 时应用千分位分组（挂载停在起始值，分组格式在动画路径生效）', () => {
    render(<CountUp to={1000000} from={0} separator="," />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('NaN 目标值防御：渲染 0 而非 NaN', () => {
    render(<CountUp to={Number.NaN} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.queryByText('NaN')).not.toBeInTheDocument();
  });

  it('Infinity 目标值防御：渲染 0 而非 Infinity', () => {
    render(<CountUp to={Number.POSITIVE_INFINITY} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('方向 down 时挂载后显示起始值（动画从 from 向下滚到 to，终点为目标值）', () => {
    render(<CountUp to={500} from={1000} direction="down" />);
    // 挂载水合写回起始值；to 是动画终点（SSR 首帧渲染），from 是起点。
    expect(screen.getByText('1000')).toBeInTheDocument();
    expect(screen.queryByText('500')).not.toBeInTheDocument();
  });
});
