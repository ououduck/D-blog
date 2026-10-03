/**
 * 横向滚动容器的边缘渐隐判定：只有当某一侧确实还有被裁切的内容时才返回 true。
 * 无条件渐隐（纯 CSS 蒙版）会在静止在最左/最右端时把首尾元素的边缘啃出一条
 * 半透明带，看起来像模糊溢出，因此渐隐必须由真实滚动位置驱动。
 */
import { useEffect, useState, type RefObject } from 'react';

/** 贴边判定容差（px）：分数像素的 scrollLeft 不算还有内容被裁切。 */
const EDGE_TOLERANCE = 1;

export interface ScrollEdgeFade {
  /** 左侧还有被裁切的内容（已向右滚动）。 */
  fadeStart: boolean;
  /** 右侧还有被裁切的内容（尚未滚到最右）。 */
  fadeEnd: boolean;
}

const NO_FADE: ScrollEdgeFade = { fadeStart: false, fadeEnd: false };

export const useScrollEdgeFade = (scrollerRef: RefObject<HTMLElement | null>): ScrollEdgeFade => {
  // 初值一律「不渐隐」：SSG 预渲染与客户端首帧一致，水合后再按实际溢出纠正。
  const [fade, setFade] = useState<ScrollEdgeFade>(NO_FADE);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return;
    }

    const sync = () => {
      const scrollable = scroller.scrollWidth - scroller.clientWidth;
      const next: ScrollEdgeFade = {
        fadeStart: scroller.scrollLeft > EDGE_TOLERANCE,
        fadeEnd: scrollable - scroller.scrollLeft > EDGE_TOLERANCE,
      };
      setFade((prev) => (prev.fadeStart === next.fadeStart && prev.fadeEnd === next.fadeEnd ? prev : next));
    };

    sync();
    scroller.addEventListener('scroll', sync, { passive: true });
    // 容器尺寸（视口变化）与内容宽度（分类数量变化）都会改变是否溢出。
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(sync);
    if (observer) {
      observer.observe(scroller);
      const content = scroller.firstElementChild;
      if (content) {
        observer.observe(content);
      }
    }

    return () => {
      scroller.removeEventListener('scroll', sync);
      observer?.disconnect();
    };
  }, [scrollerRef]);

  return fade;
};
