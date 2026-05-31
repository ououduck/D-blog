import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ZoomIn, ZoomOut, RotateCcw, Download } from 'lucide-react';
import { useModalOverlay } from '@/hooks/useModalOverlay';

interface ImageViewerProps {
  src: string | null;
  alt?: string;
  onClose: () => void;
}

const MIN_SCALE = 0.5;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.25;

export const ImageViewer: React.FC<ImageViewerProps> = ({ src, alt, onClose }) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const isOpen = Boolean(src);

  useModalOverlay({
    isOpen,
    onClose,
    initialFocusRef: closeButtonRef
  });

  // Reset state when image changes
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [src]);

  const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setScale((prev) => clampScale(prev + delta));
  }, []);

  const handleZoomIn = () => setScale((prev) => clampScale(prev + ZOOM_STEP));
  const handleZoomOut = () => setScale((prev) => clampScale(prev - ZOOM_STEP));
  const handleReset = () => { setScale(1); setPosition({ x: 0, y: 0 }); };

  const handleDownload = () => {
    if (!src) return;
    const a = document.createElement('a');
    a.href = src;
    a.download = alt || 'image';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Mouse drag for panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({ x: dragStartRef.current.posX + dx, y: dragStartRef.current.posY + dy });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch drag for panning
  const touchStartRef = useRef<{ x: number; y: number; posX: number; posY: number; dist: number } | null>(null);
  const [isPinching, setIsPinching] = useState(false);
  const pinchStartScaleRef = useRef(1);
  const pinchStartDistRef = useRef(0);

  const getTouchDist = (touches: React.TouchList) => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, posX: position.x, posY: position.y, dist: 0 };
    } else if (e.touches.length === 2) {
      setIsPinching(true);
      pinchStartScaleRef.current = scale;
      pinchStartDistRef.current = getTouchDist(e.touches);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isPinching && e.touches.length === 2) {
      const currentDist = getTouchDist(e.touches);
      const ratio = currentDist / (pinchStartDistRef.current || 1);
      setScale(clampScale(pinchStartScaleRef.current * ratio));
      return;
    }
    if (touchStartRef.current && e.touches.length === 1 && scale > 1) {
      const dx = e.touches[0].clientX - touchStartRef.current.x;
      const dy = e.touches[0].clientY - touchStartRef.current.y;
      setPosition({ x: touchStartRef.current.posX + dx, y: touchStartRef.current.posY + dy });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setIsPinching(false);
    touchStartRef.current = null;
  };

  useEffect(() => {
    const handleWheelEvent = (e: WheelEvent) => {
      if (isOpen) handleWheel(e);
    };
    window.addEventListener('wheel', handleWheelEvent, { passive: false });
    return () => window.removeEventListener('wheel', handleWheelEvent);
  }, [isOpen, handleWheel]);

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
          onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
          className="fixed inset-0 z-[120] flex cursor-default items-center justify-center bg-black/92 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={alt ? `图片预览：${alt}` : '图片预览'}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* Close button */}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={(event) => { event.stopPropagation(); onClose(); }}
            className="absolute right-4 top-4 z-50 rounded-full bg-white/10 p-2 text-white/70 transition-colors hover:bg-white/20 hover:text-white"
            aria-label="关闭图片预览"
          >
            <X size={24} />
          </button>

          {/* Toolbar */}
          <div className="absolute bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-1 rounded-full bg-white/10 px-2 py-1.5 backdrop-blur-xl">
            <button onClick={handleZoomOut} className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white" aria-label="缩小" title="缩小">
              <ZoomOut size={18} />
            </button>
            <span className="min-w-[3rem] text-center text-xs font-medium text-white/80 tabular-nums">
              {Math.round(scale * 100)}%
            </span>
            <button onClick={handleZoomIn} className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white" aria-label="放大" title="放大">
              <ZoomIn size={18} />
            </button>
            <span className="mx-0.5 h-4 w-px bg-white/20" />
            <button onClick={handleReset} className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white" aria-label="重置" title="重置">
              <RotateCcw size={16} />
            </button>
            <button onClick={handleDownload} className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white" aria-label="下载" title="下载原图">
              <Download size={16} />
            </button>
          </div>

          <motion.img
            ref={imageRef}
            layoutId={`image-${src}`}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{
              scale: 1,
              opacity: 1,
              x: position.x,
              y: position.y,
            }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            src={src}
            alt={alt || ''}
            draggable={false}
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            style={{
              transform: `scale(${scale})`,
              cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
              maxHeight: '90vh',
              maxWidth: '90vw',
              objectFit: 'contain',
            }}
            className="rounded-lg shadow-2xl transition-transform duration-100 select-none"
            onClick={(event) => event.stopPropagation()}
          />

          {alt && (
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="absolute bottom-20 left-0 right-0 px-4 text-center text-sm text-white/60"
            >
              {alt}
            </motion.p>
          )}

          {/* Keyboard shortcuts hint */}
          <div className="absolute left-4 top-4 text-[10px] text-white/25">
            滚轮缩放 · 拖拽平移 · 双指缩放
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};