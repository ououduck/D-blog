/**
 * img-proxy — 同源图片代理（Cloudflare Pages Functions / EdgeOne Pages 边缘函数通用）。
 *
 * 背景：文章封面存放在 img.pldduck.com（图床未开启 CORS），浏览器端的分享海报
 * （Canvas）无法跨域读取这些图片，导出 PNG 时画布会被污染。
 *
 * 本函数把图床图片经站点同源路径转发，并附加 Access-Control-Allow-Origin 头，
 * 使前端可以跨域加载封面而不污染画布。实现上只依赖 onRequest(context) 与
 * fetch/Response（两个平台的 Pages Functions API 完全一致，见 edgeone CLI 的
 * 边缘函数打包器：以 `({request, params, env, waitUntil})` 调用 onRequest）。
 *
 * 安全约束：仅允许代理本站图床 https://img.pldduck.com/*，避免沦为开放代理；
 * 同时校验协议必须为 https，杜绝任意 URL 转发。
 */

const ALLOWED_IMAGE_HOSTS = new Set(['img.pldduck.com']);

export const onRequest = async (context: { request: Request }): Promise<Response> => {
  const { request } = context;

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('method not allowed', { status: 405 });
  }

  const target = new URL(request.url).searchParams.get('url');
  if (!target) {
    return new Response('missing url', { status: 400 });
  }

  let upstream: URL;
  try {
    upstream = new URL(target);
  } catch {
    return new Response('invalid url', { status: 400 });
  }

  if (upstream.protocol !== 'https:' || !ALLOWED_IMAGE_HOSTS.has(upstream.hostname)) {
    return new Response('forbidden', { status: 403 });
  }

  try {
    const upstreamResponse = await fetch(upstream.toString(), {
      headers: { 'user-agent': 'D-blog-img-proxy/1.0' },
      // 图床失联/TCP 挂起时快速失败返回 502，避免边缘请求悬挂到平台超时。
      signal: AbortSignal.timeout(10000),
    });
    const headers = new Headers(upstreamResponse.headers);
    // 关键：同源代理必须带上 CORS 头，前端 canvas 才能读取。
    headers.set('access-control-allow-origin', '*');
    // 图床图片 URL 稳定，允许 CDN 与浏览器缓存，海报生成更快速。
    headers.set('cache-control', 'public, max-age=86400');
    headers.delete('set-cookie');
    return new Response(await upstreamResponse.arrayBuffer(), {
      status: upstreamResponse.status,
      headers,
    });
  } catch {
    return new Response('proxy error', { status: 502 });
  }
};
