/**
 * 图片查看器底部工具栏：极简、按需出现。
 * - 仅高频操作：− / 缩放比例（点击即恢复 100%）/ + / 缩放切换 / 更多
 * - 下载等低频操作收进「更多」弹出层
 * - visible=false 时不渲染（由 ImageViewer 的自动隐藏逻辑驱动）
 */

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, Maximize2, Minus, MoreHorizontal, Plus } from 'lucide-react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

export interface ImageViewerToolbarProps {
  visible: boolean;
  scale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  /** 恢复 100%（替代独立 Reset 按钮）。 */
  onResetZoom: () => void;
  /** 缩放切换（100% ↔ 240%）。 */
  onToggleZoom: () => void;
  onDownload: () => void;
}

const TOOLBAR_BUTTON_CLASS =
  'inline-flex h-10 w-10 items-center justify-center rounded-full text-white/75 transition-colors hover:bg-white/10 hover:text-white active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white';

export const ImageViewerToolbar: React.FC<ImageViewerToolbarProps> = ({
  visible,
  scale,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onToggleZoom,
  onDownload,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRootRef = useRef<HTMLDivElement | null>(null);

  // 工具栏整体隐藏时连带收起「更多」弹层。
  useEffect(() => {
    if (!visible) {
      setIsMoreOpen(false);
    }
  }, [visible]);

  // 弹层打开时点击外部关闭（工具栏自身点击不关闭）。
  useEffect(() => {
    if (!isMoreOpen) {
      return;
    }
    const handleMouseDown = (event: MouseEvent) => {
      if (!moreRootRef.current?.contains(event.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [isMoreOpen]);

  const scaleLabel = `${Math.round(scale * 100)}%`;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.18, ease: 'easeOut' }}
          className="absolute bottom-12 left-1/2 z-40 -translate-x-1/2"
          data-testid="viewer-toolbar"
        >
          <div className="flex items-center gap-0.5 rounded-full bg-white/10 px-1.5 py-1 backdrop-blur-sm">
            <button type="button" onClick={onZoomOut} className={TOOLBAR_BUTTON_CLASS} aria-label="缩小" title="缩小">
              <Minus size={16} aria-hidden="true" />
            </button>
            {/* 缩放比例即 Reset：点击恢复 100%，省去独立 Reset 按钮 */}
            <button
              type="button"
              onClick={onResetZoom}
              className="inline-flex h-10 min-w-[3.5rem] items-center justify-center rounded-full text-xs font-semibold text-white/85 tabular-nums transition-colors hover:bg-white/10 hover:text-white active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
              aria-label={`当前缩放 ${scaleLabel}，点击恢复 100%`}
              title="恢复 100%"
            >
              {scaleLabel}
            </button>
            <button type="button" onClick={onZoomIn} className={TOOLBAR_BUTTON_CLASS} aria-label="放大" title="放大">
              <Plus size={16} aria-hidden="true" />
            </button>
            <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-white/15" />
            <button
              type="button"
              onClick={onToggleZoom}
              className={TOOLBAR_BUTTON_CLASS}
              aria-label="切换缩放"
              title="切换缩放（100% ↔ 240%）"
            >
              <Maximize2 size={15} aria-hidden="true" />
            </button>
            <div ref={moreRootRef} className="relative">
              <button
                type="button"
                onClick={() => setIsMoreOpen((open) => !open)}
                className={TOOLBAR_BUTTON_CLASS}
                aria-label="更多操作"
                aria-expanded={isMoreOpen}
              >
                <MoreHorizontal size={16} aria-hidden="true" />
              </button>
              {isMoreOpen && (
                <div
                  role="menu"
                  aria-label="更多操作"
                  className="absolute bottom-full right-0 mb-2 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-zinc-900/90 p-1 backdrop-blur-sm"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onDownload();
                      setIsMoreOpen(false);
                    }}
                    className="flex min-h-10 items-center gap-2 whitespace-nowrap rounded-lg px-3 text-sm text-white/85 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
                  >
                    <Download size={15} aria-hidden="true" />
                    下载图片
                  </button>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
