/**
 * 站点统计计算（纯函数）：从已发布文章列表生成 site-stats.json 的全部字段。
 * 与 generate-site-data.mjs 分离以便单测；now 由调用方注入（构建期时钟），
 * 保证同一输入 + 同一构建时刻输出确定，满足 SSG 确定性要求。
 */

/** 趋势图统计的月份数（含当月，向前回溯）。 */
export const TREND_MONTHS = 12;

const MONTH_PATTERN = /^\d{4}-\d{2}$/;

/** 按出现次数统计并排序（同频次按 zh-CN 名称序），与既有 countBy 口径一致。 */
const countBy = (items, getKey) =>
  Array.from(
    items.reduce((map, item) => {
      const key = getKey(item);
      if (key) {
        map.set(key, (map.get(key) || 0) + 1);
      }
      return map;
    }, new Map()),
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'zh-CN'));

const toPostSummary = (post) => ({
  id: post.id,
  title: post.title,
  excerpt: post.excerpt,
  date: post.date,
  updatedAt: post.updatedAt,
  category: post.category,
  tags: post.tags,
  coverImage: post.coverImage,
  readTime: post.readTime,
  wordCount: post.wordCount || 0,
  imageCount: post.imageCount || 0,
});

/** 提取 YYYY-MM-DD 日期的 UTC 毫秒（非法/缺失返回 null）。 */
const toUtcDayMs = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isNaN(ms) ? null : ms;
};

/**
 * 生成完整站点统计对象。
 * @param {Array<{id,title,excerpt,date,updatedAt,category,tags,coverImage,readTime,wordCount,imageCount}>} postsWithSearch
 * @param {{ now?: Date }} options now：构建期当前时间（缺省为实际当前时间，仅限脚本直接运行时）。
 */
export const buildSiteStats = (postsWithSearch, { now = new Date() } = {}) => {
  const posts = Array.isArray(postsWithSearch) ? postsWithSearch : [];
  const totalPosts = posts.length;
  const totalWords = posts.reduce((sum, post) => sum + (post.wordCount || 0), 0);
  const totalCategories = new Set(posts.map((post) => post.category)).size;
  const totalTags = new Set(posts.flatMap((post) => post.tags || [])).size;
  const totalImages = posts.reduce((sum, post) => sum + (post.imageCount || 0), 0);

  const categoryStats = countBy(posts, (post) => post.category);
  const tagStats = countBy(
    posts.flatMap((post) => post.tags || []),
    (tag) => tag,
  ).slice(0, 12);
  const recentPosts = posts
    .slice()
    .sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date))
    .slice(0, 5)
    .map(toPostSummary);
  const topWordCountPosts = posts
    .slice()
    .sort((a, b) => (b.wordCount || 0) - (a.wordCount || 0))
    .slice(0, 5)
    .map(toPostSummary);
  const topImageCountPosts = posts
    .slice()
    .sort((a, b) => (b.imageCount || 0) - (a.imageCount || 0))
    .slice(0, 5)
    .map(toPostSummary);

  // 运行时间：以最早发布日期为博客起点（含首日计 1 天），锚定文章数据而非部署时间。
  const buildUtcDayMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const firstPostDate =
    posts.reduce((earliest, post) => {
      const date = typeof post.date === 'string' ? post.date : '';
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return earliest;
      }
      return !earliest || date < earliest ? date : earliest;
    }, '') || '';
  const firstPostMs = toUtcDayMs(firstPostDate);
  const runningDays = firstPostMs === null ? 0 : Math.max(1, Math.floor((buildUtcDayMs - firstPostMs) / 86400000) + 1);

  // 近 N 个月发布趋势：固定窗口（含 0 的月份也输出），月份字符串 YYYY-MM。
  const monthCounts = new Map();
  for (const post of posts) {
    const month = typeof post.date === 'string' ? post.date.slice(0, 7) : '';
    if (MONTH_PATTERN.test(month)) {
      monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
    }
  }
  const trendCursor = new Date(buildUtcDayMs);
  trendCursor.setUTCDate(1);
  trendCursor.setUTCMonth(trendCursor.getUTCMonth() - (TREND_MONTHS - 1));
  const monthlyPosts = [];
  for (let index = 0; index < TREND_MONTHS; index += 1) {
    const month = `${trendCursor.getUTCFullYear()}-${String(trendCursor.getUTCMonth() + 1).padStart(2, '0')}`;
    monthlyPosts.push({ month, count: monthCounts.get(month) || 0 });
    trendCursor.setUTCMonth(trendCursor.getUTCMonth() + 1);
  }

  // 年度回顾：构建当年（UTC）的真实汇总；无文章时输出零值结构（不伪造内容）。
  const year = now.getUTCFullYear();
  const yearPosts = posts.filter((post) => typeof post.date === 'string' && post.date.startsWith(`${year}-`));
  // postsWithSearch 已按 date 降序传入，这里不依赖该前提，自行排序保证稳定。
  const yearPostsSorted = yearPosts
    .slice()
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : String(a.id).localeCompare(String(b.id))));
  const yearReview = {
    year,
    posts: yearPosts.length,
    words: yearPosts.reduce((sum, post) => sum + (post.wordCount || 0), 0),
    category: countBy(yearPosts, (post) => post.category)[0]?.name ?? null,
    tags: countBy(
      yearPosts.flatMap((post) => post.tags || []),
      (tag) => tag,
    )
      .slice(0, 3)
      .map((item) => item.name),
    firstPost: yearPostsSorted[0]
      ? { id: yearPostsSorted[0].id, title: yearPostsSorted[0].title, date: yearPostsSorted[0].date }
      : null,
    latestPost: yearPostsSorted[yearPostsSorted.length - 1]
      ? {
          id: yearPostsSorted[yearPostsSorted.length - 1].id,
          title: yearPostsSorted[yearPostsSorted.length - 1].title,
          date: yearPostsSorted[yearPostsSorted.length - 1].date,
        }
      : null,
  };

  return {
    totalPosts,
    totalWords,
    totalCategories,
    totalTags,
    totalImages,
    firstPostDate,
    runningDays,
    monthlyPosts,
    yearReview,
    categoryStats,
    tagStats,
    recentPosts,
    topWordCountPosts,
    topImageCountPosts,
  };
};
