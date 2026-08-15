import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackToTop } from './BackToTop';

class IntersectionObserverMock {
  static instances: IntersectionObserverMock[] = [];
  callback: IntersectionObserverCallback;
  observed: Element[] = [];

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    IntersectionObserverMock.instances.push(this);
  }

  observe(target: Element) {
    this.observed.push(target);
  }

  unobserve() {}
  disconnect() {}

  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting, target: this.observed[0], isVisible: isIntersecting } as unknown as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

beforeEach(() => {
  IntersectionObserverMock.instances = [];
  vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const getButton = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>('button[aria-label="返回顶部"]');

describe('BackToTop', () => {
  it('初始隐藏（哨兵相交时按钮不可见）', () => {
    const { container } = render(<BackToTop />);
    const button = getButton(container);
    expect(button).not.toBeNull();
    expect(button!.style.opacity).toBe('0');
    expect(button!.style.visibility).toBe('hidden');
  });

  it('滚动越过哨兵后显示按钮', () => {
    const { container } = render(<BackToTop />);
    act(() => {
      IntersectionObserverMock.instances[0].trigger(false);
    });
    const button = getButton(container)!;
    expect(button.style.opacity).toBe('1');
    expect(button.style.visibility).toBe('visible');
    expect(button.tabIndex).toBe(0);
  });

  it('回到顶部后隐藏按钮', () => {
    const { container } = render(<BackToTop />);
    act(() => {
      IntersectionObserverMock.instances[0].trigger(false);
    });
    act(() => {
      IntersectionObserverMock.instances[0].trigger(true);
    });
    const button = getButton(container)!;
    expect(button.style.opacity).toBe('0');
    expect(button.tabIndex).toBe(-1);
  });

  it('点击按钮滚动到顶部', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const { container } = render(<BackToTop />);
    act(() => {
      IntersectionObserverMock.instances[0].trigger(false);
    });
    await userEvent.click(getButton(container)!);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    scrollTo.mockRestore();
  });
});
