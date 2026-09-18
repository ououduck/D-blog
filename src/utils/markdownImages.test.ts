import { describe, it, expect } from 'vitest';
import { extractMarkdownImages } from './markdownImages';

describe('extractMarkdownImages', () => {
  it('提取 alt/src/title（含单双引号 title）', () => {
    const markdown = [
      '正文段落',
      '![第一张](/img/a.png)',
      '![第二张](https://cdn.example.com/b.png "标题 B")',
      "![第三张](/img/c.png '标题 C')",
    ].join('\n');

    expect(extractMarkdownImages(markdown)).toEqual([
      { src: '/img/a.png', alt: '第一张', title: undefined },
      { src: 'https://cdn.example.com/b.png', alt: '第二张', title: '标题 B' },
      { src: '/img/c.png', alt: '第三张', title: '标题 C' },
    ]);
  });

  it('保持文档顺序、跳过普通链接', () => {
    const markdown = '[文字链接](/link.png)\n\n![图1](/1.png)\n文字\n![图2](/2.png)';
    const images = extractMarkdownImages(markdown);
    expect(images.map((image) => image.src)).toEqual(['/1.png', '/2.png']);
  });

  it('空输入返回空数组', () => {
    expect(extractMarkdownImages('')).toEqual([]);
  });
});
