/**
 * 当前章节 hook：从 TableOfContents 抽出的 rAF 合并滚动同步逻辑。
 * 激活判定线与 TOC 点击跳转共用 getHeadingScrollOffset()（CSS 变量
 * --article-heading-offset）：标题滚动落点即激活切换线，点击跳转后高亮
 * 立即正确，不会出现"位置对了但高亮晚一截"。
 */

import { useEffect, useState } from 'react';
import { getHeadingScrollOffset } from '@/utils/scroll';
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
      // 与 scrollToHeadingElement 同一偏移源：标题被滚动到 offset 位置时，
      // 恰好跨过激活判定线，位置与高亮永远一致。
      const visibleBoundary = window.scrollY + getHeadingScrollOffset() + 1;
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
