/**
 * 写作日历：GitHub 风格发布频率热力图。
 *
 * 数据来自文章日期字段（"YYYY-MM-DD"，本地时区解析），按天聚合计数后
 * 以 53 周 × 7 天的网格渲染，颜色深浅表示当日发文量。
 *
 * 窗口锚点 = 最近一篇发布的日期（而非"今天"）：SSG 构建与客户端水合时
 * 数据一致，网格完全确定性，不会因构建/访问时间差产生水合冲突；
 * 站点持续发布时该窗口自然跟随最新动态。
 */

import React, { useMemo } from 'react';

interface WritingCalendarProps {
  /** 文章日期列表（"YYYY-MM-DD"）。 */
  dates: string[];
  className?: string;
}

const CELL_SIZE_CLASS = 'h-[11px] w-[11px] rounded-[2px] sm:h-[12px] sm:w-[12px]';
const WEEK_COUNT = 53;
const WEEKDAY_LABELS = ['一', '三', '五'];

/** 本地时区解析 "YYYY-MM-DD" → Date（避免 UTC 午夜解析在 UTC+8 倒退一天）。 */
const parseLocalDate = (value: string): Date | null => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
};

const toDayKey = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getDayLevel = (count: number): number => {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count === 2) return 2;
  if (count <= 4) return 3;
  return 4;
};

const LEVEL_CLASSES = [
  'bg-zinc-200 dark:bg-zinc-800',
  'bg-zinc-400 dark:bg-zinc-600',
  'bg-zinc-600 dark:bg-zinc-500',
  'bg-zinc-800 dark:bg-zinc-400',
  'bg-zinc-950 dark:bg-zinc-200',
];

interface CalendarCell {
  date: Date;
  count: number;
  level: number;
  inWindow: boolean;
}

export const WritingCalendar: React.FC<WritingCalendarProps> = ({ dates, className = '' }) => {
  const { cells, totalPosts, activeDays, monthLabels } = useMemo(() => {
    const counts = new Map<string, number>();
    let latest: Date | null = null;
    for (const value of dates) {
      const date = parseLocalDate(value);
      if (!date) continue;
      const key = toDayKey(date);
      counts.set(key, (counts.get(key) ?? 0) + 1);
      if (!latest || date > latest) latest = date;
    }

    const totalPosts = Array.from(counts.values()).reduce((sum, count) => sum + count, 0);
    if (totalPosts === 0) {
      return { cells: [], totalPosts: 0, activeDays: 0, monthLabels: [] };
    }

    // 窗口终点 = 最近发布日期；起点 = 终点往前 52 周。
    const endDate = latest as Date;
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - (WEEK_COUNT - 1) * 7 + 1);

    // 列对齐：起点对齐到周一（0=周一 … 6=周日），保证列边界稳定。
    const alignedStart = new Date(startDate);
    alignedStart.setDate(startDate.getDate() - ((startDate.getDay() + 6) % 7));

    const allCells: CalendarCell[] = [];
    const activeDays = counts.size;
    const monthLabels: Array<{ weekIndex: number; label: string }> = [];

    const cursor = new Date(alignedStart);
    for (let week = 0; week < WEEK_COUNT; week += 1) {
      // 月份标签：每周的第一个新月份（第一列总是显示）。
      const firstOfWeek = new Date(cursor);
      if (
        week === 0 ||
        firstOfWeek.getMonth() !== new Date(cursor.getTime() - 7 * 24 * 3600 * 1000).getMonth()
      ) {
        monthLabels.push({
          weekIndex: week,
          label: `${firstOfWeek.getMonth() + 1}月`,
        });
      }

      for (let day = 0; day < 7; day += 1) {
        const cellDate = new Date(cursor);
        const key = toDayKey(cellDate);
        const count = counts.get(key) ?? 0;
        const inWindow = cellDate >= startDate && cellDate <= endDate;
        allCells.push({
          date: cellDate,
          count,
          level: inWindow ? getDayLevel(count) : 0,
          inWindow,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    // 对齐后的第一列固定为周一，星期标签（一/三/五）在行内位置恒定。
    return { cells: allCells, totalPosts, activeDays, monthLabels };
  }, [dates]);

  if (cells.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">暂无文章发布记录。</p>
    );
  }

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return (
    <div className={className}>
      <div className="overflow-x-auto no-scrollbar">
        <div className="min-w-max">
          {/* 月份标签行 */}
          <div className="flex" aria-hidden="true">
            <span className="w-8 shrink-0 sm:w-9" />
            <div className="relative flex gap-[3px] sm:gap-[4px]">
              {monthLabels.map(({ weekIndex, label }) => (
                <span
                  key={`${weekIndex}-${label}`}
                  className="absolute top-0 text-[10px] leading-none text-zinc-400 dark:text-zinc-500"
                  style={{ left: `${weekIndex * (13 + 3)}px` }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-1 flex gap-[3px] sm:gap-[4px]">
            {/* 星期标签列（一/三/五） */}
            <div className="flex w-8 shrink-0 flex-col justify-between py-[1px] sm:w-9" aria-hidden="true">
              {WEEKDAY_LABELS.map((label) => (
                <span key={label} className="text-[10px] leading-[13px] text-zinc-400 dark:text-zinc-500">
                  {label}
                </span>
              ))}
            </div>

            <div
              role="img"
              aria-label={`写作日历：最近一年共 ${totalPosts} 篇发布，覆盖 ${activeDays} 个活跃日期`}
              className="flex gap-[3px] sm:gap-[4px]"
            >
              {weeks.map((week, weekIndex) => (
                <div key={weekIndex} className="flex flex-col gap-[3px] sm:gap-[4px]">
                  {week.map((cell) => (
                    <div
                      key={toDayKey(cell.date)}
                      title={`${toDayKey(cell.date)}${cell.count > 0 ? `：发布 ${cell.count} 篇` : ''}`}
                      aria-hidden="true"
                      className={`${CELL_SIZE_CLASS} ${cell.inWindow ? LEVEL_CLASSES[cell.level] : 'bg-transparent'}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 图例 */}
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
        <span>少</span>
        {[0, 1, 2, 3, 4].map((level) => (
          <span key={level} className={`${CELL_SIZE_CLASS} ${LEVEL_CLASSES[level]}`} aria-hidden="true" />
        ))}
        <span>多</span>
      </div>
    </div>
  );
};
