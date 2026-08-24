import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FeedbackDock } from './FeedbackDock';
import { siteConfig } from '@config/site.config';

describe('FeedbackDock', () => {
  it('渲染贴边反馈侧签：竖向「反馈」文字，点击直达反馈表单', () => {
    render(<FeedbackDock />);
    const link = screen.getByRole('link', { name: '提交反馈与建议' });
    expect(link).toHaveAttribute('href', siteConfig.feedback.url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    // 竖向排版的「反馈」二字。
    expect(screen.getByText('反')).toBeInTheDocument();
    expect(screen.getByText('馈')).toBeInTheDocument();
  });
});
