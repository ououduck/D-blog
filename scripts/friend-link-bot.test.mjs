// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { parseApplication } from './friend-link-bot.mjs';

describe('parseApplication 续行折叠', () => {
  const base = [
    '- Site Name: 测试博客',
    '- Site URL: https://example.com',
    '- Friend Page URL: https://example.com/friends',
    '- Avatar URL: https://example.com/avatar.png',
    '- Your Name / Contact: 张三',
    '- Filename: test',
  ];

  it('缩进续行折叠进字段值', () => {
    const body = [...base.slice(0, 4), '- Short Description: 第一行', '  第二行续写', ...base.slice(4)].join('\n');
    const result = parseApplication(body);
    expect(result?.description).toContain('第一行');
    expect(result?.description).toContain('第二行续写');
  });

  it('缩进子列表项（-foo 无空格标记）不折叠进字段值', () => {
    const body = [...base.slice(0, 4), '- Short Description: 描述', '  -foo 子项', ...base.slice(4)].join('\n');
    const result = parseApplication(body);
    expect(result?.description).toBe('描述');
  });

  it('数字列表（1. 条目）不折叠进字段值', () => {
    const body = [...base.slice(0, 4), '- Short Description: 描述', '  1. 条目', ...base.slice(4)].join('\n');
    const result = parseApplication(body);
    expect(result?.description).toBe('描述');
  });
});
