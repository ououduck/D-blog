import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageViewer } from './ImageViewer';

describe('ImageViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    // 下载路径依赖的浏览器 API 打桩
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(['fake'], { type: 'image/png' })),
      }),
    );
    Object.defineProperty(URL, 'createObjectURL', { writable: true, value: vi.fn(() => 'blob:mock') });
    Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: vi.fn() });
    vi.spyOn(HTMLElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('src 存在时渲染图片预览对话框', () => {
    render(<ImageViewer src="/img/photo.png" alt="照片" onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', '/img/photo.png');
  });

  it('src 为 null 时不渲染', () => {
    render(<ImageViewer src={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('点击关闭按钮触发 onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ImageViewer src="/img/a.png" onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: '关闭图片预览' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('渲染缩放/下载等工具栏按钮', () => {
    render(<ImageViewer src="/img/a.png" alt="图" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: '放大' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '缩小' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下载' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重置' })).toBeInTheDocument();
  });

  it('点击下载通过 fetch 拉取并触发下载', async () => {
    const user = userEvent.setup();
    render(<ImageViewer src="/img/download.png" alt="下载图" onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '下载' }));
    expect(fetch).toHaveBeenCalledWith('/img/download.png', { mode: 'cors' });
  });

  it('渲染 alt 描述文本', () => {
    render(<ImageViewer src="/img/a.png" alt="示例图片说明" onClose={vi.fn()} />);
    expect(screen.getByText('示例图片说明')).toBeInTheDocument();
  });
});
