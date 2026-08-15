import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { remarkCodeMeta } from './remarkCodeMeta';

const toHtml = (markdown: string) =>
  unified()
    .use(remarkParse)
    .use(remarkCodeMeta)
    .use(remarkRehype)
    .use(rehypeStringify)
    .processSync(markdown)
    .toString();

describe('remarkCodeMeta', () => {
  it('把围栏代码块 info 字符串透传为 data-meta 属性', () => {
    const html = toHtml('```ts title="app.ts"\nconst a = 1;\n```');
    // remark-parse 的 code.meta 为 info 字符串中语言名之后的部分（title="app.ts"）
    expect(html).toContain('data-meta="title=&quot;app.ts&quot;"');
  });

  it('无 meta 的代码块不添加 data-meta', () => {
    const html = toHtml('```ts\nconst a = 1;\n```');
    expect(html).not.toContain('data-meta');
  });

  it('行内代码不受影响', () => {
    const html = toHtml('使用 `npm run build` 构建');
    expect(html).toContain('<code>npm run build</code>');
    expect(html).not.toContain('data-meta');
  });

  it('meta 仅含语言名（无参数）时不添加', () => {
    const html = toHtml('```js\nconst x = 1;\n```');
    expect(html).not.toContain('data-meta');
  });

  it('多个代码块各自携带自己的 meta', () => {
    const html = toHtml('```ts title="a.ts"\nconst a = 1;\n```\n\n```py title="b.py"\nprint(1)\n```');
    expect(html).toContain('data-meta="title=&quot;a.ts&quot;"');
    expect(html).toContain('data-meta="title=&quot;b.py&quot;"');
  });
});
