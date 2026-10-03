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

  it('online 事件丢失时，页面重新可见（visibilitychange）会收起离线提示', () => {
    render(<OfflineStatus />);
    act(() => {
      fireEvent('offline');
    });
    expect(screen.getByText('当前处于离线模式，部分页面可能无法访问。')).toBeInTheDocument();

    // 网络已恢复，但事件没送达（后台冻结/部分内核不派发）：回到前台必须自愈。
    setOnline(true);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.queryByText('当前处于离线模式，部分页面可能无法访问。')).not.toBeInTheDocument();
    expect(screen.getByText('网络已恢复。')).toBeInTheDocument();
  });

  it('离线提示不会永久停留：离线期间按 navigator.onLine 定时复查', () => {
    render(<OfflineStatus />);
    act(() => {
      fireEvent('offline');
    });
    expect(screen.getByText('当前处于离线模式，部分页面可能无法访问。')).toBeInTheDocument();

    // 无任何事件送达，仅网络标志位变化。
    setOnline(true);
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByText('当前处于离线模式，部分页面可能无法访问。')).not.toBeInTheDocument();
    expect(screen.getByText('网络已恢复。')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2400);
    });
    expect(screen.queryByText('网络已恢复。')).not.toBeInTheDocument();
  });

  it('navigator.onLine 卡在离线时以真实请求探测确认恢复（系统连通性判定滞后）', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    setOnline(false);
    render(<OfflineStatus />);
    expect(screen.getByText('当前处于离线模式，部分页面可能无法访问。')).toBeInTheDocument();

    // 浏览器认为仍离线（不派发 online、onLine 也不翻转），但请求真的能通。
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('connectivity-probe');
    expect(screen.queryByText('当前处于离线模式，部分页面可能无法访问。')).not.toBeInTheDocument();
    expect(screen.getByText('网络已恢复。')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('探测请求失败时如实保持离线提示，不假装恢复', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    vi.stubGlobal('fetch', fetchMock);

    setOnline(false);
    render(<OfflineStatus />);
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(fetchMock).toHaveBeenCalled();
    expect(screen.getByText('当前处于离线模式，部分页面可能无法访问。')).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it('卸载后停止探测，不残留定时器与过期回调', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    setOnline(false);
    const { unmount } = render(<OfflineStatus />);
    unmount();
    await act(async () => {
      vi.advanceTimersByTime(30000);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it('状态未变化时不误弹「网络已恢复」（重复事件与可见性变化均去重）', () => {
    const { container } = render(<OfflineStatus />);
    act(() => {
      fireEvent('online');
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(screen.queryByText('网络已恢复。')).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
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
