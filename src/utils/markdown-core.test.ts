import { describe, it, expect } from 'vitest';
import { stripFrontmatter } from './markdown-core.mjs';

describe('stripFrontmatter（与 gray-matter 分隔语义对齐）', () => {
  it('剥离标准 frontmatter', () => {
    expect(stripFrontmatter('---\ntitle: Hello\n---\nBody text\n')).toBe('Body text\n');
  });

  it('支持空 frontmatter（--- 后紧跟 ---）', () => {
    expect(stripFrontmatter('---\n---\nBody text\n')).toBe('Body text\n');
  });

  it('frontmatter 块标量内缩进的 --- 不误判为闭分隔符', () => {
    const input = '---\ndescription: |\n  ---\n  block content\nexcerpt: x\n---\nBody text\n';
    expect(stripFrontmatter(input)).toBe('Body text\n');
  });

  it('frontmatter 值行中内嵌的 --- 不误判为闭分隔符', () => {
    const input = '---\ntitle: hello---world\nexcerpt: x\n---\nBody\n';
    expect(stripFrontmatter(input)).toBe('Body\n');
  });

  it('正文中的水平线 --- 保留', () => {
    const input = '---\ntitle: X\n---\n\n---\n\nBody\n';
    expect(stripFrontmatter(input)).toContain('---');
    expect(stripFrontmatter(input)).toContain('Body');
  });

  it('无 frontmatter 时原样返回', () => {
    const input = 'Just text\n---\nnot fm\n';
    expect(stripFrontmatter(input)).toBe(input);
  });

  it('容错 UTF-8 BOM', () => {
    expect(stripFrontmatter('\uFEFF---\ntitle: X\n---\nBody\n')).toBe('Body\n');
  });
});
