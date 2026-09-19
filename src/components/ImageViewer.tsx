/**
 * 图片查看器（微信式极简 Lightbox）：打开即看图，操作 UI 按需出现、自动隐藏。
 *
 * 交互与能力：
 * - 单图 / 多图画廊（上一张/下一张、键盘方向键、桌面淡箭头、移动端横滑切换）
 * - 缩放：滚轮以指针为焦点、双指捏合以两指中心为焦点、双击 100%↔240%、
 *   工具栏 ±（键盘 +/-/0）；缩放后拖拽平移（边界钳制）
 * - UI 自动隐藏：鼠标移动/点击图片/键盘操作唤出工具栏与标题，约 2.5s 无操作淡出；
 *   关闭按钮与页码常驻（页码仅多图）
 * - 相邻图片预加载（±1）+ 已加载缓存：切换画廊尽量不重复出现 loading
 * - caption 仅在图片有真实 title 时显示（alt 只保留无障碍语义，不作视觉 caption）
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useModalOverlay } from '@/hooks/useModalOverlay';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { downloadBlob } from '@/utils/download';
import { ImageViewerToolbar } from './ImageViewerToolbar';

export interface ImageViewerImage {
  src: string;
  alt?: string;
  /** 真实图片标题（Markdown title 等）：存在时才作为视觉 caption 显示。 */
  title?: string;
}

