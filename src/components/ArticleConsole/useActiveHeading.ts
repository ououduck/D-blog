/**
 * 当前章节 hook：从 TableOfContents 抽出的 rAF 合并滚动同步逻辑。
 * 按视口边界（HEADING_SCROLL_OFFSET）确定当前应高亮的标题 id；
 * scroll/resize/hashchange 共享一个 rAF 帧，零重复 setState。
 */

import { useEffect, useState } from 'react';
import { HEADING_SCROLL_OFFSET } from '@/utils/scroll';
import type { MarkdownHeading } from '@/utils/headings';

const getHeadingTop = (element: HTMLElement) => element.getBoundingClientRect().top + window.scrollY;

export const useActiveHeading = (headings: MarkdownHeading[]): string | null => {
  const [activeHeadingId, setActiveHeadingId] = useState<string | null>(headings[0]?.id ?? null);

  useEffect(() => {
    if (headings.length === 0 || typeof window === 'undefined') {
      setActiveHeadingId(null);
      return;
    }

    let animationFrameId: number | null = null;

    const syncActiveHeading = () => {
      animationFrameId = null;
      const visibleBoundary = window.scrollY + HEADING_SCROLL_OFFSET + 1;
      let nextActiveId = headings[0]?.id ?? null;

      for (const heading of headings) {
        const element = document.getElementById(heading.id);

        if (!element) {
          continue;
        }

        if (getHeadingTop(element) <= visibleBoundary) {
          nextActiveId = heading.id;
        } else {
          break;
        }
      }

      setActiveHeadingId((currentId) => (currentId === nextActiveId ? currentId : nextActiveId));
    };

    const requestSyncActiveHeading = () => {
      if (animationFrameId !== null) {
        return;
      }

      animationFrameId = window.requestAnimationFrame(syncActiveHeading);
    };

    setActiveHeadingId(headings[0]?.id ?? null);
    requestSyncActiveHeading();

    window.addEventListener('scroll', requestSyncActiveHeading, { passive: true });
    window.addEventListener('resize', requestSyncActiveHeading);
    window.addEventListener('hashchange', requestSyncActiveHeading);

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      window.removeEventListener('scroll', requestSyncActiveHeading);
      window.removeEventListener('resize', requestSyncActiveHeading);
      window.removeEventListener('hashchange', requestSyncActiveHeading);
    };
  }, [headings]);

  return activeHeadingId;
};
