/**
 * giscus 同源代理核心逻辑（Cloudflare Pages Functions 与 EdgeOne Pages 中间件共用）。
 *
 * 包含纯函数（路径白名单映射与父页面 origin 提取）与共享转发实现
 * （proxyGiscus：网络请求、Host 重写、响应头净化与 widget CSP）。
 * 两个平台的入口（Cloudflare onRequest / EdgeOne middleware）各自保留，
 * 仅做上下文适配与错误兜底。
 *
 * 背景：giscus.app 在大陆网络被 DNS 污染/阻断，站点同源路径转发 giscus 资源
 * （client.js、widget 页面、/_next 静态资源、主题 CSS、相对 API）即可正常加载评论。
 * 安全约束：仅代理白名单路径、仅转发到 https://giscus.app，避免沦为开放代理。
 */
export const GISCUS_UPSTREAM = 'https://giscus.app';

/** widget 页面路径（/widget 或 /{locale}/widget，如 /zh-CN/widget）。 */
const WIDGET_PATH_RE = /^\/[a-z]{2}(-[A-Z]{2})?\/widget$/;
/** giscus 相对 API 路径（widget 页面以根相对路径调用，如 /api/oauth/token）。 */
const GISCUS_API_PATHS = new Set([
  '/api/discussions',
  '/api/discussions/categories',
  '/api/oauth/authorize',
  '/api/oauth/authorized',
  '/api/oauth/token',
]);

/** 命中则返回上游相对路径（不含 query），未命中返回 null。 */
export function upstreamPath(pathname: string): string | null {
  if (pathname === '/giscus' || pathname.startsWith('/giscus/')) {
    const rest = pathname.slice('/giscus'.length);
    return rest === '' ? '/' : rest;
  }
  if (pathname === '/_next' || pathname.startsWith('/_next/')) return pathname;
  if (pathname === '/themes' || pathname.startsWith('/themes/')) return pathname;
  if (pathname === '/default.css') return pathname;
  if (pathname === '/widget' || WIDGET_PATH_RE.test(pathname)) return pathname;
  if (GISCUS_API_PATHS.has(pathname)) return pathname;
  return null;
}

/** 是否为 widget 页面路径（需要按父页面 origin 设置 frame-ancestors）。 */
export function isWidgetPage(pathname: string): boolean {
  return pathname === '/widget' || WIDGET_PATH_RE.test(pathname);
}

/** 从 widget 页面 query 提取父页面 origin（frame-ancestors 校验口径与 giscus SSR 一致）。 */
export function parentOriginFromQuery(search: string): string | null {
  try {
    const origin = new URLSearchParams(search).get('origin');
    return origin ? new URL(origin).origin : null;
  } catch {
    return null;
  }
}

/**
 * 转发单个 giscus 请求到上游（共享实现，Cloudflare 与 EdgeOne 入口复用）。
 * @param request 原始请求（必须已通过 upstreamPath 白名单校验）。
 * @returns 上游响应（已净化头部并设置 widget CSP）。
 */
export async function proxyGiscus(request: Request): Promise<Response> {
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
