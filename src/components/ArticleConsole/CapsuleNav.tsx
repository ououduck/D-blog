/**
 * 桌面端胶囊文章导航（≥1024px）：
 * - 收缩态：右侧迷你轨（展开按钮 + 章节序号 + 进度 + 回到顶部），绝不遮挡正文；
 * - hover 轻展开预览（250ms 意图延迟），点击/键盘 focus 固定展开，钉住后不自动收起；
 * - 展开态 = 目录树（共享 TocTree）+ 真实阅读进度 + 阅读操作区；
 * - 状态记忆：pinned/展开状态跨文章导航继承（模块级），专注阅读进出快照恢复；
 * - 定位：fixed 垂直居中，right 偏移按文章容器右缘动态计算（resize 跟随）。
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, Copy, Eye, EyeOff, Link2, List, Pin, PinOff, Share2, X } from 'lucide-react';
import type { RefObject } from 'react';
import type { MarkdownHeading } from '@/utils/headings';
import { buildHeadingTree, buildParentMap, getAncestorIds, getRootBranchId } from '@/utils/toc';
import { useTocExpansion } from './useTocExpansion';
import { replaceUrlHash, scrollToHeadingElement } from '@/utils/headingScroll';
import { useActiveHeading } from './useActiveHeading';
import { useReadingProgress } from './useReadingProgress';
import { TocTree } from './TocTree';
import { getCapsuleState, restoreFromReadingMode, setCapsuleState, snapshotForReadingMode } from './capsuleState';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { hasOpenOverlay } from '@/hooks/useModalOverlay';

const HOVER_INTENT_MS = 250;
const COPY_FEEDBACK_MS = 2000;
/** 迷你轨最多展示的章节序号数（超出则以「当前/总数」形式显示）。 */
const MAX_RAIL_SECTIONS = 6;
const RAIL_WIDTH = 56;

type CopyFeedback = { kind: 'article' | 'heading'; ok: boolean } | null;

interface CapsuleNavProps {
  headings: MarkdownHeading[];
  /** 正文容器（进度测量 + 定位基准）。 */
  targetRef: RefObject<HTMLElement | null>;
  /** 正文结尾哨兵。 */
  endRef: RefObject<HTMLElement | null>;
  isReadingMode: boolean;
  onShare: () => void;
  onCopyArticleLink: () => Promise<boolean>;
  onCopyHeadingLink: (id: string) => Promise<boolean>;
  onToggleReadingMode: () => void;
}

