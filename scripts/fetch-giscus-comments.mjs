/**
 * fetch-giscus-comments.mjs — 构建期获取 Giscus 评论数（方案 A：构建期快照）。
 *
 * Giscus 以 GitHub Discussions 承载评论，文章评论按 mapping=pathname 自动建讨论，
 * 即 discussion 的 title 为文章页面 URL（origin + pathname）。本脚本通过 GitHub
 * GraphQL API 拉取仓库全部 discussions 与评论数，按 title 的 pathname 匹配到每篇文章
 * （与 Giscus 的映射口径一致），输出 postId -> commentCount 的映射。
 *
 * 为什么用 GraphQL 而非 REST：
 * - GitHub REST API 没有 /repos/{owner}/{repo}/discussions 端点（官方 OpenAPI 无此路径）；
 * - Search API 的 type:discussion 不索引 discussions；
 * - GraphQL 的 repository.discussions 是唯一途径，且必须认证（匿名请求被拒绝）。
 *
 * 容错路径（本地无 token / API 失败 / 限速 / 无匹配）：
 * 一律记录日志后跳过，不抛出异常、不阻塞构建 —— 评论数缺失时页面优雅降级（不展示）。
 *
 * CI 中可使用 GITHUB_TOKEN（GitHub Actions 内置，可读公开/私有仓库的 discussions）；
 * 本地无 token 时该步骤自动跳过。
 */
import { pathToFileURL } from 'url';
import { loadSiteConfig } from './site-config-loader.mjs';
import { createBuildLogger } from './build-logger.mjs';
import { fetchWithRetry, RetryableHttpError } from './lib/http.mjs';

const GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
const REQUEST_TIMEOUT_MS = 15000;
/** 网络瞬时抖动/5xx 的重试次数（不含首次）；限流/权限类错误不重试。 */
const REQUEST_RETRIES = 2;
/** 分页上限（防御）：正常站点 discussions 数量远小于此。 */
const MAX_PAGES = 10;
const DISCUSSIONS_PER_PAGE = 100;

const logger = createBuildLogger('giscus-comments');

/**
 * 归一化 discussion 标题为路径形态，用于与文章路由 /post/<id> 比较。
 * Giscus 的 pathname mapping 使用页面相对路径（如 "post/busuanzi" 或 "/post/busuanzi"），
 * 个别场景也可能是完整 URL —— 三种形态统一归一化为 "/post/<id>"。
 */
const parsePathname = (value) => {
  try {
    const url = new URL(value);
    return url.pathname.replace(/\/+$/, '') || value;
  } catch {
    // 无协议形态（Giscus pathname mapping 的相对路径）：补前导斜杠再归一化。
    const pathname = String(value).trim();
    return (pathname.startsWith('/') ? pathname : `/${pathname}`).replace(/\/+$/, '');
  }
};

// owner/name 走 GraphQL variables（而非模板插值进查询串），避免仓库名含
// 引号等特殊字符时破坏查询结构。
const COMMENT_COUNTS_QUERY = `query CommentCounts($owner: String!, $name: String!, $cursor: String) {
  repository(owner: $owner, name: $name) {
    discussions(first: ${DISCUSSIONS_PER_PAGE}, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        number
        title
        category { id }
        comments { totalCount }
      }
    }
  }
}`;

/**
 * 拉取评论数并匹配到文章。
 * @param {{ posts: Array<{ id: string }>, token?: string }} options
 * @returns {Promise<Map<string, number> | null>} postId -> 评论数；失败/无 token 返回 null（调用方优雅跳过）。
 */
