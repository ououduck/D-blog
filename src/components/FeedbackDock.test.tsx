import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FeedbackDock } from './FeedbackDock';
import { siteConfig } from '@config/site.config';

describe('FeedbackDock', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // useReducedMotion 依赖 matchMedia。
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

  it('默认收起：仅显示贴边的侧签按钮，面板移出可访问性树', () => {
    render(<FeedbackDock />);
    const toggle = screen.getByRole('button', { name: '打开反馈面板' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    // 收起态面板 aria-hidden + inert：标题与反馈按钮均不可达。
    expect(screen.queryByRole('dialog', { name: '我们需要您的反馈' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '前往反馈页' })).not.toBeInTheDocument();
  });

  it('点击侧签展开面板：显示标题与「前往反馈页」按钮（跳转反馈表单）', async () => {
    const user = userEvent.setup();
    render(<FeedbackDock />);
    await user.click(screen.getByRole('button', { name: '打开反馈面板' }));

    const dialog = await screen.findByRole('dialog', { name: '我们需要您的反馈' });
    expect(dialog).toHaveAttribute('aria-modal', 'false');
    expect(screen.getByRole('button', { name: '收起反馈面板' })).toHaveAttribute('aria-expanded', 'true');

    const feedbackLink = screen.getByRole('link', { name: '前往反馈页' });
    expect(feedbackLink).toHaveAttribute('href', siteConfig.feedback.url);
    expect(feedbackLink).toHaveAttribute('target', '_blank');
    expect(feedbackLink).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('再次点击侧签收起面板', async () => {
    const user = userEvent.setup();
    render(<FeedbackDock />);
    await user.click(screen.getByRole('button', { name: '打开反馈面板' }));
    await screen.findByRole('dialog', { name: '我们需要您的反馈' });

    await user.click(screen.getByRole('button', { name: '收起反馈面板' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '我们需要您的反馈' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: '打开反馈面板' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('Escape 键收起面板', async () => {
    const user = userEvent.setup();
    render(<FeedbackDock />);
    await user.click(screen.getByRole('button', { name: '打开反馈面板' }));
    await screen.findByRole('dialog', { name: '我们需要您的反馈' });

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '我们需要您的反馈' })).not.toBeInTheDocument();
    });
  });

  it('点击面板外部收起面板', async () => {
    const user = userEvent.setup();
    render(<FeedbackDock />);
    await user.click(screen.getByRole('button', { name: '打开反馈面板' }));
    await screen.findByRole('dialog', { name: '我们需要您的反馈' });

    await user.click(document.body);
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '我们需要您的反馈' })).not.toBeInTheDocument();
    });
  });
});
