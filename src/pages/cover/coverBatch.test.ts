import { describe, it, expect } from 'vitest';
import { parseBatchText } from './coverBatch';

describe('parseBatchText — JSON 输入', () => {
  it('解析数组对象并使用 title/name 字段', () => {
    const result = parseBatchText(
      JSON.stringify([{ title: ' 文章一 ', subtitle: '副标题', description: '描述' }, { name: '文章二' }]),
      'input.json',
    );
    expect(result.issues).toEqual([]);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ title: '文章一', subtitle: '副标题', description: '描述' });
    expect(result.items[1].title).toBe('文章二');
  });

  it('slug 归一化：小写、非法字符转短横线、去首尾短横线、截断 80 字符', () => {
    const result = parseBatchText(JSON.stringify([{ title: 'T', slug: '  Hello World!  ' }]), 'input.json');
    expect(result.items[0].slug).toBe('hello-world');
  });

  it('缺少 title 的记录报 issue 并跳过', () => {
    const result = parseBatchText(JSON.stringify([{ description: '无标题' }, { title: '有效' }]), 'input.json');
    expect(result.issues).toEqual([{ line: 1, message: '缺少 title 字段' }]);
    expect(result.items).toHaveLength(1);
  });

  it('非法 JSON 报 issue', () => {
    const result = parseBatchText('{not json', 'input.json');
    expect(result.issues).toEqual([{ line: 1, message: 'JSON 格式无效' }]);
    expect(result.items).toEqual([]);
  });

  it('容忍 UTF-8 BOM', () => {
    const result = parseBatchText(`\uFEFF${JSON.stringify([{ title: 'BOM 文章' }])}`, 'input.json');
    expect(result.items).toHaveLength(1);
  });
});

describe('parseBatchText — CSV 输入', () => {
  it('解析带引号字段（含逗号与转义引号）的 CSV', () => {
    const result = parseBatchText('title,description\n"文章,一","他说""你好"""', 'input.csv');
    expect(result.items[0]).toMatchObject({ title: '文章,一', description: '他说"你好"' });
  });

  it('跳过空行并逐行定位缺失 title 的错误行号（空行不计数）', () => {
    const result = parseBatchText('title,description\n\n有效文章,ok\n,缺标题', 'input.csv');
    expect(result.items).toHaveLength(1);
    expect(result.issues).toEqual([{ line: 3, message: '缺少 title 字段' }]);
  });
});

describe('parseBatchText — Markdown frontmatter 输入', () => {
  it('解析 frontmatter 字段', () => {
    const result = parseBatchText('---\ntitle: 封面文章\nsubtitle: 副标题\n---\n正文内容', 'input.md');
    expect(result.issues).toEqual([]);
    expect(result.items[0]).toMatchObject({ title: '封面文章', subtitle: '副标题' });
  });

  it('无有效 frontmatter 时报告问题', () => {
    const result = parseBatchText('纯文本没有 frontmatter', 'input.md');
    expect(result.issues).toEqual([{ line: 1, message: 'Markdown 缺少有效 frontmatter 或 title' }]);
  });
});

describe('parseBatchText — slug 去重', () => {
  it('重复 slug 追加 -2、-3 后缀且不与其他条目冲突', () => {
    const result = parseBatchText(
      JSON.stringify([
        { title: 'A', slug: 'same' },
        { title: 'B', slug: 'same' },
        { title: 'C', slug: 'same-2' },
      ]),
      'input.json',
    );
    expect(result.items.map((item) => item.slug)).toEqual(['same', 'same-2', 'same-2-2']);
  });
});