interface ImageViewerProps {
  /** 单图模式（向后兼容）：src/alt 直接构造单元素画廊。 */
  src: string | null;
  alt?: string;
  /** 画廊模式：提供时优先于 src/alt。 */
  images?: ImageViewerImage[];
  /** 打开时定位到的图片下标（画廊模式）。 */
  initialIndex?: number;
  onClose: () => void;
  /** UI 自动隐藏间隔（毫秒）：默认 2500，测试可注入更小值。 */
  uiHideDelayMs?: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.35;
/** 双击/双击切放的明确目标倍率（不做逐级变焦）。 */
const DOUBLE_TAP_SCALE = 2.4;
const DOUBLE_TAP_DELAY = 280;
/** UI 自动隐藏间隔：唤出后约 2.5s 无操作淡出（图片本身永不淡出）。 */
const UI_HIDE_DELAY_MS = 2500;
/** 触屏横滑切换阈值：水平位移超过该值且明显大于垂直位移才判定为切换。 */
const SWIPE_MIN_DISTANCE = 48;
const SWIPE_AXIS_RATIO = 1.2;

const clampScale = (scale: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
const getTouchDistance = (touches: React.TouchList) => {
  if (touches.length < 2) return 0;
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
};
const getTouchMidpoint = (touches: React.TouchList) => ({
  x: (touches[0].clientX + touches[1].clientX) / 2,
  y: (touches[0].clientY + touches[1].clientY) / 2,
});

const clampToRange = (value: number, bound: number) => Math.min(bound, Math.max(-bound, value));

/**
 * 计算缩放后图片相对视口的可平移范围。
 * img.offsetWidth/Height 返回的是不含 transform 的布局尺寸；
 * 缩放后显示尺寸 = 布局尺寸 × scale，超出视口的部分除以 2 即为
 * 各轴向允许拖动的最大距离，防止图片被拖出屏幕后无法找回。
 */
const computePanBounds = (img: HTMLImageElement, scale: number) => ({
  maxX: Math.max(0, (img.offsetWidth * scale - window.innerWidth) / 2),
  maxY: Math.max(0, (img.offsetHeight * scale - window.innerHeight) / 2),
});

export const ImageViewer: React.FC<ImageViewerProps> = ({
  src,
  alt,
  images,
  initialIndex,
  onClose,
  uiHideDelayMs = UI_HIDE_DELAY_MS,
}) => {
  const viewerRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasError, setHasError] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const touchStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const pinchStartRef = useRef({ distance: 0, scale: 1, sx: 0, sy: 0, rx: 0, ry: 0, px: 0, py: 0 });
  // 触屏横滑：start/last 记录单指轨迹；multiTouch 标记本次手势出现过双指。
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const swipeLastRef = useRef<{ x: number; y: number } | null>(null);
  const multiTouchRef = useRef(false);
  // 轻点（tap）判定：上一次 tap 时间与单击 UI 切换的挂起计时器。
  const lastTapEndRef = useRef(0);
  const singleTapTimerRef = useRef<number | null>(null);

  // ── UI 自动隐藏（单一计时器，无竞争） ──
  const [isUiVisible, setIsUiVisible] = useState(false);
  const uiHideTimerRef = useRef<number | null>(null);
  const clearUiHideTimer = useCallback(() => {
    if (uiHideTimerRef.current !== null) {
      window.clearTimeout(uiHideTimerRef.current);
      uiHideTimerRef.current = null;
    }
  }, []);
  const scheduleUiHide = useCallback(() => {
    clearUiHideTimer();
    uiHideTimerRef.current = window.setTimeout(() => {
      uiHideTimerRef.current = null;
      setIsUiVisible(false);
    }, uiHideDelayMs);
  }, [clearUiHideTimer, uiHideDelayMs]);
  /** 唤出 UI 并重置隐藏计时（任何用户交互都走这里）。 */
  const showUi = useCallback(() => {
    setIsUiVisible(true);
    scheduleUiHide();
  }, [scheduleUiHide]);
  /** 移动端轻点图片：显示 → 隐藏切换。 */
  const toggleUi = useCallback(() => {
    setIsUiVisible((visible) => {
      if (visible) {
        clearUiHideTimer();
        return false;
      }
      scheduleUiHide();
      return true;
    });
  }, [clearUiHideTimer, scheduleUiHide]);
  useEffect(() => clearUiHideTimer, [clearUiHideTimer]);
  useEffect(
    () => () => {
      if (singleTapTimerRef.current !== null) {
        window.clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
    },
    [],
  );

  // ── 画廊 ──
  const gallery = useMemo<ImageViewerImage[]>(() => {
    if (images && images.length > 0) {
      return images;
    }
    return src ? [{ src, alt }] : [];
  }, [images, src, alt]);
  const [currentIndex, setCurrentIndex] = useState(() =>
    initialIndex && Number.isFinite(initialIndex) ? Math.max(0, initialIndex) : 0,
  );
  const safeIndex = Math.min(currentIndex, Math.max(gallery.length - 1, 0));
  const currentImage = gallery[safeIndex];
  const isOpen = gallery.length > 0;
  const displaySrc = currentImage?.src ?? null;
  const displayAlt = currentImage?.alt ?? alt;
  const caption = currentImage?.title;
  const canNavigate = gallery.length > 1;
  const hasPrev = canNavigate && safeIndex > 0;
  const hasNext = canNavigate && safeIndex < gallery.length - 1;

  useModalOverlay({
    isOpen,
    onClose,
    initialFocusRef: closeButtonRef,
    containerRef: viewerRef,
  });

  // ── 加载状态（含已加载缓存：切换回已预加载的图片不闪 loading） ──
  const loadedSrcsRef = useRef<Set<string>>(new Set());
  const [loadedFlag, setLoadedFlag] = useState(() => ({ src: displaySrc, loaded: false }));
  // 派生状态模式：src 变化时在渲染期同步重置（避免 effect 迟一帧闪 spinner）。
  if (loadedFlag.src !== displaySrc) {
    setLoadedFlag({ src: displaySrc, loaded: loadedSrcsRef.current.has(displaySrc ?? '') });
  }
  const isLoaded = loadedFlag.loaded;
  const [retrySrcKey, setRetrySrcKey] = useState(0);

  const resetView = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  // 切换图片：视图复位 + 错误态复位（加载态已由上方派生逻辑处理）。
  useEffect(() => {
    resetView();
    setHasError(false);
  }, [displaySrc, resetView]);

  // 相邻图片预加载（±1）：左右切换尽量直接命中缓存，不再闪 loading。
  useEffect(() => {
    if (!canNavigate) {
      return;
    }
    [safeIndex - 1, safeIndex + 1].forEach((neighborIndex) => {
      const neighbor = gallery[neighborIndex];
      if (!neighbor || loadedSrcsRef.current.has(neighbor.src)) {
        return;
      }
      const image = new Image();
      image.onload = () => {
        loadedSrcsRef.current.add(neighbor.src);
      };
      image.src = neighbor.src;
    });
  }, [canNavigate, gallery, safeIndex]);

  const goPrev = useCallback(() => {
    showUi();
    setCurrentIndex((current) => Math.max(0, current - 1));
  }, [showUi]);
  const goNext = useCallback(() => {
    showUi();
    setCurrentIndex((current) => Math.min(gallery.length - 1, current + 1));
  }, [gallery.length, showUi]);

  // ── 缩放（以操作点为焦点：指针/捏合中心在缩放前后保持屏幕位置） ──
  const zoomAround = useCallback(
    (nextScaleRaw: number, clientX: number, clientY: number) => {
      const img = imgRef.current;
      const nextScale = clampScale(nextScaleRaw);
      if (!img) {
        setScale(nextScale);
        return;
      }
      const ratio = nextScale / scale;
      const rect = img.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const nextX = clampToRange(position.x + (clientX - centerX) * (1 - ratio), computePanBounds(img, nextScale).maxX);
      const nextY = clampToRange(position.y + (clientY - centerY) * (1 - ratio), computePanBounds(img, nextScale).maxY);
      setScale(nextScale);
      setPosition({ x: nextX, y: nextY });
    },
    [position, scale],
  );

  const getImageCenter = useCallback(() => {
    const rect = imgRef.current?.getBoundingClientRect();
    return {
      x: rect ? rect.left + rect.width / 2 : window.innerWidth / 2,
      y: rect ? rect.top + rect.height / 2 : window.innerHeight / 2,
    };
  }, []);

  /** 双击/双指捏合后的明确缩放切换：100% ↔ 240%，绕操作点缩放。 */
  const toggleZoomAround = useCallback(
    (clientX: number, clientY: number) => {
      zoomAround(scale > 1 ? 1 : DOUBLE_TAP_SCALE, clientX, clientY);
    },
    [scale, zoomAround],
  );

  const handleZoomIn = useCallback(() => {
    const center = getImageCenter();
    zoomAround(scale + ZOOM_STEP, center.x, center.y);
    showUi();
  }, [getImageCenter, scale, showUi, zoomAround]);
  const handleZoomOut = useCallback(() => {
    const center = getImageCenter();
    zoomAround(scale - ZOOM_STEP, center.x, center.y);
    showUi();
  }, [getImageCenter, scale, showUi, zoomAround]);
  const handleToggleZoom = useCallback(() => {
    const center = getImageCenter();
    toggleZoomAround(center.x, center.y);
    showUi();
  }, [getImageCenter, showUi, toggleZoomAround]);
  const handleResetZoom = useCallback(() => {
    resetView();
    showUi();
  }, [resetView, showUi]);

  const handleDownload = useCallback(async () => {
    if (!displaySrc) return;
    const baseName = displayAlt?.trim() || 'image';
    // 跨域图片的 a[download] 会被浏览器忽略而退化为导航打开：先尝试 fetch 成
    // blob 再用 objectURL 触发下载；fetch 失败（CORS 不允许/网络错误）时降级
    // 为新标签打开让用户手动保存，避免静默导航走当前标签。
    try {
      const response = await fetch(displaySrc, { mode: 'cors' });
      if (!response.ok) {
        throw new Error(`unexpected status ${response.status}`);
      }
      const blob = await response.blob();
      // 根据 MIME 类型追加文件扩展名，避免保存出无后缀文件。
      const ext =
        blob.type === 'image/png'
          ? '.png'
          : blob.type === 'image/jpeg'
            ? '.jpeg'
            : blob.type === 'image/webp'
              ? '.webp'
              : blob.type === 'image/gif'
                ? '.gif'
                : blob.type === 'image/svg+xml'
                  ? '.svg'
                  : '';
      downloadBlob(blob, `${baseName}${ext}`);
    } catch {
      window.open(displaySrc, '_blank', 'noopener,noreferrer');
    }
  }, [displaySrc, displayAlt]);

  // ── 滚轮缩放（以指针为焦点） ──
  const handleWheel = useCallback(
    (event: WheelEvent) => {
      if (!isOpen) return;
      event.preventDefault();
      const direction = event.deltaY > 0 ? -1 : 1;
      zoomAround(scale + direction * ZOOM_STEP, event.clientX, event.clientY);
      showUi();
    },
    [isOpen, scale, showUi, zoomAround],
  );

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => window.removeEventListener('wheel', handleWheel);
  }, [handleWheel, isOpen]);

