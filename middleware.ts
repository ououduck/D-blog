/**
 * giscus 同源代理中间件（EdgeOne Pages 边缘函数 / 根目录 middleware.ts）。
 *
 * EdgeOne Pages 的边缘函数约定与 Cloudflare 不同：
 * - 中间件文件位于项目根目录 middleware.ts（而非 functions/_middleware.ts），
 *   导出名为 `middleware`（onRequest 仅用于 functions/ 目录下的路由函数）。
 * - 中间件返回 Response 即短路；返回 null/undefined 则继续后续边缘函数/回源。
 *
 * 路径白名单、转发实现与安全约束见 functions/giscus-proxy-core.ts（Cloudflare 版
 * functions/_middleware.ts 复用同一份核心）。背景与路由约定见 functions/_middleware.ts
 * 头部注释：把 giscus.app 的全部资源经站点同源路径转发，绕过大陆网络对 giscus.app
 * 的 DNS 污染/阻断。仅代理白名单路径且仅转发到 https://giscus.app。
 */
import { proxyGiscus, upstreamPath } from './functions/giscus-proxy-core';

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
