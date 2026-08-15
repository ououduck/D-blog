import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { OfflineStatus } from './OfflineStatus';

const setOnline = (online: boolean) => {
  Object.defineProperty(navigator, 'onLine', { value: online, configurable: true });
};

const fireEvent = (type: string) => {
  window.dispatchEvent(new Event(type));
};

describe('OfflineStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setOnline(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('在线时不渲染', () => {
    const { container } = render(<OfflineStatus />);
    expect(container.firstChild).toBeNull();
  });

  it('初始离线时立即显示离线提示', () => {
    setOnline(false);
    render(<OfflineStatus />);
    expect(screen.getByText('当前处于离线模式，已收藏文章仍可继续阅读。')).toBeInTheDocument();
  });

  it('offline 事件触发显示离线提示', () => {
    render(<OfflineStatus />);
    act(() => {
      fireEvent('offline');
    });
    expect(screen.getByText('当前处于离线模式，已收藏文章仍可继续阅读。')).toBeInTheDocument();
  });

  it('恢复在线后显示恢复提示并在 2.4s 后消失', () => {
    render(<OfflineStatus />);
    act(() => {
      fireEvent('offline');
    });
    act(() => {
      fireEvent('online');
    });
    expect(screen.getByText('网络已恢复。')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2400);
    });
    expect(screen.queryByText('网络已恢复。')).not.toBeInTheDocument();
  });

  it('卸载时清理定时器', () => {
    const { unmount } = render(<OfflineStatus />);
    act(() => {
      fireEvent('offline');
    });
    act(() => {
      fireEvent('online');
    });
    expect(() => unmount()).not.toThrow();
    act(() => {
      vi.advanceTimersByTime(2400);
    });
  });
});
