// 不蒜子统计：按官方 API（cdn.busuanzi.cc/api.php）以 POST 上报当前页 URL，
// 返回今日/总访问量与访客数等计数，按 span id 回填到 DOM。
//
// 不使用官方 <script defer src="...busuanzi.min.js"> 标签：该脚本是带
// window.busuanziRequestSent 守卫的 IIFE，整页只会执行一次。本站为 SSG + 客户端
// 水合的 SPA，路由切换不会重新加载页面，官方脚本因此无法为新路由上报/回填，
// 每篇文章的阅读量与统计页的站点数都会停在「加载中」。
// 改为在 Layout 路由变化时主动调用本函数：等价于官方脚本在每次页面加载时执行，
// 适配 SPA 客户端导航，且每条路由只上报一次，避免双计数。
const BUSUANZI_API_URL = 'https://cdn.busuanzi.cc/api.php';

type BusuanziResponse = Record<string, string | number>;
type CachedBusuanziResponse = { pageUrl: string; data: BusuanziResponse };

// 最近一次拿到的计数，供页面组件挂载时立即回填（路由切换时 Ping 通常先于
// 新页面 span 挂载完成，组件挂载后从缓存补一次即可即时显示，无需再次上报）。
// busuanzi_page_*（页面级计数）属于当前路由，缓存必须绑定 URL，
// 禁止把上一篇文章的计数填进新文章。
let lastResponse: CachedBusuanziResponse | null = null;

const getPageUrl = (): string => {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  return url.href;
};

// 回填所有匹配的 span（id 与返回 key 同名），返回实际填充到的元素数。
// 站点级计数可跨路由复用；页面级计数仅在缓存 URL 与当前路由一致时回填。
const fillSpans = ({ pageUrl, data }: CachedBusuanziResponse): number => {
  if (typeof document === 'undefined') return 0;
  const canFillPageMetrics = pageUrl === getPageUrl();
  let filled = 0;
  for (const key of Object.keys(data)) {
    if (key.startsWith('busuanzi_page_') && !canFillPageMetrics) continue;
    document.querySelectorAll(`#${key}`).forEach((el) => {
      el.textContent = String(data[key]);
      filled += 1;
    });
  }
  return filled;
};

/**
 * 用最近一次的计数回填当前页面中的不蒜子 span（不发起请求、不计数）。
 * 供展示不蒜子数据的组件在挂载/可见性变化时调用，避免 span 晚于 Ping 完成时
 * 仍停留在「加载中」。
 */
export const fillBusuanziSpans = (): void => {
  if (lastResponse) {
    fillSpans(lastResponse);
  }
};

/**
 * 上报当前页面访问并回填不蒜子计数 span。
 *
 * 路由切换（AnimatePresence mode="wait"）下新页面 span 在退出动画结束后才挂载，
 * 故用 rAF 轮询短暂重试；一旦填充到任意 span 即视为已挂载并停止。
 */
export const pingBusuanzi = (signal?: AbortSignal): void => {
  if (typeof window === 'undefined') return;

  const pageUrl = getPageUrl();
  fetch(BUSUANZI_API_URL, {
    method: 'POST',
    // 不设 Content-Type：保持 simple request，避免 CORS 预检（与不蒜子官方脚本一致）。
    body: JSON.stringify({ url: pageUrl, referrer: document.referrer }),
    signal,
  })
    .then((response) => response.json())
    .then((data: BusuanziResponse) => {
      const response = { pageUrl, data };
      // 旧路由的响应晚到（路由切换后返回，AbortController 只能中断未完成的
      // fetch）时，不得用旧路由的计数覆盖当前路由缓存 —— 否则新页面计数会
      // 停留在「加载中」直到下一次导航。
      if (pageUrl !== getPageUrl()) return;
      lastResponse = response;
      let frames = 0;
      const step = () => {
        const filled = fillSpans(response);
        if (filled === 0 && ++frames < 45) {
          requestAnimationFrame(step);
        }
      };
      requestAnimationFrame(step);
    })
    .catch(() => {
      // 不蒜子统计失败不影响页面功能，静默忽略（含路由切换 abort）。
    });
};
