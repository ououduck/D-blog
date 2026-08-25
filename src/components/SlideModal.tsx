/**
 * 通用滑出弹层：移动端底部抽屉 / 桌面居中对话框，含焦点陷阱、滚动锁与退出动画。
 */

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useModalOverlay } from '@/hooks/useModalOverlay';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { easeOut } from '@/utils/motion';

interface SlideModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
  ariaLabelledby?: string;
  ariaDescribedby?: string;
}

export const SlideModal: React.FC<SlideModalProps> = ({
  isOpen,
  onClose,
  initialFocusRef,
  children,
  className = '',
  ariaLabelledby,
  ariaDescribedby,
}) => {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const isMobile = useMediaQuery('(max-width: 767px)', false);
  const reducedMotion = useReducedMotion();
  const modalRef = useRef<HTMLDivElement>(null);

  useModalOverlay({
    isOpen: shouldRender,
    onClose,
    initialFocusRef,
    containerRef: modalRef,
  });

  useEffect(() => {
    if (!isOpen) {
      if (shouldRender && reducedMotion) {
        setShouldRender(false);
      }
      return;
    }

    setShouldRender(true);
  }, [isOpen, shouldRender, reducedMotion]);

  if ((!shouldRender && !isOpen) || typeof document === 'undefined') {
    return null;
  }

  const overlayDuration = reducedMotion ? 0.1 : 0.16;
  const modalDuration = reducedMotion ? 0 : 0.18;
  const desktopVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  };
  const mobileVariants = {
    hidden: { opacity: 0, y: reducedMotion ? 0 : 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reducedMotion ? 0 : 16 },
  };

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        if (!isOpen) {
          setShouldRender(false);
        }
      }}
    >
      {isOpen && (
        <motion.div
          ref={modalRef}
          key="slide-modal"
          tabIndex={-1}
          className={`fixed inset-0 z-nested flex justify-center ${isMobile ? 'items-end' : 'items-center'}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledby || undefined}
          aria-describedby={ariaDescribedby || undefined}
        >
          <motion.div
            className="fixed inset-0 bg-black/50 dark:bg-black/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: overlayDuration, ease: 'easeOut' }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/*
            面板结构恒定：children 始终位于同一树位。此前按 isMobile 三元渲染两棵
            结构不同的子树（移动端多一层拖动把手），跨 767px 断点时 React 按位置
            对账会把含 {children} 的内容节点卸载重建 —— ShareModal 的 copiedType、
            ShuoShuoShareModal 的 copied 等弹窗内状态全部丢失。
            现在把手常驻（桌面端 hidden），断点只切换 className 与 variants。
          */}
          <motion.div
            className={`
              relative z-10
              w-full
              overflow-hidden
              editorial-sheet
              border
              bg-paper
              shadow-none
              dark:bg-zinc-900
              ${isMobile ? 'max-h-[88vh] supports-[height:100dvh]:max-h-[88dvh] border-b-0 border-zinc-300 dark:border-zinc-700' : 'mx-4 max-w-lg max-h-[80vh] supports-[height:100dvh]:max-h-[80dvh] rounded-overlay border-zinc-300 dark:border-zinc-700'}
              ${className}
            `}
            style={
              isMobile
                ? {
                    // 面板 padding 承担 safe-area：底部 + 左右（横屏 iPhone 刘海在左右两侧）
                    paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                    paddingLeft: 'env(safe-area-inset-left, 0px)',
                    paddingRight: 'env(safe-area-inset-right, 0px)',
                  }
                : undefined
            }
            variants={isMobile ? mobileVariants : desktopVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: modalDuration, ease: easeOut }}
          >
            <div className={isMobile ? 'flex justify-center px-4 pt-3' : 'hidden'}>
              <div className="h-1.5 w-14 rounded-full bg-zinc-300/80 dark:bg-zinc-700/80" />
            </div>
            <div
              className={`overflow-y-auto overscroll-contain ${
                isMobile
                  ? 'max-h-[calc(88vh-18px)] supports-[height:100dvh]:max-h-[calc(88dvh-18px)]'
                  : 'max-h-[80vh] supports-[height:100dvh]:max-h-[80dvh]'
              }`}
            >
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
