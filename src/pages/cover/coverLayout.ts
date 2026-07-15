import { BASE_CANVAS_WIDTH, CANVAS_SAFE_MARGIN } from './coverConstants';
import type { CanvasSize, CoverRatio, FittedText, LayoutMode, Point } from './coverTypes';

export type TextMeasure = (text: string, fontSize: number) => number;
export interface FitTextOptions {
  maxWidth: number;
  maxLines: number;
  fontSize: number;
  minFontSize?: number;
  lineHeight?: number;
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

export function scalePoint(point: Point, from: CanvasSize, to: CanvasSize): Point {
  if (from.width === 0 || from.height === 0) return { x: 0, y: 0 };
  return { x: point.x * to.width / from.width, y: point.y * to.height / from.height };
}

export function getCoverImageScale(image: CanvasSize, canvas: CanvasSize): number {
  if (image.width <= 0 || image.height <= 0 || canvas.width <= 0 || canvas.height <= 0) return 1;
  return Math.max(canvas.width / image.width, canvas.height / image.height);
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

export function wrapText(text: string, maxWidth: number, fontSize: number, measure: TextMeasure): string[] {
  if (!text.trim()) return [];
  const lines = [''];
  for (const token of tokenizeText(text)) appendToken(lines, token, maxWidth, fontSize, measure);
  return lines.map(line => line.trim()).filter(Boolean);
}

export function fitText(text: string, options: FitTextOptions, measure: TextMeasure): FittedText {
  const maxLines = Math.max(1, Math.floor(options.maxLines));
  const minFontSize = Math.max(1, Math.min(options.fontSize, options.minFontSize ?? 12));
  let fontSize = Math.max(minFontSize, options.fontSize);
  let lines = wrapText(text, options.maxWidth, fontSize, measure);
  while (fontSize > minFontSize && lines.length > maxLines) {
    fontSize--;
    lines = wrapText(text, options.maxWidth, fontSize, measure);
  }
  const truncated = lines.length > maxLines;
  if (truncated) {
    lines = lines.slice(0, maxLines);
    let last = lines[maxLines - 1];
    while (last && measure(`${last}…`, fontSize) > options.maxWidth) last = last.slice(0, -1);
    lines[maxLines - 1] = `${last}…`;
  }
  return { lines, fontSize, lineHeight: fontSize * (options.lineHeight ?? 1.2), truncated };
}

export function getTextAreaWidth(size: CanvasSize): number {
  return Math.max(1, size.width - CANVAS_SAFE_MARGIN * 2);
}
