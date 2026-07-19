import { useEffect, type RefObject, useRef } from 'react';

interface UseModalOverlayOptions {
  isOpen: boolean;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
  containerRef?: RefObject<HTMLElement | null>;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  'object',
  'embed',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

const openOverlayStack: symbol[] = [];
let scrollLockCount = 0;
let originalBodyOverflow = '';

const getFocusableElements = (container: HTMLElement) => (
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.getAttribute('aria-hidden') === 'true' || element.closest('[inert]')) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none';
  })
);

const lockBodyScroll = () => {
  if (scrollLockCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  scrollLockCount += 1;
};

const unlockBodyScroll = () => {
  scrollLockCount = Math.max(0, scrollLockCount - 1);

  if (scrollLockCount === 0) {
    document.body.style.overflow = originalBodyOverflow;
  }
};

export function useModalOverlay({
  isOpen,
  onClose,
  initialFocusRef,
  containerRef
}: UseModalOverlayOptions) {
  const overlayIdRef = useRef(Symbol('modal-overlay'));
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const overlayId = overlayIdRef.current;
    previousActiveElementRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    openOverlayStack.push(overlayId);
    lockBodyScroll();

    const getContainer = () => containerRef?.current
      ?? initialFocusRef?.current?.closest<HTMLElement>('[role="dialog"], [aria-modal="true"]')
      ?? null;

    const focusFrame = window.requestAnimationFrame(() => {
      const container = getContainer();
      const focusTarget = initialFocusRef?.current
        ?? (container ? getFocusableElements(container)[0] : null)
        ?? container;
      focusTarget?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openOverlayStack[openOverlayStack.length - 1] !== overlayId) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const container = getContainer();
      if (!container) {
        return;
      }

      const focusableElements = getFocusableElements(container);
      if (focusableElements.length === 0) {
        event.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey && (activeElement === firstElement || !container.contains(activeElement))) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && (activeElement === lastElement || !container.contains(activeElement))) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);

      const stackIndex = openOverlayStack.lastIndexOf(overlayId);
      if (stackIndex >= 0) {
        openOverlayStack.splice(stackIndex, 1);
      }
      unlockBodyScroll();

      const previousActiveElement = previousActiveElementRef.current;
      previousActiveElementRef.current = null;
      if (previousActiveElement?.isConnected) {
        window.requestAnimationFrame(() => {
          previousActiveElement.focus({ preventScroll: true });
        });
      }
    };
  }, [containerRef, initialFocusRef, isOpen]);
}
