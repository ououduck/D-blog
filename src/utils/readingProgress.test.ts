import { describe, expect, it } from 'vitest';
import { getReadingProgress, getScrollTopForReadingProgress } from './readingProgress';

const viewportHeight = 1000;
const documentHeight = 4000;
const articleTop = 200;
const articleHeight = 2000;

const inputAt = (scrollY: number) => ({
  rect: {
    top: articleTop - scrollY,
    height: articleHeight,
    bottom: articleTop + articleHeight - scrollY
  },
  viewportHeight,
  scrollY,
  documentHeight
});

describe('reading progress scroll mapping', () => {
  it('maps progress back to the same scroll position', () => {
    const originalScrollY = 970;
    const progress = getReadingProgress(inputAt(originalScrollY));
    const restoredScrollY = getScrollTopForReadingProgress(inputAt(0), progress);

    expect(progress).toBeCloseTo(0.5);
    expect(restoredScrollY).toBeCloseTo(originalScrollY);
  });

  it('clamps progress to the article scroll range', () => {
    expect(getScrollTopForReadingProgress(inputAt(0), 0)).toBe(20);
    expect(getScrollTopForReadingProgress(inputAt(0), 1)).toBe(1920);
    expect(getScrollTopForReadingProgress(inputAt(0), -1)).toBe(20);
    expect(getScrollTopForReadingProgress(inputAt(0), 2)).toBe(1920);
  });

  it('returns zero when the document has no scroll range', () => {
    const input = { ...inputAt(0), documentHeight: viewportHeight };

    expect(getReadingProgress(input)).toBe(0);
    expect(getScrollTopForReadingProgress(input, 0.5)).toBe(0);
  });

  it('returns zero for a short article without a progress range', () => {
    const input = {
      ...inputAt(0),
      rect: { top: articleTop, height: 100, bottom: articleTop + 100 }
    };

    expect(getReadingProgress(input)).toBe(0);
    expect(getScrollTopForReadingProgress(input, 0.5)).toBe(0);
  });

  it('safely handles a non-finite target progress', () => {
    expect(getScrollTopForReadingProgress(inputAt(0), Number.NaN)).toBe(0);
  });
});
