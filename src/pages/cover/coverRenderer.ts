import type { PatternType } from '../../config/coverTemplates';
import { BASE_CANVAS_WIDTH, CANVAS_SAFE_MARGIN } from './coverConstants';
import { calculateLayoutMetrics, fitText, getEffectiveLayout, getImageFitScale, getSubtitleFontWeight, normalizeFontWeight } from './coverLayout';
import type { CoverRenderOptions, FittedText, TextAlign } from './coverTypes';
import { loadCachedImage } from './coverImageCache';
import { chooseTextColor, sampleRegion } from './coverColor';

const FALLBACK_BACKGROUND = '#667eea';

function imageDimensions(image: CanvasImageSource): { width: number; height: number } {
  if ('naturalWidth' in image) return { width: image.naturalWidth, height: image.naturalHeight };
  if ('videoWidth' in image) return { width: image.videoWidth, height: image.videoHeight };
  if ('width' in image && typeof image.width === 'number') return { width: image.width, height: image.height as number };
  if (typeof SVGImageElement !== 'undefined' && image instanceof SVGImageElement) return { width: image.width.baseVal.value, height: image.height.baseVal.value };
  throw new Error('无法读取图片尺寸');
}

function gradientPoints(width: number, height: number, angle: number): [number, number, number, number] {
  const radians = (angle - 90) * Math.PI / 180;
  const radius = Math.abs(width * Math.cos(radians)) / 2 + Math.abs(height * Math.sin(radians)) / 2;
  const cx = width / 2; const cy = height / 2;
  // CSS linear-gradient(angle) 中角度指向渐变线终点（100% 色标），0% 色标位于
  // 角度反方向：起点取反，首色才能落在 CSS 语义一致的位置（如 90deg → 左→右）。
  return [cx - Math.cos(radians) * radius, cy - Math.sin(radians) * radius,
    cx + Math.cos(radians) * radius, cy + Math.sin(radians) * radius];
}

