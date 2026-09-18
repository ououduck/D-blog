import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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

  afterEach(() => {
    vi.restoreAllMocks();
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
    await user.click(screen.getByRole('button', { name: '仅复制链接' }));
    expect(copyTextToClipboard).toHaveBeenCalledWith('https://blog.pldduck.com/post/test');
    expect(await screen.findByText('复制成功')).toBeInTheDocument();
  });

  it('复制完整分享包含标题/摘要/链接', async () => {
    const user = userEvent.setup();
    const { copyTextToClipboard } = await import('@/utils/clipboard');
    render(<ShareModal isOpen {...baseProps} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '复制标题、简介和链接' }));
    expect(copyTextToClipboard).toHaveBeenCalledWith(
      '标题：测试文章\n简介：这是摘要\n链接：https://blog.pldduck.com/post/test',
    );
  });

  it('复制失败时如实反馈', async () => {
    const user = userEvent.setup();
    const { copyTextToClipboard } = await import('@/utils/clipboard');
    vi.mocked(copyTextToClipboard).mockResolvedValueOnce(false);
    render(<ShareModal isOpen {...baseProps} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '仅复制链接' }));
    expect(await screen.findByText('复制失败，请手动复制链接。')).toBeInTheDocument();
  });

  it('提供社交平台分享意图链接（编码后的中文标题与 URL）', () => {
    render(<ShareModal isOpen {...baseProps} onClose={vi.fn()} />);
    const xLink = screen.getByRole('link', { name: '分享到 X（推特）' });
    expect(xLink).toHaveAttribute(
      'href',
      `https://twitter.com/intent/tweet?text=${encodeURIComponent('测试文章')}&url=${encodeURIComponent(baseProps.url)}`,
    );
    expect(xLink).toHaveAttribute('target', '_blank');
    expect(xLink).toHaveAttribute('rel', 'noopener noreferrer');

    const tgLink = screen.getByRole('link', { name: '分享到 Telegram' });
    expect(tgLink).toHaveAttribute(
      'href',
      `https://t.me/share/url?url=${encodeURIComponent(baseProps.url)}&text=${encodeURIComponent('测试文章')}`,
    );

    const qzoneLink = screen.getByRole('link', { name: '分享到 QQ 空间' });
    expect(qzoneLink).toHaveAttribute('href', expect.stringContaining('sns.qzone.qq.com'));
  });

  it('浏览器支持 Web Share API 时显示系统分享按钮并调用', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    const user = userEvent.setup();
    render(<ShareModal isOpen {...baseProps} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: '使用系统分享' }));
    expect(share).toHaveBeenCalledWith({
      title: '测试文章',
      text: '这是摘要',
      url: 'https://blog.pldduck.com/post/test',
    });
    Reflect.deleteProperty(navigator, 'share');
  });

  it('微信面板懒加载渲染二维码（uqr SVG）', async () => {
    const user = userEvent.setup();
    render(<ShareModal isOpen {...baseProps} onClose={vi.fn()} />);
    expect(screen.queryByRole('img', { name: '当前链接的微信分享二维码' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '微信扫码分享' }));
    await waitFor(() => {
      const qr = screen.getByRole('img', { name: '当前链接的微信分享二维码' });
      expect(qr).toHaveAttribute('src', expect.stringContaining('data:image/svg+xml'));
    });
  });

  it('说说模式：autoCopied=true 显示自动复制成功，迟到结果不覆盖手动状态', async () => {
    const user = userEvent.setup();
    const { copyTextToClipboard } = await import('@/utils/clipboard');
    const { rerender } = render(
      <ShareModal isOpen {...baseProps} onClose={vi.fn()} autoCopied={null} contentLabel="这条说说" />,
    );
    expect(screen.getByText('这条说说')).toBeInTheDocument();

    // 打开后用户先手动复制
    await user.click(screen.getByRole('button', { name: '仅复制链接' }));
    // 迟到的 autoCopied=false（竞态）不得覆盖成功状态
    rerender(<ShareModal isOpen {...baseProps} onClose={vi.fn()} autoCopied={false} contentLabel="这条说说" />);
    expect(screen.getByText('复制成功')).toBeInTheDocument();
    expect(copyTextToClipboard).toHaveBeenCalled();
  });

  it('说说模式：autoCopied=false 且未手动复制时显示失败提示', () => {
    render(<ShareModal isOpen {...baseProps} onClose={vi.fn()} autoCopied={false} contentLabel="这条说说" />);
    expect(screen.getByText('自动复制失败，请点击下方按钮手动复制。')).toBeInTheDocument();
  });

  it('关闭按钮触发 onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ShareModal isOpen {...baseProps} onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: '关闭分享弹窗' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
