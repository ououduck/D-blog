// 阅读进度区间：正文首行进入视口上部 18% 记为 0%，正文最后一行进入视口中间（50%）
// 记为 100%。正文之后的许可协议/作者/导航/推荐/评论等区块不参与文章长度计算。
const READING_PROGRESS_START_RATIO = 0.18;
export const READING_PROGRESS_END_RATIO = 0.5;
// 进度四舍五入显示为 100% 时即视为已读完，避免主页出现“已读 100%”却仍在继续阅读卡中。
const READING_PROGRESS_COMPLETION_THRESHOLD = 0.995;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

type ReadingBoundaryRect = Pick<DOMRect, 'top' | 'height' | 'bottom'>;

type ReadingProgressInput = {
  rect: ReadingBoundaryRect;
  endRect?: ReadingBoundaryRect;
  viewportHeight: number;
  scrollY: number;
  documentHeight: number;
};

type ReadingScrollRange = {
  startScrollTop: number;
  endScrollTop: number;
  documentMaxScrollTop: number;
};

const getReadingScrollRange = (input: ReadingProgressInput): ReadingScrollRange => {
  const { rect, viewportHeight, scrollY, documentHeight } = input;
  const startOffset = viewportHeight * READING_PROGRESS_START_RATIO;
  const endOffset = viewportHeight * READING_PROGRESS_END_RATIO;
  const articleTop = rect.top + scrollY;
  const readingEnd = input.endRect
    ? input.endRect.top + scrollY
    : articleTop + rect.height;
  const startScrollTop = articleTop - startOffset;
  const documentMaxScrollTop = Math.max(documentHeight - viewportHeight, 0);
  const articleEndScrollTop = readingEnd - endOffset;
  const endScrollTop = Math.min(articleEndScrollTop, documentMaxScrollTop);

  return { startScrollTop, endScrollTop, documentMaxScrollTop };
};

export const getReadingProgress = (input: ReadingProgressInput) => {
  const { startScrollTop, endScrollTop, documentMaxScrollTop } = getReadingScrollRange(input);

  // 文档没有可滚动区间时，即使文章末尾已在视口内，也没有证据表明文章被读过。
  if (documentMaxScrollTop <= 0) {
    return 0;
  }

  const totalScrollable = endScrollTop - startScrollTop;

  // A short article may not create any scrollable range. Treat the initial
  // measurement as unknown instead of marking it complete at scroll position 0.
  if (totalScrollable <= 0) {
    return 0;
  }

  return clamp((input.scrollY - startScrollTop) / totalScrollable, 0, 1);
};

export const getScrollTopForReadingProgress = (input: ReadingProgressInput, progress: number) => {
  const { startScrollTop, endScrollTop, documentMaxScrollTop } = getReadingScrollRange(input);
  const totalScrollable = endScrollTop - startScrollTop;

  if (documentMaxScrollTop <= 0 || totalScrollable <= 0 || !Number.isFinite(progress)) {
    return 0;
  }

  return clamp(startScrollTop + clamp(progress, 0, 1) * totalScrollable, 0, documentMaxScrollTop);
};

export const isReadingComplete = (progress: number) => progress >= READING_PROGRESS_COMPLETION_THRESHOLD;
