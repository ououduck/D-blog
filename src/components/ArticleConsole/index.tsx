/**
 * 文章阅读控制台（编排层）：
 * - 桌面（≥1024px）：CapsuleNav 悬浮胶囊（目录/进度/分享/复制/阅读模式）；
 * - 移动（<1024px）：ArticleToolbar 工具栏 + 受控 TableOfContents 目录 Sheet；
 * - 统一数据源：useActiveHeading / useReadingProgress / utils/toc 单一实现；
 * - 媒体查询决定渲染哪套 UI，同一时刻只有一套监听器在跑（性能约束）。
 */

import React, { useCallback, useMemo, useState } from 'react';
import type { RefObject } from 'react';
import type { MarkdownHeading } from '@/utils/headings';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useReadingMode } from '@/components/ReadingModeContext';
import { useReadingProgress } from './useReadingProgress';
import { CapsuleNav } from './CapsuleNav';
import { ArticleToolbar } from './ArticleToolbar';
import { TableOfContents } from '@/components/TableOfContents';
import { copyTextToClipboard } from '@/utils/clipboard';

export interface ArticleConsoleProps {
  headings: MarkdownHeading[];
  /** 正文容器（进度测量 + 胶囊定位基准）。 */
  targetRef: RefObject<HTMLElement | null>;
  /** 正文结尾哨兵。 */
  endRef: RefObject<HTMLElement | null>;
  /** 文章绝对链接（canonical，复制链接用）。 */
  articleUrl: string;
  onShare: () => void;
}

export const ArticleConsole: React.FC<ArticleConsoleProps> = ({ headings, targetRef, endRef, articleUrl, onShare }) => {
  // SSR/首帧 false（移动工具栏），挂载后纠正；桌面胶囊仅客户端渲染。
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const { isReadingMode, toggleReadingMode } = useReadingMode();
  const [isTocOpen, setIsTocOpen] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // isClient 同步：避免 SSR 阶段 createPortal（CapsuleNav/Toolbar 内部也有守卫，
  // 这里统一处理 TOC 受控渲染的水合确定性）。
  React.useEffect(() => {
    setIsClient(true);
  }, []);

  const { percentage } = useReadingProgress(targetRef, endRef);

  const handleCopyArticleLink = useCallback(() => copyTextToClipboard(articleUrl), [articleUrl]);

  const onOpenChange = useCallback((open: boolean) => setIsTocOpen(open), []);
  const openToc = useCallback(() => setIsTocOpen(true), []);

  const consoleElement = useMemo(() => {
    if (!isClient) {
      return null;
    }
    if (isDesktop) {
      return (
        <CapsuleNav
          headings={headings}
          targetRef={targetRef}
          endRef={endRef}
          isReadingMode={isReadingMode}
          onShare={onShare}
          onCopyArticleLink={handleCopyArticleLink}
          onCopyHeadingLink={async (id) => {
            const { buildHeadingAnchorUrl } = await import('@/utils/headingScroll');
            return copyTextToClipboard(buildHeadingAnchorUrl(id));
          }}
          onToggleReadingMode={toggleReadingMode}
        />
      );
    }
    return (
      <>
        <ArticleToolbar
          percentage={percentage}
          headingsCount={headings.length}
          onOpenToc={openToc}
          onShare={onShare}
          isReadingMode={isReadingMode}
          onToggleReadingMode={toggleReadingMode}
          onCopyArticleLink={handleCopyArticleLink}
        />
        <TableOfContents
          headings={headings}
          mobileShowTrigger={false}
          desktopShowTrigger={false}
          isOpen={isTocOpen}
          onOpenChange={onOpenChange}
          progressTargetRef={targetRef}
          progressEndRef={endRef}
        />
      </>
    );
  }, [
    isClient,
    isDesktop,
    headings,
    targetRef,
    endRef,
    isReadingMode,
    onShare,
    handleCopyArticleLink,
    toggleReadingMode,
    percentage,
    openToc,
    isTocOpen,
    onOpenChange,
  ]);

  return consoleElement;
};
