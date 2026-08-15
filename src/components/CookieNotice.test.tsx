import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CookieNotice } from './CookieNotice';

const CONSENT_KEY = 'cookie-consent';

describe('CookieNotice', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('未同意过时显示提示', () => {
    render(<CookieNotice />);
    expect(screen.getByText('Cookie 使用')).toBeInTheDocument();
  });

  it('已同意过时不显示提示', () => {
    window.localStorage.setItem(CONSENT_KEY, 'accepted');
    const { container } = render(<CookieNotice />);
    expect(container.firstChild).toBeNull();
  });

  it('点击同意写入 localStorage 并隐藏', async () => {
    render(<CookieNotice />);
    await userEvent.click(screen.getByRole('button', { name: '同意' }));
    expect(window.localStorage.getItem(CONSENT_KEY)).toBe('accepted');
  });

  it('点击关闭仅隐藏不持久化同意', async () => {
    render(<CookieNotice />);
    await userEvent.click(screen.getByRole('button', { name: '关闭 Cookie 使用说明' }));
    expect(window.localStorage.getItem(CONSENT_KEY)).toBeNull();
  });

  it('localStorage 不可用时仍显示提示（不影响功能）', () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    render(<CookieNotice />);
    expect(screen.getByText('Cookie 使用')).toBeInTheDocument();
    getItem.mockRestore();
  });
});
