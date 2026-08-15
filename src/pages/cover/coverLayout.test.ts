import { describe, it, expect } from 'vitest';
import {
  clamp,
  fitText,
  getCanvasSize,
  getEffectiveLayout,
  getExportFilename,
  getImageFitScale,
  getSubtitleFontWeight,
  normalizeFontWeight,
} from './coverLayout';

// 简化测量：按字符数 × 字号估算宽度（每个字符占 fontSize 宽）。
const measure = (text: string, fontSize: number) => Array.from(text).length * fontSize;

describe('clamp', () => {
  it('边界裁剪', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('min > max 时自动交换', () => {
    expect(clamp(5, 10, 0)).toBe(5);
  });
});

describe('getCanvasSize', () => {
  it('按比例与基准宽度计算尺寸', () => {
    expect(getCanvasSize({ w: 16, h: 9 }, 1600)).toEqual({ width: 1600, height: 900 });
  });

  it('非法输入抛错', () => {
    expect(() => getCanvasSize({ w: 0, h: 9 })).toThrow();
    expect(() => getCanvasSize({ w: 16, h: 0 })).toThrow();
    expect(() => getCanvasSize({ w: 16, h: 9 }, 0)).toThrow();
  });
});

describe('getEffectiveLayout', () => {
  it('无图标时强制 text-only', () => {
    expect(getEffectiveLayout('icon-split', false)).toBe('text-only');
    expect(getEffectiveLayout('icon-split', true, false)).toBe('text-only');
  });

  it('有图标时保留原布局', () => {
    expect(getEffectiveLayout('icon-split', true)).toBe('icon-split');
    expect(getEffectiveLayout('text-only', false)).toBe('text-only');
  });
});

describe('getImageFitScale', () => {
  const canvas = { width: 1000, height: 500 };

  it('cover 取放缩比最大值（填满画布）', () => {
    expect(getImageFitScale({ width: 500, height: 500 }, canvas, 'cover')).toBe(2);
  });

  it('contain 取放缩比最小值（完整放入）', () => {
    expect(getImageFitScale({ width: 500, height: 500 }, canvas, 'contain')).toBe(1);
  });

  it('非法尺寸返回 1', () => {
    expect(getImageFitScale({ width: 0, height: 500 }, canvas)).toBe(1);
  });
});

describe('normalizeFontWeight / getSubtitleFontWeight', () => {
  it('就近取 100 的倍数并限制在 100~900', () => {
    expect(normalizeFontWeight(345)).toBe(300);
    expect(normalizeFontWeight(0)).toBe(100);
    expect(normalizeFontWeight(1200)).toBe(900);
  });

  it('副标题字重为主字重减 200', () => {
    expect(getSubtitleFontWeight(700)).toBe(500);
    expect(getSubtitleFontWeight(200)).toBe(100);
  });
});

describe('getExportFilename', () => {
  it('净化非法字符并补扩展名', () => {
    expect(getExportFilename(' 我的封面/测试:1 ', 'png')).toBe('我的封面-测试-1.png');
  });

  it('倍率大于 1 时追加 @Nx', () => {
    expect(getExportFilename('cover', 'jpeg', 2)).toBe('cover@2x.jpg');
  });

  it('全为点号/空格时回退 cover', () => {
    expect(getExportFilename('....', 'png')).toBe('cover.png');
    expect(getExportFilename('   ', 'png')).toBe('cover.png');
  });
});

describe('fitText', () => {
  it('短文本单行容纳不截断', () => {
    const result = fitText('短文本', { maxWidth: 300, maxLines: 2, fontSize: 48 }, measure);
    expect(result.lines).toEqual(['短文本']);
    expect(result.truncated).toBe(false);
    expect(result.fontSize).toBe(48);
  });

  it('超宽文本按 maxWidth 换行', () => {
    // 10 字符 × 24px = 240px 一行；maxWidth=100 → 每行最多 4 字符
    const result = fitText('一二三四五六七八九十', { maxWidth: 100, maxLines: 10, fontSize: 24 }, measure);
    expect(result.lines.length).toBeGreaterThan(1);
    expect(result.lines[0].length).toBeLessThanOrEqual(4);
  });

  it('行数超限时缩小字号', () => {
    const result = fitText(
      '一二三四五六七八九十甲乙丙丁戊己庚辛壬癸',
      { maxWidth: 80, maxLines: 2, fontSize: 40, minFontSize: 20 },
      measure,
    );
    // minFontSize=20 时每行最多 4 字符，20 字符至少 5 行 → 截断为 2 行
    expect(result.truncated).toBe(true);
    expect(result.lines.length).toBeLessThanOrEqual(2);
  });

  it('截断时末行加省略号', () => {
    const result = fitText('这是一个非常长的标题需要被截断处理', { maxWidth: 60, maxLines: 1, fontSize: 30 }, measure);
    expect(result.truncated).toBe(true);
    expect(result.lines[0]).toMatch(/…$/);
  });

  it('空文本返回空行', () => {
    const result = fitText('', { maxWidth: 300, maxLines: 2, fontSize: 48 }, measure);
    expect(result.lines).toEqual([]);
  });

  it('保留多段落结构', () => {
    const result = fitText('第一段\n\n第二段', { maxWidth: 500, maxLines: 5, fontSize: 24 }, measure);
    expect(result.lines.length).toBeGreaterThanOrEqual(2);
  });
});
