import { describe, it, expect } from 'vitest';
import {
  clamp,
  getCanvasSize,
  getEffectiveLayout,
  getExportFilename,
  getImageFitScale,
  getSubtitleFontWeight,
  normalizeFontWeight,
} from './coverLayout';

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
