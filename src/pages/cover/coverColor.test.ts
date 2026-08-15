import { describe, it, expect } from 'vitest';
import { chooseTextColor } from './coverColor';

describe('chooseTextColor', () => {
  it('深色背景返回白色文字且高对比度', () => {
    const decision = chooseTextColor({ r: 20, g: 20, b: 40 }, '#ffffff');
    expect(decision.color).toBe('#ffffff');
    expect(decision.contrast).toBeGreaterThanOrEqual(4.5);
    expect(decision.lowContrast).toBe(false);
  });

  it('浅色背景返回深色文字', () => {
    const decision = chooseTextColor({ r: 240, g: 240, b: 240 }, '#ffffff');
    expect(decision.color).toBe('#1a1a2e');
  });

  it('无背景时依据 fallback 决定（白色 fallback → 深色文字）', () => {
    const decision = chooseTextColor(null, '#ffffff');
    expect(decision.color).toBe('#1a1a2e');
  });

  it('低对比度背景标记 lowContrast', () => {
    // 中灰背景与黑白两色对比度都不足 4.5
    const decision = chooseTextColor({ r: 128, g: 128, b: 128 }, '#ffffff');
    expect(decision.lowContrast).toBe(true);
  });

  it('fallback 非法时回退为黑色（浅背景 → 深色文字胜出）', () => {
    const decision = chooseTextColor({ r: 240, g: 240, b: 240 }, 'not-a-color');
    // fallback 变黑：黑字与浅背景对比度远高于白字，选深色
    expect(decision.color).toBe('#1a1a2e');
  });
});