export const fetchCommentCounts = async ({ posts, token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '' }) => {
  const siteConfig = loadSiteConfig({ logger });
  const { repo, categoryId } = siteConfig.comments || {};
  const guestbookDiscussionId = siteConfig.guestbook?.discussionId;

  if (!repo || typeof repo !== 'string' || !repo.includes('/')) {
    logger.warn('comments.repo 未配置或格式非法，跳过评论数获取');
    return null;
  }
  if (!token) {
    logger.warn('未设置 GITHUB_TOKEN/GH_TOKEN，跳过评论数获取（本地构建可接受，CI 中会自动使用 GITHUB_TOKEN）');
    return null;
  }

  const [owner, name] = repo.split('/');
  const postPathToId = new Map(posts.map((post) => [`/post/${post.id}`, post.id]));
  const counts = new Map();

  try {
    let cursor = null;
    let truncated = false;
    for (let page = 0; page < MAX_PAGES; page += 1) {
      let response;
      try {
        response = await fetchWithRetry(
          GRAPHQL_ENDPOINT,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
              'User-Agent': 'd-blog-build',
              Accept: 'application/json',
            },
            body: JSON.stringify({ query: COMMENT_COUNTS_QUERY, variables: { owner, name, cursor } }),
          },
          {
            timeoutMs: REQUEST_TIMEOUT_MS,
            retries: REQUEST_RETRIES,
            onRetry: (info) =>
              logger.warn(
                'GitHub GraphQL 请求瞬时失败，重试中',
                `attempt=${info.attempt} status=${info.status ?? 'network'}`,
              ),
          },
        );
      } catch (error) {
        // 网络抖动/5xx 重试耗尽：评论数优雅降级（不阻塞构建）。
        logger.warn(
          'GitHub GraphQL 请求失败，跳过评论数获取',
          error instanceof RetryableHttpError ? `status=${error.status} attempts=${error.attempts}` : String(error),
        );
        return null;
      }

      if (response.status === 401 || response.status === 403) {
        const rateLimited = response.headers.get('x-ratelimit-remaining') === '0';
        logger.warn(
          `GitHub API 拒绝访问${rateLimited ? '（限速耗尽）' : ''}，跳过评论数获取`,
          `status=${response.status}`,
        );
        return null;
      }
      if (!response.ok) {
        logger.warn('GitHub API 请求失败，跳过评论数获取', `status=${response.status}`);
        return null;
      }

      const body = await response.json();
      if (body.errors) {
        // 常见原因：token 无权限读取 discussions / 仓库名写错。
        logger.warn('GitHub GraphQL 返回错误，跳过评论数获取', JSON.stringify(body.errors).slice(0, 300));
        return null;
      }

      const discussions = body.data?.repository?.discussions;
      if (!discussions?.nodes) {
        logger.warn('GraphQL 响应结构异常，跳过评论数获取');
        return null;
      }

      for (const node of discussions.nodes) {
        if (!node || typeof node.title !== 'string') continue;
        // 排除留言板（mapping=number 固定指向的 discussion，不属于任何文章）。
        if (guestbookDiscussionId !== undefined && node.number === guestbookDiscussionId) continue;
        // 防御：配置了 categoryId 时只统计"文章评论"分类的 discussion。
        if (categoryId && node.category?.id && node.category.id !== categoryId) continue;

        const postId = postPathToId.get(parsePathname(node.title));
        if (postId && !counts.has(postId)) {
          counts.set(postId, Number.isFinite(node.comments?.totalCount) ? node.comments.totalCount : 0);
        }
      }

      if (!discussions.pageInfo?.hasNextPage || !discussions.pageInfo.endCursor) break;
      // 已达到分页上限且仍有余页：标记截断，循环自然结束（上方 break 条件为
      // 下一页存在，因此此处必然 page === MAX_PAGES - 1）。
      if (page === MAX_PAGES - 1) {
        truncated = true;
        break;
      }
      cursor = discussions.pageInfo.endCursor;
    }
    if (truncated) {
      // 超过 1000 条 discussion 时结果不完整：明确提示而非静默截断
      // （文章卡片展示的评论数会偏低）。
      logger.warn(
        'discussions 数量超过分页上限，评论数可能不完整',
        `pages=${MAX_PAGES} perPage=${DISCUSSIONS_PER_PAGE}`,
      );
    }
  } catch (error) {
    logger.warn('获取评论数失败（网络异常等），跳过评论数获取', error instanceof Error ? error.message : String(error));
    return null;
  }

  if (counts.size === 0) {
    logger.warn('未匹配到任何文章的 discussion，评论数保持不展示');
    return null;
  }
  return counts;
};

// 独立运行（node scripts/fetch-giscus-comments.mjs）：仅用于手动调试/核对，不参与构建。
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { loadPostsWithContent } = await import('./ssg-data-loader.mjs');
  const posts = loadPostsWithContent();
  const counts = await fetchCommentCounts({ posts });
  if (counts) {
    for (const [id, count] of counts) console.log(`${id}: ${count}`);
  } else {
    console.log('(skipped)');
  }
}
