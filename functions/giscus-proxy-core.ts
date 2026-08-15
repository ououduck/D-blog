/**
 * giscus 同源代理核心逻辑（Cloudflare Pages Functions 与 EdgeOne Pages 中间件共用）。
 *
 * 只包含纯函数：路径白名单映射与父页面 origin 提取，便于单元测试；
 * 网络转发部分分别在 functions/_middleware.ts（Cloudflare onRequest）与
 * 根目录 middleware.ts（EdgeOne `middleware` 导出）中实现，改动需同步。
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
