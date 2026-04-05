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
  } : {};

  const desktopStyles = !isMobile ? {
    ...getTransitionStyle(desktopDuration),
    transform: isAnimating ? 'translateY(0)' : 'translateY(24px)',
    opacity: isAnimating ? 1 : 0,
  } : {};

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center"
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
            max-h-[80vh]
            overflow-hidden
            rounded-b-3xl
            border-t
            border-zinc-200
            bg-white
            shadow-2xl
            dark:border-zinc-800
            dark:bg-zinc-900
            will-change-transform
            ${className}
          `}
          style={{
            top: 0,
            paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))',
            maxHeight: '80vh',
            ...mobileStyles,
          }}
        >
          <div
            className="overflow-y-auto"
            style={{
              maxHeight: 'calc(80vh - 32px)',
              padding: '16px',
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
            max-w-md
            max-h-[80vh]
            overflow-hidden
            rounded-2xl
            border
            border-zinc-200
            bg-white
            shadow-2xl
            dark:border-zinc-800
            dark:bg-zinc-900
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
              padding: '16px',
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
