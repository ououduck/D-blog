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

  describe('画廊模式', () => {
    const galleryImages = [
      { src: '/img/1.png', alt: '第一张', title: '图一说明' },
      { src: '/img/2.png', alt: '第二张' },
      { src: '/img/3.png', alt: '第三张' },
    ];

    it('按 initialIndex 定位并显示序号指示', () => {
      render(<ImageViewer src={null} images={galleryImages} initialIndex={1} onClose={vi.fn()} />);
      expect(screen.getByRole('img')).toHaveAttribute('src', '/img/2.png');
      expect(screen.getByText('2 / 3')).toBeInTheDocument();
    });

    it('方向键切换图片，边界处不再移动', async () => {
      const user = userEvent.setup();
      render(<ImageViewer src={null} images={galleryImages} initialIndex={0} onClose={vi.fn()} />);
      expect(screen.getByRole('button', { name: '上一张' })).toBeDisabled();

      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('img')).toHaveAttribute('src', '/img/2.png');
      await user.keyboard('{ArrowRight}');
      expect(screen.getByRole('img')).toHaveAttribute('src', '/img/3.png');
      expect(screen.getByRole('button', { name: '下一张' })).toBeDisabled();

      await user.keyboard('{ArrowLeft}');
      expect(screen.getByRole('img')).toHaveAttribute('src', '/img/2.png');
    });

    it('点击上一张/下一张按钮切换', async () => {
      const user = userEvent.setup();
      render(<ImageViewer src={null} images={galleryImages} initialIndex={1} onClose={vi.fn()} />);
      await user.click(screen.getByRole('button', { name: '下一张' }));
      expect(screen.getByRole('img')).toHaveAttribute('src', '/img/3.png');
      await user.click(screen.getByRole('button', { name: '上一张' }));
      expect(screen.getByRole('img')).toHaveAttribute('src', '/img/2.png');
    });

    it('优先展示 title 作为 caption，切换后随图片更新', async () => {
      const user = userEvent.setup();
      render(<ImageViewer src={null} images={galleryImages} initialIndex={0} onClose={vi.fn()} />);
      expect(screen.getByText('图一说明')).toBeInTheDocument();
      await user.keyboard('{ArrowRight}');
      // 第二张无 title：caption 回退为 alt
      expect(screen.getByText('第二张')).toBeInTheDocument();
    });

    it('单图模式不渲染序号与切换按钮', () => {
      render(<ImageViewer src="/img/solo.png" alt="唯一" onClose={vi.fn()} />);
      expect(screen.queryByText(/\/ 1/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '上一张' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: '下一张' })).not.toBeInTheDocument();
    });
  });
});
