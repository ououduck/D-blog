import { describe, it, expect } from 'vitest';
import React from 'react';
import { extractMarkdownHeadings, extractTextFromReactNode, slugifyHeading, stripInlineMarkdown } from './headings';

describe('stripInlineMarkdown', () => {
  it('剥离链接但保留链接文本', () => {
    expect(stripInlineMarkdown('[文档](https://example.com/docs)')).toBe('文档');
  });

  it('剥离图片并保留 alt 文本', () => {
    expect(stripInlineMarkdown('![截图](/img/shot.png)')).toBe('截图');
  });

  it('剥离行内代码', () => {
    expect(stripInlineMarkdown('运行 `npm run build` 即可')).toBe('运行 npm run build 即可');
  });

  it('剥离粗体/斜体/删除线标记', () => {
    expect(stripInlineMarkdown('**粗体** __粗体__ *斜体* _斜体_ ~~删除~~')).toBe('粗体 粗体 斜体 斜体 删除');
  });

  it('剥离 HTML 标签', () => {
    expect(stripInlineMarkdown('<span>内联</span>')).toBe('内联');
  });

  it('解码 HTML 实体', () => {
    expect(stripInlineMarkdown('A &amp; B')).toBe('A & B');
    expect(stripInlineMarkdown('&copy; 2026')).toBe('© 2026');
    expect(stripInlineMarkdown('&#x41;&#66;')).toBe('AB');
    expect(stripInlineMarkdown('&#65;')).toBe('A');
  });

  it('反斜杠转义的字面字符', () => {
    // 转义后仍被粗体标记剥离：\* 先被 (\*\*|__|\*|_|~~) 移除，转义规则后执行
    // 只保留反斜杠 —— 记录当前实际行为（潜在改进点：先遮蔽转义字符再处理其他标记）。
    expect(stripInlineMarkdown('\\*字面星号\\*')).toBe('\\字面星号\\');
    expect(stripInlineMarkdown('\\# 标题')).toBe('# 标题');
    expect(stripInlineMarkdown('v1\\.2')).toBe('v1.2');
    expect(stripInlineMarkdown('a\\\\b')).toBe('a\\b');
  });

  it('移除标题行尾的井号并折叠空白', () => {
    expect(stripInlineMarkdown('标题 #')).toBe('标题');
    expect(stripInlineMarkdown('多   个    空格')).toBe('多 个 空格');
  });

  it('空字符串与纯标记返回空', () => {
    expect(stripInlineMarkdown('')).toBe('');
    expect(stripInlineMarkdown('   ')).toBe('');
  });
});

describe('slugifyHeading', () => {
  it('英文标题转小写短横线 slug', () => {
    expect(slugifyHeading('Hello World')).toBe('hello-world');
  });

  it('保留中文字符', () => {
    expect(slugifyHeading('接入不蒜子统计')).toBe('接入不蒜子统计');
  });

  it('特殊字符替换为短横线并修剪首尾', () => {
    expect(slugifyHeading('C++ 与 C# 入门')).toBe('c-与-c-入门');
    expect(slugifyHeading('  spaced  ')).toBe('spaced');
  });

  it('纯符号文本产生空 slug', () => {
    expect(slugifyHeading('!!! ???')).toBe('');
  });
});

