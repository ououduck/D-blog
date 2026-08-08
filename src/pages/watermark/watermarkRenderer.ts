export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'center-left'
  | 'center'
  | 'center-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export type WatermarkRenderOptions = {
  text: string;
  fontSize: number;
  opacity: number;
  position: WatermarkPosition;
  padding?: number;
  fontFamily?: string;
};

export const DEFAULT_WATERMARK_OPTIONS: WatermarkRenderOptions = {
  text: 'D-blog',
  fontSize: 48,
  opacity: 30,
  position: 'bottom-right',
  padding: 32,
  fontFamily: 'sans-serif'
};

export const clampWatermarkFontSize = (value: number) => Math.min(240, Math.max(8, Number.isFinite(value) ? value : DEFAULT_WATERMARK_OPTIONS.fontSize));
export const clampWatermarkOpacity = (value: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : DEFAULT_WATERMARK_OPTIONS.opacity));

const getAnchor = (position: WatermarkPosition) => {
  const horizontal = position.endsWith('left') ? 'left' : position.endsWith('right') ? 'right' : 'center';
  const vertical = position.startsWith('top') ? 'top' : position.startsWith('bottom') ? 'bottom' : 'center';
  return { horizontal, vertical } as const;
};

export const getWatermarkPoint = (
  width: number,
  height: number,
  fontSize: number,
  position: WatermarkPosition,
  padding = 32
) => {
  const safePadding = Math.max(0, padding);
  const { horizontal, vertical } = getAnchor(position);
  const halfHeight = fontSize / 2;
  const x = horizontal === 'left'
    ? safePadding
    : horizontal === 'right'
      ? width - safePadding
      : width / 2;
  const y = vertical === 'top'
    ? safePadding + fontSize
    : vertical === 'bottom'
      ? height - safePadding
      : height / 2 + halfHeight / 2;

  return { x, y, textAlign: horizontal === 'left' ? 'left' : horizontal === 'right' ? 'right' : 'center' } as const;
};

export const getWatermarkFilename = (filename: string, format: 'png' | 'jpeg') => {
  const base = filename.replace(/\.[^/.]+$/, '').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'image';
  return `${base}-watermarked.${format === 'jpeg' ? 'jpg' : 'png'}`;
};

export const renderWatermark = (canvas: HTMLCanvasElement, image: CanvasImageSource, options: WatermarkRenderOptions) => {
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('当前浏览器不支持 Canvas 绘制。');
  }

  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const text = options.text.trim();
  if (!text) {
    return;
  }

  const requestedFontSize = Number.isFinite(options.fontSize) && options.fontSize > 0
    ? Math.min(240, options.fontSize)
    : DEFAULT_WATERMARK_OPTIONS.fontSize;
  const opacity = clampWatermarkOpacity(options.opacity) / 100;
  const padding = Math.max(0, options.padding ?? DEFAULT_WATERMARK_OPTIONS.padding ?? 32);
  const fontFamily = options.fontFamily || DEFAULT_WATERMARK_OPTIONS.fontFamily;
  const availableWidth = Math.max(1, width - padding * 2);
  const minimumFontSize = Math.min(requestedFontSize, Math.max(4, Math.min(12, width * 0.02)));
  context.save();
  context.font = `600 ${requestedFontSize}px ${fontFamily}`;
  const measuredWidth = context.measureText(text).width;
  const proportionalFontSize = measuredWidth > availableWidth
    ? requestedFontSize * availableWidth / measuredWidth
    : requestedFontSize;
  const fontSize = measuredWidth > availableWidth
    ? Math.max(minimumFontSize, proportionalFontSize)
    : requestedFontSize;
  context.font = `600 ${fontSize}px ${fontFamily}`;
  context.textBaseline = 'alphabetic';
  const point = getWatermarkPoint(width, height, fontSize, options.position, padding);
  context.textAlign = point.textAlign;
  context.globalAlpha = opacity;
  context.shadowColor = 'rgba(0, 0, 0, 0.45)';
  context.shadowBlur = Math.max(2, fontSize * 0.12);
  context.shadowOffsetY = Math.max(1, fontSize * 0.04);
  context.fillStyle = '#ffffff';
  context.fillText(text, point.x, point.y, availableWidth);
  context.restore();
};
