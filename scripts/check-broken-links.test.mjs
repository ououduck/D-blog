import { describe, it, expect } from 'vitest';
import { extractExternalLinks, parseIgnoreHosts } from './check-broken-links.mjs';

describe('extractExternalLinks', () => {
  it('提取 Markdown 外链（含行号）', () => {
    const links = extractExternalLinks('访问 [示例](https://example.com) 查看。');
    expect(links).toEqual([{ url: 'https://example.com', line: 1, type: 'md' }]);
  });

  it('排除图片链接（![..]）', () => {
    const links = extractExternalLinks('![封面](https://cdn.example.com/a.png)');
    expect(links).toEqual([]);
  });

  it('提取 HTML <a href> 链接', () => {
    const links = extractExternalLinks('<a href="https://docs.example.org/guide">文档</a>');
    expect(links).toEqual([{ url: 'https://docs.example.org/guide', line: 1, type: 'html' }]);
  });

  it('排除站内链接与锚点', () => {
    const links = extractExternalLinks('站内 [/post/a](/post/a) 与锚点 [跳转](#section)');
    expect(links).toEqual([]);
  });

  it('URL 含嵌套括号时完整提取（维基式）', () => {
    const links = extractExternalLinks('[维基](https://en.wikipedia.org/wiki/Foo_(bar))');
    expect(links[0].url).toContain('Foo_(bar)');
  });

  it('去除尾部标点/闭合字符', () => {
    const links = extractExternalLinks('结尾 [链接](https://a.com/page).');
    expect(links[0].url).toBe('https://a.com/page');
  });

  it('多行多链接提取正确的行号', () => {
    const content = ['第一行 [a](https://a.com)', '', '第三行 [b](https://b.com)'].join('\n');
    const links = extractExternalLinks(content);
    expect(links.map((link) => link.line)).toEqual([1, 3]);
  });
});

describe('parseIgnoreHosts', () => {
  it('未传 --ignore-hosts 时返回空集合', () => {
    expect(parseIgnoreHosts([])).toEqual(new Set());
    expect(parseIgnoreHosts(['--dry-run', '--fail'])).toEqual(new Set());
  });

  it('解析逗号分隔域名（去空白、小写、忽略空项）', () => {
    expect(parseIgnoreHosts(['--ignore-hosts=One.Dash.Cloudflare.com, example.com , ,B.com'])).toEqual(
      new Set(['one.dash.cloudflare.com', 'example.com', 'b.com']),
    );
  });
});
