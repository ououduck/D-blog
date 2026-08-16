/**
 * 参考 react-bits「RotatingText」的词条轮换组件（framer-motion 版）：
 * 多段短语以 3D 翻转/位移动画循环切换。
 *
 * 适配 D-blog：
 * - SSR 首帧渲染第一段短语（无 JS 时展示静态文本）；
 * - 尊重 prefers-reduced-motion：自动轮换关闭，仅展示首段；
 * - 移除 react-bits 中不适用于本站的部分默认样式，样式由调用方控制。
 */

import {
  motion,
  AnimatePresence,
  type Transition,
  type VariantLabels,
  type Target,
  type TargetAndTransition,
} from 'framer-motion';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export interface RotatingTextRef {
  next: () => void;
  previous: () => void;
  jumpTo: (index: number) => void;
  reset: () => void;
}

export interface RotatingTextProps extends Omit<
  React.ComponentPropsWithoutRef<typeof motion.span>,
  'children' | 'transition' | 'initial' | 'animate' | 'exit'
> {
  texts: string[];
  transition?: Transition;
  initial?: boolean | Target | VariantLabels;
  animate?: boolean | VariantLabels | TargetAndTransition;
  exit?: Target | VariantLabels;
  animatePresenceMode?: 'sync' | 'wait';
  animatePresenceInitial?: boolean;
  rotationInterval?: number;
  staggerDuration?: number;
  staggerFrom?: 'first' | 'last' | 'center' | 'random' | number;
  loop?: boolean;
  auto?: boolean;
  splitBy?: string;
  onNext?: (index: number) => void;
  mainClassName?: string;
  splitLevelClassName?: string;
  elementLevelClassName?: string;
}

const splitIntoCharacters = (text: string): string[] => {
  if (typeof Intl !== 'undefined' && Intl.Segmenter) {
    const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), (segment) => segment.segment);
  }
  return Array.from(text);
};

