/**
 * 文章标题锚点顶部偏移：单一数据源为 CSS 变量 --article-heading-offset。
 *
 * Layout 运行时按当前上下文写入 documentElement：
 * - 普通模式：实测固定导航栏（.site-navbar，含 safe-area）高度 + 16px 余量；
 * - 专注阅读：无固定导航，仅保留 1.5rem 呼吸余量。
 *
 * 读取方（必须共用，禁止再引入独立 magic number）：
 * - JS：TOC/胶囊点击跳转、useActiveHeading 激活判断、正文锚点与 hash 深链；
 * - CSS：.post-prose 标题的 scroll-margin-top（浏览器原生锚点跳转）。
 * 五类行为共享同一参考线：标题落点 = 激活判定线 = 原生锚点位置。
 */

/** CSS 变量不可用时的兜底值（px）：与 index.css :root 默认值 6.5rem 保持一致。 */
export const FALLBACK_HEADING_SCROLL_OFFSET = 104;

/** 读取当前生效的标题滚动偏移（px）。SSR/变量缺失时回退到 CSS 默认值。 */
export const getHeadingScrollOffset = (): number => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return FALLBACK_HEADING_SCROLL_OFFSET;
  }

  try {
    const raw = getComputedStyle(document.documentElement).getPropertyValue('--article-heading-offset');
    const parsed = Number.parseFloat(raw);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return parsed;
    }
  } catch {
    // 计算样式不可用的极端环境：走兜底值。
  }

  return FALLBACK_HEADING_SCROLL_OFFSET;
};
