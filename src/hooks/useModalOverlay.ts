import { useEffect, RefObject, useRef } from 'react';

interface UseModalOverlayOptions {
  isOpen: boolean;
  onClose: () => void;
  initialFocusRef?: RefObject<HTMLElement | null>;
}

export function useModalOverlay({ isOpen, onClose, initialFocusRef }: UseModalOverlayOptions) {
  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Save previous focus
    previousActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Set focus to modal
    if (initialFocusRef?.current) {
      // Use setTimeout to ensure the element is rendered and can receive focus
      window.setTimeout(() => {
        initialFocusRef.current?.focus();
      }, 50);
    }

    // Scroll lock and prevent layout shift
    const originalOverflow = document.body.style.overflow;
    const originalPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = 'hidden';
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    // Handle ESC key
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      // Restore scroll and padding
      document.body.style.overflow = originalOverflow;
      document.body.style.paddingRight = originalPaddingRight;

      // Remove event listener
      window.removeEventListener('keydown', handleKeyDown);

      // Restore focus
      if (previousActiveElementRef.current) {
        const elem = previousActiveElementRef.current;
        window.setTimeout(() => elem.focus(), 0);
      }
    };
  }, [isOpen, onClose, initialFocusRef]);
}
