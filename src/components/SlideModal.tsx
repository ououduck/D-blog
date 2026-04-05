import React, { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

interface SlideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  onCloseCallback?: () => void;
  initialFocusRef?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
  className?: string;
  ariaLabelledby?: string;
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
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const hasCalledOpenRef = useRef(false);
  const hasCalledCloseRef = useRef(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      const handleChange = () => {
        setIsMobile(window.innerWidth <= 768);
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, []);

  const handleOpen = useCallback(() => {
    if (!hasCalledOpenRef.current && onOpen) {
      onOpen();
      hasCalledOpenRef.current = true;
    }
  }, [onOpen]);

  const handleClose = useCallback(() => {
    if (!hasCalledCloseRef.current && onCloseCallback) {
      onCloseCallback();
      hasCalledCloseRef.current = true;
    }
  }, [onCloseCallback]);

  useEffect(() => {
    if (isOpen) {
      previousActiveElementRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

      const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) {
        document.body.style.paddingRight = `${scrollbarWidth}px`;
      }

      hasCalledOpenRef.current = false;
      hasCalledCloseRef.current = false;
      setIsVisible(true);
      setIsAnimating(false);

      const frame = requestAnimationFrame(() => {
        setIsAnimating(true);
        handleOpen();
      });

      return () => window.cancelAnimationFrame(frame);
    }

    if (!isVisible) {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      return;
    }

    hasCalledOpenRef.current = false;
    hasCalledCloseRef.current = false;
    setIsAnimating(false);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reducedMotion ? 0 : (isMobile ? 300 : 400);

    const timer = window.setTimeout(() => {
      setIsVisible(false);
      handleClose();
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';

      if (previousActiveElementRef.current) {
        requestAnimationFrame(() => {
          previousActiveElementRef.current?.focus();
        });
      }
    }, duration);

    return () => window.clearTimeout(timer);
  }, [isOpen, isVisible, isMobile, handleOpen, handleClose]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reducedMotion ? 0 : (isMobile ? 150 : 200);

    if (initialFocusRef?.current) {
      const timer = setTimeout(() => {
        initialFocusRef.current?.focus();
      }, duration);
      
      return () => {
        clearTimeout(timer);
        window.removeEventListener('keydown', handleKeyDown);
      };
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isMobile, onClose, initialFocusRef]);

  useEffect(() => {
    return () => {
      document.body.style.overflow = '';
      document.body.style.paddingRight = '';
      if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
      }
    };
  }, []);

  if (!isVisible || typeof document === 'undefined') {
    return null;
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobileDuration = reducedMotion ? 0 : 300;
  const desktopDuration = reducedMotion ? 0 : 400;

  const getTransitionStyle = (duration: number) => ({
    transition: reducedMotion 
      ? 'opacity 150ms ease, visibility 150ms ease' 
      : `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1), opacity ${duration}ms ease`,
  });

  const mobileStyles = isMobile ? {
    ...getTransitionStyle(mobileDuration),
    transform: isAnimating ? 'translateY(0)' : 'translateY(100%)',
    opacity: isAnimating ? 1 : 0,
  } : {};

  const desktopStyles = !isMobile ? {
    ...getTransitionStyle(desktopDuration),
    transform: isAnimating ? 'translateY(0)' : 'translateY(24px)',
    opacity: isAnimating ? 1 : 0,
  } : {};

  return createPortal(
    <div
      className={`fixed inset-0 z-[110] flex justify-center ${isMobile ? 'items-end' : 'items-center'}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledby}
    >
      <div
        className={`
          fixed inset-0
          bg-black/60
          backdrop-blur-sm
          dark:bg-black/80
          ${isAnimating ? 'opacity-100' : 'opacity-0'}
        `}
        style={{
          transition: reducedMotion
            ? 'opacity 150ms ease'
            : `opacity ${mobileDuration}ms ease`,
        }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="sr-only" aria-live="polite">
        {isOpen ? '弹窗已打开' : '弹窗已关闭'}
      </div>

      {isMobile ? (
        <div
          ref={modalRef}
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
            maxHeight: '85vh',
            ...mobileStyles,
          }}
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
        </div>
      ) : (
        <div
          ref={modalRef}
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
          style={{
            maxHeight: '80vh',
            ...desktopStyles,
          }}
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
        </div>
      )}
    </div>,
    document.body
  );
};
