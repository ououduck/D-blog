import { renderToPipeableStream } from 'react-dom/server';
import { Writable } from 'node:stream';
import { StaticRouter } from 'react-router-dom/server';
import { HelmetProvider } from 'react-helmet-async';
import { AppShell } from './App';
import { SsgRouteContext, buildSsgRouteData, type SsgRouteData } from './ssr/routeData';
import { Post } from './types';

/**
 * 把 React 节点渲染为完整 HTML 字符串。
 * 使用 renderToPipeableStream（而非 renderToString）：路由组件均为 React.lazy
 * 懒加载，renderToString 不支持 Suspense，会中止服务端渲染。
 * onAllReady 表示所有 Suspense 边界（含懒加载组件）均已就绪，输出完整静态 HTML。
 *
 * 若懒加载 chunk 迟迟无法 resolve，onAllReady 可能永不触发导致构建永久挂起，
 * 因此设置渲染超时：超时后 reject，由调用方记录错误并中止该页渲染。
 */
const RENDER_TIMEOUT_MS = 30000;

const renderTreeToString = (
  node: React.ReactNode,
  onError?: (error: unknown) => void
): Promise<string> =>
  new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error('SSR render timed out: a lazy route chunk may have failed to load.'));
    }, RENDER_TIMEOUT_MS);

    const stream = renderToPipeableStream(node, {
      onAllReady() {
        if (settled) {
          return;
        }
        settled = true;
        clearTimeout(timer);
        const chunks: string[] = [];
        stream.pipe(
          new Writable({
            write(chunk, _encoding, callback) {
              chunks.push(String(chunk));
              callback();
            },
            final(callback) {
              resolve(chunks.join(''));
              callback();
            },
          })
        );
      },
      onError(error) {
        onError?.(error);
      },
    });
  });

const MARKER_TAG = '<div data-ssg-marker="1">';
/**
 * 构建期 SSG 渲染入口（scripts/ssg.mjs 通过 dist-ssr 调用）。
 * 用 StaticRouter 按 URL 渲染与客户端完全相同的组件树。
 *
 * React 19 的 metadata hoisting 会把 <title>/<meta>/<link> 提升到 <head>，
 * 而 <script>（如 JSON-LD）留在渲染树位置（body）。用 html/head/body 包装后，
 * 这两种行为都与客户端水合一致：head 提取 title/meta/link，body 提取正文。
 *
 * 注意：路由组件均为 React.lazy 懒加载，renderToPipeableStream 会把挂起的
 * Suspense 边界内容序列化为 <div hidden id="S:x"> 并附恢复脚本 <script>$RC(...)</script>，
 * 这些内容都位于 <body> 内、位于 marker div 之外。因此必须返回整个 <body> 的
 * innerHTML（而非截断到 marker），确保水合脚本能找到序列化内容。
 *
 * posts 为构建期解析的完整文章列表（含 content），用于文章页同步渲染正文。
 */
export const renderApp = async (
  url: string,
  options: { posts?: Post[]; onError?: (error: unknown) => void } = {}
): Promise<{ html: string; head: string; routeData: SsgRouteData | undefined }> => {
  const routeData = buildSsgRouteData(options.posts ?? [], url);
  const helmetContext = {};

  const rendered = await renderTreeToString(
    <HelmetProvider context={helmetContext}>
      <SsgRouteContext.Provider value={routeData}>
        <StaticRouter location={url} basename="/">
          <html>
            <head />
            <body>
              <div data-ssg-marker="1">
                <AppShell />
              </div>
            </body>
          </html>
        </StaticRouter>
      </SsgRouteContext.Provider>
    </HelmetProvider>,
    options.onError
  );

  const headMatch = rendered.match(/<head>([\s\S]*?)<\/head>/);
  if (!headMatch) {
    throw new Error(`SSR head not found for URL: ${url}`);
  }

  const bodyMatch = rendered.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  if (!bodyMatch) {
    throw new Error(`SSR body not found for URL: ${url}`);
  }
  const bodyHtml = bodyMatch[1];

  // 剥离 marker div 外壳：其内部是 AppShell 渲染结果，外壳本身是 SSR 专属包裹，
  // 客户端水合时不存在该节点，必须移除。marker 之后的序列化内容（hidden div、
  // $RC 恢复脚本等）需原样保留在 root 内供水合使用。
  let html = bodyHtml;
  const markerIndex = bodyHtml.indexOf(MARKER_TAG);
  if (markerIndex >= 0) {
    const innerStart = markerIndex + MARKER_TAG.length;
    let depth = 1;
    let i = innerStart;
    let innerEnd = -1;
    while (i < bodyHtml.length) {
      const open = bodyHtml.indexOf('<div', i);
      const close = bodyHtml.indexOf('</div>', i);
      const next = open !== -1 && open < close ? open : close;
      if (next === close) {
        depth -= 1;
        if (depth === 0) {
          innerEnd = close;
          break;
        }
      } else {
        depth += 1;
      }
      i = next + 4;
    }
    if (innerEnd > 0) {
      const innerHtml = bodyHtml.slice(innerStart, innerEnd);
      const trailing = bodyHtml.slice(innerEnd + '</div>'.length);
      html = innerHtml + trailing;
    }
  }

  return { html, head: headMatch[1], routeData };
};
