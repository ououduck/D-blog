import { describe, it, expect } from 'vitest';
import {
  getReadingProgress,
  getScrollTopForReadingProgress,
  isReadingComplete,
  READING_PROGRESS_END_RATIO,
} from './readingProgress';

/**
 * 实现约定：rect 是「当前 scrollY 下」相对视口的位置（absTop - scrollY），
 * 函数内部用 rect.top + scrollY 还原文章的文档绝对位置。
 *
 * 场景 A（absTop=600、viewport=800、document=2000）：
 *   startOffset=144（0.18）、endOffset=400（0.5）
 *   startScrollTop=600-144=456；documentMaxScrollTop=2000-800=1200
 *   endScrollTop=min(600+800-400, 1200)=1000；totalScrollable=544
 *   progress(scrollY) = (scrollY-456)/544
 */
interface InputOptions {
  absTop?: number;
  viewportHeight?: number;
  documentHeight?: number;
  rectHeight?: number;
  endRectTop?: number;
}

const makeInput = (scrollY: number, opts: InputOptions = {}) => {
  const absTop = opts.absTop ?? 600;
  const viewportHeight = opts.viewportHeight ?? 800;
  const documentHeight = opts.documentHeight ?? 2000;
  const rectHeight = opts.rectHeight ?? 800;
  const rect = { top: absTop - scrollY, height: rectHeight, bottom: absTop - scrollY + rectHeight };
  const endRect =
    opts.endRectTop === undefined
      ? undefined
      : { top: opts.endRectTop - scrollY, height: 20, bottom: opts.endRectTop - scrollY + 20 };
  return { rect, endRect, viewportHeight, scrollY, documentHeight };
};

describe('getReadingProgress', () => {
  it('READING_PROGRESS_END_RATIO 导出为 0.5', () => {
    expect(READING_PROGRESS_END_RATIO).toBe(0.5);
  });

  it('滚动到阅读结束位置时为 1', () => {
    expect(getReadingProgress(makeInput(1000))).toBe(1);
  });

  it('阅读区间中点时为 0.5', () => {
    expect(getReadingProgress(makeInput(728))).toBeCloseTo(0.5, 5);
  });

  it('阅读区间起点时为 0', () => {
    expect(getReadingProgress(makeInput(456))).toBe(0);
  });

  it('超界滚动被夹取到 [0, 1]', () => {
    expect(getReadingProgress(makeInput(1200))).toBe(1);
    expect(getReadingProgress(makeInput(0))).toBe(0);
  });

  it('文档无可滚动空间时返回 0（未读过）', () => {
    expect(getReadingProgress(makeInput(100, { documentHeight: 600 }))).toBe(0);
  });

  it('文章过短无滚动区间时返回 0', () => {
    const input = makeInput(0, { absTop: 0, rectHeight: 100, documentHeight: 800 });
    expect(getReadingProgress(input)).toBe(0);
  });

  it('使用 endRect 时以正文末尾为阅读终点', () => {
    // 正文末尾绝对位置 1100 → endScrollTop = min(1100-400, 1200) = 700
    const input = makeInput(700, { endRectTop: 1100 });
    expect(getReadingProgress(input)).toBe(1);
    // 区间中点：456 + (700-456)/2 = 578
    const mid = makeInput(578, { endRectTop: 1100 });
    expect(getReadingProgress(mid)).toBeCloseTo(0.5, 5);
  });
});

describe('getScrollTopForReadingProgress', () => {
  it('进度 1 换算回阅读结束滚动位置', () => {
    expect(getScrollTopForReadingProgress(makeInput(456), 1)).toBe(1000);
  });

  it('进度 0.5 换算回区间中点', () => {
    expect(getScrollTopForReadingProgress(makeInput(456), 0.5)).toBe(728);
  });

  it('进度 0 返回起始滚动位置（起点为正时不被夹取到 0）', () => {
    expect(getScrollTopForReadingProgress(makeInput(456), 0)).toBe(456);
  });

  it('起始位置为负滚动时被夹取到 0', () => {
    // absTop=100 → startScrollTop = 100-144 = -44
    const input = makeInput(0, { absTop: 100 });
    expect(getScrollTopForReadingProgress(input, 0)).toBe(0);
  });

  it('非法进度返回 0', () => {
    expect(getScrollTopForReadingProgress(makeInput(456), Number.NaN)).toBe(0);
    expect(getScrollTopForReadingProgress(makeInput(456), Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('进度超出 [0,1] 被夹取', () => {
    expect(getScrollTopForReadingProgress(makeInput(456), 2)).toBe(1000);
    expect(getScrollTopForReadingProgress(makeInput(456), -1)).toBe(456);
  });

  it('文档不可滚动时返回 0', () => {
    expect(getScrollTopForReadingProgress(makeInput(0, { documentHeight: 600 }), 0.5)).toBe(0);
  });
});

describe('isReadingComplete', () => {
  it('达到完成阈值视为读完', () => {
    expect(isReadingComplete(1)).toBe(true);
    expect(isReadingComplete(0.995)).toBe(true);
    expect(isReadingComplete(0.9999)).toBe(true);
  });

  it('低于阈值未读完', () => {
    expect(isReadingComplete(0.994)).toBe(false);
    expect(isReadingComplete(0.99)).toBe(false);
    expect(isReadingComplete(0)).toBe(false);
  });
});
