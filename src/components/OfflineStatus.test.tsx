import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act, fireEvent as fireTLEvent } from '@testing-library/react';
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
    expect(screen.getByText('当前处于离线模式，部分页面可能无法访问。')).toBeInTheDocument();
  });

  it('offline 事件触发显示离线提示', () => {
    render(<OfflineStatus />);
    act(() => {
      fireEvent('offline');
    });
    expect(screen.getByText('当前处于离线模式，部分页面可能无法访问。')).toBeInTheDocument();
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

  it('离线时提供「已缓存文章」入口并列出缓存文章（含标题解析与 Esc 关闭）', async () => {
    vi.useRealTimers();
    const cachedRequests = [
      new Request('https://blog.example.com/post/hello-world'),
      new Request('https://blog.example.com/'),
    ];
    const cachedResponses = new Map([
      ['https://blog.example.com/post/hello-world', new Response('<html><title>你好世界 - D-blog</title></html>')],
    ]);
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['dblog-abc123-pages']),
      open: vi.fn().mockResolvedValue({
        keys: vi.fn().mockResolvedValue(cachedRequests),
        match: vi.fn((request: Request) => Promise.resolve(cachedResponses.get(request.url))),
      }),
    });

    setOnline(false);
    render(<OfflineStatus />);
    const toggle = screen.getByRole('button', { name: /已缓存文章/ });
    await act(async () => {
      fireTLEvent.click(toggle);
    });
    expect(await screen.findByRole('navigation', { name: '已缓存文章列表' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '你好世界' })).toHaveAttribute(
      'href',
      'https://blog.example.com/post/hello-world',
    );

    // Esc 关闭列表
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(screen.queryByRole('navigation', { name: '已缓存文章列表' })).not.toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('页面缓存为空时显示占位文案', async () => {
    vi.useRealTimers();
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue(['dblog-abc123-pages']),
      open: vi.fn().mockResolvedValue({ keys: vi.fn().mockResolvedValue([]) }),
    });

    setOnline(false);
    render(<OfflineStatus />);
    await act(async () => {
      fireTLEvent.click(screen.getByRole('button', { name: /已缓存文章/ }));
    });
    expect(await screen.findByText('暂无可离线阅读的文章缓存。')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('无页面缓存（Cache Storage 不可用）时入口仍可展开并显示占位', async () => {
    vi.useRealTimers();
    vi.stubGlobal('caches', {
      keys: vi.fn().mockResolvedValue([]),
      open: vi.fn(),
    });

    setOnline(false);
    render(<OfflineStatus />);
    await act(async () => {
      fireTLEvent.click(screen.getByRole('button', { name: /已缓存文章/ }));
    });
    expect(await screen.findByText('暂无可离线阅读的文章缓存。')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
