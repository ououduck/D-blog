/**
 * 阅读进度 hook：从 ReadingProgressBadge 抽出的 rAF 合并滚动监听。
 * 复用 utils/readingProgress 的进度公式（不在组件内重写）；仅在整百分比
 * 变化时 setState，长文章滚动期间每帧最多一次测量、通常零渲染。
 */

import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { getReadingProgress } from '@/utils/readingProgress';

export const useReadingProgress = (
  targetRef: RefObject<HTMLElement | null>,
  endRef?: RefObject<HTMLElement | null>,
): { percentage: number; hasTarget: boolean } => {
  const [percentage, setPercentage] = useState(0);
  const [hasTarget, setHasTarget] = useState(false);
  const percentageRef = useRef(0);
  const hasTargetRef = useRef(false);

  useEffect(() => {
    let animationFrame = 0;

    const updateProgress = () => {
      animationFrame = 0;
      const target = targetRef.current;

      if (!target) {
        if (percentageRef.current !== 0) {
          percentageRef.current = 0;
          setPercentage(0);
        }
        if (hasTargetRef.current) {
          hasTargetRef.current = false;
          setHasTarget(false);
        }
        return;
      }

      if (!hasTargetRef.current) {
        hasTargetRef.current = true;
        setHasTarget(true);
      }

      const nextProgress = getReadingProgress({
        rect: target.getBoundingClientRect(),
        endRect: endRef?.current?.getBoundingClientRect(),
        viewportHeight: window.innerHeight,
        scrollY: window.scrollY,
        documentHeight: document.documentElement.scrollHeight,
      });
      const nextPercentage = Math.round(nextProgress * 100);

      if (nextPercentage !== percentageRef.current) {
        percentageRef.current = nextPercentage;
        setPercentage(nextPercentage);
      }
    };

    const scheduleUpdate = () => {
      if (!animationFrame) {
        animationFrame = window.requestAnimationFrame(updateProgress);
      }
    };

    scheduleUpdate();
    window.addEventListener('scroll', scheduleUpdate, { passive: true });
    window.addEventListener('resize', scheduleUpdate);

    return () => {
      window.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame);
      }
    };
  }, [endRef, targetRef]);

  return { percentage, hasTarget };
};
