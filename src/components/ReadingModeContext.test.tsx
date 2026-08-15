import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import { ReadingModeProvider, useReadingMode } from './ReadingModeContext';

const Consumer = () => {
  const { isReadingMode, toggleReadingMode, exitReadingMode } = useReadingMode();
  return (
    <div>
      <span data-testid="mode">{isReadingMode ? 'on' : 'off'}</span>
      <button onClick={toggleReadingMode}>toggle</button>
      <button onClick={exitReadingMode}>exit</button>
    </div>
  );
};

const renderConsumer = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ReadingModeProvider>
        <Consumer />
      </ReadingModeProvider>
    </MemoryRouter>,
  );

describe('ReadingModeContext', () => {
  beforeEach(() => {
    delete document.documentElement.dataset.readingMode;
  });

  afterEach(() => {
    delete document.documentElement.dataset.readingMode;
  });

  it('初始为关闭状态', () => {
    renderConsumer();
    expect(screen.getByTestId('mode').textContent).toBe('off');
  });

  it('toggle 切换阅读模式并同步 documentElement 属性', async () => {
    renderConsumer();
    await userEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('mode').textContent).toBe('on');
    expect(document.documentElement.dataset.readingMode).toBe('true');

    await userEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('mode').textContent).toBe('off');
    expect(document.documentElement.dataset.readingMode).toBeUndefined();
  });

  it('exit 退出阅读模式', async () => {
    renderConsumer();
    await userEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('mode').textContent).toBe('on');
    await userEvent.click(screen.getByText('exit'));
    expect(screen.getByTestId('mode').textContent).toBe('off');
  });

  it('路由变化自动退出阅读模式', async () => {
    const NavConsumer = () => {
      const { isReadingMode, toggleReadingMode } = useReadingMode();
      const navigate = useNavigate();
      return (
        <div>
          <span data-testid="mode">{isReadingMode ? 'on' : 'off'}</span>
          <button onClick={toggleReadingMode}>toggle</button>
          <button onClick={() => navigate('/post/b')}>go-b</button>
        </div>
      );
    };
    render(
      <MemoryRouter initialEntries={['/post/a']} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ReadingModeProvider>
          <NavConsumer />
        </ReadingModeProvider>
      </MemoryRouter>,
    );
    await userEvent.click(screen.getByText('toggle'));
    expect(screen.getByTestId('mode').textContent).toBe('on');

    // 真实路由导航：locationKey 变化 → 自动退出阅读模式
    await userEvent.click(screen.getByText('go-b'));
    await act(async () => {});
    expect(screen.getByTestId('mode').textContent).toBe('off');
  });

  it('Provider 外使用 hook 抛错', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow('useReadingMode must be used within ReadingModeProvider');
    spy.mockRestore();
  });
});
