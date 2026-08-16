import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WritingCalendar } from './WritingCalendar';

describe('WritingCalendar', () => {
  it('空数据时显示提示', () => {
    render(<WritingCalendar dates={[]} />);
    expect(screen.getByText('暂无文章发布记录。')).toBeInTheDocument();
  });

  it('有效日期计数并渲染网格（含 aria 汇总）', () => {
    const dates = ['2026-01-01', '2026-01-01', '2026-01-02', '2026-03-14'];
    render(<WritingCalendar dates={dates} />);
    // aria-label 汇总发布总数与活跃天数。
    const grid = screen.getByRole('img', { name: /写作日历/ });
    expect(grid).toHaveAccessibleName(/共 4 篇发布/);
    expect(grid).toHaveAccessibleName(/3 个活跃日期/);
  });

  it('同一日期多篇发布聚合为一天', () => {
    const dates = ['2026-01-01', '2026-01-01', '2026-01-01'];
    render(<WritingCalendar dates={dates} />);
    const grid = screen.getByRole('img', { name: /写作日历/ });
    expect(grid).toHaveAccessibleName(/共 3 篇发布/);
    expect(grid).toHaveAccessibleName(/1 个活跃日期/);
  });

  it('忽略非法日期字符串', () => {
    render(<WritingCalendar dates={['2026-01-01', 'not-a-date', '']} />);
    const grid = screen.getByRole('img', { name: /写作日历/ });
    expect(grid).toHaveAccessibleName(/共 1 篇发布/);
  });

  it('渲染图例（少/多）', () => {
    render(<WritingCalendar dates={['2026-01-01']} />);
    expect(screen.getByText('少')).toBeInTheDocument();
    expect(screen.getByText('多')).toBeInTheDocument();
  });
});
