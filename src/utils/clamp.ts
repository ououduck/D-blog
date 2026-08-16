/**
 * 数值钳制工具：把 value 限制在 [min, max] 区间内。
 * 统一全站三处各自实现的 clamp（readingProgress / readingHistory / coverLayout），
 * min > max 时自动交换（与 coverLayout 的行为一致）。
 */
export const clamp = (value: number, min: number, max: number): number => {
  if (min > max) [min, max] = [max, min];
  return Math.min(max, Math.max(min, value));
};