export const CapsuleNav: React.FC<CapsuleNavProps> = ({
  headings,
  targetRef,
  endRef,
  isReadingMode,
  onShare,
  onCopyArticleLink,
  onCopyHeadingLink,
  onToggleReadingMode,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const headingTree = useMemo(() => buildHeadingTree(headings), [headings]);
  const parentMap = useMemo(() => buildParentMap(headingTree), [headingTree]);
  const activeHeadingId = useActiveHeading(headings);
  const { percentage } = useReadingProgress(targetRef, endRef);

  // 模块级状态记忆的 React 镜像：跨文章导航继承、专注阅读快照恢复。
  const [pinned, setPinned] = useState(() => getCapsuleState().pinned);
  const [userExpanded, setUserExpanded] = useState(() => getCapsuleState().userExpanded);
  const [hoverPreview, setHoverPreview] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<CopyFeedback>(null);
  const hoverTimerRef = useRef<number | null>(null);
  const copyTimerRef = useRef<number | null>(null);
  const railRef = useRef<HTMLElement | null>(null);
  const railToggleRef = useRef<HTMLButtonElement | null>(null);
  // 跳转收起后的程序化焦点恢复不触发 focusWithin 自动展开（一次性抑制）：
  // 否则「收起 + 焦点回轨」会被容器 onFocusCapture 立刻顶开，收起失效。
  const suppressFocusExpandRef = useRef(false);
  const suppressTimerRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const activeItemRef = useRef<HTMLLIElement | null>(null);

  const isExpanded = pinned || userExpanded || hoverPreview || focusWithin;

  // 专注阅读进入/退出：快照与恢复（阅读模式下隐藏与阅读无关的操作）。
  const wasReadingModeRef = useRef(isReadingMode);
  useEffect(() => {
    if (isReadingMode && !wasReadingModeRef.current) {
      snapshotForReadingMode();
      setPinned(false);
      setUserExpanded(false);
      setCapsuleState({ pinned: false, userExpanded: false });
    }
    if (!isReadingMode && wasReadingModeRef.current) {
      restoreFromReadingMode();
      setPinned(getCapsuleState().pinned);
      setUserExpanded(getCapsuleState().userExpanded);
    }
    wasReadingModeRef.current = isReadingMode;
  }, [isReadingMode]);

  // 展开态联动目录树的分支折叠（与 TOC 相同策略：仅展开当前分支）。
  const activeAncestorIds = useMemo(() => getAncestorIds(activeHeadingId, parentMap), [activeHeadingId, parentMap]);
  const activeBranchIds = useMemo(
    () => new Set(activeHeadingId ? [activeHeadingId, ...activeAncestorIds] : activeAncestorIds),
    [activeAncestorIds, activeHeadingId],
  );
  const activeRootBranchId = useMemo(() => getRootBranchId(activeHeadingId, parentMap), [activeHeadingId, parentMap]);

  // 展开状态：与移动 Sheet 共享 useTocExpansion（用户手动展开/折叠优先于
  // 自动收拢，active 变化只保证 active 分支可见）。
  const { expandedMap, toggleNode, expandBranchForNavigation } = useTocExpansion({
    headingTree,
    activeHeadingId,
    activeRootBranchId,
    activeAncestorIds,
    collapseInactiveRootBranches: true,
    autoExpandActiveNode: true,
  });

  // 定位：right 偏移 = 文章右缘到视口右缘的可用空间 - 轨宽 - 间隙，钳制在
  // [1rem, 6rem]；窄屏自动贴近边缘，宽屏保持在留白带内（不贴死浏览器边缘）。
  useEffect(() => {
    const updateOffset = () => {
      const element = targetRef.current;
      if (!element) {
        return;
      }
      const rect = element.getBoundingClientRect();
      const available = window.innerWidth - rect.right;
      const offset = Math.max(16, Math.min(available - RAIL_WIDTH - 12, 96));
      document.documentElement.style.setProperty('--capsule-right', `${offset}px`);
    };

    updateOffset();
    window.addEventListener('resize', updateOffset);
    return () => window.removeEventListener('resize', updateOffset);
  }, [targetRef, headings]);

  // hover 意图延迟：防止路过的鼠标误展开。
  const scheduleHoverPreview = useCallback(() => {
    if (pinned || userExpanded) {
      return;
    }
    if (hoverTimerRef.current !== null) {
      return;
    }
    hoverTimerRef.current = window.setTimeout(
      () => {
        hoverTimerRef.current = null;
        setHoverPreview(true);
      },
      shouldReduceMotion ? 0 : HOVER_INTENT_MS,
    );
  }, [pinned, shouldReduceMotion, userExpanded]);

  const cancelHoverPreview = useCallback(() => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setHoverPreview(false);
  }, []);

  // 收起胶囊（未固定时）：指针/焦点状态与模块级记忆同步复位。
  const collapseCapsule = useCallback(() => {
    cancelHoverPreview();
    setFocusWithin(false);
    setUserExpanded(false);
    setCapsuleState({ userExpanded: false });
  }, [cancelHoverPreview]);

  const toggleUserExpanded = useCallback(() => {
    cancelHoverPreview();
    setUserExpanded((current) => {
      const next = !current;
      setCapsuleState({ userExpanded: next });
      return next;
    });
  }, [cancelHoverPreview]);

  const togglePinned = useCallback(() => {
    setPinned((current) => {
      const next = !current;
      setCapsuleState({ pinned: next, userExpanded: next ? true : getCapsuleState().userExpanded });
      return next;
    });
    setUserExpanded(true);
  }, []);

  // 展开时（未钉住）：Esc 收起、外点收起。有其他弹层打开时让位（不处理 Esc）。
  useEffect(() => {
    if (!isExpanded || pinned) {
      return;
    }
    const collapse = () => {
      setUserExpanded(false);
      setCapsuleState({ userExpanded: false });
      setFocusWithin(false);
      setHoverPreview(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !hasOpenOverlay()) {
        collapse();
      }
    };
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!panelRef.current?.contains(target) && !railRef.current?.contains(target)) {
        collapse();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [isExpanded, pinned]);

  // 卸载清理挂起计时器。
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
      }
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      if (suppressTimerRef.current !== null) {
        window.clearTimeout(suppressTimerRef.current);
      }
    };
  }, []);

  const showCopyFeedback = useCallback((kind: 'article' | 'heading', ok: boolean) => {
    setCopyFeedback({ kind, ok });
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
    copyTimerRef.current = window.setTimeout(() => setCopyFeedback(null), COPY_FEEDBACK_MS);
  }, []);

  const handleCopyArticleLink = useCallback(async () => {
    showCopyFeedback('article', await onCopyArticleLink());
  }, [onCopyArticleLink, showCopyFeedback]);

  const handleCopyHeadingLink = useCallback(async () => {
    if (!activeHeadingId) {
      return;
    }
    showCopyFeedback('heading', await onCopyHeadingLink(activeHeadingId));
  }, [activeHeadingId, onCopyHeadingLink, showCopyFeedback]);

  const handleNavigate = useCallback(
    (id: string) => {
      const ancestorIds = getAncestorIds(id, parentMap);
      const rootId = getRootBranchId(id, parentMap);
      expandBranchForNavigation(rootId, ancestorIds);

      scrollToHeadingElement(id, shouldReduceMotion ? 'auto' : 'smooth');
      replaceUrlHash(id);

      // 未固定：跳转即收起（与移动端 Sheet 点击后关闭一致），并把焦点归还到
      // 迷你轨的展开按钮（面板视觉隐藏后焦点会丢失，不能掉到 body）。
      if (!pinned) {
        collapseCapsule();
        if (railToggleRef.current) {
          suppressFocusExpandRef.current = true;
          railToggleRef.current.focus();
          if (suppressTimerRef.current !== null) {
            window.clearTimeout(suppressTimerRef.current);
          }
          suppressTimerRef.current = window.setTimeout(() => {
            suppressFocusExpandRef.current = false;
            suppressTimerRef.current = null;
          }, 0);
        }
      }
    },
    [collapseCapsule, expandBranchForNavigation, parentMap, pinned, shouldReduceMotion],
  );

  const handleBackToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  }, [shouldReduceMotion]);

  // 滚动到当前激活目录项在展开面板中可见。
  useEffect(() => {
    const panel = panelRef.current;
    const activeElement = activeItemRef.current;
    if (!isExpanded || !panel || !activeElement) {
      return;
    }
    activeElement.scrollIntoView({ block: 'nearest', behavior: shouldReduceMotion ? 'auto' : 'smooth' });
  }, [activeHeadingId, expandedMap, isExpanded, shouldReduceMotion]);

  const activeRootIndex = headingTree.findIndex((node) => node.id === activeRootBranchId);
  const railRoots = headingTree.slice(0, MAX_RAIL_SECTIONS);

  const railActions = (
    <>
      <button
        ref={railToggleRef}
        type="button"
        onClick={toggleUserExpanded}
        className="capsule-rail-btn"
        aria-label={isExpanded ? '收起文章导航' : '展开文章导航'}
        aria-expanded={isExpanded}
      >
        {isExpanded ? <X size={16} /> : <List size={16} />}
      </button>
      {railRoots.map((node) => {
        const isCurrentRoot = node.id === activeRootBranchId;
        return (
          <button
            key={node.id}
            type="button"
            onClick={() => handleNavigate(node.id)}
            className={`capsule-rail-btn capsule-rail-num ${isCurrentRoot ? 'capsule-rail-num-active' : ''}`}
            aria-label={`跳转到章节 ${node.index + 1}：${node.text}`}
            title={node.text}
          >
            {String(node.index + 1).padStart(2, '0')}
          </button>
        );
      })}
      {headingTree.length > MAX_RAIL_SECTIONS && (
        <span
          className="capsule-rail-num capsule-rail-total"
          aria-label={`当前第 ${activeRootIndex + 1} 章，共 ${headingTree.length} 章`}
          title={`当前第 ${activeRootIndex + 1} / ${headingTree.length} 章`}
        >
          {String((activeRootIndex >= 0 ? activeRootIndex : 0) + 1).padStart(2, '0')}
          <span aria-hidden="true">/{headingTree.length}</span>
        </span>
      )}
      <span className="capsule-progress" title={`阅读进度 ${percentage}%`}>
        <span className="capsule-progress-track" aria-hidden="true">
          <span className="capsule-progress-fill" style={{ height: `${percentage}%` }} />
        </span>
        <span className="capsule-progress-num" aria-hidden="true">
          {percentage}
        </span>
        <span className="sr-only">阅读进度 {percentage}%</span>
      </span>
      <button type="button" onClick={handleBackToTop} className="capsule-rail-btn" aria-label="回到顶部">
        <ArrowUp size={16} />
      </button>
    </>
  );

  const capsule = createPortal(
    <div
      className="capsule-container"
      data-expanded={isExpanded ? 'true' : undefined}
      // hover/focus 意图统一挂在容器上：面板为绝对定位（展开不推动迷你轨），
      // 容器级 mouseenter/mouseleave 以 DOM 归属判定，指针在轨/面板间移动
      // （含 wrapper 内置的 0.5rem 过渡桥）不会触发收起，杜绝抽搐循环。
      onMouseEnter={scheduleHoverPreview}
      onMouseLeave={cancelHoverPreview}
      onFocusCapture={() => {
        if (suppressFocusExpandRef.current) {
          return;
        }
        setFocusWithin(true);
      }}
      onBlurCapture={(event) => {
        if (!(event.currentTarget as HTMLElement).contains(event.relatedTarget as Node | null)) {
          setFocusWithin(false);
        }
      }}
    >
      {/* 迷你轨：收缩态 & 展开态下仍保留（展开面板绝对定位在轨左侧，不占流式布局） */}
      <nav
        ref={railRef}
        aria-label="文章导航（收缩）"
        className={`capsule-rail ${isExpanded ? 'capsule-rail-dimmed' : ''}`}
      >
        {railActions}
      </nav>

      {/* 展开面板：绝对定位于迷你轨左侧（不挤动轨道，消除 hover 位移抽搐）；
          wrapper 自带 0.5rem 右侧内边距作为指针过渡桥；可见性由容器
          data-expanded + CSS opacity/visibility 过渡驱动（visibility:hidden
          时移出可访问性树）。 */}
      <aside ref={panelRef} className="capsule-panel" role="group" aria-label="文章阅读导航面板">
        <div className="capsule-panel-card">
          <div className="capsule-panel-head">
            <span className="capsule-panel-title">文章目录</span>
            {!isReadingMode && (
              <button
                type="button"
                onClick={togglePinned}
                className="capsule-panel-btn"
                aria-label={pinned ? '取消固定导航面板' : '固定导航面板'}
                aria-pressed={pinned}
                title={pinned ? '取消固定' : '固定（阅读期间保持展开）'}
              >
                {pinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
            )}
            <button type="button" onClick={toggleUserExpanded} className="capsule-panel-btn" aria-label="收起导航面板">
              <X size={14} />
            </button>
          </div>

          <div className="capsule-panel-toc">
            {headingTree.length > 0 && (
              <TocTree
                nodes={headingTree}
                expandedMap={expandedMap}
                activeHeadingId={activeHeadingId}
                activeBranchIds={activeBranchIds}
                activeItemRef={activeItemRef}
                shouldForceExpand={false}
                onNavigate={handleNavigate}
                onToggle={toggleNode}
              />
            )}
          </div>

          <div className="capsule-panel-progress">
            <span>阅读进度</span>
            <span className="capsule-panel-progress-track" aria-hidden="true">
              <span className="capsule-panel-progress-fill" style={{ width: `${percentage}%` }} />
            </span>
            <span className="tabular-nums">{percentage}%</span>
          </div>

          <div className="capsule-panel-actions">
            <button type="button" onClick={onShare} className="capsule-action-row" aria-label="分享文章">
              <Share2 size={15} aria-hidden="true" />
              <span>分享</span>
            </button>
            {!isReadingMode && (
              <>
                <button
                  type="button"
                  onClick={() => void handleCopyArticleLink()}
                  className="capsule-action-row"
                  aria-label="复制文章链接"
                >
                  <Link2 size={15} aria-hidden="true" />
                  <span>复制文章链接</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleCopyHeadingLink()}
                  className="capsule-action-row"
                  aria-label="复制当前标题链接"
                  disabled={!activeHeadingId}
                >
                  <Copy size={15} aria-hidden="true" />
                  <span>复制标题链接</span>
                </button>
                <button
                  type="button"
                  onClick={onToggleReadingMode}
                  className="capsule-action-row"
                  aria-label="进入专注阅读"
                >
                  <Eye size={15} aria-hidden="true" />
                  <span>阅读模式</span>
                </button>
              </>
            )}
            {isReadingMode && (
              <button
                type="button"
                onClick={onToggleReadingMode}
                className="capsule-action-row"
                aria-label="退出专注阅读"
              >
                <EyeOff size={15} aria-hidden="true" />
                <span>退出阅读模式</span>
              </button>
            )}
          </div>

          <p className="capsule-copy-status" role="status" aria-live="polite">
            {copyFeedback
              ? copyFeedback.ok
                ? copyFeedback.kind === 'article'
                  ? '文章链接已复制'
                  : '标题链接已复制'
                : '复制失败，请重试'
              : ''}
          </p>
        </div>
      </aside>
    </div>,
    document.body,
  );

  return capsule;
};
