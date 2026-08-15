// @vitest-environment node
/**
 * giscus 同源代理中间件冒烟测试。
 *
 * 直接加载 Cloudflare 版（functions/_middleware.ts 的 onRequest）与 EdgeOne 版
 * （根目录 middleware.ts 的 `middleware`），mock 上游 giscus.app，断言：
 * - 路径白名单映射（含 /giscus 前缀剥离）；
 * - Host 重写为 giscus.app（OAuth 回调 redirect_uri 依赖）；
 * - POST body 透传（widget 的 /api/* 调用）；
 * - widget 响应按父页面 origin 设置 frame-ancestors CSP；
 * - 非代理路径放行（Cloudflare 走 next()，EdgeOne 返回 null）。
 */
import { describe, expect, it, vi } from 'vitest';

import { onRequest } from '../../functions/_middleware';
import { middleware } from '../../middleware';

const makeMockUpstream = () => {
  const seen: { url: string; host: string | null; method: string; body: string | null }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    seen.push({
      url: `${url.pathname}${url.search}`,
      host: (init?.headers as Headers | undefined)?.get('host') ?? null,
      method: init?.method ?? 'GET',
      // request.body 是 ReadableStream：用 Response 读取文本断言透传内容。
      body: init?.body ? await new Response(init.body as ReadableStream).text() : null,
    });
    return new Response('UPSTREAM-BODY', {
      status: 200,
      headers: {
        'content-type': 'text/html',
        'content-encoding': 'gzip',
        'content-length': '99',
        'x-frame-options': 'DENY',
        'content-security-policy': "frame-ancestors 'none';",
        'set-cookie': 'a=1',
      },
    });
  });
  return { seen, fetchMock };
};

describe('giscus 同源代理中间件（Cloudflare onRequest）', () => {
  it('转发 /giscus/* 到 giscus.app 并重写 Host', async () => {
    const { seen, fetchMock } = makeMockUpstream();
    vi.stubGlobal('fetch', fetchMock);
    const response = await onRequest({
      request: new Request('https://blog.pldduck.com/giscus/client.js'),
      next: async () => new Response('STATIC'),
    });
    vi.unstubAllGlobals();

    expect(await response.text()).toBe('UPSTREAM-BODY');
    expect(seen).toEqual([{ url: '/client.js', host: 'giscus.app', method: 'GET', body: null }]);
    // 响应头：剥离会被边缘运行时解码的 content-encoding / content-length / set-cookie / x-frame-options
    expect(response.headers.get('content-encoding')).toBeNull();
    expect(response.headers.get('content-length')).toBeNull();
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('x-frame-options')).toBeNull();
  });

  it('widget 页面按父页面 origin 设置 frame-ancestors CSP', async () => {
    const { fetchMock } = makeMockUpstream();
    vi.stubGlobal('fetch', fetchMock);
    const response = await onRequest({
      request: new Request('https://blog.pldduck.com/zh-CN/widget?origin=https%3A%2F%2Fblog.pldduck.com%2Fpost%2Fabc'),
      next: async () => new Response('STATIC'),
    });
    vi.unstubAllGlobals();

    expect(response.headers.get('content-security-policy')).toBe("frame-ancestors 'self' https://blog.pldduck.com;");
  });

  it('非代理路径放行给 context.next()', async () => {
    const { fetchMock } = makeMockUpstream();
    vi.stubGlobal('fetch', fetchMock);
    const response = await onRequest({
      request: new Request('https://blog.pldduck.com/posts/hello-world'),
      next: async () => new Response('STATIC', { status: 200 }),
    });
    vi.unstubAllGlobals();

    expect(await response.text()).toBe('STATIC');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('giscus 同源代理中间件（EdgeOne middleware）', () => {
  it('转发 API POST 并透传 body', async () => {
    const { seen, fetchMock } = makeMockUpstream();
    vi.stubGlobal('fetch', fetchMock);
    const response = await middleware({
      request: new Request('https://blog.pldduck.com/api/oauth/token', {
        method: 'POST',
        body: '{"session":"abc"}',
      }),
    });
    vi.unstubAllGlobals();

    expect(response).not.toBeNull();
    expect(await response!.text()).toBe('UPSTREAM-BODY');
    expect(seen).toEqual([{ url: '/api/oauth/token', host: 'giscus.app', method: 'POST', body: '{"session":"abc"}' }]);
  });

  it('非代理路径返回 null（继续回源）', async () => {
    const { fetchMock } = makeMockUpstream();
    vi.stubGlobal('fetch', fetchMock);
    const response = await middleware({
      request: new Request('https://blog.pldduck.com/about'),
    });
    vi.unstubAllGlobals();

    expect(response).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
