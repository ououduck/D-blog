/**
 * 归档分组状态：把文章按「年份 → 月份」聚合，供 /archive 时间线渲染与
 * 展开/折叠状态管理使用。构建期数据日期通常合法，但模块对无效日期承诺
 * 「不抛错」：月份解析失败时回退为 1 月（避免产生多个「NaN月」分组且
 * 排序不稳定），未知年份在排序时固定排在最后。
 */
import type { PostMetadata } from '../../types';
import { formatDate, getDateTimestamp } from '../../utils/date';

interface MonthGroup {
  month: string;
  monthNum: number;
  total: number;
  posts: PostMetadata[];
}

interface ArchiveGroup {
  year: string;
  total: number;
  months: MonthGroup[];
}

interface ArchiveExpansion {
  years: Set<string>;
  months: Set<string>;
}

const formatMonth = (dateText: string) => formatDate(dateText, 'zh-CN', { month: 'numeric' });

/** 解析「N月」文案为月份数字；无效日期时回退 1，杜绝 NaN 分组。 */
const parseMonthNumber = (dateText: string): number => {
  const monthNum = Number.parseInt(formatMonth(dateText).replace('月', ''), 10);
  return Number.isInteger(monthNum) && monthNum >= 1 && monthNum <= 12 ? monthNum : 1;
};

/** 年份倒序比较：从「2026年」等本地化文案提取数字；未知年份固定排在最后。 */
const compareYearDesc = (a: string, b: string) => {
  const yearA = Number.parseInt(a, 10);
  const yearB = Number.parseInt(b, 10);
  if (Number.isNaN(yearA) && Number.isNaN(yearB)) return 0;
  if (Number.isNaN(yearA)) return 1;
  if (Number.isNaN(yearB)) return -1;
  return yearB - yearA;
};

export const getMonthKey = (year: string, monthNum: number) => `${year}-${monthNum}`;

export const buildArchiveGroups = (posts: PostMetadata[]): ArchiveGroup[] => {
  const groups = new Map<string, ArchiveGroup>();

  posts
    .slice()
    .sort((a, b) => getDateTimestamp(b.date) - getDateTimestamp(a.date))
    .forEach((post) => {
      const year = formatDate(post.date, 'zh-CN', { year: 'numeric' });
      const monthNum = parseMonthNumber(post.date);
      let yearGroup = groups.get(year);

      if (!yearGroup) {
        yearGroup = { year, total: 0, months: [] };
        groups.set(year, yearGroup);
      }

      yearGroup.total += 1;

      let monthGroup = yearGroup.months.find((month) => month.monthNum === monthNum);
      if (!monthGroup) {
        monthGroup = { month: `${monthNum}月`, monthNum, total: 0, posts: [] };
        yearGroup.months.push(monthGroup);
      }

      monthGroup.total += 1;
      monthGroup.posts.push(post);
    });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      months: group.months.sort((a, b) => b.monthNum - a.monthNum),
    }))
    .sort((a, b) => compareYearDesc(a.year, b.year));
};

export const getAllExpansion = (groups: ArchiveGroup[]): ArchiveExpansion => ({
  years: new Set(groups.map((group) => group.year)),
  months: new Set(groups.flatMap((group) => group.months.map((month) => getMonthKey(group.year, month.monthNum)))),
});

export const getInitialExpansion = (groups: ArchiveGroup[], year: string | null): ArchiveExpansion => {
  if (groups.length === 0) {
    return { years: new Set(), months: new Set() };
  }

  const target = groups.find((group) => group.year === year) ?? groups[0];
  const firstMonth = target.months[0];
  return {
    years: new Set([target.year]),
    months: new Set(firstMonth ? [getMonthKey(target.year, firstMonth.monthNum)] : []),
  };
};

export const isAllVisibleExpanded = (
  groups: ArchiveGroup[],
  expandedYears: ReadonlySet<string>,
  expandedMonths: ReadonlySet<string>,
) =>
  groups.length > 0 &&
  groups.every(
    (group) =>
      expandedYears.has(group.year) &&
      group.months.every((month) => expandedMonths.has(getMonthKey(group.year, month.monthNum))),
  );

export const ensureYearExpanded = (groups: ArchiveGroup[], expandedYears: ReadonlySet<string>, year: string | null) => {
  if (!year || !groups.some((group) => group.year === year) || expandedYears.has(year)) {
    return new Set(expandedYears);
  }

  return new Set([...expandedYears, year]);
};
