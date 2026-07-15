import type { PatternType } from '../../config/coverTemplates';
import { CANVAS_SAFE_MARGIN } from './coverConstants';
import { fitText, getEffectiveLayout, getSubtitleFontWeight, normalizeFontWeight } from './coverLayout';
import type { CoverRenderOptions, TextAlign } from './coverTypes';
import { loadImage } from './coverFiles';

const FALLBACK_BACKGROUND = '#667eea';

function imageDimensions(image: CanvasImageSource): { width: number; height: number } {
  if ('naturalWidth' in image) return { width: image.naturalWidth, height: image.naturalHeight };
  if ('videoWidth' in image) return { width: image.videoWidth, height: image.videoHeight };
  if ('displayWidth' in image) return { width: image.displayWidth, height: image.displayHeight };
  if ('width' in image && typeof image.width === 'number') return { width: image.width, height: image.height as number };
  if (image instanceof SVGImageElement) return { width: image.width.baseVal.value, height: image.height.baseVal.value };
  throw new Error('无法读取图片尺寸');
}

function gradientPoints(width: number, height: number, angle: number): [number, number, number, number] {
  const radians = (angle - 90) * Math.PI / 180;
  const radius = Math.abs(width * Math.cos(radians)) / 2 + Math.abs(height * Math.sin(radians)) / 2;
  const cx = width / 2;
  const cy = height / 2;
  return [cx + Math.cos(radians) * radius, cy + Math.sin(radians) * radius,
    cx - Math.cos(radians) * radius, cy - Math.sin(radians) * radius];
}