function createTemplateFill(ctx: CanvasRenderingContext2D, value: string, width: number, height: number): string | CanvasGradient {
  const match = value.match(/linear-gradient\(\s*(-?\d+(?:\.\d+)?)deg\s*,\s*(.+)\s*\)/i);
  if (!match) return value.trim() || FALLBACK_BACKGROUND;
  const stops = Array.from(match[2].matchAll(/(#[a-f\d]{3,8}|rgba?\([^)]*\)|hsla?\([^)]*\)|[a-z]+)\s*(\d+(?:\.\d+)?)?%?/gi));
  if (stops.length < 2) return FALLBACK_BACKGROUND;
  const gradient = ctx.createLinearGradient(...gradientPoints(width, height, Number(match[1])));
  stops.forEach((stop, index) => gradient.addColorStop(
    stop[2] === undefined ? index / (stops.length - 1) : Math.min(1, Math.max(0, Number(stop[2]) / 100)), stop[1]
  ));
  return gradient;
}

function drawPattern(ctx: CanvasRenderingContext2D, pattern: PatternType, width: number, height: number, scale: number): void {
  if (pattern === 'solid') return;
  ctx.save(); ctx.globalAlpha = 0.08; ctx.strokeStyle = '#ffffff'; ctx.fillStyle = '#ffffff'; ctx.lineWidth = Math.max(1, 1.5 * scale);
  const step = Math.max(8, 40 * scale);
  if (pattern === 'dots') {
    for (let x = 0; x < width; x += step) for (let y = 0; y < height; y += step) { ctx.beginPath(); ctx.arc(x, y, Math.max(1, 2 * scale), 0, Math.PI * 2); ctx.fill(); }
  } else if (pattern === 'grid') {
    for (let x = 0; x < width; x += 50 * scale) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke(); }
    for (let y = 0; y < height; y += 50 * scale) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke(); }
  } else if (pattern === 'waves') {
    for (let y = 0; y < height; y += 30 * scale) { ctx.beginPath(); ctx.moveTo(0, y); for (let x = 0; x <= width; x += Math.max(2, 10 * scale)) ctx.lineTo(x, y + Math.sin(x / Math.max(1, 50 * scale)) * 10 * scale); ctx.stroke(); }
  } else if (pattern === 'diagonal') {
    for (let i = -height; i < width + height; i += 35 * scale) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i - height, height); ctx.stroke(); }
  } else if (pattern === 'circles') {
    for (let x = 40 * scale; x < width; x += 60 * scale) for (let y = 40 * scale; y < height; y += 60 * scale) { ctx.beginPath(); ctx.arc(x, y, 6 * scale, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.arc(x, y, 14 * scale, 0, Math.PI * 2); ctx.stroke(); }
  } else {
    const size = (pattern === 'hexagon' ? 18 : 20) * scale; const rowHeight = size * 0.866;
    for (let row = 0; row <= height / rowHeight + 1; row++) for (let col = 0; col <= width / size + 1; col++) {
      const cx = col * size + (row % 2) * size / 2; const cy = row * rowHeight; ctx.beginPath();
      if (pattern === 'hexagon') for (let i = 0; i < 6; i++) { const angle = Math.PI / 3 * i - Math.PI / 6; const x = cx + size * Math.cos(angle); const y = cy + size * Math.sin(angle); i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
      else { const flip = (row + col) % 2 === 0; ctx.moveTo(cx, cy + (flip ? size : 0)); ctx.lineTo(cx + size / 2, cy + (flip ? 0 : size)); ctx.lineTo(cx + size, cy + (flip ? size : 0)); }
      ctx.closePath(); ctx.stroke();
    }
  }
  ctx.restore();
}

function drawCorners(ctx: CanvasRenderingContext2D, options: CoverRenderOptions, scale: number): void {
  const { width, height } = options.size; const size = Math.min(width, height) * 0.08;
  const margin = Math.min(CANVAS_SAFE_MARGIN * scale / 2, width * 0.08, height * 0.08);
  ctx.save(); ctx.strokeStyle = options.decorations.cornerColor; ctx.fillStyle = options.decorations.cornerColor; ctx.globalAlpha = options.decorations.cornerOpacity / 100; ctx.lineWidth = Math.max(1, 3 * scale); ctx.lineCap = 'round';
  for (const corner of [{ x: margin, y: margin, dx: 1, dy: 1 }, { x: width - margin, y: margin, dx: -1, dy: 1 }, { x: margin, y: height - margin, dx: 1, dy: -1 }, { x: width - margin, y: height - margin, dx: -1, dy: -1 }]) {
    ctx.beginPath(); ctx.moveTo(corner.x, corner.y + size * corner.dy); ctx.lineTo(corner.x, corner.y); ctx.lineTo(corner.x + size * corner.dx, corner.y); ctx.stroke();
    ctx.beginPath(); ctx.arc(corner.x + size * 0.25 * corner.dx, corner.y + size * 0.25 * corner.dy, Math.max(1, 4 * scale), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawSeparator(ctx: CanvasRenderingContext2D, options: CoverRenderOptions, y: number, scale: number): void {
  const width = options.size.width * 0.25;
  ctx.save(); ctx.strokeStyle = options.decorations.separatorColor; ctx.globalAlpha = options.decorations.separatorOpacity / 100; ctx.lineWidth = Math.max(1, scale); ctx.setLineDash([8 * scale, 6 * scale]);
  ctx.beginPath(); ctx.moveTo((options.size.width - width) / 2, y); ctx.lineTo((options.size.width + width) / 2, y); ctx.stroke(); ctx.restore();
}

function textX(align: TextAlign, width: number, margin: number): number { return align === 'left' ? margin : align === 'right' ? width - margin : width / 2; }
function canvasAlign(align: TextAlign): CanvasTextAlign { return align; }

function applyTextEffects(ctx: CanvasRenderingContext2D, options: CoverRenderOptions, scale: number): void {
  const shadow = options.textShadow; const alpha = Math.round(Math.min(1, Math.max(0, shadow.opacity)) * 255).toString(16).padStart(2, '0');
  const shadowColor = /^#[\da-f]{6}$/i.test(shadow.color) ? `${shadow.color}${alpha}` : shadow.color;
  ctx.shadowColor = shadow.opacity > 0 ? shadowColor : 'transparent'; ctx.shadowBlur = shadow.blur * scale; ctx.shadowOffsetX = shadow.x * scale; ctx.shadowOffsetY = shadow.y * scale;
}

function fitTextBlock(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, fontSize: number,
  weight: number, options: CoverRenderOptions, maxLines: number): FittedText {
  const measure = (value: string, size: number) => {
    ctx.font = `${normalizeFontWeight(weight)} ${size}px ${options.fontFamily}`;
    return ctx.measureText(value).width;
  };
  return fitText(text, { maxWidth, maxLines, fontSize, minFontSize: options.minFontSize ?? 14 }, measure);
}

function drawFittedText(ctx: CanvasRenderingContext2D, text: string, x: number, centerY: number, maxWidth: number, fontSize: number,
  weight: number, align: CanvasTextAlign, options: CoverRenderOptions, maxLines: number, scale: number, fitted = fitTextBlock(ctx, text, maxWidth, fontSize, weight, options, maxLines)): FittedText {
  const sampled = options.autoTextColor
    ? sampleRegion(ctx, align === 'left' ? x : align === 'right' ? x - maxWidth : x - maxWidth / 2, centerY - fitted.lineHeight * fitted.lines.length / 2, maxWidth, fitted.lineHeight * fitted.lines.length)
    : null;
  const fallbackBackground = options.template.category === 'light' ? '#ffffff' : '#000000';
  const decision = options.autoTextColor ? chooseTextColor(sampled, fallbackBackground) : null;
  if (decision?.lowContrast && options.diagnostics) { options.diagnostics.lowContrast = true; options.diagnostics.warnings.push('部分文字区域对比度不足，请调整背景或使用手动文字颜色'); }
  if (fitted.truncated && options.diagnostics) { options.diagnostics.truncated = true; options.diagnostics.warnings.push('文字过长，已自动截断'); }
  ctx.save(); ctx.font = `${normalizeFontWeight(weight)} ${fitted.fontSize}px ${options.fontFamily}`; ctx.textAlign = align; ctx.textBaseline = 'middle'; applyTextEffects(ctx, options, scale);
  ctx.fillStyle = decision?.color ?? (options.autoTextColor ? fallbackBackground : options.textColor);
  const firstY = centerY - (fitted.lines.length - 1) * fitted.lineHeight / 2;
  fitted.lines.forEach((line, index) => { const y = firstY + index * fitted.lineHeight; if (options.textStroke.enabled && options.textStroke.width > 0) { ctx.strokeStyle = options.textStroke.color; ctx.lineWidth = options.textStroke.width * scale; ctx.lineJoin = 'round'; ctx.miterLimit = 2; ctx.strokeText(line, x, y); } ctx.fillText(line, x, y); });
  ctx.restore(); return fitted;
}

async function resolveIcon(source: string | CanvasImageSource): Promise<CanvasImageSource> { return typeof source === 'string' ? loadCachedImage(source) : source; }

async function drawIcon(ctx: CanvasRenderingContext2D, source: string | CanvasImageSource, fallbackSource: string, x: number, y: number, size: number,
  radiusPercent: number, backgroundEnabled: boolean, diagnostics?: string[]): Promise<void> {
  let image: CanvasImageSource;
  try { image = await resolveIcon(source); } catch {
    if (source === fallbackSource) throw new Error('默认 Logo 加载失败');
    try { image = await loadCachedImage(fallbackSource); diagnostics?.push('图标加载失败，已回退到站点 Logo'); } catch { throw new Error('图标加载失败，请重新选择图标'); }
  }
  const radius = Math.min(size / 2, size * radiusPercent / 100);
  if (backgroundEnabled) { ctx.save(); ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'; ctx.beginPath(); radius > 0 ? ctx.roundRect(x, y, size, size, radius) : ctx.rect(x, y, size, size); ctx.fill(); ctx.restore(); }
  ctx.save(); if (radius > 0) { ctx.beginPath(); ctx.roundRect(x, y, size, size, radius); ctx.clip(); } ctx.drawImage(image, x, y, size, size); ctx.restore();
}

export async function renderCover(ctx: CanvasRenderingContext2D, options: CoverRenderOptions): Promise<void> {
  const { width, height } = options.size; const baseScale = width / BASE_CANVAS_WIDTH;
  const metrics = calculateLayoutMetrics({ size: options.size, layout: options.layout, leftText: options.leftText, rightText: options.rightText, subText: options.subText,
    fontSize: options.fontSize * baseScale, subFontSize: options.subFontSize * baseScale, iconSize: options.icon.size * baseScale, spacing: options.spacing * baseScale,
    subSpacing: options.subSpacing * baseScale, showIcon: options.icon.show, hasIcon: options.icon.source !== null, maxTextLines: options.maxTextLines, minFontSize: (options.minFontSize ?? 14) * baseScale });
  const scale = baseScale * metrics.scale; const margin = CANVAS_SAFE_MARGIN * baseScale;
  const diagnostics = options.diagnostics ?? { scaled: metrics.scaled, truncated: false, overflow: metrics.overflow, lowContrast: false, warnings: [...metrics.warnings] };
  diagnostics.scaled = diagnostics.scaled || metrics.scaled; diagnostics.overflow = diagnostics.overflow || metrics.overflow;
  ctx.save(); ctx.clearRect(0, 0, width, height);
  if (!options.transparentBackground) { ctx.fillStyle = createTemplateFill(ctx, options.template.gradient, width, height); ctx.fillRect(0, 0, width, height); }
  if (options.backgroundImage) {
    const background = options.backgroundImage; const dimensions = imageDimensions(background.image); const imageScale = getImageFitScale(dimensions, options.size, background.fit) * background.scale;
    ctx.save(); ctx.filter = background.blur * baseScale > 0 ? `blur(${background.blur * baseScale}px)` : 'none'; ctx.globalAlpha = background.opacity / 100;
    ctx.translate(width / 2 + background.x * baseScale, height / 2 + background.y * baseScale); ctx.scale(background.flipX ? -imageScale : imageScale, background.flipY ? -imageScale : imageScale); ctx.drawImage(background.image, -dimensions.width / 2, -dimensions.height / 2); ctx.restore();
  }
  if (options.overlay.enabled && options.overlay.blur > 0) { const layer = document.createElement('canvas'); layer.width = width; layer.height = height; layer.getContext('2d')?.drawImage(ctx.canvas, 0, 0); ctx.clearRect(0, 0, width, height); ctx.save(); ctx.filter = `blur(${options.overlay.blur * baseScale}px)`; ctx.drawImage(layer, 0, 0); ctx.restore(); }
  if (options.overlay.enabled) { ctx.save(); ctx.globalAlpha = options.overlay.opacity / 100; ctx.fillStyle = options.overlay.color; ctx.fillRect(0, 0, width, height); ctx.restore(); }
  drawPattern(ctx, options.template.pattern, width, height, baseScale); if (options.decorations.showCorners) drawCorners(ctx, options, baseScale);
  const hasIcon = options.icon.source !== null; const layout = getEffectiveLayout(options.layout, options.icon.show, hasIcon); const centerX = width / 2; const centerY = height / 2;
  const fallbackIconSource = options.fallbackIconSource;
  // `calculateLayoutMetrics` already returns physical canvas units. Reusing those values
  // avoids applying the export scale twice and preserves the minimum-size protection.
  const iconSize = metrics.iconSize; const mainSize = metrics.mainFontSize; const subSize = metrics.subFontSize;
  const spacing = metrics.spacing; const subSpacing = metrics.subSpacing;
  const renderOptions = { ...options, size: options.size, fontSize: mainSize, subFontSize: subSize, spacing, subSpacing,
    minFontSize: (options.minFontSize ?? 14) * baseScale, diagnostics, icon: { ...options.icon, size: iconSize } };
  const mainText = options.leftText && options.rightText ? `${options.leftText} ${options.rightText}` : options.leftText || options.rightText;
  const mainMaxLines = options.maxTextLines ?? (layout === 'text-only' ? 3 : 2);
  const textWidth = width - margin * 2;

  if (layout === 'icon-only' && options.icon.source) {
    await drawIcon(ctx, options.icon.source, fallbackIconSource, centerX - iconSize / 2, centerY - iconSize / 2, iconSize, options.icon.borderRadius, options.icon.backgroundEnabled, diagnostics.warnings);
  } else if (layout === 'icon-split' && options.icon.source) {
    const sideWidth = Math.max(1, centerX - iconSize / 2 - spacing - margin);
    const leftFitted = options.leftText ? fitTextBlock(ctx, options.leftText, sideWidth, mainSize, options.fontWeight, renderOptions, mainMaxLines) : null;
    const rightFitted = options.rightText ? fitTextBlock(ctx, options.rightText, sideWidth, mainSize, options.fontWeight, renderOptions, mainMaxLines) : null;
    const mainHeight = Math.max(leftFitted?.lineHeight ? leftFitted.lineHeight * leftFitted.lines.length : 0, rightFitted?.lineHeight ? rightFitted.lineHeight * rightFitted.lines.length : 0);
    const subtitleFitted = options.subText ? fitTextBlock(ctx, options.subText, textWidth, subSize, getSubtitleFontWeight(options.fontWeight), renderOptions, 2) : null;
    const groupHeight = Math.max(iconSize, mainHeight) + (subtitleFitted ? subSpacing + subtitleFitted.lineHeight * subtitleFitted.lines.length : 0);
    const mainCenterY = centerY - (groupHeight - Math.max(iconSize, mainHeight)) / 2;
    await drawIcon(ctx, options.icon.source, fallbackIconSource, centerX - iconSize / 2, mainCenterY - iconSize / 2, iconSize, options.icon.borderRadius, options.icon.backgroundEnabled, diagnostics.warnings);
    if (leftFitted) drawFittedText(ctx, options.leftText, centerX - iconSize / 2 - spacing, mainCenterY, sideWidth, mainSize, options.fontWeight, 'right', renderOptions, mainMaxLines, scale, leftFitted);
    if (rightFitted) drawFittedText(ctx, options.rightText, centerX + iconSize / 2 + spacing, mainCenterY, sideWidth, mainSize, options.fontWeight, 'left', renderOptions, mainMaxLines, scale, rightFitted);
    if (subtitleFitted) drawFittedText(ctx, options.subText, centerX, mainCenterY + Math.max(iconSize, mainHeight) / 2 + subSpacing + subtitleFitted.lineHeight * subtitleFitted.lines.length / 2, textWidth, subSize, getSubtitleFontWeight(options.fontWeight), 'center', renderOptions, 2, scale, subtitleFitted);
  } else if (layout === 'stacked' && options.icon.source) {
    const mainFitted = mainText ? fitTextBlock(ctx, mainText, textWidth, mainSize, options.fontWeight, renderOptions, mainMaxLines) : null;
    const subtitleFitted = options.subText ? fitTextBlock(ctx, options.subText, textWidth, subSize, getSubtitleFontWeight(options.fontWeight), renderOptions, 2) : null;
    const mainHeight = mainFitted ? mainFitted.lineHeight * mainFitted.lines.length : 0;
    const subtitleHeight = subtitleFitted ? subtitleFitted.lineHeight * subtitleFitted.lines.length : 0;
    const groupHeight = iconSize + (mainFitted ? subSpacing + mainHeight : 0) + (subtitleFitted ? subSpacing + subtitleHeight : 0);
    const groupTop = centerY - groupHeight / 2;
    const iconTop = groupTop;
    await drawIcon(ctx, options.icon.source, fallbackIconSource, centerX - iconSize / 2, iconTop, iconSize, options.icon.borderRadius, options.icon.backgroundEnabled, diagnostics.warnings);
    if (options.decorations.showSeparator) drawSeparator(ctx, options, iconTop + iconSize + subSpacing / 2, scale);
    const x = textX(options.textAlign, width, margin); const align = canvasAlign(options.textAlign);
    const mainCenterY = iconTop + iconSize + subSpacing + mainHeight / 2;
    if (mainFitted) drawFittedText(ctx, mainText, x, mainCenterY, textWidth, mainSize, options.fontWeight, align, renderOptions, mainMaxLines, scale, mainFitted);
    if (subtitleFitted) drawFittedText(ctx, options.subText, x, mainCenterY + mainHeight / 2 + subSpacing + subtitleHeight / 2, textWidth, subSize, getSubtitleFontWeight(options.fontWeight), align, renderOptions, 2, scale, subtitleFitted);
  } else {
    const mainFitted = mainText ? fitTextBlock(ctx, mainText, textWidth, mainSize, options.fontWeight, renderOptions, mainMaxLines) : null;
    const subtitleFitted = options.subText ? fitTextBlock(ctx, options.subText, textWidth, subSize, getSubtitleFontWeight(options.fontWeight), renderOptions, 2) : null;
    const mainHeight = mainFitted ? mainFitted.lineHeight * mainFitted.lines.length : 0;
    const subtitleHeight = subtitleFitted ? subtitleFitted.lineHeight * subtitleFitted.lines.length : 0;
    const groupHeight = mainHeight + (subtitleFitted ? subSpacing + subtitleHeight : 0);
    const groupTop = centerY - groupHeight / 2;
    const x = textX(options.textAlign, width, margin); const align = canvasAlign(options.textAlign);
    if (mainFitted) drawFittedText(ctx, mainText, x, groupTop + mainHeight / 2, textWidth, mainSize, options.fontWeight, align, renderOptions, mainMaxLines, scale, mainFitted);
    if (subtitleFitted) drawFittedText(ctx, options.subText, x, groupTop + mainHeight + subSpacing + subtitleHeight / 2, textWidth, subSize, getSubtitleFontWeight(options.fontWeight), align, renderOptions, 2, scale, subtitleFitted);
  }
  ctx.restore();
}
