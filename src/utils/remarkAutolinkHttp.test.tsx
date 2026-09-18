import { describe, it, expect } from 'vitest';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { renderToStaticMarkup } from 'react-dom/server';
import { remarkAutolinkHttp } from './remarkAutolinkHttp';

const render = (markdown: string) =>
  renderToStaticMarkup(<ReactMarkdown remarkPlugins={[remarkGfm, remarkAutolinkHttp]}>{markdown}</ReactMarkdown>);

describe('remarkAutolinkHttp', () => {
  it('裸 http(s) URL 自动成链，展示文本去掉协议前缀', () => {
    const html = render('看看这个 https://blog.pldduck.com/post/hello 好东西');
    expect(html).toContain('<a href="https://blog.pldduck.com/post/hello"');
    expect(html).toContain('>blog.pldduck.com/post/hello</a>');
  });

  it('仅 http/https 成链，裸域名不误伤', () => {
    const html = render('访问 example.com 或者 ftp://files.example.com');
    expect(html).not.toContain('<a href="example.com"');
    expect(html).not.toContain('<a href="ftp://');
  });

  it('已有 Markdown 链接内的 URL 不重复处理', () => {
    const html = render('[官网](https://blog.pldduck.com)');
    expect((html.match(/<a /g) ?? []).length).toBe(1);
  });

  it('行内代码中的 URL 不成链', () => {
    const html = render('运行 `npm config set registry https://registry.npmmirror.com` 即可');
    expect(html).not.toContain('<a href');
  });

  it('中文标点结尾不吞入 URL', () => {
    const html = render('地址是 https://blog.pldduck.com，欢迎来看');
    expect(html).toContain('href="https://blog.pldduck.com"');
    expect(html).not.toContain('blog.pldduck.com，');
  });
});
