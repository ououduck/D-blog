import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IssueSubscriptionCard, ISSUE_SUBSCRIPTION_URL } from './IssueSubscriptionCard';

describe('IssueSubscriptionCard', () => {
  it('渲染标题与订阅说明', () => {
    render(<IssueSubscriptionCard />);
    expect(screen.getByText('订阅新文章提醒')).toBeInTheDocument();
    expect(screen.getByText(/在 GitHub Issue 中点击 Subscribe/)).toBeInTheDocument();
  });

  it('订阅链接指向 Issue 并带安全属性', () => {
    render(<IssueSubscriptionCard />);
    const link = screen.getByRole('link', { name: /前往订阅/ });
    expect(link).toHaveAttribute('href', ISSUE_SUBSCRIPTION_URL);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
