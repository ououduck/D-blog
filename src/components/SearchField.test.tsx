import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchField } from './SearchField';

describe('SearchField', () => {
  it('渲染搜索输入框并透传 placeholder', () => {
    render(<SearchField placeholder="搜索文章…" />);
    expect(screen.getByRole('searchbox')).toHaveAttribute('placeholder', '搜索文章…');
  });

  it('输入触发 onValueChange', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SearchField onValueChange={onValueChange} />);
    await user.type(screen.getByRole('searchbox'), 'react');
    expect(onValueChange).toHaveBeenLastCalledWith('react');
  });

  it('有值且提供 onClear 时显示清除按钮', async () => {
    const user = userEvent.setup();
    const onClear = vi.fn();
    render(<SearchField value="测试" onClear={onClear} />);
    await user.click(screen.getByRole('button', { name: '清除搜索' }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it('无值时隐藏清除按钮', () => {
    const { container } = render(<SearchField value="" onClear={vi.fn()} />);
    expect(container.querySelector('button')).toBeNull();
  });

  it('未提供 onClear 时不渲染清除按钮', () => {
    const { container } = render(<SearchField value="有值" />);
    expect(container.querySelector('button')).toBeNull();
  });

  it('禁用状态下不渲染清除按钮', () => {
    const { container } = render(<SearchField value="有值" onClear={vi.fn()} disabled />);
    expect(container.querySelector('button')).toBeNull();
    expect(screen.getByRole('searchbox')).toBeDisabled();
  });

  it('渲染 endAction 内容', () => {
    render(<SearchField value="" endAction={<button type="button">搜索按钮</button>} />);
    expect(screen.getByRole('button', { name: '搜索按钮' })).toBeInTheDocument();
  });

  it('IME 组合期间不触发 onValueChange，组合结束补发完整值', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SearchField onValueChange={onValueChange} />);

    // 模拟中文输入法：compositionstart → 输入拼音中间态 → compositionend
    const input = screen.getByRole('searchbox') as HTMLInputElement;
    await user.type(input, 'n', {
      skipClick: true,
    });
    // 手动派发 composition 事件序列（userEvent 不模拟 IME）
    input.focus();
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    input.value = 'nihao';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // 组合期间的 onChange 应被忽略
    expect(onValueChange).not.toHaveBeenCalledWith('nihao');
    input.value = '你好';
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '你好' }));
    expect(onValueChange).toHaveBeenLastCalledWith('你好');
  });
});