export const RotatingText = forwardRef<RotatingTextRef, RotatingTextProps>(
  (
    {
      texts,
      transition = { type: 'spring', damping: 25, stiffness: 300 },
      initial = { y: '100%', opacity: 0 },
      animate = { y: 0, opacity: 1 },
      exit = { y: '-120%', opacity: 0 },
      animatePresenceMode = 'wait',
      animatePresenceInitial = false,
      rotationInterval = 2600,
      staggerDuration = 0,
      staggerFrom = 'first',
      loop = true,
      auto = true,
      splitBy = 'characters',
      onNext,
      mainClassName,
      splitLevelClassName,
      elementLevelClassName,
      ...rest
    },
    ref,
  ) => {
    const reducedMotion = useReducedMotion();
    const [currentTextIndex, setCurrentTextIndex] = useState(0);

    const elements = useMemo(() => {
      const currentText: string = texts[currentTextIndex] ?? '';
      if (splitBy === 'characters') {
        const words = currentText.split(' ');
        return words.map((word, index) => ({
          characters: splitIntoCharacters(word),
          needsSpace: index !== words.length - 1,
        }));
      }
      if (splitBy === 'words') {
        return currentText.split(' ').map((word, index, arr) => ({
          characters: [word],
          needsSpace: index !== arr.length - 1,
        }));
      }
      if (splitBy === 'lines') {
        return currentText.split('\n').map((line, index, arr) => ({
          characters: [line],
          needsSpace: index !== arr.length - 1,
        }));
      }

      return currentText.split(splitBy).map((part, index, arr) => ({
        characters: [part],
        needsSpace: index !== arr.length - 1,
      }));
    }, [texts, currentTextIndex, splitBy]);

    // 预计算每个词在整句中的起始字符偏移与总字符数，
    // 避免渲染期对每词 slice+reduce（O(n²)）与每字符重复求总长。
    const charOffsets = useMemo(() => {
      let offset = 0;
      return elements.map((word) => {
        const previous = offset;
        offset += word.characters.length;
        return previous;
      });
    }, [elements]);
    const totalCharCount = useMemo(() => elements.reduce((sum, word) => sum + word.characters.length, 0), [elements]);

    // random 错峰锚点在词条变化时固化一次：渲染期调用 Math.random 会让每次
    // 重渲染/轮换的 delay 随机抖动，且 SSR 与客户端得到不同延迟。
    const randomStaggerAnchor = useMemo(
      () => (staggerFrom === 'random' ? Math.floor(Math.random() * Math.max(1, totalCharCount)) : 0),
      [staggerFrom, totalCharCount],
    );

    const getStaggerDelay = useCallback(
      (index: number, totalChars: number): number => {
        const total = totalChars;
        if (staggerFrom === 'first') {
          return index * staggerDuration;
        }
        if (staggerFrom === 'last') {
          return (total - 1 - index) * staggerDuration;
        }
        if (staggerFrom === 'center') {
          const center = Math.floor(total / 2);
          return Math.abs(center - index) * staggerDuration;
        }
        if (staggerFrom === 'random') {
          return Math.abs(randomStaggerAnchor - index) * staggerDuration;
        }
        return Math.abs((staggerFrom as number) - index) * staggerDuration;
      },
      [randomStaggerAnchor, staggerFrom, staggerDuration],
    );

    const handleIndexChange = useCallback(
      (newIndex: number) => {
        setCurrentTextIndex(newIndex);
        onNext?.(newIndex);
      },
      [onNext],
    );

    const next = useCallback(() => {
      // texts 为空时 length-1 = -1，相等判断恒 false，索引会无限自增。
      if (texts.length === 0) return;
      const nextIndex = currentTextIndex === texts.length - 1 ? (loop ? 0 : currentTextIndex) : currentTextIndex + 1;
      if (nextIndex !== currentTextIndex) {
        handleIndexChange(nextIndex);
      }
    }, [currentTextIndex, loop, texts.length, handleIndexChange]);

    const previous = useCallback(() => {
      if (texts.length === 0) return;
      const prevIndex = currentTextIndex === 0 ? (loop ? texts.length - 1 : currentTextIndex) : currentTextIndex - 1;
      if (prevIndex !== currentTextIndex) {
        handleIndexChange(prevIndex);
      }
    }, [currentTextIndex, loop, texts.length, handleIndexChange]);

    const jumpTo = useCallback(
      (index: number) => {
        const validIndex = Math.max(0, Math.min(index, texts.length - 1));
        if (validIndex !== currentTextIndex) {
          handleIndexChange(validIndex);
        }
      },
      [texts.length, currentTextIndex, handleIndexChange],
    );

    const reset = useCallback(() => {
      if (currentTextIndex !== 0) {
        handleIndexChange(0);
      }
    }, [currentTextIndex, handleIndexChange]);

    useImperativeHandle(ref, () => ({ next, previous, jumpTo, reset }), [next, previous, jumpTo, reset]);

    useEffect(() => {
      if (!auto || reducedMotion) {
        return;
      }

      const intervalId = window.setInterval(next, rotationInterval);
      return () => window.clearInterval(intervalId);
    }, [auto, next, reducedMotion, rotationInterval]);

    const currentText = texts[currentTextIndex] ?? '';

    return (
      <motion.span className={mainClassName} {...rest} layout transition={transition}>
        <span className="sr-only">{currentText}</span>
        <AnimatePresence mode={animatePresenceMode} initial={animatePresenceInitial}>
          <motion.span key={currentTextIndex} layout aria-hidden="true" className="inline-flex flex-wrap">
            {elements.map((wordObj, wordIndex) => (
              <span key={wordIndex} className={splitLevelClassName}>
                {wordObj.characters.map((char, charIndex) => (
                  <motion.span
                    key={charIndex}
                    // reducedMotion 时跳过入场动画（与「自动轮换已停」的意图一致，
                    // 直接渲染最终状态，避免水合后仍播放一次字符动画）。
                    initial={reducedMotion ? false : initial}
                    animate={animate}
                    exit={exit}
                    transition={{
                      ...transition,
                      delay: getStaggerDelay(charOffsets[wordIndex] + charIndex, totalCharCount),
                    }}
                    className={`inline-block ${elementLevelClassName ?? ''}`}
                  >
                    {char}
                  </motion.span>
                ))}
                {wordObj.needsSpace && <span className="whitespace-pre"> </span>}
              </span>
            ))}
          </motion.span>
        </AnimatePresence>
      </motion.span>
    );
  },
);

RotatingText.displayName = 'RotatingText';
