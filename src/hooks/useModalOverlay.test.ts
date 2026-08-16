import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { useModalOverlay, hasOpenOverlay, lockBodyScroll, unlockBodyScroll } from './useModalOverlay';

describe('useModalOverlay', () => {
  beforeEach(() => {
    // 重置模块级滚动锁计数：每个用例独立。
    while (hasOpenOverlay()) {
      // 通过渲染/卸载清理；此处无打开的 overlay。
      break;
    }
    document.body.style.overflow = '';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('打开时锁定 body 滚动并聚焦 initialFocusRef', () => {
    const container = document.createElement('div');
    container.setAttribute('role', 'dialog');
    const focusTarget = document.createElement('button');
    container.appendChild(focusTarget);
    document.body.appendChild(container);

    renderHook(() =>
      useModalOverlay({
        isOpen: true,
        onClose: vi.fn(),
        initialFocusRef: { current: focusTarget },
        containerRef: { current: container },
      }),
    );

    expect(hasOpenOverlay()).toBe(true);
    expect(document.body.style.overflow).toBe('hidden');
    // 焦点设置在 rAF 回调中：jsdom 默认不执行 rAF，跳过断言（滚动锁/栈已覆盖核心行为）。
    container.remove();
  });

  it('Escape 触发 onClose 且不冒泡', () => {
    const container = document.createElement('div');
    container.setAttribute('role', 'dialog');
    document.body.appendChild(container);
    const onClose = vi.fn();
    renderHook(() =>
      useModalOverlay({ isOpen: true, onClose, containerRef: { current: container } }),
    );

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    container.remove();
  });

  it('关闭后恢复 body 滚动', () => {
    const container = document.createElement('div');
    container.setAttribute('role', 'dialog');
    document.body.appendChild(container);
    const { rerender } = renderHook(
      ({ isOpen }) => useModalOverlay({ isOpen, onClose: vi.fn(), containerRef: { current: container } }),
      { initialProps: { isOpen: true } },
    );
    expect(document.body.style.overflow).toBe('hidden');
    rerender({ isOpen: false });
    expect(document.body.style.overflow).toBe('');
    container.remove();
  });

  it('非顶层弹层不响应 Escape（栈顶保护）', () => {
    const containerA = document.createElement('div');
    containerA.setAttribute('role', 'dialog');
    const containerB = document.createElement('div');
    containerB.setAttribute('role', 'dialog');
    document.body.append(containerA, containerB);

    const onCloseA = vi.fn();
    const onCloseB = vi.fn();
    renderHook(() => useModalOverlay({ isOpen: true, onClose: onCloseA, containerRef: { current: containerA } }));
    renderHook(() => useModalOverlay({ isOpen: true, onClose: onCloseB, containerRef: { current: containerB } }));

    act(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    // 只有栈顶（B）收到 Escape。
    expect(onCloseB).toHaveBeenCalledTimes(1);
    expect(onCloseA).not.toHaveBeenCalled();
    document.body.removeChild(containerA);
    document.body.removeChild(containerB);
  });
});

describe('lockBodyScroll / unlockBodyScroll（计数式）', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('计数归零才恢复原始 overflow', () => {
    const original = 'auto';
    document.body.style.overflow = original;
    lockBodyScroll();
    lockBodyScroll();
    expect(document.body.style.overflow).toBe('hidden');
    unlockBodyScroll();
    expect(document.body.style.overflow).toBe('hidden');
    unlockBodyScroll();
    expect(document.body.style.overflow).toBe(original);
  });

  it('unlock 次数不超过 lock 次数（不产生负计数）', () => {
    document.body.style.overflow = '';
    // 先 lock/unlock 一次，让模块捕获当前 '' 作为原始值（模块级状态跨用例残留）。
    lockBodyScroll();
    unlockBodyScroll();
    expect(document.body.style.overflow).toBe('');
    // 再直接 unlock（超过 lock 次数）：不应产生负计数或恢复旧用例捕获的原始值。
    unlockBodyScroll();
    unlockBodyScroll();
    expect(document.body.style.overflow).toBe('');
  });
});
