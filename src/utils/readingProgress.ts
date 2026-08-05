export const READING_PROGRESS_START_RATIO = 0.18;
export const READING_PROGRESS_END_RATIO = 0.28;
export const READING_PROGRESS_COMPLETION_THRESHOLD = 1;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export const getReadingProgress = ({
  rect,
  viewportHeight,
  scrollY,
  documentHeight
}: {
  rect: Pick<DOMRect, 'top' | 'height' | 'bottom'>;
  viewportHeight: number;
  scrollY: number;
  documentHeight: number;
}) => {
  const startOffset = viewportHeight * READING_PROGRESS_START_RATIO;
  const endOffset = viewportHeight * READING_PROGRESS_END_RATIO;
  const articleTop = rect.top + scrollY;
  const articleBottom = articleTop + rect.height;
  const startScrollTop = articleTop - startOffset;
  const documentMaxScrollTop = Math.max(documentHeight - viewportHeight, 0);
  const articleEndScrollTop = articleBottom - endOffset;
  const endScrollTop = Math.min(articleEndScrollTop, documentMaxScrollTop);
  const totalScrollable = Math.max(endScrollTop - startScrollTop, 1);

  return clamp((scrollY - startScrollTop) / totalScrollable, 0, 1);
};

export const isReadingComplete = (progress: number) => progress >= READING_PROGRESS_COMPLETION_THRESHOLD;
