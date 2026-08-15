import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContentStatus, LoadingStatus } from './ContentStatus';

describe('ContentStatus', () => {
  it('渲染标题与描述', () => {
    render(<ContentStatus title="没有内容" description="这里是描述" />);
    expect(screen.getByText('没有内容')).toBeInTheDocument();
    expect(screen.getByText('这里是描述')).toBeInTheDocument();
  });

  it('error 变体带 alert 角色', () => {
    render(<ContentStatus title="加载失败" variant="error" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('empty 变体带 status 角色', () => {
    render(<ContentStatus title="空状态" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('提供 action 时点击触发回调', async () => {
    const onAction = vi.fn();
    render(<ContentStatus title="重试" actionLabel="重新加载" onAction={onAction} />);
    await userEvent.click(screen.getByRole('button', { name: '重新加载' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('未提供 onAction 时不渲染按钮', () => {
    render(<ContentStatus title="标题" actionLabel="按钮" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('LoadingStatus', () => {
  it('渲染 sr-only 标签', () => {
    render(<LoadingStatus label="正在加载" />);
    expect(screen.getByText('正在加载')).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });
});
