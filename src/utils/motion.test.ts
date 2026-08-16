import { describe, it, expect } from 'vitest';
import { easeOut, easeSmooth, fadeInUp, staggerContainer, routeTransition } from './motion';
import { HEADING_SCROLL_OFFSET } from './scroll';

describe('motion 常量', () => {
  it('缓动曲线为标准 cubic-bezier 数组', () => {
    expect(easeOut).toHaveLength(4);
    expect(easeSmooth).toHaveLength(4);
    for (const value of [...easeOut, ...easeSmooth]) {
      expect(typeof value).toBe('number');
    }
  });

  it('变体结构完整（hidden/visible 或 initial/animate/exit）', () => {
    expect(fadeInUp.hidden).toBeDefined();
    expect(fadeInUp.visible).toBeDefined();
    expect(staggerContainer.hidden).toBeDefined();
    expect(staggerContainer.visible).toBeDefined();
    expect(routeTransition.initial).toBeDefined();
    expect(routeTransition.animate).toBeDefined();
    expect(routeTransition.exit).toBeDefined();
  });
});

describe('scroll 常量', () => {
  it('标题锚点偏移为正数', () => {
    expect(HEADING_SCROLL_OFFSET).toBeGreaterThan(0);
  });
});
