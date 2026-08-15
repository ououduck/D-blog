import { useInView, useMotionValue, useSpring } from 'framer-motion';
import { useCallback, useEffect, useRef } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * 参考 react-bits「CountUp」的数字滚动组件，适配 D-blog：
 * - SSR 首帧直接渲染最终值（无 JS 时爬虫/用户也能读到完整数字），
 *   进入视口后才从 from 滚动到 to，避免水合后数字回跳；
 * - 使用 framer-motion 的 useSpring 阻尼滚动，滚动曲线与全站动效一致；
 * - 尊重 prefers-reduced-motion：直接静态渲染最终值，不启动动画。
 */

interface CountUpProps {
  /** 目标值（SSR 首帧即渲染该值）。 */
  to: number;
  /** 起始值，默认 0。 */
  from?: number;
  /** 计数方向。 */
  direction?: 'up' | 'down';
  /** 进入视口后的延迟（秒）。 */
  delay?: number;
  /** 动画时长（秒），仅影响阻尼/刚度换算。 */
  duration?: number;
  className?: string;
  /** 千分位分隔符；为空则不加分隔。 */
  separator?: string;
}

const getDecimalPlaces = (num: number): number => {
  const text = String(num);
  const dotIndex = text.indexOf('.');
  if (dotIndex === -1) {
    return 0;
  }

  const decimals = text.slice(dotIndex + 1);
  return Number(decimals) !== 0 ? decimals.length : 0;
};

export const CountUp: React.FC<CountUpProps> = ({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 1.8,
  className,
  separator,
}) => {
  const ref = useRef<HTMLSpanElement | null>(null);
  const reducedMotion = useReducedMotion();
  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to));

  const formatValue = useCallback(
    (latest: number) => {
      const options: Intl.NumberFormatOptions = {
        useGrouping: Boolean(separator),
        minimumFractionDigits: maxDecimals > 0 ? maxDecimals : 0,
        maximumFractionDigits: maxDecimals > 0 ? maxDecimals : 0,
      };

      const formatted = new Intl.NumberFormat('zh-CN', options).format(latest);
      return separator ? formatted.replace(/,/g, separator) : formatted;
    },
    [maxDecimals, separator],
  );

  const motionValue = useMotionValue(direction === 'down' ? to : from);
  const damping = 20 + 40 * (1 / duration);
  const stiffness = 100 * (1 / duration);
  const springValue = useSpring(motionValue, { damping, stiffness });
  const isInView = useInView(ref, { once: true, margin: '0px 0px -8% 0px' });

  useEffect(() => {
    if (!ref.current || reducedMotion) {
      return;
    }

    // 水合后先写回起始值：与 SSR 首帧的最终值不同，但仅在进入视口时
    // 才真正可见（下方 isInView 触发滚动），视觉上就是“进入视口开始计数”。
    ref.current.textContent = formatValue(direction === 'down' ? to : from);

    const unsubscribe = springValue.on('change', (latest: number) => {
      if (ref.current) {
        ref.current.textContent = formatValue(latest);
      }
    });

    return () => unsubscribe();
  }, [direction, formatValue, from, reducedMotion, springValue, to]);

  useEffect(() => {
    if (!isInView || reducedMotion) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      motionValue.set(direction === 'down' ? from : to);
    }, delay * 1000);

    return () => window.clearTimeout(timeoutId);
  }, [delay, direction, from, isInView, motionValue, reducedMotion, to]);

  return (
    <span ref={ref} className={className}>
      {formatValue(to)}
    </span>
  );
};
