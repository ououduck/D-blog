import { describe, it, expect } from 'vitest';
import { coverSizePresets } from './coverPresets';

describe('coverSizePresets', () => {
  it('预设标签唯一且宽高为正数', () => {
    const labels = new Set(coverSizePresets.map((preset) => preset.label));
    expect(labels.size).toBe(coverSizePresets.length);
    for (const preset of coverSizePresets) {
      expect(preset.w).toBeGreaterThan(0);
      expect(preset.h).toBeGreaterThan(0);
    }
  });

  it('包含常用的 16:9 与社交分享比例', () => {
    const labels = coverSizePresets.map((preset) => preset.label);
    expect(labels).toContain('16:9');
    expect(labels).toContain('1.91:1');
  });
});
