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
 * 路径白名单、转发实现与安全约束见 functions/giscus-proxy-core.ts
 * （EdgeOne 版根目录 middleware.ts 复用同一份核心）。
 */
import { proxyGiscus, upstreamPath } from './giscus-proxy-core';

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
