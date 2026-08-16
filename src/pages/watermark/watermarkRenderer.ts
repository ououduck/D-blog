/**
 * 水印渲染工具：把文字水印绘制到图片 canvas，支持九个位置锚点、旋转、
 * 缩放与透明度参数，供水印工具页调用。
 */
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

type WatermarkRenderOptions = {
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
  fontFamily: 'sans-serif',
};

export const clampWatermarkFontSize = (value: number) =>
  Math.min(240, Math.max(8, Number.isFinite(value) ? value : DEFAULT_WATERMARK_OPTIONS.fontSize));
export const clampWatermarkOpacity = (value: number) =>
  Math.min(100, Math.max(0, Number.isFinite(value) ? value : DEFAULT_WATERMARK_OPTIONS.opacity));

const getAnchor = (position: WatermarkPosition) => {
  const horizontal = position.endsWith('left') ? 'left' : position.endsWith('right') ? 'right' : 'center';
  const vertical = position.startsWith('top') ? 'top' : position.startsWith('bottom') ? 'bottom' : 'center';
  return { horizontal, vertical } as const;
};

const getWatermarkPoint = (
  width: number,
  height: number,
  fontSize: number,
  position: WatermarkPosition,
  padding = 32,
) => {
  const safePadding = Math.max(0, padding);
  const { horizontal, vertical } = getAnchor(position);
  const halfHeight = fontSize / 2;
  const x = horizontal === 'left' ? safePadding : horizontal === 'right' ? width - safePadding : width / 2;
  // 配合 renderWatermark 的 textBaseline='middle'：以 em 盒中心定位，
  // top/bottom 的 padding 语义对称，且底部文字不会因 descender 越界被裁切。
  const rawY =
    vertical === 'top'
      ? safePadding + halfHeight
      : vertical === 'bottom'
        ? height - safePadding - halfHeight
        : height / 2;
  // 宽幅小图（高度 < padding×2 + fontSize，如 400×50）时 top/bottom 锚点会落在
  // 画布外，fillText 被整体裁掉、水印完全不可见：把 y 夹在 [halfHeight,
  // height - halfHeight] 内，保证文字至少完整可见（字号本身已按宽度收缩）。
  // 注意高度 < halfHeight 时上界为负，旧式 min 后 max 会得到 y=halfHeight > height，
  // 文字整体越界不可见；上界须不低于下界（高度过小时退化为居中半可见）。
  const upper = Math.max(halfHeight, height - halfHeight);
  const y = Math.min(Math.max(halfHeight, rawY), upper);

  return { x, y, textAlign: horizontal === 'left' ? 'left' : horizontal === 'right' ? 'right' : 'center' } as const;
};

export const getWatermarkFilename = (filename: string, format: 'png' | 'jpeg') => {
  const base =
    filename
      .replace(/\.[^/.]+$/, '')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .trim() || 'image';
  return `${base}-watermarked.${format === 'jpeg' ? 'jpg' : 'png'}`;
};

export const renderWatermark = (
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  options: WatermarkRenderOptions,
) => {
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

  const requestedFontSize =
    Number.isFinite(options.fontSize) && options.fontSize > 0
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
  const proportionalFontSize =
    measuredWidth > availableWidth ? (requestedFontSize * availableWidth) / measuredWidth : requestedFontSize;
  const fontSize = measuredWidth > availableWidth ? Math.max(minimumFontSize, proportionalFontSize) : requestedFontSize;
  context.font = `600 ${fontSize}px ${fontFamily}`;
  context.textBaseline = 'middle';
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
