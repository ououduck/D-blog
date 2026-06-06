import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

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
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const hasCalledOpenRef = useRef(false);
  const hasCalledCloseRef = useRef(false);

  const reducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
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
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';

    if (!hasCalledCloseRef.current && onCloseCallback) {
      onCloseCallback();
      hasCalledCloseRef.current = true;
    }

    if (previousActiveElementRef.current) {
      requestAnimationFrame(() => {
        previousActiveElementRef.current?.focus();
      });
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

    previousActiveElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.paddingRight = scrollbarWidth > 0 ? `${scrollbarWidth}px` : '';

    hasCalledOpenRef.current = false;
    hasCalledCloseRef.current = false;
    setShouldRender(true);

    const frame = requestAnimationFrame(() => {
      handleOpen();
    });

    return () => window.cancelAnimationFrame(frame);
  }, [isOpen, shouldRender, reducedMotion, handleOpen, restoreState]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    if (initialFocusRef?.current) {
      const timer = window.setTimeout(() => {
        initialFocusRef.current?.focus();
      }, reducedMotion ? 0 : (isMobile ? 150 : 200));

      return () => {
        window.clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isMobile, onClose, initialFocusRef, reducedMotion]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
    };
  }, []);

  if ((!shouldRender && !isOpen) || typeof document === 'undefined') {
    return null;
  }

  const overlayDuration = reducedMotion ? 0.15 : 0.3;
  const modalDuration = reducedMotion ? 0 : (isMobile ? 0.3 : 0.4);
  const modalVariants = {
    hidden: isMobile ? { y: '100%', opacity: 0 } : { y: 24, opacity: 0 },
    visible: { y: 0, opacity: 1 },
    exit: isMobile ? { y: '100%', opacity: 0 } : { y: 24, opacity: 0 }
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
          key="slide-modal"
          className={`fixed inset-0 z-[110] flex justify-center ${isMobile ? 'items-end' : 'items-center'}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby={ariaLabelledby || undefined}
          aria-describedby={ariaDescribedby || undefined}
        >
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm dark:bg-black/80"
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
                overflow-hidden
                rounded-t-[28px]
                border border-b-0
                border-zinc-200/80
                bg-white/95
                shadow-[0_-24px_80px_rgba(15,23,42,0.18)]
                backdrop-blur-xl
                dark:border-zinc-800/80
                dark:bg-zinc-900/95
                dark:shadow-[0_-24px_80px_rgba(0,0,0,0.45)]
                will-change-transform
                ${className}
              `}
              style={{
                paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
                maxHeight: '85vh'
              }}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: modalDuration, ease: [0.4, 0, 0.2, 1] }}
            >
              <div className="flex justify-center px-4 pt-3">
                <div className="h-1.5 w-14 rounded-full bg-zinc-300/80 dark:bg-zinc-700/80" />
              </div>
              <div
                className="overflow-y-auto"
                style={{
                  maxHeight: 'calc(85vh - 40px)',
                  padding: '12px 16px 16px',
                }}
              >
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
                overflow-hidden
                rounded-[28px]
                border
                border-zinc-200/80
                bg-white/95
                shadow-[0_32px_100px_rgba(15,23,42,0.22)]
                backdrop-blur-xl
                dark:border-zinc-800/80
                dark:bg-zinc-900/95
                dark:shadow-[0_32px_100px_rgba(0,0,0,0.45)]
                will-change-transform
                ${className}
              `}
              style={{ maxHeight: '80vh' }}
              variants={modalVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              transition={{ duration: modalDuration, ease: [0.4, 0, 0.2, 1] }}
            >
              <div
                className="overflow-y-auto"
                style={{
                  maxHeight: 'calc(80vh - 32px)',
                  padding: '20px',
                }}
              >
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
