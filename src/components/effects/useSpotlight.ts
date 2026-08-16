/**
 * 参考 react-bits「SpotlightCard」的指针跟随高光逻辑：
 * 鼠标在元素内移动时记录光标位置，配合 <SpotlightLayer /> 渲染一层
 * 柔和径向渐变光斑。
 *
 * 与 react-bits 原版的差异（适配 D-blog 的编辑风设计）：
 * - 光斑颜色由 CSS 变量驱动（.editorial-spotlight），亮/暗主题自动适配，
 *   无需在 JS 里感知主题；
 * - 仅在支持 hover + 精细指针的设备上启用（触屏不会有“悬停粘滞”光斑）；
 * - 尊重 prefers-reduced-motion：直接禁用整个效果（纯装饰）。
 */

import { useRef, useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export interface SpotlightLayerStyle extends React.CSSProperties {
  '--spotlight-x'?: string;
  '--spotlight-y'?: string;
}

interface UseSpotlightOptions {
  /** 光斑最大不透明度（0~1）。 */
  activeOpacity?: number;
}

export interface SpotlightBind<T extends HTMLElement = HTMLElement> {
  ref: React.RefObject<T | null>;
  onMouseMove: React.MouseEventHandler<T>;
  onMouseEnter: React.MouseEventHandler<T>;
  onMouseLeave: React.MouseEventHandler<T>;
  onFocus: React.FocusEventHandler<T>;
  onBlur: React.FocusEventHandler<T>;
}

export const useSpotlight = <T extends HTMLElement = HTMLDivElement>({
  activeOpacity = 0.6,
}: UseSpotlightOptions = {}): {
  bind: SpotlightBind<T>;
  layerStyle: SpotlightLayerStyle;
  enabled: boolean;
} => {
  const ref = useRef<T | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);
  const hoverCapable = useMediaQuery('(hover: hover) and (pointer: fine)', false);
  const reducedMotion = useReducedMotion();
  const enabled = hoverCapable && !reducedMotion;

  const handleMouseMove: React.MouseEventHandler<T> = (event) => {
    if (!enabled || !ref.current || isFocused) {
      return;
    }

    const rect = ref.current.getBoundingClientRect();
    setPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
  };

  const handleMouseEnter: React.MouseEventHandler<T> = () => {
    if (enabled) {
      setOpacity(activeOpacity);
    }
  };

  const handleMouseLeave: React.MouseEventHandler<T> = () => {
    setOpacity(0);
  };

  const handleFocus: React.FocusEventHandler<T> = () => {
    if (enabled) {
      setIsFocused(true);
      setOpacity(activeOpacity);
    }
  };

  const handleBlur: React.FocusEventHandler<T> = () => {
    setIsFocused(false);
    setOpacity(0);
  };

  return {
    bind: {
      ref,
      onMouseMove: handleMouseMove,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
      onFocus: handleFocus,
      onBlur: handleBlur,
    },
    layerStyle: {
      '--spotlight-x': `${position.x}px`,
      '--spotlight-y': `${position.y}px`,
      opacity,
    },
    enabled,
  };
};