describe('extractMarkdownHeadings', () => {
  it('提取 ATX 标题（1-3 级）', () => {
    const headings = extractMarkdownHeadings('# 一级\n\n## 二级\n\n### 三级');
    expect(headings).toEqual([
      { id: '一级', level: 1, rawText: '一级', text: '一级' },
      { id: '二级', level: 2, rawText: '二级', text: '二级' },
      { id: '三级', level: 3, rawText: '三级', text: '三级' },
    ]);
  });

  it('4 级及以上标题不提取', () => {
    const headings = extractMarkdownHeadings('#### 四级\n##### 五级');
    expect(headings).toEqual([]);
  });

  it('提取 Setext 标题（= 一级、- 二级）', () => {
    const headings = extractMarkdownHeadings('大标题\n======\n\n小标题\n-------');
    expect(headings.map((heading) => [heading.level, heading.rawText])).toEqual([
      [1, '大标题'],
      [2, '小标题'],
    ]);
  });

  it('跳过围栏代码块中的伪标题', () => {
    const markdown = ['# 真实标题', '', '```', '# 代码里的标题', '```', '', '## 另一个真实标题'].join('\n');
    const headings = extractMarkdownHeadings(markdown);
    expect(headings.map((heading) => heading.rawText)).toEqual(['真实标题', '另一个真实标题']);
  });

  it('跳过缩进代码块中的伪标题', () => {
    const markdown = '# 真实标题\n\n    # 缩进代码里的标题\n\n## 结束';
    const headings = extractMarkdownHeadings(markdown);
    expect(headings.map((heading) => heading.rawText)).toEqual(['真实标题', '结束']);
  });

  it('跳过 HTML 注释内的伪标题', () => {
    const markdown = '# 真实标题\n\n<!--\n# 注释里的标题\n-->\n\n## 结束';
    const headings = extractMarkdownHeadings(markdown);
    expect(headings.map((heading) => heading.rawText)).toEqual(['真实标题', '结束']);
  });

  it('重复标题生成唯一 id（-2 后缀）', () => {
    const headings = extractMarkdownHeadings('# 重复\n\n# 重复\n\n# 重复');
    expect(headings.map((heading) => heading.id)).toEqual(['重复', '重复-2', '重复-3']);
  });

  it('生成的后缀 id 与其它标题 slug 冲突时继续追加后缀', () => {
    // 第二个「简介」生成「简介-2」，恰好与第三个标题的 slug 相同：
    // 第三个必须继续追加后缀，避免 DOM 中出现重复 id。
    const headings = extractMarkdownHeadings('# 简介\n\n# 简介\n\n# 简介-2');
    expect(headings.map((heading) => heading.id)).toEqual(['简介', '简介-2', '简介-2-2']);
  });

  it('已有标题占用「A-2」时重复 A 跳过占用 id', () => {
    const headings = extractMarkdownHeadings('# A-2\n\n# A\n\n# A');
    expect(headings.map((heading) => heading.id)).toEqual(['a-2', 'a', 'a-3']);
  });

  it('特殊字符标题的 slug 处理', () => {
    const headings = extractMarkdownHeadings('# C++ 入门\n\n## C++ 进阶');
    expect(headings.map((heading) => heading.id)).toEqual(['c-入门', 'c-进阶']);
  });

  it('空标题回退为 section', () => {
    const headings = extractMarkdownHeadings('# \n\n##   ');
    expect(headings.map((heading) => heading.id)).toEqual(['section', 'section-2']);
  });

  it('标题中的行内标记被剥离后用于 id 与 text', () => {
    const headings = extractMarkdownHeadings('# [文档](/docs) `快速开始`');
    expect(headings[0].rawText).toBe('文档 快速开始');
    expect(headings[0].id).toBe('文档-快速开始');
  });

  it('HTML 实体在标题文本中解码', () => {
    const headings = extractMarkdownHeadings('# Hello &amp; World');
    expect(headings[0].rawText).toBe('Hello & World');
    expect(headings[0].id).toBe('hello-world');
  });

  it('emoji 从 text 剥离但保留在 rawText，id 不含 emoji', () => {
    const headings = extractMarkdownHeadings('# 🚀 发射');
    expect(headings[0].rawText).toBe('🚀 发射');
    expect(headings[0].text).toBe('发射');
    expect(headings[0].id).toBe('发射');
  });

  it('混合内容提取顺序与文档一致', () => {
    const headings = extractMarkdownHeadings('## B 标题\n\n# A 标题\n\n### C 标题');
    expect(headings.map((heading) => heading.rawText)).toEqual(['B 标题', 'A 标题', 'C 标题']);
  });
});

describe('extractTextFromReactNode', () => {
  it('提取字符串与数字', () => {
    expect(extractTextFromReactNode('文本')).toBe('文本');
    expect(extractTextFromReactNode(42)).toBe('42');
  });

  it('递归提取嵌套 React 元素', () => {
    const node = React.createElement(
      'div',
      null,
      React.createElement('span', null, 'a', React.createElement('b', null, 'b')),
      'c',
    );
    expect(extractTextFromReactNode(node)).toBe('abc');
  });

  it('数组节点按序拼接', () => {
    expect(extractTextFromReactNode(['x', React.createElement('em', null, 'y'), 'z'])).toBe('xyz');
  });

  it('其他类型返回空字符串', () => {
    expect(extractTextFromReactNode(null)).toBe('');
    expect(extractTextFromReactNode(undefined)).toBe('');
    expect(extractTextFromReactNode(false)).toBe('');
  });
});
