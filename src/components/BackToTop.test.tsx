import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BackToTop } from './BackToTop';

const getButton = (container: HTMLElement) =>
  container.querySelector<HTMLButtonElement>('button[aria-label="返回顶部"]');

describe('BackToTop', () => {
  it('始终渲染并保持可见、可聚焦（常驻回归）', () => {
    const { container } = render(<BackToTop />);
    const button = getButton(container);
    expect(button).not.toBeNull();
    // 常驻按钮不再通过 IntersectionObserver 隐藏：不设置 visibility:hidden，
    // tabIndex 保持 0 可被键盘聚焦。
    expect(button!.style.visibility).not.toBe('hidden');
    expect(button!.tabIndex).toBe(0);
  });

  it('点击按钮滚动到顶部', async () => {
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
    const { container } = render(<BackToTop />);
    await userEvent.click(getButton(container)!);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    scrollTo.mockRestore();
  });
});
