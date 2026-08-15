import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('总页数 <= 1 时不渲染', () => {
    const { container } = render(<Pagination currentPage={1} totalPages={1} onPageChange={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('渲染页码按钮与上一页/下一页', () => {
    render(<Pagination currentPage={2} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '第 1 页' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '上一页' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '下一页' })).toBeInTheDocument();
  });

  it('当前页按钮标记 aria-current=page', () => {
    render(<Pagination currentPage={2} totalPages={3} onPageChange={vi.fn()} />);
    const current = screen.getByRole('button', { name: '第 2 页' });
    expect(current).toHaveAttribute('aria-current', 'page');
  });

  it('点击页码触发 onPageChange', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={3} onPageChange={onPageChange} />);
    await user.click(screen.getByRole('button', { name: '第 3 页' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('第一页时上一页禁用、最后一页时下一页禁用', () => {
    const { rerender } = render(<Pagination currentPage={1} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '上一页' })).toBeDisabled();

    rerender(<Pagination currentPage={3} totalPages={3} onPageChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '下一页' })).toBeDisabled();
  });

  it('大页码数渲染省略号', () => {
    render(<Pagination currentPage={10} totalPages={20} onPageChange={vi.fn()} />);
    expect(screen.getAllByText('…').length).toBeGreaterThan(0);
  });

  it('输入页码回车后跳转并夹取范围', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination currentPage={1} totalPages={5} onPageChange={onPageChange} />);
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, '9');
    await user.keyboard('{Enter}');
    // 9 超过总页数 5，夹取为 5
    expect(onPageChange).toHaveBeenCalledWith(5);
  });

  it('输入非法页码时不触发跳转并恢复显示', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(<Pagination currentPage={2} totalPages={5} onPageChange={onPageChange} />);
    const input = screen.getByRole('spinbutton');
    await user.clear(input);
    await user.type(input, 'abc');
    await user.keyboard('{Enter}');
    expect(onPageChange).not.toHaveBeenCalled();
    expect(input).toHaveValue(2);
  });
});
