import { describe, it, expect } from 'vitest';
import { getInitialShuoShuo } from './shuoshuo';

describe('shuoshuo 服务', () => {
  it('getInitialShuoShuo 返回构建期内联的说说列表', () => {
    const items = getInitialShuoShuo();
    expect(Array.isArray(items)).toBe(true);
    for (const item of items) {
      expect(typeof item.id).toBe('string');
      expect(typeof item.date).toBe('string');
      expect(typeof item.content).toBe('string');
      expect(typeof item.filePath).toBe('string');
    }
  });

  it('说说按日期倒序（新 → 旧）', () => {
    const items = getInitialShuoShuo();
    for (let index = 1; index < items.length; index += 1) {
      expect(items[index - 1].date >= items[index].date).toBe(true);
    }
  });
});
