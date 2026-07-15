import type { PostMetadata } from '../../types';
import { formatDate, getDateTimestamp } from '../../utils/date';

export interface MonthGroup {
  month: string;
  monthNum: number;
  total: number;
  posts: PostMetadata[];
}

export interface ArchiveGroup {
  year: string;
  total: number;
  categories: string[];
  months: MonthGroup[];
}

export interface ArchiveExpansion {
  years: Set<string>;
  months: Set<string>;
}

const formatMonth = (dateText: string) => formatDate(dateText, 'zh-CN', { month: 'numeric' });

export const getMonthKey = (year: string, monthNum: number) => `${year}-${monthNum}`;

export const buildArchiveGroups = (posts: PostMetadata[]): ArchiveGroup[] => {
  const groups = new Map<string, ArchiveGroup>();

  posts
    .slice()
    .sort((a, b) => getDateTimestamp(b.date) - getDateTimestamp(a.date))
    .forEach((post) => {
      const year = formatDate(post.date, 'zh-CN', { year: 'numeric' });
      const monthNum = Number.parseInt(formatMonth(post.date).replace('月', ''), 10);
      let yearGroup = groups.get(year);

      if (!yearGroup) {
        yearGroup = { year, total: 0, categories: [], months: [] };
        groups.set(year, yearGroup);
      }

      yearGroup.total += 1;
      if (!yearGroup.categories.includes(post.category)) {
        yearGroup.categories.push(post.category);
      }

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
      categories: group.categories.sort(),
      months: group.months.sort((a, b) => b.monthNum - a.monthNum)
    }))
    .sort((a, b) => Number(b.year) - Number(a.year));
};

export const getAllExpansion = (groups: ArchiveGroup[]): ArchiveExpansion => ({
  years: new Set(groups.map((group) => group.year)),
  months: new Set(groups.flatMap((group) => group.months.map((month) => getMonthKey(group.year, month.monthNum))))
});

export const getInitialExpansion = (groups: ArchiveGroup[], year: string | null): ArchiveExpansion => {
  if (groups.length === 0) {
    return { years: new Set(), months: new Set() };
  }

  const target = groups.find((group) => group.year === year) ?? groups[0];
  const firstMonth = target.months[0];
  return {
    years: new Set([target.year]),
    months: new Set(firstMonth ? [getMonthKey(target.year, firstMonth.monthNum)] : [])
  };
};

export const isAllVisibleExpanded = (
  groups: ArchiveGroup[],
  expandedYears: ReadonlySet<string>,
  expandedMonths: ReadonlySet<string>
) => groups.length > 0 && groups.every((group) =>
  expandedYears.has(group.year)
  && group.months.every((month) => expandedMonths.has(getMonthKey(group.year, month.monthNum)))
);

export const ensureYearExpanded = (
  groups: ArchiveGroup[],
  expandedYears: ReadonlySet<string>,
  year: string | null
) => {
  if (!year || !groups.some((group) => group.year === year) || expandedYears.has(year)) {
    return new Set(expandedYears);
  }

  return new Set([...expandedYears, year]);
};
