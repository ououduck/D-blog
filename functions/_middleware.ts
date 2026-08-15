/**
 * giscus 同源代理中间件（Cloudflare Pages Functions / _middleware.ts）。
 *
 * 背景：giscus.app 在大陆网络被 DNS 污染/阻断（本地解析被污染成 198.18.x.x 或
 * fdfe:dcba:9876:: 假地址，直连 AWS Global Accelerator 真实 IP 也不可达），导致
 * 评论区/留言板「加载很久后显示加载失败」。本中间件把 giscus 的全部资源经博客
 * 同源路径转发：客户端脚本、widget 页面、/_next 静态资源、主题 CSS、API 路由，
 * 评论功能在大陆网络即可正常加载（读评论、看讨论；登录评论受 giscus OAuth 回调
 * 域限制，仍依赖 giscus.app 可达，见 README「Giscus 评论」小节）。
 *
 * 路径白名单与纯逻辑见 functions/giscus-proxy-core.ts（EdgeOne 版根目录
 * middleware.ts 复用同一份核心，改动需同步）。
 *
 * 安全约束：仅代理白名单路径、仅转发到 https://giscus.app，避免沦为开放代理。
 * Host 重写为 giscus.app：giscus 的 OAuth 回调按 req.headers.host 生成 redirect_uri，
 * 保留原 Host 会导致 GitHub 回调校验失败。
 */
import { GISCUS_UPSTREAM, isWidgetPage, parentOriginFromQuery, upstreamPath } from './giscus-proxy-core';

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
    // 大陆网络下 giscus.app 的 DNS 被污染成黑洞 IP，TCP 连接可能一直挂起且
    // 不触发 error：显式超时兜底，快速失败由前端回退官方来源（与 dev 代理一致）。
    signal: AbortSignal.timeout(10000),
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

export const onRequest = async (context: { request: Request; next: () => Promise<Response> }): Promise<Response> => {
  const pathname = new URL(context.request.url).pathname;
  if (!upstreamPath(pathname)) {
    return context.next();
  }
  try {
    return await proxyGiscus(context.request);
  } catch {
    // 上游不可达时返回 502，由前端兜底来源（官方 giscus.app）接管重试。
    return new Response('giscus proxy error', { status: 502 });
  }
};