  // ── 键盘 ──
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '+' || event.key === '=') {
        event.preventDefault();
        const center = getImageCenter();
        zoomAround(scale + ZOOM_STEP, center.x, center.y);
        showUi();
      }
      if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        const center = getImageCenter();
        zoomAround(scale - ZOOM_STEP, center.x, center.y);
        showUi();
      }
      if (event.key === '0') {
        event.preventDefault();
        resetView();
        showUi();
      }
      // 画廊切换：仅在未缩放时响应（缩放状态下 ←/→ 保留给平移直觉）。
      if (canNavigate && scale <= 1) {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          goPrev();
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          goNext();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canNavigate, getImageCenter, goNext, goPrev, isOpen, resetView, scale, showUi, zoomAround]);

  // ── 拖拽平移（仅缩放后） ──
  const handlePointerDown = (event: React.PointerEvent) => {
    if (scale <= 1) return;
    event.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: event.clientX, y: event.clientY, posX: position.x, posY: position.y };
    // 捕获指针：拖动中鼠标移出窗口/容器再松开时，pointerup 仍派发给本元素。
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 部分环境（如 jsdom/旧浏览器）不支持 pointer capture，忽略即可。
    }
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    showUi();
    if (!isDragging) return;
    const dx = event.clientX - dragStartRef.current.x;
    const dy = event.clientY - dragStartRef.current.y;
    const img = imgRef.current;
    if (img) {
      const { maxX, maxY } = computePanBounds(img, scale);
      setPosition({
        x: clampToRange(dragStartRef.current.posX + dx, maxX),
        y: clampToRange(dragStartRef.current.posY + dy, maxY),
      });
      return;
    }
    setPosition({ x: dragStartRef.current.posX + dx, y: dragStartRef.current.posY + dy });
  };

  const stopDragging = () => setIsDragging(false);

  // ── 触屏：双指捏合（以两指中心为焦点）/ 单指拖拽 / 横滑切换 / 轻点唤出 UI ──
  const handleTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length === 1) {
      multiTouchRef.current = false;
      swipeStartRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
      swipeLastRef.current = swipeStartRef.current;
      touchStartRef.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
        posX: position.x,
        posY: position.y,
      };
      return;
    }

    if (event.touches.length === 2) {
      event.preventDefault();
      multiTouchRef.current = true;
      swipeStartRef.current = null;
      swipeLastRef.current = null;
      const rect = imgRef.current?.getBoundingClientRect();
      const midpoint = getTouchMidpoint(event.touches);
      pinchStartRef.current = {
        distance: getTouchDistance(event.touches),
        scale,
        sx: midpoint.x,
        sy: midpoint.y,
        rx: rect ? rect.left + rect.width / 2 : 0,
        ry: rect ? rect.top + rect.height / 2 : 0,
        px: position.x,
        py: position.y,
      };
    }
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    if (event.touches.length === 2) {
      event.preventDefault();
      showUi();
      const start = pinchStartRef.current;
      if (start.distance <= 0) {
        return;
      }
      const distance = getTouchDistance(event.touches);
      const nextScale = clampScale(start.scale * (distance / start.distance));
      const ratio = nextScale / start.scale;
      // 焦点缩放：捏合中心（start 时刻）在缩放前后保持屏幕位置。
      const img = imgRef.current;
      const bounds = img ? computePanBounds(img, nextScale) : { maxX: 0, maxY: 0 };
      const nextX = clampToRange(start.px + (start.sx - start.rx) * (1 - ratio), bounds.maxX);
      const nextY = clampToRange(start.py + (start.sy - start.ry) * (1 - ratio), bounds.maxY);
      setScale(nextScale);
      setPosition({ x: nextX, y: nextY });
      return;
    }

    if (event.touches.length === 1) {
      swipeLastRef.current = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    }

    if (event.touches.length === 1 && touchStartRef.current && scale > 1) {
      event.preventDefault();
      showUi();
      const dx = event.touches[0].clientX - touchStartRef.current.x;
      const dy = event.touches[0].clientY - touchStartRef.current.y;
      const img = imgRef.current;
      if (img) {
        const { maxX, maxY } = computePanBounds(img, scale);
        setPosition({
          x: clampToRange(touchStartRef.current.posX + dx, maxX),
          y: clampToRange(touchStartRef.current.posY + dy, maxY),
        });
        return;
      }
      setPosition({ x: touchStartRef.current.posX + dx, y: touchStartRef.current.posY + dy });
    }
  };

  // 轻点（tap）判定：双击窗口内 → 缩放切换；否则轻点唤出/隐藏 UI。
  // touchend 上 preventDefault 阻止浏览器合成 click/dblclick，杜绝双击双重触发。
  const handleTapEnd = (x: number, y: number) => {
    if (scale > 1) {
      showUi();
      return;
    }
    const now = Date.now();
    if (now - lastTapEndRef.current < DOUBLE_TAP_DELAY) {
      lastTapEndRef.current = 0;
      if (singleTapTimerRef.current !== null) {
        window.clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
      toggleZoomAround(x, y);
      showUi();
      return;
    }
    lastTapEndRef.current = now;
    singleTapTimerRef.current = window.setTimeout(() => {
      singleTapTimerRef.current = null;
      toggleUi();
    }, DOUBLE_TAP_DELAY);
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    // 全部手指抬起：先判横滑，再判轻点（缩放状态下属于平移/点按，不切换）。
    if (event.touches.length === 0) {
      const canSwipe =
        canNavigate && scale <= 1 && !multiTouchRef.current && swipeStartRef.current && swipeLastRef.current;
      if (canSwipe) {
        const dx = swipeLastRef.current!.x - swipeStartRef.current!.x;
        const dy = swipeLastRef.current!.y - swipeStartRef.current!.y;
        if (Math.abs(dx) > SWIPE_MIN_DISTANCE && Math.abs(dx) > Math.abs(dy) * SWIPE_AXIS_RATIO) {
          if (dx < 0) {
            goNext();
          } else {
            goPrev();
          }
          swipeStartRef.current = null;
          swipeLastRef.current = null;
          touchStartRef.current = null;
          pinchStartRef.current = { distance: 0, scale, sx: 0, sy: 0, rx: 0, ry: 0, px: 0, py: 0 };
          stopDragging();
          return;
        }
      }

      if (swipeStartRef.current && swipeLastRef.current && !multiTouchRef.current) {
        const tapX = swipeLastRef.current.x;
        const tapY = swipeLastRef.current.y;
        event.preventDefault();
        handleTapEnd(tapX, tapY);
      }
      swipeStartRef.current = null;
      swipeLastRef.current = null;
    }

    if (event.touches.length === 1) {
      // 双指捏合抬起一指（或 touchcancel 中断）：用剩余手指位置重新锚定，
      // 消除平移死区与旧锚点残留导致的位移跳变。
      touchStartRef.current = {
        x: event.touches[0].clientX,
        y: event.touches[0].clientY,
        posX: position.x,
        posY: position.y,
      };
    } else {
      touchStartRef.current = null;
    }
    pinchStartRef.current = { distance: 0, scale, sx: 0, sy: 0, rx: 0, ry: 0, px: 0, py: 0 };
    stopDragging();
  };

  useEffect(() => {
    return () => {
      if (singleTapTimerRef.current !== null) {
        window.clearTimeout(singleTapTimerRef.current);
        singleTapTimerRef.current = null;
      }
    };
  }, []);

  if (typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={viewerRef}
          tabIndex={-1}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
          onClick={(event) => {
            // 点击黑色背景关闭；点击图片/工具栏等子元素不关闭。
            if (event.target === event.currentTarget) onClose();
          }}
          onMouseMove={handleMouseMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onMouseLeave={stopDragging}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
          className="fixed inset-0 z-viewer flex cursor-default touch-none items-center justify-center overflow-hidden bg-black/[0.96] p-3 text-white sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={displayAlt ? `图片预览：${displayAlt}` : '图片预览'}
        >
          {/* 关闭按钮：唯一常驻的高优先级控件 */}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClose();
            }}
            className="absolute right-3 top-3 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/85 transition-colors hover:bg-white/20 hover:text-white active:scale-[0.96] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white sm:right-5 sm:top-5"
            aria-label="关闭图片预览"
          >
            <X size={20} />
          </button>

          {/* 画廊切换箭头：仅桌面端，默认极淡，hover 提升 */}
          {canNavigate && (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goPrev();
                }}
                disabled={!hasPrev}
                className="absolute left-3 top-1/2 z-40 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white/35 transition-all duration-150 hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white active:scale-[0.96] disabled:pointer-events-none disabled:opacity-15 sm:left-5 md:flex"
                aria-label="上一张"
                title="上一张（←）"
              >
                <ChevronLeft size={26} />
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  goNext();
                }}
                disabled={!hasNext}
                className="absolute right-3 top-1/2 z-40 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full text-white/35 transition-all duration-150 hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white active:scale-[0.96] disabled:pointer-events-none disabled:opacity-15 sm:right-5 md:flex"
                aria-label="下一张"
                title="下一张（→）"
              >
                <ChevronRight size={26} />
              </button>
            </>
          )}

          {/* 图片：绝对视觉主体；key=src 实现切换时的轻量交叉淡入 */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.98 }}
            animate={{ scale, opacity: 1, x: position.x, y: position.y }}
            exit={{ opacity: 0 }}
            transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
            className="relative touch-none select-none"
            style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
            onPointerDown={handlePointerDown}
            onDoubleClick={(event) => {
              event.stopPropagation();
              toggleZoomAround(event.clientX, event.clientY);
              showUi();
            }}
            onClick={(event) => {
              event.stopPropagation();
              showUi();
            }}
            onTouchStart={handleTouchStart}
          >
            {!isLoaded && !hasError && (
              <div
                className={`absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/15 border-t-white/70 ${prefersReducedMotion ? '' : 'animate-spin'}`}
              />
            )}
            {hasError ? (
              <div className="flex flex-col items-center gap-3 px-6 text-center">
                <p className="text-sm text-white/70">图片加载失败</p>
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setHasError(false);
                    setRetrySrcKey((key) => key + 1);
                  }}
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-white/10 px-4 text-sm text-white/85 transition-colors hover:bg-white/20 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
                >
                  重试
                </button>
              </div>
            ) : (
              <motion.img
                key={`${displaySrc ?? ''}-${retrySrcKey}`}
                ref={imgRef}
                src={displaySrc ?? undefined}
                alt={displayAlt || ''}
                draggable={false}
                initial={prefersReducedMotion ? false : { opacity: 0 }}
                animate={{ opacity: isLoaded ? 1 : 0.4 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.2, ease: 'easeOut' }}
                onLoad={() => {
                  loadedSrcsRef.current.add(displaySrc ?? '');
                  setLoadedFlag({ src: displaySrc, loaded: true });
                }}
                onError={() => {
                  setHasError(true);
                }}
                className="max-h-[86vh] max-w-[100vw] object-contain md:max-h-[88vh] md:max-w-[94vw] supports-[height:100dvh]:max-h-[86dvh]"
              />
            )}
          </motion.div>

          {/* 真实 title 才显示的轻量 caption：跟随 UI 一起淡出 */}
          {caption && (
            <motion.p
              animate={{ opacity: isUiVisible ? 1 : 0 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
              className="pointer-events-none absolute bottom-[6.75rem] left-1/2 z-40 max-w-[min(42rem,88vw)] -translate-x-1/2 px-4 text-center text-xs leading-5 text-white/60 sm:text-sm"
            >
              {caption}
            </motion.p>
          )}

          {/* 页码：仅多图，常驻、极轻 */}
          {canNavigate && (
            <div
              aria-live="polite"
              className="absolute bottom-5 left-1/2 z-40 -translate-x-1/2 text-sm text-white/70 tabular-nums"
            >
              {safeIndex + 1} / {gallery.length}
            </div>
          )}

          {/* 工具栏：默认隐藏，用户操作时淡入，约 2.5s 无操作自动隐藏 */}
          <ImageViewerToolbar
            visible={isUiVisible}
            scale={scale}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
            onToggleZoom={handleToggleZoom}
            onDownload={() => void handleDownload()}
          />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
