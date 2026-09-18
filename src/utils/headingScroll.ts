/**
 * 标题滚动/URL hash 工具：目录（TOC）、胶囊导航、正文锚点共用同一行为，
 * 保证平滑滚动偏移与 hash 写入在全站一致。
 */

import { HEADING_SCROLL_OFFSET } from '@/utils/scroll';

export const getHeadingScrollTop = (element: HTMLElement): number =>
  Math.max(0, element.getBoundingClientRect().top + window.scrollY - HEADING_SCROLL_OFFSET);

/** 平滑/即时滚动到指定标题（元素不存在时静默跳过）。 */
export const scrollToHeadingElement = (id: string, behavior: ScrollBehavior) => {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  window.scrollTo({ top: getHeadingScrollTop(element), behavior });
};

/** 用 replaceState 更新地址栏 hash（不产生历史记录，与既有 TOC 行为一致）。 */
export const replaceUrlHash = (id: string) => {
  const url = new URL(window.location.href);
  url.hash = id;
  window.history.replaceState({}, '', url.toString());
};

/** 复制标题锚点完整链接（协议 + 域名 + 路径 + #hash）；剪贴板由调用方处理。 */
export const buildHeadingAnchorUrl = (id: string): string => {
  const url = new URL(window.location.href);
  url.hash = id;
  return url.toString();
};
