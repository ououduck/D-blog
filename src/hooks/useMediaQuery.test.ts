import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMediaQuery } from './useMediaQuery';

interface MediaQueryListener {
  (event: { matches: boolean }): void;
}

type MatchMediaMock = {
  matches: boolean;
  media: string;
  listeners: MediaQueryListener[];
  addEventListener: (event: string, listener: MediaQueryListener) => void;
  removeEventListener: (event: string, listener: MediaQueryListener) => void;
  addListener: (listener: MediaQueryListener) => void;
  removeListener: (listener: MediaQueryListener) => void;
};

let mediaQueryMocks: MatchMediaMock[] = [];
const originalMatchMedia = window.matchMedia;

const createMatchMediaMock = (query: string): MatchMediaMock => {
  const mock: MatchMediaMock = {
    matches: false,
    media: query,
    listeners: [],
    addEventListener: (_event, listener) => {
      mock.listeners.push(listener);
    },
    removeEventListener: (_event, listener) => {
      mock.listeners = mock.listeners.filter((item) => item !== listener);
    },
    addListener: (listener) => {
      mock.listeners.push(listener);
    },
    removeListener: (listener) => {
      mock.listeners = mock.listeners.filter((item) => item !== listener);
    },
  };
  return mock;
};

beforeEach(() => {
  mediaQueryMocks = [];
  window.matchMedia = vi.fn((query: string) => {
    const mock = createMatchMediaMock(query);
    mediaQueryMocks.push(mock);
    return mock;
  }) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  window.matchMedia = originalMatchMedia;
});

describe('useMediaQuery', () => {
  it('挂载后同步真实媒体状态（matches=false → false）', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)', true));
    // 首帧 defaultValue=true 由挂载后的 effect 立即纠正为真实值 false
    expect(result.current).toBe(false);
  });

  it('媒体查询匹配时返回 true', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    // hook 挂载后 mock 才被创建；把初始 matches 改为 true 再触发同步
    act(() => {
      mediaQueryMocks[0].matches = true;
      mediaQueryMocks[0].listeners.forEach((listener) => listener({ matches: true }));
    });
    expect(result.current).toBe(true);
  });

  it('媒体查询变化时更新返回值', () => {
    const { result } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(result.current).toBe(false);

    act(() => {
      mediaQueryMocks[0].matches = true;
      mediaQueryMocks[0].listeners.forEach((listener) => listener({ matches: true }));
    });
    expect(result.current).toBe(true);
  });

  it('卸载时移除监听器', () => {
    const { unmount } = renderHook(() => useMediaQuery('(min-width: 768px)'));
    expect(mediaQueryMocks[0].listeners).toHaveLength(1);
    unmount();
    expect(mediaQueryMocks[0].listeners).toHaveLength(0);
  });

  it('查询变化时重新订阅', () => {
    const { rerender } = renderHook(({ query }) => useMediaQuery(query), {
      initialProps: { query: '(min-width: 768px)' },
    });
    expect(mediaQueryMocks).toHaveLength(1);
    rerender({ query: '(hover: hover)' });
    expect(mediaQueryMocks).toHaveLength(2);
  });
});