function createTemplateFill(ctx: CanvasRenderingContext2D, gradientValue: string, width: number, height: number): string | CanvasGradient {
  const match = gradientValue.match(/linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg\s*,\s*(.+)\s*\)/i);
  if (!match) return gradientValue.trim() || FALLBACK_BACKGROUND;
  const stops = Array.from(match[2].matchAll(/(#[a-f\d]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)\s*(\d+(?:\.\d+)?)?%?/gi));
  if (stops.length < 2) return FALLBACK_BACKGROUND;
  const gradient = ctx.createLinearGradient(...gradientPoints(width, height, Number(match[1])));
  stops.forEach((stop, index) => {
    const position = stop[2] === undefined ? index / (stops.length - 1) : Number(stop[2]) / 100;
    gradient.addColorStop(Math.min(1, Math.max(0, position)), stop[1]);
  });
  return gradient;
}

function drawPattern(ctx: CanvasRenderingContext2D, pattern: PatternType, width: number, height: number): void {
  if (pattern === 'solid') return;
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  if (pattern === 'dots') {
    for (let x = 0; x < width; x += 40) for (let y = 0; y < height; y += 40) {
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    }
  } else if (pattern === 'grid') {
    for (let x = 0; x < width; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y < height; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  } else if (pattern === 'waves') {
    for (let y = 0; y < height; y += 30) {
      ctx.beginPath(); ctx.moveTo(0, y);
      for (let x = 0; x <= width; x += 10) ctx.lineTo(x, y + Math.sin(x / 50) * 10);
      ctx.stroke();
    }
  } else if (pattern === 'diagonal') {
    for (let i = -height; i < width + height; i += 35) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - height, height); ctx.stroke();
    }
  } else if (pattern === 'circles') {
    for (let x = 40; x < width; x += 60) for (let y = 40; y < height; y += 60) {
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.stroke();
    }
  } else {
    const size = pattern === 'hexagon' ? 18 : 20;
    const rowHeight = size * 0.866;
    for (let row = 0; row <= height / rowHeight + 1; row++) for (let col = 0; col <= width / size + 1; col++) {
      const cx = col * size + (row % 2) * size / 2;
      const cy = row * rowHeight;
      ctx.beginPath();
      if (pattern === 'hexagon') {
        for (let i = 0; i < 6; i++) {
          const angle = Math.PI / 3 * i - Math.PI / 6;
          const x = cx + size * Math.cos(angle); const y = cy + size * Math.sin(angle);
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
      } else {
        const flip = (row + col) % 2 === 0;
        ctx.moveTo(cx, cy + (flip ? size : 0));
        ctx.lineTo(cx + size / 2, cy + (flip ? 0 : size));
        ctx.lineTo(cx + size, cy + (flip ? size : 0));
      }
      ctx.closePath(); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawCorners(ctx: CanvasRenderingContext2D, options: CoverRenderOptions): void {
  const { width, height } = options.size;
  const size = Math.min(width, height) * 0.08;
  const margin = Math.min(CANVAS_SAFE_MARGIN / 2, width * 0.08, height * 0.08);
  ctx.save();
  ctx.strokeStyle = options.decorations.cornerColor;
  ctx.fillStyle = options.decorations.cornerColor;
  ctx.globalAlpha = options.decorations.cornerOpacity / 100;
  ctx.lineWidth = 3; ctx.lineCap = 'round';
  for (const corner of [{ x: margin, y: margin, dx: 1, dy: 1 }, { x: width - margin, y: margin, dx: -1, dy: 1 },
    { x: margin, y: height - margin, dx: 1, dy: -1 }, { x: width - margin, y: height - margin, dx: -1, dy: -1 }]) {
    ctx.beginPath(); ctx.moveTo(corner.x, corner.y + size * corner.dy); ctx.lineTo(corner.x, corner.y);
    ctx.lineTo(corner.x + size * corner.dx, corner.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(corner.x + size * 0.25 * corner.dx, corner.y + size * 0.25 * corner.dy, 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawSeparator(ctx: CanvasRenderingContext2D, options: CoverRenderOptions, y: number): void {
  const width = options.size.width * 0.25;
  ctx.save(); ctx.strokeStyle = options.decorations.separatorColor;
  ctx.globalAlpha = options.decorations.separatorOpacity / 100; ctx.lineWidth = 1; ctx.setLineDash([8, 6]);
  ctx.beginPath(); ctx.moveTo((options.size.width - width) / 2, y); ctx.lineTo((options.size.width + width) / 2, y); ctx.stroke();
  ctx.restore();
}

function textX(align: TextAlign, width: number): number {
  return align === 'left' ? CANVAS_SAFE_MARGIN : align === 'right' ? width - CANVAS_SAFE_MARGIN : width / 2;
}

function canvasAlign(align: TextAlign): CanvasTextAlign {
  return align;
}

function applyTextEffects(ctx: CanvasRenderingContext2D, options: CoverRenderOptions): void {
  const shadow = options.textShadow;
  const alpha = Math.round(Math.min(1, Math.max(0, shadow.opacity)) * 255).toString(16).padStart(2, '0');
  ctx.shadowColor = shadow.opacity > 0 ? `${shadow.color}${alpha}` : 'transparent';
  ctx.shadowBlur = shadow.blur; ctx.shadowOffsetX = shadow.x; ctx.shadowOffsetY = shadow.y;
}

function drawFittedText(ctx: CanvasRenderingContext2D, text: string, x: number, centerY: number, maxWidth: number,
  fontSize: number, weight: number, align: CanvasTextAlign, options: CoverRenderOptions, maxLines: number): number {
  const measure = (value: string, size: number) => {
    ctx.font = `${normalizeFontWeight(weight)} ${size}px ${options.fontFamily}`;
    return ctx.measureText(value).width;
  };
  const fitted = fitText(text, { maxWidth, maxLines, fontSize, minFontSize: options.minFontSize ?? 14 }, measure);
  ctx.save(); ctx.font = `${normalizeFontWeight(weight)} ${fitted.fontSize}px ${options.fontFamily}`;
  ctx.textAlign = align; ctx.textBaseline = 'middle'; applyTextEffects(ctx, options);
  ctx.fillStyle = options.autoTextColor ? (options.template.category === 'light' || options.template.id === 'white' ? '#1a1a2e' : '#ffffff') : options.textColor;
  const firstY = centerY - (fitted.lines.length - 1) * fitted.lineHeight / 2;
  fitted.lines.forEach((line, index) => {
    const y = firstY + index * fitted.lineHeight;
    if (options.textStroke.enabled && options.textStroke.width > 0) {
      ctx.strokeStyle = options.textStroke.color; ctx.lineWidth = options.textStroke.width;
      ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.strokeText(line, x, y);
    }
    ctx.fillText(line, x, y);
  });
  ctx.restore();
  return fitted.fontSize;
}

async function resolveIcon(source: string | CanvasImageSource): Promise<CanvasImageSource> {
  return typeof source === 'string' ? loadImage(source) : source;
}

async function drawIcon(ctx: CanvasRenderingContext2D, source: string | CanvasImageSource, x: number, y: number,
  size: number, radiusPercent: number, backgroundEnabled: boolean): Promise<void> {
  const image = await resolveIcon(source);
  const radius = Math.min(size / 2, size * radiusPercent / 100);
  if (backgroundEnabled) {
    ctx.save(); ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; ctx.beginPath();
    radius > 0 ? ctx.roundRect(x, y, size, size, radius) : ctx.rect(x, y, size, size); ctx.fill(); ctx.restore();
  }
  ctx.save();
  if (radius > 0) { ctx.beginPath(); ctx.roundRect(x, y, size, size, radius); ctx.clip(); }
  ctx.drawImage(image, x, y, size, size); ctx.restore();
}

export async function renderCover(ctx: CanvasRenderingContext2D, options: CoverRenderOptions): Promise<void> {
  const { width, height } = options.size;
  ctx.save(); ctx.clearRect(0, 0, width, height);
  if (options.backgroundImage) {
    const background = options.backgroundImage;
    const dimensions = imageDimensions(background.image);
    const coverScale = Math.max(width / dimensions.width, height / dimensions.height) * background.scale;
    ctx.save(); ctx.filter = background.blur > 0 ? `blur(${background.blur}px)` : 'none';
    ctx.globalAlpha = background.opacity / 100; ctx.translate(width / 2 + background.x, height / 2 + background.y);
    ctx.scale(coverScale, coverScale); ctx.drawImage(background.image, -dimensions.width / 2, -dimensions.height / 2); ctx.restore();
  }
  ctx.globalAlpha = options.backgroundImage ? 0.8 : 1;
  ctx.fillStyle = createTemplateFill(ctx, options.template.gradient, width, height); ctx.fillRect(0, 0, width, height); ctx.globalAlpha = 1;
  if (options.overlay.enabled && options.overlay.blur > 0) {
    const backgroundLayer = document.createElement('canvas');
    backgroundLayer.width = width;
    backgroundLayer.height = height;
    backgroundLayer.getContext('2d')?.drawImage(ctx.canvas, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.filter = `blur(${options.overlay.blur}px)`;
    ctx.drawImage(backgroundLayer, 0, 0);
    ctx.restore();
  }
  if (options.overlay.enabled) {
    ctx.save(); ctx.globalAlpha = options.overlay.opacity / 100;
    ctx.fillStyle = options.overlay.color; ctx.fillRect(0, 0, width, height); ctx.restore();
  }
  drawPattern(ctx, options.template.pattern, width, height);
  if (options.decorations.showCorners) drawCorners(ctx, options);

  const hasIcon = options.icon.source !== null;
  const layout = getEffectiveLayout(options.layout, options.icon.show, hasIcon);
  const centerX = width / 2; const centerY = height / 2; const iconSize = options.icon.size;
  if (layout === 'icon-only' && options.icon.source) {
    await drawIcon(ctx, options.icon.source, centerX - iconSize / 2, centerY - iconSize / 2, iconSize,
      options.icon.borderRadius, options.icon.backgroundEnabled);
  } else if (layout === 'icon-split' && options.icon.source) {
    await drawIcon(ctx, options.icon.source, centerX - iconSize / 2, centerY - iconSize / 2, iconSize,
      options.icon.borderRadius, options.icon.backgroundEnabled);
    const sideWidth = Math.max(1, centerX - iconSize / 2 - options.spacing - CANVAS_SAFE_MARGIN);
    if (options.leftText) drawFittedText(ctx, options.leftText, centerX - iconSize / 2 - options.spacing, centerY,
      sideWidth, options.fontSize, options.fontWeight, 'right', options, options.maxTextLines ?? 2);
    if (options.rightText) drawFittedText(ctx, options.rightText, centerX + iconSize / 2 + options.spacing, centerY,
      sideWidth, options.fontSize, options.fontWeight, 'left', options, options.maxTextLines ?? 2);
    if (options.subText) drawFittedText(ctx, options.subText, centerX, centerY + options.fontSize / 2 + options.subSpacing + options.subFontSize / 2,
      width - CANVAS_SAFE_MARGIN * 2, options.subFontSize, getSubtitleFontWeight(options.fontWeight), 'center', options, 2);
  } else if (layout === 'stacked' && options.icon.source) {
    const iconY = centerY - iconSize / 2 - options.subSpacing - options.fontSize / 2;
    await drawIcon(ctx, options.icon.source, centerX - iconSize / 2, iconY - iconSize / 2, iconSize,
      options.icon.borderRadius, options.icon.backgroundEnabled);
    if (options.decorations.showSeparator) drawSeparator(ctx, options, iconY + iconSize / 2 + options.subSpacing / 2);
    const main = options.leftText && options.rightText ? `${options.leftText} ${options.rightText}` : options.leftText || options.rightText;
    const mainY = iconY + iconSize / 2 + options.subSpacing + options.fontSize / 2;
    const x = textX(options.textAlign, width); const align = canvasAlign(options.textAlign);
    if (main) drawFittedText(ctx, main, x, mainY, width - CANVAS_SAFE_MARGIN * 2, options.fontSize,
      options.fontWeight, align, options, options.maxTextLines ?? 2);
    if (options.subText) drawFittedText(ctx, options.subText, x, mainY + options.fontSize / 2 + options.subSpacing,
      width - CANVAS_SAFE_MARGIN * 2, options.subFontSize, getSubtitleFontWeight(options.fontWeight), align, options, 2);
  } else {
    const main = options.leftText && options.rightText ? `${options.leftText} ${options.rightText}` : options.leftText || options.rightText;
    const x = textX(options.textAlign, width); const align = canvasAlign(options.textAlign);
    const mainY = options.subText ? centerY - options.subSpacing / 2 - options.subFontSize / 2 : centerY;
    if (main) drawFittedText(ctx, main, x, mainY, width - CANVAS_SAFE_MARGIN * 2, options.fontSize,
      options.fontWeight, align, options, options.maxTextLines ?? 3);
    if (options.subText) drawFittedText(ctx, options.subText, x, main ? centerY + options.fontSize / 2 + options.subSpacing : centerY,
      width - CANVAS_SAFE_MARGIN * 2, options.subFontSize, getSubtitleFontWeight(options.fontWeight), align, options, 2);
  }
  ctx.restore();
}
