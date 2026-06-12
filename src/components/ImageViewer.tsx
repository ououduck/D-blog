import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Maximize2, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { useModalOverlay } from '@/hooks/useModalOverlay';

interface ImageViewerProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.35;
const DOUBLE_TAP_DELAY = 280;

const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
const getTouchDistance = (touches: React.TouchList) => {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
};

export const ImageViewer: React.FC<ImageViewerProps> = ({ src, alt, onClose }) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const touchStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const pinchStartRef = useRef({ distance: 0, scale: 1 });
  const lastTapRef = useRef(0);
  const isOpen = Boolean(src);

  useModalOverlay({
    isOpen,
    onClose,
    initialFocusRef: closeButtonRef
  });

  const resetView = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    resetView();
    setIsLoaded(false);
  }, [src, resetView]);

  useEffect(() => {
    if (scale <= 1) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  const zoomTo = useCallback((nextScale: number) => {
    setScale(clampScale(nextScale));
  }, []);

  const handleZoomIn = () => zoomTo(scale + ZOOM_STEP);
  const handleZoomOut = () => zoomTo(scale - ZOOM_STEP);
  const handleToggleZoom = () => zoomTo(scale > 1 ? 1 : 2.4);

  const handleDownload = () => {
    if (!src) return;
    const link = document.createElement('a');
    link.href = src;
    link.download = alt?.trim() || 'image';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleWheel = useCallback((event: WheelEvent) => {
    if (!isOpen) return;
    event.preventDefault();
    const direction = event.deltaY > 0 ? -1 : 1;
    setScale((current) => clampScale(current + direction * ZOOM_STEP));
  }, [isOpen]);

  useEffect(() => {
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        setScale((current) => clampScale(current + ZOOM_STEP));
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        setScale((current) => clampScale(current - ZOOM_STEP));
      }
      if (event.key === '0') {
        event.preventDefault();
        resetView();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, resetView]);

  const handleMouseDown = (event: React.MouseEvent) => {
    if (scale <= 1) return;
    event.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: event.clientX, y: event.clientY, posX: position.x, posY: position.y };
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = event.clientX - dragStartRef.current.x;
    const dy = event.clientY - dragStartRef.current.y;
    setPosition({ x: dragStartRef.current.posX + dx, y: dragStartRef.current.posY + dy });
  };

  const stopDragging = () => setIsDragging(false);

  const handleTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length === 1) {
      const now = Date.now();
      if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
        event.preventDefault();
        handleToggleZoom();
      }
      lastTapRef.current = now;
      touchStartRef.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
        posX: position.x,
        posY: position.y
      };
      return;
    }

    if (event.touches.length === 2) {
      event.preventDefault();
      pinchStartRef.current = { distance: getTouchDistance(event.touches), scale };
    }
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      const ratio = getTouchDistance(event.touches) / (pinchStartRef.current.distance || 1);
      zoomTo(pinchStartRef.current.scale * ratio);
      return;
    }

    if (event.touches.length === 1 && touchStartRef.current && scale > 1) {
      event.preventDefault();
      const dx = event.touches[0].clientX - touchStartRef.current.x;
      const dy = event.touches[0].clientY - touchStartRef.current.y;
      setPosition({ x: touchStartRef.current.posX + dx, y: touchStartRef.current.posY + dy });
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    pinchStartRef.current = { distance: 0, scale };
    stopDragging();
  };

  const toolbarLabel = useMemo(() => `${Math.round(scale * 100)}%`, [scale]);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
          className="fixed inset-0 z-[120] flex cursor-default items-center justify-center overflow-hidden bg-zinc-950/95 p-3 text-white backdrop-blur-md sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={alt ? `图片预览：${alt}` : '图片预览'}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDragging}
          onMouseLeave={stopDragging}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.12),transparent_34%),linear-gradient(180deg,rgba(0,0,0,0.1),rgba(0,0,0,0.48))]" />

          <div className="absolute left-3 right-3 top-3 z-50 flex items-center justify-between gap-3 sm:left-5 sm:right-5 sm:top-5">
            <div className="min-w-0 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs text-white/65 shadow-2xl backdrop-blur-xl sm:px-4">
              <span className="hidden sm:inline">滚轮缩放 · 拖拽平移 · 双击放大</span>
              <span className="sm:hidden">双指缩放 · 双击放大</span>
            </div>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={(event) => { event.stopPropagation(); onClose(); }}
              className="rounded-full border border-white/10 bg-white/10 p-2.5 text-white/75 shadow-2xl backdrop-blur-xl transition hover:bg-white/20 hover:text-white"
              aria-label="关闭图片预览"
            >
              <X size={22} />
            </button>
          </div>

          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 12 }}
            animate={{ scale, opacity: isLoaded ? 1 : 0.35, x: position.x, y: position.y }}
            exit={{ scale: 0.96, opacity: 0, y: 12 }}
            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
            className="relative max-h-[86vh] max-w-[94vw] touch-none select-none"
            style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
            onMouseDown={handleMouseDown}
            onDoubleClick={(event) => { event.stopPropagation(); handleToggleZoom(); }}
            onTouchStart={handleTouchStart}
            onClick={(event) => event.stopPropagation()}
          >
            {!isLoaded && (
              <div className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/20 border-t-white/80 animate-spin" />
            )}
            <img
              src={src}
              alt={alt || ''}
              draggable={false}
              onLoad={() => setIsLoaded(true)}
              className="max-h-[86vh] max-w-[94vw] rounded-xl object-contain shadow-[0_30px_100px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
            />
          </motion.div>

          <div className="absolute bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-zinc-950/55 p-1.5 shadow-2xl backdrop-blur-xl sm:bottom-6">
            <button onClick={handleZoomOut} className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-35" aria-label="缩小" title="缩小" disabled={scale <= MIN_SCALE}>
              <Minus size={17} />
            </button>
            <span className="min-w-[3.25rem] text-center text-xs font-semibold text-white/80 tabular-nums">{toolbarLabel}</span>
            <button onClick={handleZoomIn} className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-35" aria-label="放大" title="放大" disabled={scale >= MAX_SCALE}>
              <Plus size={17} />
            </button>
            <span className="mx-1 h-5 w-px bg-white/15" />
            <button onClick={handleToggleZoom} className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="切换缩放" title="切换缩放">
              <Maximize2 size={16} />
            </button>
            <button onClick={resetView} className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="重置" title="重置">
              <RotateCcw size={16} />
            </button>
            <button onClick={handleDownload} className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white" aria-label="下载" title="下载原图">
              <Download size={16} />
            </button>
          </div>

          {alt && (
            <motion.p
              initial={{ y: 16, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.12 }}
              className="absolute bottom-[4.75rem] left-1/2 z-40 max-w-[min(42rem,88vw)] -translate-x-1/2 rounded-full border border-white/10 bg-black/25 px-4 py-2 text-center text-xs text-white/65 shadow-2xl backdrop-blur-xl sm:bottom-20 sm:text-sm"
            >
              {alt}
            </motion.p>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
