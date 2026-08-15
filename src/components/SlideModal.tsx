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

          {isMobile ? (
            <motion.div
              // 面板 padding 承担 safe-area：底部 + 左右（横屏 iPhone 刘海在左右两侧）
              className={`
                relative z-10
                w-full
                max-h-[88vh]
                supports-[height:100dvh]:max-h-[88dvh]
                overflow-hidden
                editorial-sheet
                border border-b-0
                border-zinc-300
                bg-paper
                shadow-none
                dark:border-zinc-700
                dark:bg-zinc-900
                ${className}
              `}
              style={{
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                paddingLeft: 'env(safe-area-inset-left, 0px)',
                paddingRight: 'env(safe-area-inset-right, 0px)',
              }}
              variants={mobileVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: modalDuration, ease: easeOut }}
            >
              <div className="flex justify-center px-4 pt-3">
                <div className="h-1.5 w-14 rounded-full bg-zinc-300/80 dark:bg-zinc-700/80" />
              </div>
              <div className="max-h-[calc(88vh-18px)] supports-[height:100dvh]:max-h-[calc(88dvh-18px)] overflow-y-auto overscroll-contain">
                {children}
              </div>
            </motion.div>
          ) : (
            <motion.div
              className={`
                relative z-10
                mx-4
                w-full
                max-w-lg
                max-h-[80vh]
                supports-[height:100dvh]:max-h-[80dvh]
                overflow-hidden
                rounded-overlay
                border
                border-zinc-300
                bg-paper
                shadow-none
                dark:border-zinc-700
                dark:bg-zinc-900
                ${className}
              `}
              variants={desktopVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: modalDuration, ease: easeOut }}
            >
              <div className="max-h-[80vh] supports-[height:100dvh]:max-h-[80dvh] overflow-y-auto overscroll-contain">
                {children}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
