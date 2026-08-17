// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { extractExternalLinks, parseIgnoreHosts } from './check-broken-links.mjs';

// mock 网络层（http.mjs 由本测试文件首行导入前 mock）：SSRF 校验与 fetch 可控。
vi.mock('./lib/http.mjs', () => ({
  isSafePublicHttpUrl: vi.fn(async () => true),
  fetchWithRetry: vi.fn(async () => ({ status: 200, body: { cancel: async () => {} }, headers: new Headers() })),
  safeFetchAgent: {},
  RetryableHttpError: class RetryableHttpError extends Error {
    constructor(message, status = 0, attempts = 1) {
      super(message);
      this.status = status;
      this.attempts = attempts;
    }
  },
}));
import { isSafePublicHttpUrl, fetchWithRetry } from './lib/http.mjs';
import { checkUrl } from './check-broken-links.mjs';

const mockResponse = (status, location) => {
  const headers = new Headers();
  if (location !== undefined) headers.set('location', location);
  return { status, ok: status >= 200 && status < 300, body: { cancel: async () => {} }, headers };
};

beforeEach(() => {
  vi.clearAllMocks();
  isSafePublicHttpUrl.mockResolvedValue(true);
});

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

  it('围栏代码块内的 URL 不提取（示例代码不当作外链）', () => {
    const content = ['正文 [真实](https://real.com)', '', '```bash', 'curl https://example.com/api', '```'].join('\n');
    const links = extractExternalLinks(content);
    expect(links).toEqual([{ url: 'https://real.com', line: 1, type: 'md' }]);
  });

  it('行内代码里的括号结构不提取（`` `[foo](bar)` `` 不是链接）', () => {
    const links = extractExternalLinks('语法：`[文本](https://example.com)` 不是链接');
    expect(links).toEqual([]);
  });

  it('HTML 注释内的 URL 不提取', () => {
    const content = ['<!-- 临时：https://deprecated.example.com 勿删 -->', '', '[正文](https://real.com)'].join('\n');
    const links = extractExternalLinks(content);
    expect(links).toEqual([{ url: 'https://real.com', line: 3, type: 'md' }]);
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

describe('checkUrl — 重定向逐跳 SSRF 校验', () => {
  it('初始 URL 不安全时直接拦截，不发请求', async () => {
    isSafePublicHttpUrl.mockResolvedValue(false);
    const result = await checkUrl('https://127.0.0.1/');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('SSRF');
    expect(fetchWithRetry).not.toHaveBeenCalled();
  });

  it('重定向到内网地址被拦截（跳转绕过防护）', async () => {
    // 第一跳安全，第二跳（内网元数据地址）被 SSRF 校验拦下。
    isSafePublicHttpUrl.mockImplementation(async (url) => url === 'https://public.example.com/');
    fetchWithRetry.mockResolvedValueOnce(mockResponse(302, 'http://169.254.169.254/latest/meta-data/'));

    const result = await checkUrl('https://public.example.com/');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('SSRF');
    expect(fetchWithRetry).toHaveBeenCalledTimes(1);
    expect(isSafePublicHttpUrl).toHaveBeenCalledWith('http://169.254.169.254/latest/meta-data/');
  });

  it('重定向链最终 200 判为正常', async () => {
    fetchWithRetry.mockResolvedValueOnce(mockResponse(301, 'https://public.example.com/new'));
    fetchWithRetry.mockResolvedValueOnce(mockResponse(200));

    const result = await checkUrl('https://public.example.com/');
    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(fetchWithRetry).toHaveBeenCalledTimes(2);
  });

  it('重定向超过上限判为失效', async () => {
    // 无限 302 环：超过 MAX_REDIRECTS(5) 后返回失效。
    fetchWithRetry.mockResolvedValue(mockResponse(302, 'https://public.example.com/loop'));
    const result = await checkUrl('https://public.example.com/');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('重定向');
  });

  it('重定向缺少 Location 判为失效', async () => {
    fetchWithRetry.mockResolvedValueOnce(mockResponse(302));
    const result = await checkUrl('https://public.example.com/');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Location');
  });
});
