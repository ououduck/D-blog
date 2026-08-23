import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackDock } from './FeedbackDock';
import { siteConfig } from '@config/site.config';

describe('FeedbackDock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // SlideModal 依赖 useMediaQuery（matchMedia）。
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
    document.documentElement.style.removeProperty('--feedback-dock-height');
  });

  it('渲染右下角反馈浮钮（带箭头）', () => {
    render(<FeedbackDock />);
    expect(screen.getByRole('button', { name: '打开反馈弹窗' })).toBeInTheDocument();
  });

  it('点击浮钮打开反馈弹窗，「立即反馈」跳转反馈表单', async () => {
    const user = userEvent.setup();
    render(<FeedbackDock />);
    await user.click(screen.getByRole('button', { name: '打开反馈弹窗' }));
    expect(screen.getByRole('dialog', { name: '我们需要您的反馈' })).toBeInTheDocument();
    const feedbackLink = screen.getByRole('link', { name: /前往反馈页/ });
    expect(feedbackLink).toHaveAttribute('href', siteConfig.feedback.url);
    expect(feedbackLink).toHaveAttribute('target', '_blank');
    expect(feedbackLink).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('点击关闭按钮关闭反馈弹窗', async () => {
    const user = userEvent.setup();
    render(<FeedbackDock />);
    await user.click(screen.getByRole('button', { name: '打开反馈弹窗' }));
    await user.click(screen.getByRole('button', { name: '关闭反馈弹窗' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '我们需要您的反馈' })).not.toBeInTheDocument();
    });
  });
});
