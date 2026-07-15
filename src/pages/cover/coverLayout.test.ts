import { describe, expect, it } from 'vitest';
import {
  clamp, fitText, getCanvasSize, getCoverImageScale, getEffectiveLayout,
  getExportFilename, getSubtitleFontWeight, scalePoint, wrapText
} from './coverLayout';

const measure = (text: string, fontSize: number) => Array.from(text).length * fontSize;

describe('cover layout helpers', () => {
  it('calculates canvas sizes and scaled coordinates', () => {
    expect(getCanvasSize({ w: 16, h: 9 })).toEqual({ width: 1200, height: 675 });
    expect(scalePoint({ x: 100, y: 50 }, { width: 200, height: 100 }, { width: 1200, height: 600 }))
      .toEqual({ x: 600, y: 300 });
  });

  it('uses a cover scale and clamps values', () => {
    expect(getCoverImageScale({ width: 800, height: 800 }, { width: 1200, height: 675 })).toBe(1.5);
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-1, 0, 10)).toBe(0);
  });

  it('falls back to text only whenever an icon layout cannot show an icon', () => {
    expect(getEffectiveLayout('stacked', false, true)).toBe('text-only');
    expect(getEffectiveLayout('icon-only', true, false)).toBe('text-only');
    expect(getEffectiveLayout('icon-split', false, true)).toBe('text-only');
    expect(getEffectiveLayout('stacked', true, true)).toBe('stacked');
  });

  it('normalizes subtitle weight and export filenames', () => {
    expect(getSubtitleFontWeight(100)).toBe(100);
    expect(getSubtitleFontWeight(900)).toBe(700);
    expect(getExportFilename(' article/cover ', 'jpeg', 2)).toBe('article-cover@2x.jpg');
    expect(getExportFilename('  ', 'png')).toBe('cover.png');
  });

  it('wraps Chinese, English words and oversized words', () => {
    expect(wrapText('中文测试', 20, 10, measure)).toEqual(['中文', '测试']);
    expect(wrapText('hello world', 60, 10, measure)).toEqual(['hello', 'world']);
    expect(wrapText('abcdefgh', 30, 10, measure)).toEqual(['abc', 'def', 'gh']);
  });

  it('shrinks text to the line limit and truncates at minimum size', () => {
    const fitted = fitText('abcdefghijkl', { maxWidth: 40, maxLines: 2, fontSize: 10, minFontSize: 5 }, measure);
    expect(fitted.fontSize).toBeLessThan(10);
    expect(fitted.lines).toHaveLength(2);

    const truncated = fitText('abcdefghijkl', { maxWidth: 10, maxLines: 1, fontSize: 10, minFontSize: 10 }, measure);
    expect(truncated.truncated).toBe(true);
    expect(truncated.lines[0].endsWith('…')).toBe(true);
  });
});
