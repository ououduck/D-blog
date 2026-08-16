import { describe, it, expect, vi } from 'vitest';
import { createBatchZip, dedupeSlugs, parseBatchText, type BatchCoverItem } from './coverBatch';

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

  it('跳过空行并定位缺失 title 的真实文件行号（空行参与计数）', () => {
    const result = parseBatchText('title,description\n\n有效文章,ok\n,缺标题', 'input.csv');
    expect(result.items).toHaveLength(1);
    // 第 4 行（第 1 行表头、第 2 行空行、第 3 行有效、第 4 行缺标题）——
    // 此前用数据行序号 +2，空行越多偏移越大，误导用户定位。
    expect(result.issues).toEqual([{ line: 4, message: '缺少 title 字段' }]);
  });

  it('无表头 CSV：每行即一条记录，首行不被当表头吞掉', () => {
    const result = parseBatchText('文章一,副标题一\n文章二,副标题二', 'input.csv');
    expect(result.issues).toEqual([]);
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ title: '文章一', subtitle: '副标题一' });
    expect(result.items[1]).toMatchObject({ title: '文章二', subtitle: '副标题二' });
  });

  it('表头含 name 字段同样识别为表头', () => {
    const result = parseBatchText('name,description\n标题A,描述A', 'input.csv');
    expect(result.items).toHaveLength(1);
    expect(result.items[0].title).toBe('标题A');
  });

  it('引号内换行的字段后，错误行号取真实物理行（引号内换行参与计数）', () => {
    // 第 1 行表头；第 2~3 行是「多行\n字段」引号字段（跨两物理行）；
    // 第 4 行缺 title —— 若引号内换行不推进行号，会误报为第 3 行。
    const result = parseBatchText('title,description\n"多行\n字段",ok\n,缺标题', 'input.csv');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ title: '多行\n字段', description: 'ok' });
    expect(result.issues).toEqual([{ line: 4, message: '缺少 title 字段' }]);
  });

  it('引号内 CRLF 换行同样推进物理行号（不重复计行）', () => {
    const result = parseBatchText('title,description\r\n"多行\r\n字段",ok\r\n,缺标题', 'input.csv');
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ title: '多行\r\n字段', description: 'ok' });
    expect(result.issues).toEqual([{ line: 4, message: '缺少 title 字段' }]);
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

describe('dedupeSlugs — 跨文件合并去重', () => {
  it('多文件合并后相同 slug 追加后缀，避免 ZIP 同名覆盖', () => {
    // 模拟两个文件各含一个 slug: same 的条目（parseBatchText 单文件内已去重，
    // 合并后仍可能冲突）。
    const items: BatchCoverItem[] = [
      { title: 'A', subtitle: '', description: '', slug: 'same' },
      { title: 'B', subtitle: '', description: '', slug: 'same' },
    ];
    expect(dedupeSlugs(items).map((item) => item.slug)).toEqual(['same', 'same-2']);
  });

  it('与既有 -2 后缀不冲突', () => {
    const items: BatchCoverItem[] = [
      { title: 'A', subtitle: '', description: '', slug: 'same' },
      { title: 'B', subtitle: '', description: '', slug: 'same' },
      { title: 'C', subtitle: '', description: '', slug: 'same-2' },
    ];
    expect(dedupeSlugs(items).map((item) => item.slug)).toEqual(['same', 'same-2', 'same-2-2']);
  });
});

describe('createBatchZip', () => {
  const makeResult = (filename: string) => ({
    filename,
    blob: new Blob([filename], { type: 'image/png' }),
  });

  it('打包全部画布并触发进度回调', async () => {
    const onProgress = vi.fn();
    const blob = await createBatchZip([makeResult('a.png'), makeResult('b.png')], onProgress);
    expect(blob).toBeInstanceOf(Blob);
    expect(onProgress).toHaveBeenNthCalledWith(1, 1);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2);
  });

  it('abort 信号触发时抛错', async () => {
    const controller = new AbortController();
    const generator = (async function* () {
      yield makeResult('a.png');
      controller.abort();
      yield makeResult('b.png');
    })();
    await expect(createBatchZip(generator, undefined, controller.signal)).rejects.toThrow('批量生成已取消');
  });

  it('支持异步迭代器输入', async () => {
    const generator = (async function* () {
      yield makeResult('x.png');
    })();
    const blob = await createBatchZip(generator);
    expect(blob).toBeInstanceOf(Blob);
  });
});
