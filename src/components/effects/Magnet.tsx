/**
 * 参考 react-bits「Magnet」的磁吸效果：元素在光标接近时向光标方向轻微
 * 平移，离开后回弹。适配 D-blog：
 * - 仅在支持 hover + 精细指针的设备上启用（触屏无意义）；
 * - 尊重 prefers-reduced-motion：整体禁用；
 * - 位移幅度默认更克制（magnetStrength 更大），保持编辑风的内敛观感。
 */

import React, { useEffect, useRef, useState } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface MagnetProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onMouseMove'> {
  /** 感应范围（以元素边缘向外扩展的像素数）。 */
  padding?: number;
  disabled?: boolean;
  /** 磁吸强度：数值越大，光标拉动位移越小。 */
  magnetStrength?: number;
  /** 激活状态过渡（进入磁吸范围）。 */
  activeTransition?: string;
  /** 非激活状态过渡（回弹）。 */
  inactiveTransition?: string;
  wrapperClassName?: string;
  innerClassName?: string;
}

export const Magnet: React.FC<MagnetProps> = ({
  children,
  padding = 80,
  disabled = false,
  magnetStrength = 5,
  activeTransition = 'transform 0.25s ease-out',
  inactiveTransition = 'transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
  wrapperClassName = '',
  innerClassName = '',
  ...props
}) => {
  const [isActive, setIsActive] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const magnetRef = useRef<HTMLDivElement | null>(null);
  const hoverCapable = useMediaQuery('(hover: hover) and (pointer: fine)', false);
  const reducedMotion = useReducedMotion();
  const effectiveDisabled = disabled || !hoverCapable || reducedMotion;

  useEffect(() => {
    if (effectiveDisabled) {
      setPosition({ x: 0, y: 0 });
      setIsActive(false);
      return;
    }

    let frame = 0;
    const reset = () => {
      // 取消挂起的 rAF：光标快速移出时，最后一次 mousemove 已挂起帧，
      // 若不清除，reset 清 0 后挂起回调按旧坐标重新置非零位移，元素保持偏移。
      if (frame) {
        window.cancelAnimationFrame(frame);
        frame = 0;
      }
      setIsActive(false);
      setPosition({ x: 0, y: 0 });
    };

    const handleMouseMove = (event: MouseEvent) => {
      // rAF 节流：mousemove 频率可能高于帧率，同帧内多次移动合并为一次
      // setState，避免高频重渲染。
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const element = magnetRef.current;
        if (!element) {
          return;
        }

        const { left, top, width, height } = element.getBoundingClientRect();
        const centerX = left + width / 2;
        const centerY = top + height / 2;

        const distanceX = Math.abs(centerX - event.clientX);
        const distanceY = Math.abs(centerY - event.clientY);

        if (distanceX < width / 2 + padding && distanceY < height / 2 + padding) {
          setIsActive(true);
          setPosition({
            x: (event.clientX - centerX) / magnetStrength,
            y: (event.clientY - centerY) / magnetStrength,
          });
        } else {
          setIsActive(false);
          setPosition({ x: 0, y: 0 });
        }
      });
    };

    window.addEventListener('mousemove', handleMouseMove);
    // 光标移出浏览器窗口时复位，避免元素保持偏移（重新进入才复位）。
    document.addEventListener('mouseleave', reset);
    window.addEventListener('blur', reset);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', reset);
      window.removeEventListener('blur', reset);
      if (frame) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [effectiveDisabled, magnetStrength, padding]);

  return (
    <div
      ref={magnetRef}
      // {...props} 先展开再声明组件自身样式：调用方传 className/style 时
      // 若放在后面会静默覆盖 wrapperClassName 与内联定位样式（footgun）。
      {...props}
      className={wrapperClassName}
      style={{ position: 'relative', display: 'inline-block' }}
    >
      <div
        className={innerClassName}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          transition: isActive ? activeTransition : inactiveTransition,
          willChange: 'transform',
        }}
      >
        {children}
      </div>
    </div>
  );
};
