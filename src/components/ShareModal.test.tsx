import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShareModal } from './ShareModal';

// 复制打桩：聚焦弹层自身交互。
vi.mock('@/utils/clipboard', () => ({
  copyTextToClipboard: vi.fn(async () => true),
}));

const baseProps = {
  title: '测试文章',
  excerpt: '这是摘要',
  url: 'https://blog.pldduck.com/post/test',
};

describe('ShareModal', () => {
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

  it('打开时渲染标题与链接', () => {
    render(<ShareModal isOpen {...baseProps} onClose={vi.fn()} />);
    expect(screen.getByText('测试文章')).toBeInTheDocument();
    expect(screen.getByText('https://blog.pldduck.com/post/test')).toBeInTheDocument();
  });

  it('关闭时不渲染内容', () => {
    render(<ShareModal isOpen={false} {...baseProps} onClose={vi.fn()} />);
    expect(screen.queryByText('测试文章')).not.toBeInTheDocument();
  });

  it('复制链接按钮触发复制', async () => {
    const user = userEvent.setup();
    const { copyTextToClipboard } = await import('@/utils/clipboard');
    render(<ShareModal isOpen {...baseProps} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '仅复制文章链接' }));
    expect(copyTextToClipboard).toHaveBeenCalledWith('https://blog.pldduck.com/post/test');
  });

  it('关闭按钮触发 onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShareModal isOpen {...baseProps} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: '关闭分享弹窗' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
