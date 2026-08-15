import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReadingModeToggle } from './ReadingModeToggle';

// 阅读模式上下文打桩：控制 isReadingMode 与 toggle 回调。
const mockToggle = vi.fn();
let mockIsReadingMode = false;
vi.mock('@/components/ReadingModeContext', () => ({
  useReadingMode: () => ({
    isReadingMode: mockIsReadingMode,
    toggleReadingMode: mockToggle,
  }),
}));

describe('ReadingModeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsReadingMode = false;
  });

  it('非阅读模式时渲染专注阅读按钮', () => {
    render(<ReadingModeToggle />);
    expect(screen.getByRole('button', { name: '进入专注阅读' })).toBeInTheDocument();
    expect(screen.getByText('专注阅读')).toBeInTheDocument();
  });

  it('阅读模式中不渲染按钮', () => {
    mockIsReadingMode = true;
    render(<ReadingModeToggle />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('点击触发 toggleReadingMode', async () => {
    const user = userEvent.setup();
    render(<ReadingModeToggle />);
    await user.click(screen.getByRole('button', { name: '进入专注阅读' }));
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });
});
