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

import { useEffect, useRef, useState } from 'react';
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
  // rAF 合并帧：pointermove 频率可高于帧率，同帧内多次移动合并为一次
  // setPosition，避免卡片子树（含图片/链接）随每次光标移动高频重渲染。
  // pendingMoveRef 保存帧内最新坐标：帧执行时读取最新值（合并取末次而非首次）。
  const moveFrameRef = useRef(0);
  const pendingMoveRef = useRef({ x: 0, y: 0 });

  const handleMouseMove: React.MouseEventHandler<T> = (event) => {
    if (!enabled || !ref.current || isFocused) {
      return;
    }
    // 坐标先拷贝出合成事件：rAF 回调在下一帧执行，此时事件对象字段仍可用
    //（React 17+ 不再池化事件），但显式拷贝避免依赖事件生命周期。
    pendingMoveRef.current = { x: event.clientX, y: event.clientY };
    if (moveFrameRef.current) {
      return;
    }
    moveFrameRef.current = window.requestAnimationFrame(() => {
      moveFrameRef.current = 0;
      const element = ref.current;
      if (!element) {
        return;
      }
      const { x, y } = pendingMoveRef.current;
      const rect = element.getBoundingClientRect();
      setPosition({ x: x - rect.left, y: y - rect.top });
    });
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

  // 卸载时取消挂起的 rAF 帧，避免回调在卸载后 setState。
  useEffect(
    () => () => {
      if (moveFrameRef.current) {
        window.cancelAnimationFrame(moveFrameRef.current);
        moveFrameRef.current = 0;
      }
    },
    [],
  );

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
