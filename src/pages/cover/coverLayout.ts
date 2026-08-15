import { BASE_CANVAS_WIDTH, CANVAS_SAFE_MARGIN } from './coverConstants';
import type { BackgroundFit, CanvasSize, CoverRatio, FittedText, LayoutMode } from './coverTypes';

type TextMeasure = (text: string, fontSize: number) => number;
interface FitTextOptions {
  maxWidth: number;
  maxLines: number;
  fontSize: number;
  minFontSize?: number;
  lineHeight?: number;
}

interface LayoutMetricsOptions {
  size: CanvasSize;
  layout: LayoutMode;
  leftText: string;
  rightText: string;
  subText: string;
  fontSize: number;
  subFontSize: number;
  iconSize: number;
  spacing: number;
  subSpacing: number;
  showIcon: boolean;
  hasIcon: boolean;
  maxTextLines?: number;
  minFontSize?: number;
}

interface LayoutMetrics {
  scale: number;
  scaled: boolean;
  overflow: boolean;
  maxTextLines: number;
  mainFontSize: number;
  subFontSize: number;
  iconSize: number;
  spacing: number;
  subSpacing: number;
  warnings: string[];
}

export function clamp(value: number, min: number, max: number): number {
  if (min > max) [min, max] = [max, min];
  return Math.min(max, Math.max(min, value));
}

export function getCanvasSize(ratio: Pick<CoverRatio, 'w' | 'h'>, width = BASE_CANVAS_WIDTH): CanvasSize {
  if (ratio.w <= 0 || ratio.h <= 0 || width <= 0) throw new Error('画布比例和宽度必须大于 0');
  return { width: Math.round(width), height: Math.round(width * ratio.h / ratio.w) };
}

export function getEffectiveLayout(layout: LayoutMode, showIcon: boolean, hasIcon = true): LayoutMode {
  if ((!showIcon || !hasIcon) && layout !== 'text-only') return 'text-only';
  return layout;
}

export function getImageFitScale(image: CanvasSize, canvas: CanvasSize, fit: BackgroundFit = 'cover'): number {
  if (image.width <= 0 || image.height <= 0 || canvas.width <= 0 || canvas.height <= 0) return 1;
  return fit === 'contain'
    ? Math.min(canvas.width / image.width, canvas.height / image.height)
    : Math.max(canvas.width / image.width, canvas.height / image.height);
}

export function normalizeFontWeight(weight: number): number {
  return clamp(Math.round(weight / 100) * 100, 100, 900);
}

export function getSubtitleFontWeight(weight: number): number {
  return normalizeFontWeight(weight - 200);
}

export function getExportFilename(name: string, format: 'png' | 'jpeg', scale = 1): string {
  const safeName = name.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-').replace(/[. ]+$/g, '') || 'cover';
  return `${safeName}${scale > 1 ? `@${scale}x` : ''}.${format === 'jpeg' ? 'jpg' : 'png'}`;
}

function tokenizeText(text: string): string[] {
  return text.trim().match(/[\p{Script=Han}]|[^\s\p{Script=Han}]+|\s+/gu) ?? [];
}

function appendToken(lines: string[], token: string, maxWidth: number, fontSize: number, measure: TextMeasure): void {
  if (/^\s+$/.test(token)) {
    if (lines.at(-1) && !lines.at(-1)!.endsWith(' ')) lines[lines.length - 1] += ' ';
    return;
  }
  let current = lines[lines.length - 1];
  if (measure(current + token, fontSize) <= maxWidth) {
    lines[lines.length - 1] = current + token;
    return;
  }
  if (current.trim()) lines.push('');
  current = lines[lines.length - 1];
  if (measure(token, fontSize) <= maxWidth) {
    lines[lines.length - 1] = token;
    return;
  }
  for (const character of Array.from(token)) {
    if (current && measure(current + character, fontSize) > maxWidth) {
      lines.push(character);
      current = character;
    } else {
      current += character;
      lines[lines.length - 1] = current;
    }
  }
}

