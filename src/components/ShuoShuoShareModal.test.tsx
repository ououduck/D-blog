import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShuoShuoShareModal } from './ShuoShuoShareModal';

vi.mock('@/utils/clipboard', () => ({
  copyTextToClipboard: vi.fn(async () => true),
}));

const baseProps = {
  url: 'https://blog.pldduck.com/shuoshuo/shuo-1?id=shuo-1',
  contentPreview: '今天天气不错',
  date: '2026-01-15',
  autoCopied: null,
};

describe('ShuoShuoShareModal', () => {
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

  it('打开时渲染标题与正文预览', () => {
    render(<ShuoShuoShareModal isOpen {...baseProps} onClose={vi.fn()} />);
    expect(screen.getByText('分享说说')).toBeInTheDocument();
    expect(screen.getByText('今天天气不错')).toBeInTheDocument();
  });

  it('关闭时不渲染', () => {
    render(<ShuoShuoShareModal isOpen={false} {...baseProps} onClose={vi.fn()} />);
    expect(screen.queryByText('分享说说')).not.toBeInTheDocument();
  });

  it('手动复制按钮复制链接', async () => {
    const user = userEvent.setup();
    const { copyTextToClipboard } = await import('@/utils/clipboard');
    render(<ShuoShuoShareModal isOpen {...baseProps} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '复制说说链接' }));
    expect(copyTextToClipboard).toHaveBeenCalledWith(baseProps.url);
  });

  it('autoCopied=true 时显示复制成功反馈', () => {
    render(<ShuoShuoShareModal isOpen {...baseProps} autoCopied={true} onClose={vi.fn()} />);
    expect(screen.getByText('复制成功')).toBeInTheDocument();
  });

  it('autoCopied=false 时显示自动复制失败提示', () => {
    render(<ShuoShuoShareModal isOpen {...baseProps} autoCopied={false} onClose={vi.fn()} />);
    expect(screen.getByText(/自动复制失败/)).toBeInTheDocument();
  });

  it('关闭按钮触发 onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShuoShuoShareModal isOpen {...baseProps} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: '关闭分享弹窗' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
