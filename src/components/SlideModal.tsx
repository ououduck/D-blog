import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useModalOverlay } from '@/hooks/useModalOverlay';

interface SlideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  onCloseCallback?: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
  ariaLabelledby?: string;
  ariaDescribedby?: string;
}

export const SlideModal: React.FC<SlideModalProps> = ({
  isOpen,
  onClose,
  onOpen,
  onCloseCallback,
  initialFocusRef,
  children,
  className = '',
  ariaLabelledby,
  ariaDescribedby,
}) => {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isMobile, setIsMobile] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const hasCalledOpenRef = useRef(false);
  const hasCalledCloseRef = useRef(false);

  const reducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  useModalOverlay({
    isOpen,
    onClose,
    initialFocusRef,
    containerRef: modalRef
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleOpen = useCallback(() => {
    if (!hasCalledOpenRef.current && onOpen) {
      onOpen();
      hasCalledOpenRef.current = true;
    }
  }, [onOpen]);

  const restoreState = useCallback(() => {
    if (!hasCalledCloseRef.current && onCloseCallback) {
      onCloseCallback();
      hasCalledCloseRef.current = true;
    }
  }, [onCloseCallback]);

  useEffect(() => {
    if (!isOpen) {
      if (shouldRender && reducedMotion) {
        setShouldRender(false);
        restoreState();
      }
      return;
    }

    hasCalledOpenRef.current = false;
    hasCalledCloseRef.current = false;
    setShouldRender(true);

    const frame = requestAnimationFrame(() => {
      handleOpen();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, shouldRender, reducedMotion, handleOpen, restoreState]);

  if ((!shouldRender && !isOpen) || typeof document === 'undefined') {
    return null;
  }

  const overlayDuration = reducedMotion ? 0.1 : 0.16;
  const modalDuration = reducedMotion ? 0 : 0.18;
  const desktopVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 }
  };
  const mobileVariants = {
    hidden: { opacity: 0, y: reducedMotion ? 0 : 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: reducedMotion ? 0 : 16 }
  };

  return createPortal(
    <AnimatePresence
      onExitComplete={() => {
        if (!isOpen) {
          setShouldRender(false);
          restoreState();
        }
      }}
    >
      {isOpen && (
        <motion.div
          ref={modalRef}
          key="slide-modal"
          tabIndex={-1}
          className={`fixed inset-0 z-[110] flex justify-center ${isMobile ? 'items-end' : 'items-center'}`}
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
          <div className="sr-only" aria-live="polite">
            {isOpen ? '弹窗已打开' : '弹窗已关闭'}
          </div>

          {isMobile ? (
            <motion.div
              className={`
                relative z-10
                w-full
                max-h-[85vh]
                supports-[height:100dvh]:max-h-[85dvh]
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
              style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
              variants={mobileVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: modalDuration, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="flex justify-center px-4 pt-3">
                <div className="h-1.5 w-14 rounded-full bg-zinc-300/80 dark:bg-zinc-700/80" />
              </div>
              <div className="max-h-[calc(85vh-18px)] supports-[height:100dvh]:max-h-[calc(85dvh-18px)] overflow-y-auto">
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
              transition={{ duration: modalDuration, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="max-h-[80vh] supports-[height:100dvh]:max-h-[80dvh] overflow-y-auto">
                {children}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