function wrapText(text: string, maxWidth: number, fontSize: number, measure: TextMeasure): string[] {
  if (!text.trim() || maxWidth <= 0 || fontSize <= 0) return [];
  const paragraphs = text.replace(/\r\n?/g, '\n').split('\n');
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      if (lines.length) lines.push('');
      continue;
    }
    const paragraphLines = [''];
    for (const token of tokenizeText(paragraph)) appendToken(paragraphLines, token, maxWidth, fontSize, measure);
    lines.push(...paragraphLines.map(line => line.trim()).filter(Boolean));
  }
  return lines.filter(Boolean);
}

export function fitText(text: string, options: FitTextOptions, measure: TextMeasure): FittedText {
  const maxWidth = Math.max(1, options.maxWidth);
  const maxLines = Math.max(1, Math.floor(options.maxLines));
  const minFontSize = Math.max(1, Math.min(options.fontSize, options.minFontSize ?? 12));
  let fontSize = Math.max(minFontSize, options.fontSize);
  let lines = wrapText(text, maxWidth, fontSize, measure);
  while (fontSize > minFontSize && lines.length > maxLines) {
    fontSize--;
    lines = wrapText(text, maxWidth, fontSize, measure);
  }
  const truncated = lines.length > maxLines;
  if (truncated) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1] ?? '';
    if (measure('…', fontSize) <= maxWidth) {
      while (last && measure(`${last}…`, fontSize) > maxWidth) last = Array.from(last).slice(0, -1).join('');
      lines[maxLines - 1] = `${last}…`;
    } else {
      while (last && measure(last, fontSize) > maxWidth) last = Array.from(last).slice(0, -1).join('');
      lines[maxLines - 1] = last;
    }
  }
  return { lines, fontSize, lineHeight: fontSize * (options.lineHeight ?? 1.2), truncated };
}

export function calculateLayoutMetrics(options: LayoutMetricsOptions): LayoutMetrics {
  const canvasScale = options.size.width / BASE_CANVAS_WIDTH;
  const safeMargin = CANVAS_SAFE_MARGIN * Math.max(0.1, canvasScale);
  const availableWidth = Math.max(1, options.size.width - safeMargin * 2);
  const availableHeight = Math.max(1, options.size.height - safeMargin * 2);
  const hasText = Boolean(options.leftText.trim() || options.rightText.trim() || options.subText.trim());
  const effectiveLayout = getEffectiveLayout(options.layout, options.showIcon, options.hasIcon);
  const mainLines = options.maxTextLines ?? (effectiveLayout === 'text-only' ? 3 : 2);
  const mainLineHeight = options.fontSize * 1.2;
  const subLineHeight = options.subFontSize * 1.2;
  const contentHeight = (hasText ? mainLineHeight * mainLines : 0)
    + (options.subText.trim() ? subLineHeight * 2 : 0)
    + (options.showIcon && options.hasIcon && effectiveLayout !== 'text-only' ? options.iconSize : 0)
    + options.subSpacing * 2;
  const contentWidth = effectiveLayout === 'icon-split'
    ? options.iconSize + options.spacing * 2 + availableWidth * 0.6
    : availableWidth;
  const scale = Math.min(1, availableWidth / Math.max(1, contentWidth), availableHeight / Math.max(1, contentHeight));
  const safeScale = Math.max(0.35, scale);
  const scaled = safeScale < 0.999;
  const warnings: string[] = [];
  if (scaled) warnings.push('内容已自动缩小以适应安全区');
  const overflow = scale < 0.35;
  if (overflow) warnings.push('内容仍可能超出安全区，部分文字将截断');
  return {
    scale: safeScale,
    scaled,
    overflow,
    maxTextLines: mainLines,
    mainFontSize: Math.max(options.minFontSize ?? 14, options.fontSize * safeScale),
    subFontSize: Math.max(10, options.subFontSize * safeScale),
    iconSize: options.iconSize * safeScale,
    spacing: options.spacing * safeScale,
    subSpacing: options.subSpacing * safeScale,
    warnings,
  };
}
