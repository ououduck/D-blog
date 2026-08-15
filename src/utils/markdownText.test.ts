import { describe, it, expect } from 'vitest';
import { stripMarkdown } from './markdownText';

describe('stripMarkdown', () => {
  it('剥离标题符号并保留正文', () => {
    expect(stripMarkdown('# 一级标题\n## 二级标题\n正文')).toBe('一级标题\n二级标题\n正文');
  });

  it('保留链接文字并丢弃 URL', () => {
    expect(stripMarkdown('[访问示例](https://example.com)')).toBe('访问示例');
  });

  it('图片替换为 alt 文字', () => {
    expect(stripMarkdown('![封面图](https://cdn.example.com/a.png)')).toBe('封面图');
  });

  it('行内代码与围栏代码块处理', () => {
    expect(stripMarkdown('使用 `npm run build` 构建')).toBe('使用 npm run build 构建');
    expect(stripMarkdown('```ts\nconst a = 1;\n```\n正文')).toBe('正文');
  });

  it('粗体/斜体标记剥离', () => {
    expect(stripMarkdown('**加粗** 与 *斜体* 与 __双下划线__')).toBe('加粗 与 斜体 与 双下划线');
  });

  it('下划线不误伤 snake_case 标识符', () => {
    expect(stripMarkdown('变量 my_variable_name 与 MAX_BUFFER_SIZE')).toBe('变量 my_variable_name 与 MAX_BUFFER_SIZE');
  });

  it('删除线标记剥离', () => {
    expect(stripMarkdown('~~已删除~~ 保留')).toBe('已删除 保留');
  });

  it('HTML 标签替换为空白', () => {
    expect(stripMarkdown('文本 <span>内嵌</span> 标签')).toBe('文本 内嵌 标签');
  });

  it('列表符号剥离', () => {
    expect(stripMarkdown('- 列表项一\n* 列表项二\n1. 有序项')).toBe('列表项一\n列表项二\n有序项');
  });

  it('多余空白归一化', () => {
    expect(stripMarkdown('a    b\n\n\n\nc')).toBe('a b\n\nc');
  });

  it('空输入返回空字符串', () => {
    expect(stripMarkdown('')).toBe('');
    expect(stripMarkdown('   \n  ')).toBe('');
  });

  it('超长正文截断到 6000 字符并加省略号', () => {
    const longText = '字'.repeat(7000);
    const result = stripMarkdown(longText);
    expect(result.length).toBe(6001);
    expect(result.endsWith('…')).toBe(true);
  });
});
