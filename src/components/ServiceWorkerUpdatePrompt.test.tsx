import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceWorkerUpdatePrompt } from './ServiceWorkerUpdatePrompt';
import * as swModule from '@/registerServiceWorker';

const {
  subscribeToServiceWorker,
  getServiceWorkerState,
  applyServiceWorkerUpdate,
  subscribeToUpdateApplied,
  consumeReloadScrollRestore,
} = vi.hoisted(() => ({
  subscribeToServiceWorker: vi.fn(),
  getServiceWorkerState: vi.fn(),
  applyServiceWorkerUpdate: vi.fn(),
  subscribeToUpdateApplied: vi.fn(),
  consumeReloadScrollRestore: vi.fn(),
}));

vi.mock('@/registerServiceWorker', () => ({
  subscribeToServiceWorker,
  getServiceWorkerState,
  applyServiceWorkerUpdate,
  subscribeToUpdateApplied,
  consumeReloadScrollRestore,
}));

const sw = vi.mocked(swModule);

describe('ServiceWorkerUpdatePrompt', () => {
  beforeEach(() => {
    sw.getServiceWorkerState.mockReset();
    sw.subscribeToServiceWorker.mockReset();
    sw.applyServiceWorkerUpdate.mockReset();
    sw.subscribeToUpdateApplied.mockReset();
    sw.consumeReloadScrollRestore.mockReset();
    sw.subscribeToServiceWorker.mockReturnValue(() => {});
    sw.subscribeToUpdateApplied.mockReturnValue(() => {});
    sessionStorage.clear();
    // 清空上一个用例可能遗留的内联样式（组件会把 --service-worker-prompt-height 写到 <html> 上）
    document.documentElement.removeAttribute('style');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('无更新时渲染空', () => {
    sw.getServiceWorkerState.mockReturnValue({ status: 'ready' });
    const { container } = render(<ServiceWorkerUpdatePrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('检测到更新时显示提示文案（网站内容已更新）', () => {
    sw.getServiceWorkerState.mockReturnValue({ status: 'update-available' });
    render(<ServiceWorkerUpdatePrompt />);
    expect(screen.getByText(/发现新版本，网站内容已更新/)).toBeInTheDocument();
  });

  it('更新失败时显示失败反馈', () => {
    sw.getServiceWorkerState.mockReturnValue({ status: 'update-available', updateFailed: true });
    render(<ServiceWorkerUpdatePrompt />);
    expect(screen.getByText(/更新失败/)).toBeInTheDocument();
    // 失败后仍可重试
    expect(screen.getByRole('button', { name: '立即更新' })).toBeInTheDocument();
  });

  it('点击立即更新调用 applyServiceWorkerUpdate', async () => {
    sw.getServiceWorkerState.mockReturnValue({ status: 'update-available' });
    render(<ServiceWorkerUpdatePrompt />);
    await userEvent.click(screen.getByRole('button', { name: '立即更新' }));
    expect(sw.applyServiceWorkerUpdate).toHaveBeenCalledTimes(1);
  });

  it('点击稍后写入抑制时间戳并隐藏提示；窗口内重新触发不再弹出', async () => {
    sw.getServiceWorkerState.mockReturnValue({ status: 'update-available' });
    render(<ServiceWorkerUpdatePrompt />);
    await userEvent.click(screen.getByRole('button', { name: '稍后' }));
    expect(screen.queryByText(/发现新版本/)).not.toBeInTheDocument();
    expect(Number.parseInt(sessionStorage.getItem('dblog:sw-prompt-dismissed-at') ?? '', 10)).toBeGreaterThan(0);

    // 订阅回调再次下发 update-available：抑制窗口内不重新弹出
    const listener = sw.subscribeToServiceWorker.mock.calls[0][0];
    act(() => {
      listener({ status: 'update-available' });
    });
    expect(screen.queryByText(/发现新版本/)).not.toBeInTheDocument();
  });

  it('订阅状态变更：迟到到达的 update-available 显示提示', () => {
    sw.getServiceWorkerState.mockReturnValue({ status: 'idle' });
    render(<ServiceWorkerUpdatePrompt />);
    expect(screen.queryByText(/发现新版本/)).not.toBeInTheDocument();

    const listener = sw.subscribeToServiceWorker.mock.calls[0][0];
    // 订阅回调触发的是 React state 更新，需在 act 中执行以便同步 flush
    act(() => {
      listener({ status: 'update-available' });
    });
    expect(screen.getByText(/发现新版本/)).toBeInTheDocument();
  });

  it('其他标签页应用更新后显示轻量提示（不自动刷新）', async () => {
    sw.getServiceWorkerState.mockReturnValue({ status: 'ready' });
    render(<ServiceWorkerUpdatePrompt />);
    expect(screen.queryByText(/其他标签页更新/)).not.toBeInTheDocument();

    const onUpdateApplied = sw.subscribeToUpdateApplied.mock.calls[0][0];
    act(() => {
      onUpdateApplied();
    });
    expect(screen.getByText(/网站内容已在其他标签页更新/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '刷新查看' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '忽略更新提示' })).toBeInTheDocument();
  });

  it('挂载时消费刷新滚动位置恢复记录', () => {
    sw.getServiceWorkerState.mockReturnValue({ status: 'ready' });
    render(<ServiceWorkerUpdatePrompt />);
    expect(sw.consumeReloadScrollRestore).toHaveBeenCalledTimes(1);
  });
});
