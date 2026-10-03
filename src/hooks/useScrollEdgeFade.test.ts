/**
 * useScrollEdgeFade 单测：用脱离文档流的容器手工注入 scrollWidth/clientWidth/scrollLeft，
 * 断言两侧渐隐只在「该侧确实还有被裁切内容」时为真。
 */
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useScrollEdgeFade } from './useScrollEdgeFade';

const createScroller = () => {
  const scroller = document.createElement('div');
  scroller.appendChild(document.createElement('div'));
  return scroller;
};

const renderFade = (scroller: HTMLElement) =>
  renderHook((ref: { current: HTMLElement | null }) => useScrollEdgeFade(ref), {
    initialProps: { current: scroller },
  });

const scrollTo = (scroller: HTMLElement, metrics: { scrollWidth: number; clientWidth: number; scrollLeft: number }) => {
  Object.entries(metrics).forEach(([key, value]) => {
    Object.defineProperty(scroller, key, { configurable: true, value });
  });
  act(() => {
    scroller.dispatchEvent(new Event('scroll'));
  });
};

describe('useScrollEdgeFade', () => {
  it('内容未溢出时两侧都不渐隐（首尾元素边缘不被啃成模糊带）', () => {
    const { result } = renderFade(createScroller());
    // 未注入尺寸时 scrollWidth/clientWidth 均为 0，等价于「内容放得下」。
    expect(result.current).toEqual({ fadeStart: false, fadeEnd: false });
  });

  it('溢出且停在最左端：只渐隐右侧', () => {
    const scroller = createScroller();
    const { result } = renderFade(scroller);
    scrollTo(scroller, { scrollWidth: 800, clientWidth: 400, scrollLeft: 0 });
    expect(result.current).toEqual({ fadeStart: false, fadeEnd: true });
  });

  it('滚动到中间：两侧都渐隐', () => {
    const scroller = createScroller();
    const { result } = renderFade(scroller);
    scrollTo(scroller, { scrollWidth: 800, clientWidth: 400, scrollLeft: 200 });
    expect(result.current).toEqual({ fadeStart: true, fadeEnd: true });
  });

  it('滚到最右端：只渐隐左侧', () => {
    const scroller = createScroller();
    const { result } = renderFade(scroller);
    scrollTo(scroller, { scrollWidth: 800, clientWidth: 400, scrollLeft: 400 });
    expect(result.current).toEqual({ fadeStart: true, fadeEnd: false });
  });

  it('分数像素的贴边不算裁切', () => {
    const scroller = createScroller();
    const { result } = renderFade(scroller);
    scrollTo(scroller, { scrollWidth: 401, clientWidth: 400, scrollLeft: 0.6 });
    expect(result.current).toEqual({ fadeStart: false, fadeEnd: false });
  });

  it('渐隐状态未变化时保持同一对象，不触发多余渲染', () => {
    const scroller = createScroller();
    const { result } = renderFade(scroller);
    scrollTo(scroller, { scrollWidth: 800, clientWidth: 400, scrollLeft: 100 });
    const before = result.current;
    scrollTo(scroller, { scrollWidth: 800, clientWidth: 400, scrollLeft: 150 });
    expect(result.current).toBe(before);
  });

  it('卸载后移除滚动监听', () => {
    const scroller = createScroller();
    const removeSpy = vi.spyOn(scroller, 'removeEventListener');
    const { unmount } = renderFade(scroller);
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('scroll', expect.any(Function));
    removeSpy.mockRestore();
  });

  it('ref 未指向元素时不绑定监听', () => {
    const ref = { current: null as HTMLElement | null };
    const { result } = renderHook(() => useScrollEdgeFade(ref));
    expect(result.current).toEqual({ fadeStart: false, fadeEnd: false });
  });
});
