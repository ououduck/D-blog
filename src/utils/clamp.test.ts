import { describe, it, expect } from 'vitest';
import { clamp } from './clamp';

describe('clamp', () => {
  it('值在区间内时原样返回', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(0, 0, 10)).toBe(0);
    expect(clamp(10, 0, 10)).toBe(10);
  });

  it('低于下限时夹取到下界', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(-100, -5, 5)).toBe(-5);
  });

  it('高于上限时夹取到上界', () => {
    expect(clamp(11, 0, 10)).toBe(10);
    expect(clamp(100, -5, 5)).toBe(5);
  });

  it('min > max 时自动交换（与 coverLayout 原行为一致）', () => {
    expect(clamp(3, 10, 0)).toBe(3);
    expect(clamp(-1, 10, 0)).toBe(0);
  });

  it('边界值与非有限输入不抛错', () => {
    expect(clamp(Number.NaN, 0, 1)).toBe(Number.NaN);
    expect(clamp(Number.POSITIVE_INFINITY, 0, 1)).toBe(1);
  });
});
