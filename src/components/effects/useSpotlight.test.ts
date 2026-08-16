import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { useSpotlight } from './useSpotlight';

const mockMatchMedia = (hoverCapable: boolean) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn((query: string) => ({
      // 仅 (hover: hover) and (pointer: fine) 按参数返回；prefers-reduced-motion 恒 false。
      matches: query.includes('hover') ? hoverCapable : false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
};

describe('useSpotlight', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('支持 hover + 精细指针时启用，鼠标移入设置光斑透明度', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useSpotlight({ activeOpacity: 0.5 }));
    expect(result.current.enabled).toBe(true);
    expect(result.current.layerStyle.opacity).toBe(0);

    act(() => {
      fireEvent.mouseEnter(document.body);
      result.current.bind.onMouseEnter(null as never);
    });
    expect(result.current.layerStyle.opacity).toBe(0.5);

    act(() => {
      result.current.bind.onMouseLeave(null as never);
    });
    expect(result.current.layerStyle.opacity).toBe(0);
  });

  it('鼠标移动更新光斑位置（相对元素坐标）', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useSpotlight());
    const element = document.createElement('div');
    element.getBoundingClientRect = () => ({ left: 10, top: 20, width: 100, height: 50 }) as DOMRect;
    (result.current.bind.ref as { current: HTMLElement | null }).current = element;

    act(() => {
      result.current.bind.onMouseEnter(null as never);
      result.current.bind.onMouseMove({ clientX: 60, clientY: 40 } as React.MouseEvent<HTMLDivElement>);
    });
    expect(result.current.layerStyle['--spotlight-x']).toBe('50px');
    expect(result.current.layerStyle['--spotlight-y']).toBe('20px');
  });

  it('触屏/不支持 hover 时禁用（enabled=false）', () => {
    mockMatchMedia(false); // (hover: hover) and (pointer: fine) 不匹配
    const { result } = renderHook(() => useSpotlight());
    expect(result.current.enabled).toBe(false);
  });

  it('聚焦时显示光斑、失焦清除', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useSpotlight({ activeOpacity: 0.6 }));
    act(() => {
      result.current.bind.onFocus(null as never);
    });
    expect(result.current.layerStyle.opacity).toBe(0.6);
    act(() => {
      result.current.bind.onBlur(null as never);
    });
    expect(result.current.layerStyle.opacity).toBe(0);
  });
});
