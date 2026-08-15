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
  '[tabindex]:not([tabindex="-1"])',
].join(',');

const openOverlayStack: symbol[] = [];
let scrollLockCount = 0;

/** 页面级快捷键使用此查询，避免在弹层打开时误触发背景交互。 */
export const hasOpenOverlay = () => openOverlayStack.length > 0;
let originalBodyOverflow = '';

/**
 * 共享的页面滚动锁（计数式）。多个弹层/抽屉叠加时只有第一个捕获原始值、
 * 最后一个恢复，避免相互覆盖导致页面永久锁滚或弹层未关就恢复滚动。
 * 移动端导航等非弹层入口也应复用本锁，不要单独操作 body.style.overflow。
 */
export const lockBodyScroll = () => {
  if (scrollLockCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }

  scrollLockCount += 1;
};

export const unlockBodyScroll = () => {
  scrollLockCount = Math.max(0, scrollLockCount - 1);

  if (scrollLockCount === 0) {
    document.body.style.overflow = originalBodyOverflow;
  }
};

const getFocusableElements = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.getAttribute('aria-hidden') === 'true' || element.closest('[inert]')) {
      return false;
    }

    const style = window.getComputedStyle(element);
    return style.visibility !== 'hidden' && style.display !== 'none';
  });

export function useModalOverlay({ isOpen, onClose, initialFocusRef, containerRef }: UseModalOverlayOptions) {
  const overlayIdRef = useRef(Symbol('modal-overlay'));
  const previousActiveElementRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const overlayId = overlayIdRef.current;
    previousActiveElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openOverlayStack.push(overlayId);
    lockBodyScroll();

    const getContainer = () =>
      containerRef?.current ??
      initialFocusRef?.current?.closest<HTMLElement>('[role="dialog"], [aria-modal="true"]') ??
      null;

    const focusFrame = window.requestAnimationFrame(() => {
      const container = getContainer();
      const focusTarget =
        initialFocusRef?.current ?? (container ? getFocusableElements(container)[0] : null) ?? container;
      focusTarget?.focus({ preventScroll: true });
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (openOverlayStack[openOverlayStack.length - 1] !== overlayId) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
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

      // 仅当本弹层是栈中最后一个（关闭后无其他弹层）时恢复焦点：
      // 关闭下层弹层而上方仍有弹层时恢复焦点会把焦点从上层弹层抢走。
      const previousActiveElement = previousActiveElementRef.current;
      previousActiveElementRef.current = null;
      if (openOverlayStack.length === 0 && previousActiveElement?.isConnected) {
        window.requestAnimationFrame(() => {
          previousActiveElement.focus({ preventScroll: true });
        });
      }
    };
  }, [containerRef, initialFocusRef, isOpen]);
}
