/**
 * giscus 同源代理中间件（EdgeOne Pages 边缘函数 / 根目录 middleware.ts）。
 *
 * EdgeOne Pages 的边缘函数约定与 Cloudflare 不同：
 * - 中间件文件位于项目根目录 middleware.ts（而非 functions/_middleware.ts），
 *   导出名为 `middleware`（onRequest 仅用于 functions/ 目录下的路由函数）。
 * - 中间件返回 Response 即短路；返回 null/undefined 则继续后续边缘函数/回源。
 *
 * 路径白名单与纯逻辑见 functions/giscus-proxy-core.ts（Cloudflare 版
 * functions/_middleware.ts 复用同一份核心，改动需同步）。背景与路由约定见
 * functions/_middleware.ts 头部注释：把 giscus.app 的全部资源经站点同源路径转发，
 * 绕过大陆网络对 giscus.app 的 DNS 污染/阻断。仅代理白名单路径且仅转发到
 * https://giscus.app。
 */
import { GISCUS_UPSTREAM, isWidgetPage, parentOriginFromQuery, upstreamPath } from './functions/giscus-proxy-core';

async function proxyGiscus(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = upstreamPath(url.pathname);
  if (!path) throw new Error('not a giscus proxy path');

  const headers = new Headers(request.headers);
  headers.set('host', new URL(GISCUS_UPSTREAM).host);
  headers.set('x-forwarded-host', url.host);
  headers.set('x-forwarded-proto', 'https');
  // giscus 会话走 URL 参数（父页面 localStorage），无需转发博客 cookie。
  headers.delete('cookie');

  const upstream = await fetch(`${GISCUS_UPSTREAM}${path}${url.search}`, {
    method: request.method,
    headers,
    // GET/HEAD 不携带 body；POST/OPTIONS 等透传请求体（widget 的 API 调用）。
    body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    redirect: 'manual', // 原样透传 3xx（GitHub OAuth 跳转由浏览器继续）
  });

  const responseHeaders = new Headers(upstream.headers);
  // 边缘运行时 fetch 会自动解压响应体，保留 content-encoding 会导致浏览器解压失败。
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  responseHeaders.delete('set-cookie');
  responseHeaders.delete('x-frame-options');

  if (isWidgetPage(url.pathname)) {
    // widget 必须能被父页面嵌入：显式设置 frame-ancestors（仅此一项，与 giscus SSR 一致），
    // 避免平台/上游在响应上叠加的 CSP 限制 widget 自身的脚本/连接。
    const parentOrigin = parentOriginFromQuery(url.search);
    responseHeaders.set('content-security-policy', `frame-ancestors 'self'${parentOrigin ? ` ${parentOrigin}` : ''};`);
  } else {
    // client.js / 样式 / API JSON 等资源不承载文档 CSP，删掉避免误伤。
    responseHeaders.delete('content-security-policy');
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}

export const middleware = async (context: { request: Request }): Promise<Response | null> => {
  const pathname = new URL(context.request.url).pathname;
  if (!upstreamPath(pathname)) {
    return null; // 非 giscus 路径：继续后续边缘函数/回源静态资源
  }
  try {
    return await proxyGiscus(context.request);
  } catch {
    // 上游不可达时返回 502，由前端兜底来源（官方 giscus.app）接管重试。
    return new Response('giscus proxy error', { status: 502 });
  }
};
