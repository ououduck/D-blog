import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useResetTimer } from './useResetTimer';

describe('useResetTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('schedule 在 delayMs 后执行回调', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useResetTimer());
    act(() => {
      result.current.schedule(callback, 2000);
    });
    expect(callback).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('重复 schedule 重置计时（连续操作不提前复位）', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useResetTimer());
    act(() => {
      result.current.schedule(callback, 2000);
      vi.advanceTimersByTime(1500);
      result.current.schedule(callback, 2000);
    });
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    // 第一次 1500ms 后重新计时，此时距离第二次调度仅 1500ms，不应触发。
    expect(callback).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('clear 取消未触发的定时器（幂等）', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useResetTimer());
    act(() => {
      result.current.schedule(callback, 2000);
      result.current.clear();
      result.current.clear();
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(callback).not.toHaveBeenCalled();
  });

  it('卸载时自动清理定时器', () => {
    const callback = vi.fn();
    const { result, unmount } = renderHook(() => useResetTimer());
    act(() => {
      result.current.schedule(callback, 2000);
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(callback).not.toHaveBeenCalled();
  });
});
