import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SlideModal } from './SlideModal';

const renderModal = (isOpen: boolean, onClose = vi.fn()) =>
  render(
    <SlideModal isOpen={isOpen} onClose={onClose} ariaLabelledby="test-title">
      <div>
        <h3 id="test-title">弹层内容</h3>
        <p>这是弹层正文</p>
      </div>
    </SlideModal>,
  );

describe('SlideModal', () => {
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
  });

  it('打开时渲染对话框与内容', () => {
    renderModal(true);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('弹层内容')).toBeInTheDocument();
    expect(screen.getByText('这是弹层正文')).toBeInTheDocument();
  });

  it('关闭时不渲染内容', () => {
    renderModal(false);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('点击遮罩触发 onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderModal(true, onClose);
    // 遮罩是 fixed 背景层，通过 data 属性无法直接定位，用容器内第一个固定层
    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50');
    expect(backdrop).not.toBeNull();
    await user.click(backdrop as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('关闭后（动画完成）卸载内容', async () => {
    const onClose = vi.fn();
    const { rerender } = renderModal(true, onClose);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    rerender(
      <SlideModal isOpen={false} onClose={onClose} ariaLabelledby="test-title">
        <div>
          <h3 id="test-title">弹层内容</h3>
          <p>这是弹层正文</p>
        </div>
      </SlideModal>,
    );
    // 退出动画期间内容可能保留；最终应卸载
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText('这是弹层正文')).not.toBeInTheDocument();
  });
});
