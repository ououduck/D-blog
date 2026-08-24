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

  it('组合被 Escape 取消（无 compositionend）后输入不再被永久忽略（无法输入回归）', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SearchField onValueChange={onValueChange} />);
    const input = screen.getByRole('searchbox') as HTMLInputElement;

    // 模拟输入法开始组合后按 Escape 取消：部分浏览器/IME 取消组合时不派发
    // compositionend，此前组合标记会永久卡 true，后续输入全部被忽略。
    input.focus();
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    await user.keyboard('{Escape}');
    await user.type(input, 'hello');
    expect(onValueChange).toHaveBeenLastCalledWith('hello');
    expect(input).toHaveValue('hello');
  });

  it('中英混输：组合确认后保留组合前的既有内容（event.data 只含本次组合文本，不得整体替换）', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SearchField onValueChange={onValueChange} />);
    const input = screen.getByRole('searchbox') as HTMLInputElement;

    // 先输入英文，再组合中文：compositionend 必须提交「英文 + 中文」的完整值，
    // 而不是用 event.data（"你好"）把已输入的 "react " 整体抹掉。
    await user.type(input, 'react ');
    expect(onValueChange).toHaveBeenLastCalledWith('react ');

    input.focus();
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    input.value = 'react nihao';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // 组合中间态（拼音）不触发 onValueChange
    expect(onValueChange).not.toHaveBeenLastCalledWith('react nihao');
    input.value = 'react 你好';
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '你好' }));
    expect(onValueChange).toHaveBeenLastCalledWith('react 你好');
  });

  it('连续多次中文组合时后一次不覆盖前一次（丢字回归）', () => {
    const onValueChange = vi.fn();
    render(<SearchField onValueChange={onValueChange} />);
    const input = screen.getByRole('searchbox') as HTMLInputElement;

    const confirmComposition = (pinyin: string, committed: string) => {
      input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
      input.value = `${input.value}${pinyin}`;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.value = `${input.value.slice(0, -pinyin.length)}${committed}`;
      input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: committed }));
    };

    // 第一次组合：你好
    confirmComposition('nihao', '你好');
    expect(onValueChange).toHaveBeenLastCalledWith('你好');
    // 第二次组合：世界 —— 必须保留「你好」前缀，而不是整体替换成「世界」
    confirmComposition('shijie', '世界');
    expect(onValueChange).toHaveBeenLastCalledWith('你好世界');
  });

  it('compositionend 时 DOM value 滞后（未含组合文本）用组合前快照重建完整值', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<SearchField onValueChange={onValueChange} />);
    const input = screen.getByRole('searchbox') as HTMLInputElement;

    await user.type(input, 'react ');
    expect(onValueChange).toHaveBeenLastCalledWith('react ');

    // 模拟部分浏览器 compositionend 派发时 DOM value 尚未提交组合文本：
    // compositionstart 后 value 仍是组合前的 "react "（滞后），data 为确认文本。
    input.focus();
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    // 不修改 input.value，模拟 DOM 滞后
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '你好' }));
    expect(onValueChange).toHaveBeenLastCalledWith('react 你好');
  });

  it('组合开始后长时间无活动自动复位，输入不被永久忽略（看门狗回归）', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    // 注入 20ms 短看门狗加速测试（真实定时器）。
    render(<SearchField onValueChange={onValueChange} compositionWatchdogMs={20} />);
    const input = screen.getByRole('searchbox') as HTMLInputElement;

    input.focus();
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }));
    // 组合期间一次输入活动：看门狗重新武装，正常输入不会被误判复位。
    input.dispatchEvent(new Event('input', { bubbles: true }));
    // 等待看门狗超时（组合被静默取消、无 compositionend）后正常输入：
    // 若组合标记未被复位，userEvent 的击键仍会被 onChange 拦截。
    await new Promise((resolve) => setTimeout(resolve, 80));
    await user.type(input, 'hello');
    expect(onValueChange).toHaveBeenLastCalledWith('hello');
    expect(input).toHaveValue('hello');
  });
});
