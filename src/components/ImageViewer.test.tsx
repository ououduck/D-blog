import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

  /** 打开后唤出按需 UI（默认状态只有关闭按钮/图片/页码）。 */
  const showUi = () => {
    fireEvent.mouseMove(screen.getByRole('dialog'));
    expect(screen.getByTestId('viewer-toolbar')).toBeInTheDocument();
  };

  const galleryImages = [
    { src: '/img/1.png', alt: '第一张', title: '图一说明' },
    { src: '/img/2.png', alt: '第二张' },
    { src: '/img/3.png', alt: '第三张' },
  ];

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

  it('单图：不显示页码，工具栏默认隐藏（打开即只有图片）', () => {
    render(<ImageViewer src="/img/a.png" alt="唯一" onClose={vi.fn()} />);
    expect(screen.queryByText(/\/ 1/)).not.toBeInTheDocument();
    expect(screen.queryByTestId('viewer-toolbar')).not.toBeInTheDocument();
    // 旧版常驻操作说明已删除
    expect(screen.queryByText(/滚轮缩放|双指缩放|拖拽平移/)).not.toBeInTheDocument();
  });

  it('多图：显示轻量页码与上一张/下一张按钮（边界禁用）', () => {
    render(<ImageViewer src={null} images={galleryImages} initialIndex={0} onClose={vi.fn()} />);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上一张' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '下一张' })).toBeEnabled();
  });

  it('alt 不再作为视觉 caption（保留无障碍语义）', () => {
    render(<ImageViewer src="/img/a.png" alt="示例图片说明" onClose={vi.fn()} />);
    expect(screen.queryByText('示例图片说明')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('alt', '示例图片说明');
  });

  it('有真实 title 时显示轻量 caption，切换后随图片更新', async () => {
    const user = userEvent.setup();
    render(<ImageViewer src={null} images={galleryImages} initialIndex={0} onClose={vi.fn()} />);
    expect(screen.getByText('图一说明')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '下一张' }));
    // 第二张无 title：caption 完全不渲染
    expect(screen.queryByText('图一说明')).not.toBeInTheDocument();
    expect(screen.getByRole('img')).toHaveAttribute('src', '/img/2.png');
  });

  it('点击上一张/下一张按钮切换，边界处禁用', async () => {
    const user = userEvent.setup();
    render(<ImageViewer src={null} images={galleryImages} initialIndex={1} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '下一张' }));
    expect(screen.getByRole('img')).toHaveAttribute('src', '/img/3.png');
    expect(screen.getByText('3 / 3')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '上一张' }));
    expect(screen.getByRole('img')).toHaveAttribute('src', '/img/2.png');
  });

  it('键盘方向键切换图片', async () => {
    const user = userEvent.setup();
    render(<ImageViewer src={null} images={galleryImages} initialIndex={0} onClose={vi.fn()} />);
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('img')).toHaveAttribute('src', '/img/2.png');
    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('img')).toHaveAttribute('src', '/img/1.png');
  });

  describe('工具栏（按需出现）', () => {
    it('默认隐藏：鼠标移动后淡入，可放大并显示缩放比例', async () => {
      const user = userEvent.setup();
      render(<ImageViewer src="/img/a.png" onClose={vi.fn()} />);
      expect(screen.queryByTestId('viewer-toolbar')).not.toBeInTheDocument();

      showUi();
      await user.click(screen.getByRole('button', { name: '放大' }));
      expect(screen.getByText('135%')).toBeInTheDocument();
    });

    it('缩放比例按钮即 Reset：点击恢复 100%', async () => {
      const user = userEvent.setup();
      render(<ImageViewer src="/img/a.png" onClose={vi.fn()} />);
      showUi();
      await user.click(screen.getByRole('button', { name: '放大' }));
      expect(screen.getByText('135%')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: /点击恢复 100%/ }));
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('切换缩放按钮：100% ↔ 240% 明确档位', async () => {
      const user = userEvent.setup();
      render(<ImageViewer src="/img/a.png" onClose={vi.fn()} />);
      showUi();
      await user.click(screen.getByRole('button', { name: '切换缩放' }));
      expect(screen.getByText('240%')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: '切换缩放' }));
      expect(screen.getByText('100%')).toBeInTheDocument();
    });

    it('下载收进「更多」：点击后通过 fetch 下载', async () => {
      const user = userEvent.setup();
      render(<ImageViewer src="/img/download.png" alt="下载图" onClose={vi.fn()} />);
      showUi();
      await user.click(screen.getByRole('button', { name: '更多操作' }));
      await user.click(await screen.findByRole('menuitem', { name: '下载图片' }));
      expect(fetch).toHaveBeenCalledWith('/img/download.png', { mode: 'cors' });
    });

    it('UI 自动隐藏：约 2.5s 无操作淡出，交互重新唤出并重置计时', async () => {
      render(<ImageViewer src="/img/a.png" onClose={vi.fn()} uiHideDelayMs={60} />);
      expect(screen.queryByTestId('viewer-toolbar')).not.toBeInTheDocument();

      fireEvent.mouseMove(screen.getByRole('dialog'));
      expect(screen.getByTestId('viewer-toolbar')).toBeInTheDocument();

      await waitFor(
        () => {
          expect(screen.queryByTestId('viewer-toolbar')).not.toBeInTheDocument();
        },
        { timeout: 500 },
      );

      // 重新唤出并重置计时：60ms 内持续可见，交互刷新后依然可见
      fireEvent.mouseMove(screen.getByRole('dialog'));
      await waitFor(() => expect(screen.getByTestId('viewer-toolbar')).toBeInTheDocument());
      await new Promise((resolve) => setTimeout(resolve, 30));
      fireEvent.mouseMove(screen.getByRole('dialog'));
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(screen.getByTestId('viewer-toolbar')).toBeInTheDocument();
    });
  });

  it('移动端双击：只触发一次缩放切换（100% → 240%，不回跳）', () => {
    render(<ImageViewer src="/img/tap.png" alt="轻点图" onClose={vi.fn()} />);
    const img = screen.getByRole('img');
    const startProps = { cancelable: true, touches: [{ clientX: 120, clientY: 120 }] };
    // touchend 时 touches 应为空（手指已全部抬起），changedTouches 为抬起的手指
    const endProps = {
      cancelable: true,
      touches: [],
      changedTouches: [{ clientX: 120, clientY: 120 }],
    };

    // 第一次轻点：唤出 UI（不缩放）
    fireEvent.touchStart(img, startProps);
    fireEvent.touchEnd(img, endProps);
    // 第二次轻点落在双击窗口内：缩放切换到 240%
    fireEvent.touchStart(img, startProps);
    fireEvent.touchEnd(img, endProps);

    showUi();
    expect(screen.getByText('240%')).toBeInTheDocument();
  });

  it('加载失败：极简错误态 + 重试恢复', () => {
    render(<ImageViewer src="/img/broken.png" alt="坏图" onClose={vi.fn()} />);
    fireEvent.error(screen.getByRole('img'));
    expect(screen.getByText('图片加载失败')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '重试' }));
    expect(screen.queryByText('图片加载失败')).not.toBeInTheDocument();
  });

  describe('画廊相邻图片预加载', () => {
    it('定位中间图片时预加载前后各一张（±1）', () => {
      const created: Array<{ src: string }> = [];
      class FakeImage {
        public src = '';
        public onload: (() => void) | null = null;
        constructor() {
          created.push(this);
        }
      }
      vi.stubGlobal('Image', FakeImage);

      render(<ImageViewer src={null} images={galleryImages} initialIndex={1} onClose={vi.fn()} />);

      const srcs = created.map((image) => image.src);
      expect(srcs).toContain('/img/1.png');
      expect(srcs).toContain('/img/3.png');
      // 不一次性加载全部
      expect(srcs).not.toContain('/img/2.png'.replace('2', '2')); // 当前图由 <img> 正常加载
      expect(srcs.filter((src) => src === '/img/2.png')).toHaveLength(0);
    });

    it('边界图片只预加载存在的一侧', () => {
      const created: Array<{ src: string }> = [];
      class FakeImage {
        public src = '';
        public onload: (() => void) | null = null;
        constructor() {
          created.push(this);
        }
      }
      vi.stubGlobal('Image', FakeImage);

      render(<ImageViewer src={null} images={galleryImages} initialIndex={0} onClose={vi.fn()} />);
      const srcs = created.map((image) => image.src);
      expect(srcs).toEqual(['/img/2.png']);
    });
  });
});
