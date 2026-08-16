import { describe, it, expect } from 'vitest';
import { coverTemplates, defaultTemplate } from './coverTemplates';

describe('coverTemplates', () => {
  it('包含纯黑/纯白模板且字段完整', () => {
    expect(coverTemplates.length).toBeGreaterThanOrEqual(2);
    for (const template of coverTemplates) {
      expect(template.id).toBeTruthy();
      expect(template.name).toBeTruthy();
      expect(template.gradient).toMatch(/^linear-gradient\(/);
    }
    const ids = new Set(coverTemplates.map((template) => template.id));
    expect(ids.size).toBe(coverTemplates.length);
  });

  it('defaultTemplate 指向存在的模板', () => {
    expect(defaultTemplate).toBeDefined();
    expect(coverTemplates.some((template) => template.id === defaultTemplate?.id)).toBe(true);
  });
});
