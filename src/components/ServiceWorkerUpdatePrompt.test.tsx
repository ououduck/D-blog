import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ServiceWorkerUpdatePrompt } from './ServiceWorkerUpdatePrompt';
import * as swModule from '@/registerServiceWorker';

const { subscribeToServiceWorker, getServiceWorkerState, applyServiceWorkerUpdate } = vi.hoisted(() => ({
  subscribeToServiceWorker: vi.fn(),
  getServiceWorkerState: vi.fn(),
  applyServiceWorkerUpdate: vi.fn(),
}));

vi.mock('@/registerServiceWorker', () => ({
  subscribeToServiceWorker,
  getServiceWorkerState,
  applyServiceWorkerUpdate,
}));

const sw = vi.mocked(swModule);

describe('ServiceWorkerUpdatePrompt', () => {
  beforeEach(() => {
    sw.getServiceWorkerState.mockReset();
    sw.subscribeToServiceWorker.mockReset();
    sw.applyServiceWorkerUpdate.mockReset();
    sw.subscribeToServiceWorker.mockReturnValue(() => {});
    // 清空上一个用例可能遗留的内联样式（组件会把 --service-worker-prompt-height 写到 <html> 上）
    document.documentElement.removeAttribute('style');
  });

  it('无更新时渲染空', () => {
    sw.getServiceWorkerState.mockReturnValue({ status: 'ready' });
    const { container } = render(<ServiceWorkerUpdatePrompt />);
    expect(container.firstChild).toBeNull();
  });

  it('检测到更新时显示提示', () => {
    sw.getServiceWorkerState.mockReturnValue({ status: 'update-available' });
    render(<ServiceWorkerUpdatePrompt />);
    expect(screen.getByText(/发现新版本/)).toBeInTheDocument();
  });

  it('点击立即更新调用 applyServiceWorkerUpdate', async () => {
    sw.getServiceWorkerState.mockReturnValue({ status: 'update-available' });
    render(<ServiceWorkerUpdatePrompt />);
    await userEvent.click(screen.getByRole('button', { name: '立即更新' }));
    expect(sw.applyServiceWorkerUpdate).toHaveBeenCalledTimes(1);
  });

  it('点击稍后隐藏提示（dismissed）', async () => {
    sw.getServiceWorkerState.mockReturnValue({ status: 'update-available' });
    render(<ServiceWorkerUpdatePrompt />);
    await userEvent.click(screen.getByRole('button', { name: '稍后' }));
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
});
