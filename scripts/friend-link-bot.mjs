/**
 * friend-link-bot.mjs — 友链申请自动审核 Bot（GitHub Actions 专用）。
 *
 * 运行模式（由 workflow 以 CLI 参数区分）：
 *   node scripts/friend-link-bot.mjs opened   # issues:opened 事件：回复"已收到"标记
 *   node scripts/friend-link-bot.mjs review   # 事件驱动审核：冷却等待后处理全部待审申请
 *
 * 事件驱动（无定时轮询）：workflow 仅在 issues:opened 或手动 workflow_dispatch 时运行。
 * 新申请的 10 分钟冷却期由 review 模式在 run 内原地等待完成（无需 schedule 兜底）；
 * git push 带内重试替代定时重试，避免单次网络抖动导致申请永久滞留。
 *
 * 本版本为深度 Code Audit + 防御性重构最终版（Phase 3 全量重写，Phase 4 红队修正），
 * 在上一版基础上的关键修复：
 *
 * 1. 【DNS 超时】isSafePublicHttpUrl 改用 lookupWithTimeout —— DNS 服务器无响应
 *    时 5s 内判定不可达（fail-closed），不再无限阻塞（上版完全不受超时控制）。
 * 2. 【严格分页】listOpenIssues 开启 strictPagination=true：open issues 超过
 *    1000 条（分页上限）时抛 PaginationLimitError 中止整批 —— 静默截断的
 *    申请将永远无人处理，宁可报警也不丢单。
 * 3. 【429 限流识别】依赖 http.mjs 的 isRateLimitResponse（403/429/remaining=0
 *    统一识别）与 RateLimitError：二次限流时 `instanceof RateLimitError` 断点
 *    生效，整批暂停机制不再失效（上版 429 走普通 Error，降级机制形同虚设）。
 * 4. 【字段解析容错】parseApplication 允许 `- Site URL:`（冒号前无空格）、
 *    值内换行续行折叠；avatar 字段降级为可选（缺省用站点 logo 占位）——
 *    申请者微调模板或换行写值不再整单作废。
 * 5. 【mailto 注入净化】buildManualReviewSection 的 mailto body 先 \r\n → 空格，
 *    消除 mailto 头注入（上版把含换行的原正文直接塞进 mailto 链接）。
 * 6. 【git 分支参数化】commitAndPushFriendFile 目标分支用
 *    GITHUB_REF_NAME 覆盖（默认 main），不再硬编码。
 * 7. 【Summary 面板】processReview 结束后输出 Job Summary 表格
 *    （processed/skipped/rejected/accepted/exists/failed），运行结果在
 *    Actions 页面顶部一眼可见。
 * 8. 【审核通过自动上线】accept 提交推送成功后显式 dispatch deploy.yml ——
 *    GITHUB_TOKEN 的 git push 不会触发任何 workflow（GitHub 明确排除），
 *    必须显式触发 workflow_dispatch 才能自动构建部署；dispatch 失败仅告警，
 *    友链文件已入库，由手动部署兜底（workflow 需配 actions: write 权限）。
 * 9. 【缺省头像落地】avatar 缺失时写入站点 logo 占位 —— 修复"注释声称占位
 *    但未实现"的问题：原实现写空字符串，构建端因 avatar 必填而静默丢弃
 *    已被接受的友链，导致"审核通过但永不显示"。
 * 10. 【仓库级 API 端点】全部 GitHub REST 端点改为 /repos/{owner}/{repo} 前缀：
 *     - 拉取 open issues 原用裸 GET /issues（"List issues assigned to the
 *       authenticated user"）—— 该用户级端点对 Actions 的仓库级 GITHUB_TOKEN
 *       返回 404，导致 review 模式一启动即 Fatal；
 *     - 评论/关闭 issue 原用 /issues/{number}、/issues/{number}/comments ——
 *       REST API 根本不存在这两个路径（同样 404），opened 模式一启动即 Fatal。
 *     现统一改为 /repos/{owner}/{repo}/issues[...]（有据可查的仓库级端点）。
 *
 * 运行环境要求：GITHUB_TOKEN / GITHUB_REPOSITORY / ISSUE_PAYLOAD（opened 模式）。
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import net from 'node:net';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  fetchGithubJson,
  fetchWithRetry,
  createTimeoutSignal,
  lookupWithTimeout,
  computeBackoffDelay,
  sleep,
  RateLimitError,
  readResponseText,
  GITHUB_API_VERSION,
} from './lib/http.mjs';
import { createActionLogger, formatError, installGlobalErrorHandlers } from './lib/gh-actions-logger.mjs';

/* ------------------------------------------------------------------ */
/* 常量与可覆盖配置                                                     */
/* ------------------------------------------------------------------ */

const ISSUE_PREFIX = '[Friend Link]';

/** 申请提交后等待的冷却时长：10 分钟（可环境变量覆盖，方便测试缩短）。 */
const WAIT_MS = Number(process.env.FRIEND_LINK_WAIT_MS) || 10 * 60 * 1000;

/** review 模式原地等待冷却的封顶（毫秒）：低于 workflow timeout-minutes(15 分钟)，
 *  防止 FRIEND_LINK_WAIT_MS 被调大时 job 在等待期间被超时终止（白白占用队列）。 */
const MAX_COOLDOWN_WAIT_MS = 12 * 60 * 1000;

/** review 模式是否原地等待冷却：issues:opened 事件触发的 run 置 1（事件驱动下
 *  新申请必在冷却期，等待后本 run 内完成审核）；手动 workflow_dispatch 不等待。 */
const WAIT_COOLDOWN = ['1', 'true', 'yes'].includes(String(process.env.FRIEND_LINK_WAIT_COOLDOWN || '').toLowerCase());

const INITIAL_MARKER = '<!-- d-blog-friend-bot:initial -->';
const ACCEPTED_MARKER = '<!-- d-blog-friend-bot:accepted -->';
const REJECTED_MARKER = '<!-- d-blog-friend-bot:rejected -->';

/** 站点信息：反链检查目标。 */
const SITE_URL = process.env.FRIEND_LINK_SITE_URL || 'https://blog.pldduck.com/';

/** 缺省头像：申请缺 avatar 时用站点 logo 占位（可 env 覆盖）。 */
const DEFAULT_AVATAR_URL = process.env.FRIEND_LINK_DEFAULT_AVATAR || new URL('logo.png', SITE_URL).toString();

/** 审核通过后触发部署的工作流文件名（workflow_dispatch 的 workflow_id）。 */
const DEPLOY_WORKFLOW = process.env.FRIEND_LINK_DEPLOY_WORKFLOW || 'deploy.yml';

/** 友链页抓取的最大响应字节数（防超大附件拖垮内存/带宽）。 */
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

/** 页面抓取的整体超时（覆盖 DNS+TLS+响应头+body 全程）。 */
const PAGE_FETCH_TIMEOUT_MS = 30000;

/** 重定向最大跳数（防跳转环）。 */
const MAX_REDIRECTS = 3;

/** 评论内容安全上限：GitHub 评论 body 上限为 65536 字符，预留余量。 */
const MAX_COMMENT_BODY_CHARS = 48000;

/** mailto 预填正文截断：超长 mailto 链接会拖慢 Issue 页面渲染。 */
const MAX_MAILTO_BODY_CHARS = 4000;

/** 申请字段长度上限（输入 Schema 校验）。 */
const FIELD_LIMITS = {
  name: 100,
  description: 500,
  contact: 200,
};

/** 申请字段总长度预算（name+description+contact），防字段合计超限。 */
const MAX_TOTAL_FIELD_CHARS = 800;

/** git 子命令超时（毫秒）。 */
const GIT_TIMEOUT_MS = 60000;

/** git push 带内重试次数（事件驱动下无定时轮询兜底，网络抖动靠本 run 内重试吸收）。 */
const PUSH_RETRIES = 3;

/** 单个 review 批次最多处理多少个 open issue（避免超长运行）。 */
const MAX_ISSUES_PER_BATCH = 50;

/* ------------------------------------------------------------------ */
/* 环境与日志器                                                         */
/* ------------------------------------------------------------------ */

const logger = createActionLogger('friend-link');

const owner = process.env.GITHUB_REPOSITORY?.split('/')[0];
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
const token = process.env.GITHUB_TOKEN;

/** git 推送目标分支：优先取 GITHUB_REF_NAME（workflow 可配置），默认 main。 */
const TARGET_BRANCH = process.env.FRIEND_LINK_TARGET_BRANCH || process.env.GITHUB_REF_NAME || 'main';

/** GitHub API 统一请求入口：注入环境校验、鉴权与分页。 */
const api = async (endpoint, options = {}) => {
  const result = await fetchGithubJson(endpoint, {
    token,
    ...options,
    onRetry: (info) =>
      logger.warn('Retrying GitHub API request', {
        endpoint: endpoint.split('?')[0],
        attempt: info.attempt,
        status: info.status ?? 'network',
        delayMs: info.delayMs,
      }),
  });
  return result;
};

/* ------------------------------------------------------------------ */
/* 纯函数：申请解析 / URL 规范化 / 私网校验 / 反链识别                  */
/* ------------------------------------------------------------------ */

/**
 * 从 Issue 正文按 "- 标签: 值" 行格式解析申请字段（增强容错版）。
 * 容错规则（Phase 3/4 修复）：
 * - 标签冒号前允许无空格（`- Site URL:` 与 `-Site URL:` 均可识别）；
 * - 值内换行续行折叠：GitHub 富文本渲染会把多行值压成一行但保留换行，
 *   "值：\n  第二行" 时把后续缩进纯文本行拼进当前值；
 * - 续行仅限"缩进 + 非列表/引用标记"的纯文本行（`  - xxx` 这类子列表项
 *   不折叠，避免污染字段值 —— Phase 4 红队实测发现缩进列表项会被误拼入 URL）；
 * - 重复标签：首次出现优先，后续同标签行忽略（防正文手滑重复行污染值）；
 * - avatar 缺失不再导致整单作废（由调用方决定是否降级）。
 * @param {string} [body=''] Issue 正文。
 * @returns {object | null} 全部核心字段非空时返回对象，否则 null。
 */
const parseApplication = (body = '') => {
  const lines = String(body ?? '').split(/\r?\n/);
  // 收集所有字段行（容忍无空格冒号），重复标签取首次出现的值。
  const values = {};
  let currentLabel = null;
  for (const rawLine of lines) {
    // 字段行模式：行首可带 1-3 个空格，`- 标签: 值` 或 `-标签: 值`。
    const fieldMatch = rawLine.match(/^\s{0,3}-\s*([^:\n]+?)\s*:\s*(.*)$/);
    if (fieldMatch) {
      const label = fieldMatch[1].trim().toLowerCase();
      const value = fieldMatch[2].trim();
      currentLabel = label;
      // 首次出现优先：已有值则忽略后续同标签行（防重复行污染）。
      if (value && !values[label]) {
        values[label] = value;
      }
      continue;
    }
    // 非字段行：仅当"缩进 ≥2 空格 + 非列表/引用标记（- * > # 等）"时视为续行，
    // 折叠进当前字段值。子列表项（缩进 + 破折号）不折叠，且终结当前续行。
    if (currentLabel && /^\s{2,}\S/.test(rawLine) && !/^\s{2,}[-*>\d.]\s/.test(rawLine) && !/^\s{2,}#/.test(rawLine)) {
      const continuation = rawLine.trim();
      if (values[currentLabel]) {
        values[currentLabel] = `${values[currentLabel]} ${continuation}`.trim();
      }
    } else {
      currentLabel = null;
    }
  }

  const application = {
    name: values['site name'] || '',
    url: values['site url'] || '',
    friendPageUrl: values['friend page url'] || '',
    avatar: values['avatar url'] || '',
    description: values['short description'] || '',
    contact: values['your name / contact'] || '',
    filename: values['filename'] || '',
  };
  // 核心字段（除 avatar 外）必须全部非空，否则视为无效申请。
  const { avatar: _avatar, ...coreFields } = application;
  return Object.values(coreFields).every(Boolean) ? application : null;
};

/**
 * URL 规范化：去掉 hash、尾斜杠、统一小写。用于反链包含判断与去重比较。
 * @param {string} value
 * @returns {string}
 */
const normalizeUrl = (value) => {
  try {
    const url = new URL(value);
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().toLowerCase();
  } catch {
    return '';
  }
};

/**
 * 计算 review 批次的冷却等待时长：全部待审申请中"剩余冷却时间"的最大值。
 * 事件驱动（issues:opened）下必有刚提交的申请处于冷却期，此等待让 run 在
 * 本 run 内完成"冷却 + 审核"全流程；无待审申请或均已过冷却期时返回 0。
 * @param {Array<{ created_at?: string }>} issues 待审申请列表。
 * @param {number} [now=Date.now()] 当前时间戳（可注入测试）。
 * @returns {number} 应等待毫秒数（0 表示无需等待）。
 */
const computeCooldownWaitMs = (issues, now = Date.now()) => {
  let maxRemaining = 0;
  for (const issue of issues) {
    const createdAt = Date.parse(issue.created_at);
    if (Number.isFinite(createdAt)) {
      maxRemaining = Math.max(maxRemaining, WAIT_MS - (now - createdAt));
    }
  }
  return Math.max(0, maxRemaining);
};

/**
 * 私网地址判定（SSRF 防护）。使用 net.BlockList 按子网前缀匹配，覆盖：
 * - IPv4：0/8、10/8、127/8、169.254/16、172.16/12、192.168/16（与旧实现一致）；
 * - IPv6：::1 回环、:: 未指定、fc00::/7（ULA）、fe80::/10（链路本地）。
 * IPv4-mapped/兼容 IPv6（如 ::ffff:127.0.0.1、::ffff:7f00:1、::127.0.0.1）
 * 先解包成 IPv4 再走 IPv4 判定 —— 旧实现只做字符串前缀匹配，这类地址会漏判，
 * 攻击者可借 [::ffff:127.0.0.1] 之类的字面地址打到 runner 本机回环/内网。
 * @param {string} address
 * @returns {boolean} true 表示私网地址（不可访问）。
 */
const privateIpv4BlockList = new net.BlockList();
[
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
].forEach(([subnet, prefix]) => privateIpv4BlockList.addSubnet(subnet, prefix, 'ipv4'));

const privateIpv6BlockList = new net.BlockList();
[
  ['::', 128],
  ['::1', 128],
  ['fc00::', 7],
  ['fe80::', 10],
].forEach(([subnet, prefix]) => privateIpv6BlockList.addSubnet(subnet, prefix, 'ipv6'));

/** 把 IPv4-mapped/兼容的 IPv6 地址解包为点分 IPv4；非此类形式返回 undefined。 */
const unmapIpv4InIpv6 = (value) => {
  const toIpv4 = (high, low) => {
    const words = (Number.parseInt(high, 16) << 16) | Number.parseInt(low, 16);
    return [(words >>> 24) & 0xff, (words >>> 16) & 0xff, (words >>> 8) & 0xff, words & 0xff].join('.');
  };
  const mappedDotted = value.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (mappedDotted) return mappedDotted[1];
  const mappedHex = value.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) return toIpv4(mappedHex[1], mappedHex[2]);
  const compatibleDotted = value.match(/^::(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (compatibleDotted) return compatibleDotted[1];
  const compatibleHex = value.match(/^::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (compatibleHex) return toIpv4(compatibleHex[1], compatibleHex[2]);
  return undefined;
};

const isPrivateAddress = (address) => {
  const value = String(address).toLowerCase();
  try {
    if (value.includes(':')) {
      const mappedIpv4 = unmapIpv4InIpv6(value);
      if (mappedIpv4) {
        // 解包出的八位组来自正则（\d{1,3}），可能为 999 这类非法值；BlockList
        // 对畸形输入不抛错而是返回 false，需先校验再查询（fail-closed）。
        if (net.isIP(mappedIpv4) !== 4) return true;
        return privateIpv4BlockList.check(mappedIpv4, 'ipv4');
      }
      // net.BlockList 对畸形 IPv6 同样不抛错而是返回 false，需先按 net.isIP 校验。
      if (net.isIP(value) !== 6) return true;
      return privateIpv6BlockList.check(value, 'ipv6');
    }
    // 畸形 IPv4（net.BlockList 不会抛错而是返回 false）无法确认非私网 → fail-closed。
    if (net.isIP(value) !== 4) return true;
    return privateIpv4BlockList.check(value, 'ipv4');
  } catch {
    // 畸形地址 fail-closed：无法确认非私网即视为私网。
    return true;
  }
};

/**
 * 校验 URL 是否为"安全的公开 HTTP(S) 地址"：
 * 协议/主机名/凭据检查 + DNS 解析后逐 IP 校验非私网。
 * 任何一步异常均返回 false（fail-closed，绝不误放行内网目标）。
 * Phase 3 修复：DNS 解析使用 lookupWithTimeout（5s 超时），
 * DNS 服务器无响应时快速判定不可达，不阻塞整个 job。
 * @param {string} value
 * @returns {Promise<boolean>}
 */
const isSafePublicHttpUrl = async (value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    return false;
  }
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) {
    return false;
  }
  // 带超时的 DNS 解析：返回 []（超时/失败）时 fail-closed 判定为不安全。
  const addresses = await lookupWithTimeout(url.hostname);
  return addresses.length > 0 && addresses.every(({ address }) => !isPrivateAddress(address));
};

/**
 * 净化 mailto 预填正文：折叠换行与 CR，消除 mailto 头注入。
 * @param {string} value
 * @returns {string}
 */
const sanitizeMailtoBody = (value) =>
  String(value ?? '')
    .replace(/\r\n?/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * 抓取公开页面全文（带重定向链、整体超时、退避重试与体积上限）。
 * 每跳重定向都重新做 DNS 私网校验（防 SSRF 跳转绕过）。
 * @param {string} value 起始 URL。
 * @returns {Promise<string | null>} 页面 HTML；任何失败返回 null。
 */
const fetchPublicPage = async (value) => {
  let current = value;
  for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
    if (!(await isSafePublicHttpUrl(current))) {
      logger.warn('Blocked unsafe redirect target', { url: current });
      return null;
    }

    // 单一总超时信号覆盖 fetch 与 body 读取全程，防慢速连接无限挂起。
    const { signal, cleanup } = createTimeoutSignal(PAGE_FETCH_TIMEOUT_MS);
    try {
      const response = await fetchWithRetry(
        current,
        {
          redirect: 'manual',
          signal,
          headers: {
            'User-Agent': 'D-blogFriendLinkBot/2.0',
            Accept: 'text/html,application/xhtml+xml',
          },
        },
        {
          retries: 3,
          signal,
          onRetry: (info) =>
            logger.warn('Retrying friend-page fetch', {
              url: current,
              attempt: info.attempt,
              status: info.status ?? 'network',
              delayMs: info.delayMs,
            }),
        },
      );

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return null;
        current = new URL(location, current).toString();
        continue;
      }
      if (!response.ok) return null;

      // 限量读取 body：MAX_RESPONSE_BYTES 上限（readResponseText 内部截断）。
      // 注意：readResponseText 默认上限 512KB，此处显式放大到友链页抓取上限。
      return await readResponseText(response, { maxBytes: MAX_RESPONSE_BYTES });
    } catch (error) {
      logger.warn('Failed to fetch friend page', { url: current, error: formatError(error) });
      return null;
    } finally {
      cleanup();
    }
  }
  return null;
};

/**
 * 判断页面 HTML 是否包含本站反链（宽松规范化：大小写、转义、尾斜杠）。
 * @param {string} html
 * @returns {boolean}
 */
const containsBacklink = (html) => {
  const normalized = html
    .toLowerCase()
    .replaceAll('\\/', '/')
    .replaceAll('&amp;', '&')
    .replace(/\/+(["'\s>])/g, '$1');
  const canonical = normalizeUrl(SITE_URL);
  const withoutSlash = canonical.endsWith('/') ? canonical.slice(0, -1) : canonical;
  return normalized.includes(canonical) || normalized.includes(withoutSlash);
};

/* ------------------------------------------------------------------ */
/* GitHub API 操作（评论 / 关闭 Issue）                                */
/* ------------------------------------------------------------------ */

const postComment = (number, body) =>
  api(`/repos/${owner}/${repo}/issues/${number}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body: body.slice(0, MAX_COMMENT_BODY_CHARS) }),
  });

const closeIssue = (number, reason) =>
  api(`/repos/${owner}/${repo}/issues/${number}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ state: 'closed', state_reason: reason }),
  });

/**
 * 触发部署工作流（deploy.yml，workflow_dispatch 手动部署），让审核通过的
 * 友链真正上线：
 * - bot 用 GITHUB_TOKEN 的 git push 不会触发任何 workflow（GitHub 明确排除
 *   GITHUB_TOKEN 引发的事件），而 workflow_dispatch 是少数例外，可被
 *   GITHUB_TOKEN 显式触发 —— 因此「写入 + 推送 + dispatch 部署」三步闭环。
 * - dispatch 失败不抛错（友链文件已入库，站长手动部署仍可上线），只告警，
 *   由下一次成功 dispatch 或手动部署兜底。
 * - 注意：本端点响应为 204 No Content，不能走 fetchGithubJson（其会尝试
 *   response.json()），故直接用 fetchWithRetry。
 * @returns {Promise<boolean>} 是否成功触发部署。
 */
const dispatchDeploy = async () => {
  const payload = JSON.stringify({ repository: { ref: TARGET_BRANCH } });
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${encodeURIComponent(DEPLOY_WORKFLOW)}/dispatches`;
  try {
    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${token}`,
          'X-GitHub-Api-Version': GITHUB_API_VERSION,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: TARGET_BRANCH, inputs: { payload } }),
      },
      {
        retries: 2,
        onRetry: (info) =>
          logger.warn('Retrying deploy workflow dispatch', {
            attempt: info.attempt,
            status: info.status ?? 'network',
            delayMs: info.delayMs,
          }),
      },
    );
    if (!response.ok) {
      const bodyText = await readResponseText(response, { maxBytes: 4096 }).catch(() => '');
      throw new Error(`deploy dispatch returned HTTP ${response.status}: ${bodyText.slice(0, 300)}`);
    }
    logger.info('Deploy workflow dispatched', { workflow: DEPLOY_WORKFLOW, ref: TARGET_BRANCH });
    return true;
  } catch (error) {
    logger.warn('Failed to dispatch deploy workflow; friend file is committed and will appear on next manual deploy', {
      workflow: DEPLOY_WORKFLOW,
      ref: TARGET_BRANCH,
      error: formatError(error),
    });
    return false;
  }
};

/**
 * 分页拉取某个 issue 的全部评论（修复只取第一页导致的 marker 漏检）。
 * @param {number} number issue 编号。
 * @returns {Promise<Array<{ body?: string }>>}
 */
const listIssueComments = async (number) => {
  const result = await api(`/repos/${owner}/${repo}/issues/${number}/comments`, { params: { per_page: 100 } });
  return result.data;
};

/**
 * 分页拉取全部 open issues。
 * Phase 3 修复：strictPagination=true —— 超过 maxPages（1000 条）仍有下一页时
 * 抛 PaginationLimitError 中止整批，绝不静默截断（截断的申请将永远无人处理）。
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
const listOpenIssues = async () => {
  const result = await api(`/repos/${owner}/${repo}/issues`, {
    params: { state: 'open', per_page: 100 },
    strictPagination: true,
  });
  if (result.pages >= 10) {
    logger.warn('Open issues near pagination limit', { pages: result.pages });
  }
  return result.data;
};

/* ------------------------------------------------------------------ */
/* 文本与界面辅助                                                       */
/* ------------------------------------------------------------------ */

/**
 * 把正文包进等长围栏代码块（防正文含 ``` 破坏评论渲染），超长截断。
 * @param {string | undefined} value
 * @returns {string}
 */
const markdownCodeBlock = (value) => {
  const content = (value?.trim() || '(Issue 正文为空)').slice(0, MAX_COMMENT_BODY_CHARS - 2000);
  const longestFence = Math.max(0, ...(content.match(/`+/g) || []).map((item) => item.length));
  const fence = '`'.repeat(Math.max(3, longestFence + 1));
  return `${fence}text\n${content}\n${fence}`;
};

/**
 * 构建人工审核指引（含预填邮件的 mailto 链接与原 Issue 正文）。
 * Phase 3 修复：mailto body 经 sanitizeMailtoBody 净化（换行 → 空格），
 * 消除 mailto 头注入面；截断发生在净化之后。
 * @param {object} issue
 * @returns {string}
 */
const buildManualReviewSection = (issue) => {
  const subject = `D-blog 友链人工审核：${issue.title || `Issue #${issue.number}`}`;
  const body = issue.body?.trim() || '';
  const mailtoBody = sanitizeMailtoBody(body).slice(0, MAX_MAILTO_BODY_CHARS);
  const mailto = `mailto:i@PLDDUCK.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(mailtoBody)}`;

  return `### 人工审核\n\n部分框架会在浏览器运行 JavaScript 后才渲染友链，bot 可能无法从静态 HTML 中识别。若你已确认友链正常显示，可以发送邮件到 **i@PLDDUCK.com** 申请人工添加。\n\n[撰写人工审核邮件（已预填原 Issue 内容）](${mailto})\n\n邮件只需保留原 Issue 内容，无需重新整理资料。\n\n<details>\n<summary>查看并复制原 Issue 内容</summary>\n\n${markdownCodeBlock(body)}\n\n</details>`;
};

/* ------------------------------------------------------------------ */
/* 申请校验                                                             */
/* ------------------------------------------------------------------ */

/**
 * 校验申请内容（输入 Schema + 外部可达性 + 反链检查）。
 * @param {object} application parseApplication 的返回值。
 * @returns {Promise<string | null>} null 表示通过；否则为失败原因。
 */
const validateApplication = async (application) => {
  // 1. 文件名规则：仅字母数字下划线短横线，可带 .json 后缀。
  if (!/^[A-Za-z0-9_-]+(?:\.json)?$/.test(application.filename)) {
    return '文件名不符合规则。';
  }

  // 2. 字段长度上限（防超长文本污染 friends/ 数据文件）。
  for (const field of ['name', 'description', 'contact']) {
    if (application[field] && application[field].length > FIELD_LIMITS[field]) {
      return `${field} 长度超过上限（${FIELD_LIMITS[field]} 字符）。`;
    }
  }

  // 3. 字段合计预算（防三个字段各自未超限但合计膨胀）。
  const totalChars = ['name', 'description', 'contact'].reduce(
    (sum, field) => sum + (application[field]?.length || 0),
    0,
  );
  if (totalChars > MAX_TOTAL_FIELD_CHARS) {
    return `申请字段合计超过上限（${MAX_TOTAL_FIELD_CHARS} 字符）。`;
  }

  // 4. 三个 URL 均须为安全的公开 HTTP(S) 地址（含私网 IP 拒绝）。
  if (!(await isSafePublicHttpUrl(application.url))) return '站点地址不是安全的公开 HTTP(S) 地址。';
  if (!(await isSafePublicHttpUrl(application.friendPageUrl))) return '友链页地址不是安全的公开 HTTP(S) 地址。';
  if (application.avatar && !(await isSafePublicHttpUrl(application.avatar)))
    return '头像地址不是安全的公开 HTTP(S) 地址。';

  // 5. 文件名占用检查。
  const filename = application.filename.toLowerCase().endsWith('.json')
    ? application.filename
    : `${application.filename}.json`;
  try {
    await fs.access(path.join('friends', filename));
    return '申请文件名已经被占用，请换一个文件名后重新提交。';
  } catch {
    // 文件名可用。
  }

  // 6. 反链检查：友链页必须公开可访问且静态 HTML 包含本站地址。
  const html = await fetchPublicPage(application.friendPageUrl);
  if (!html) return '友链页无法访问，或响应不是可读取的公开页面。';
  if (!containsBacklink(html)) return `未在 ${application.friendPageUrl} 的静态 HTML 中找到 ${SITE_URL}。`;

  return null;
};

/**
 * 写入 friends/<filename>.json（字段白名单序列化，防多余字段注入）。
 * @param {object} application
 * @returns {Promise<string>} 写入的文件路径。
 */
const writeFriendFile = async (application) => {
  const filename = application.filename.toLowerCase().endsWith('.json')
    ? application.filename
    : `${application.filename}.json`;
  const filePath = path.join('friends', filename);
  const data = {
    name: application.name,
    description: application.description,
    avatar: application.avatar || DEFAULT_AVATAR_URL,
    url: application.url,
  };
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return filePath;
};

/**
 * 检查申请是否已存在于 friends/ 目录（按规范化 URL 或名称去重）。
 * 单个文件损坏时跳过该文件（build 校验会另行上报），不影响整体。
 * @param {object} application
 * @returns {Promise<boolean>}
 */
const alreadyExists = async (application) => {
  let filenames = [];
  try {
    filenames = await fs.readdir('friends');
  } catch {
    return false;
  }
  const targetUrl = normalizeUrl(application.url);
  const targetName = application.name.trim().toLowerCase();
  for (const filename of filenames.filter((item) => item.endsWith('.json'))) {
    try {
      const data = JSON.parse(await fs.readFile(path.join('friends', filename), 'utf8'));
      if (normalizeUrl(data.url) === targetUrl || data.name?.trim().toLowerCase() === targetName) {
        return true;
      }
    } catch {
      // 损坏文件由 generate-site-data.mjs 的构建校验报告，此处跳过。
    }
  }
  return false;
};

/* ------------------------------------------------------------------ */
/* Git 事务：add → commit → push（全部带超时）                          */
/* ------------------------------------------------------------------ */

/**
 * 提交并推送友链文件（幂等 + push 带内重试）。
 * - 幂等：先检查暂存区，无改动则跳过 commit（同一 checkout 内重试时首次
 *   commit 已落库，避免"nothing to commit"误抛；跨 run 由全新 checkout 保证）。
 * - push 重试：事件驱动下无定时轮询兜底，网络抖动导致的 push 失败在本 run 内
 *   最多重试 PUSH_RETRIES 次（指数退避）；仍失败则抛出 —— Issue 保持打开、
 *   不落 marker，由下一次提交事件或手动 workflow_dispatch 在全新 checkout 中重试。
 * @param {string} filePath
 * @param {number} issueNumber
 * @returns {Promise<string>} 提交短 SHA。
 */
const commitAndPushFriendFile = async (filePath, issueNumber) => {
  execFileSync('git', ['add', filePath], { timeout: GIT_TIMEOUT_MS, stdio: 'pipe' });
  const staged = execFileSync('git', ['diff', '--cached', '--name-only'], {
    encoding: 'utf8',
    timeout: GIT_TIMEOUT_MS,
    stdio: 'pipe',
  }).trim();
  if (staged) {
    execFileSync(
      'git',
      [
        '-c',
        'user.name=github-actions[bot]',
        '-c',
        'user.email=41898282+github-actions[bot]@users.noreply.github.com',
        'commit',
        '-m',
        `feat: add friend link via issue #${issueNumber}`,
      ],
      { timeout: GIT_TIMEOUT_MS, stdio: 'pipe' },
    );
  }

  let lastError = null;
  for (let attempt = 1; attempt <= PUSH_RETRIES; attempt += 1) {
    try {
      execFileSync('git', ['push', 'origin', `HEAD:${TARGET_BRANCH}`], { timeout: GIT_TIMEOUT_MS, stdio: 'pipe' });
      return execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
        encoding: 'utf8',
        timeout: GIT_TIMEOUT_MS,
        stdio: 'pipe',
      }).trim();
    } catch (error) {
      lastError = error;
      if (attempt < PUSH_RETRIES) {
        const delayMs = computeBackoffDelay(attempt, 2000, 10000);
        logger.warn('git push failed, retrying', { attempt, delayMs, error: formatError(error) });
        await sleep(delayMs);
      }
    }
  }
  throw lastError;
};

/* ------------------------------------------------------------------ */
/* 业务逻辑：opened（事件触发） / review（事件驱动审核）                 */
/* ------------------------------------------------------------------ */

/** 安全解析 ISSUE_PAYLOAD（手动触发/空 payload 时容错为空）。 */
const safeParseJson = (raw, fallback) => {
  try {
    return JSON.parse(raw || '{}');
  } catch {
    logger.warn('ISSUE_PAYLOAD is not valid JSON, treating as empty', { rawLength: (raw || '').length });
    return fallback;
  }
};

/**
 * issues:opened 事件：对新建申请 Issue 回复"已收到"标记（幂等，评论去重）。
 */
const processOpened = async () => {
  const issue = safeParseJson(process.env.ISSUE_PAYLOAD || '{}', {});
  if (!issue.number || !issue.title?.startsWith(ISSUE_PREFIX)) {
    logger.info('Skipping non-friend-link issue event', { number: issue.number ?? 'none' });
    return;
  }

  // 幂等保护：评论已含 INITIAL_MARKER（如事件重复投递）则跳过。
  const comments = await listIssueComments(issue.number);
  if (comments.some((item) => item.body?.includes(INITIAL_MARKER))) {
    logger.info('Initial marker already posted, skipping', { issue: issue.number });
    return;
  }

  await postComment(
    issue.number,
    `${INITIAL_MARKER}\n\n## 友链申请已收到\n\n- **当前状态**：等待自动审核\n- **预计时间**：提交满 ${Math.round(WAIT_MS / 60000)} 分钟后开始检查，通常在 10 至 15 分钟内处理\n- **检查内容**：友链页是否公开可访问，并在静态 HTML 中包含 D-blog 反链\n\n审核通过后，友链会自动加入本站；如果检查失败，bot 会在此 Issue 中说明原因并关闭申请。`,
  );
  logger.info('Posted initial confirmation', { issue: issue.number });
};

/**
 * 处理单个待审核 Issue（冷却期 → 评论去重 → 校验 → 拒绝/接受）。
 * 任何一步失败抛出异常，由 processReview 捕获隔离。
 * @param {Record<string, any>} issue
 * @returns {Promise<'skipped' | 'rejected' | 'accepted' | 'exists'>} 处理结果。
 */
const processIssue = async (issue) => {
  const issueNumber = issue.number;
  const now = Date.now();
  const createdAt = Date.parse(issue.created_at);

  // 冷却期：提交未满 WAIT_MS 的申请不处理。
  if (!Number.isFinite(createdAt) || now - createdAt < WAIT_MS) {
    logger.debug('Issue still in cooldown, skipping', { issue: issueNumber });
    return 'skipped';
  }

  // 评论去重：已处理过的 Issue 直接跳过（幂等）。
  const comments = await listIssueComments(issueNumber);
  if (comments.some((item) => item.body?.includes(ACCEPTED_MARKER) || item.body?.includes(REJECTED_MARKER))) {
    logger.info('Issue already processed, skipping', { issue: issueNumber });
    return 'skipped';
  }

  const application = parseApplication(issue.body);
  const error = application ? await validateApplication(application) : 'Issue 内容不完整，请使用本站生成的申请草稿。';

  if (error) {
    await postComment(
      issueNumber,
      `${REJECTED_MARKER}\n\n## 友链申请未通过\n\n- **审核结果**：未通过\n- **失败原因**：${error}\n- **Issue 状态**：已关闭\n\n你可以根据上面的原因修正友链页或申请资料，然后重新生成并提交新的 Issue。\n\n---\n\n${buildManualReviewSection(issue)}`,
    );
    await closeIssue(issueNumber, 'not_planned');
    return 'rejected';
  }

  if (await alreadyExists(application)) {
    await postComment(
      issueNumber,
      `${ACCEPTED_MARKER}\n\n## 友链申请已处理\n\n- **审核结果**：站点已存在\n- **处理说明**：该站点已经在友链目录中，无需重复添加\n- **Issue 状态**：已关闭\n\n感谢申请。`,
    );
    await closeIssue(issueNumber, 'completed');
    return 'exists';
  }

  // 写入文件 + git 事务。push 失败时抛出异常：不 close Issue、不落 marker，
  // 由下一次提交事件或手动 workflow_dispatch 在全新 checkout 中重试（无本地残留）。
  const filePath = await writeFriendFile(application);
  const sha = await commitAndPushFriendFile(filePath, issueNumber);
  await postComment(
    issueNumber,
    `${ACCEPTED_MARKER}\n\n## 友链申请已通过\n\n- **审核结果**：通过\n- **反链检查**：已找到 D-blog 反链\n- **添加文件**：\`${filePath}\`\n- **Commit**：\`${sha}\`\n- **Issue 状态**：已关闭\n\n友链已写入仓库并自动触发部署，稍后即可在站点显示。感谢申请！`,
  );
  await closeIssue(issueNumber, 'completed');
  return 'accepted';
};

/**
 * review 模式（事件驱动）：拉取全部 open issues，等待冷却后逐个隔离处理。
 * 本函数只在"有提交申请"的 run 中执行（workflow 无定时轮询）：
 * - 新提交的申请处于冷却期 → 原地等待至冷却完成（本 run 内完成"冷却+审核"
 *   全流程，无需 schedule 兜底；仅 issues:opened 触发的 run 等待，
 *   手动 workflow_dispatch 不等待，冷却中的申请留待下次事件）；
 * - 已过冷却期的申请直接处理（含上一次运行失败遗留的未处理申请）；
 * - 普通异常：记录后继续下一个 issue（坏数据不拖垮整批）。
 * - RateLimitError：暂停整批（继续请求只会继续触发限流）。
 * - PaginationLimitError：数据被截断，中止整批并报警（fail-closed）。
 */
const processReview = async () => {
  let issues = await listOpenIssues();
  let pending = issues.filter((item) => !item.pull_request && item.title?.startsWith(ISSUE_PREFIX));
  logger.info('Review cycle started', {
    openIssues: issues.length,
    friendLinkIssues: pending.length,
    batchLimit: MAX_ISSUES_PER_BATCH,
  });

  // 事件驱动冷却等待：issues:opened 触发的 run 内，新申请提交未满 WAIT_MS 时
  // 原地等待至冷却完成，等待结束后重新拉取（避免漏掉等待期间的新提交）。
  // 等待封顶 MAX_COOLDOWN_WAIT_MS（低于 job timeout-minutes 15 分钟）；超封顶的
  // 申请由 processIssue 的冷却检查跳过，留待下一次提交事件或手动重跑处理。
  if (WAIT_COOLDOWN) {
    const waitMs = Math.min(MAX_COOLDOWN_WAIT_MS, computeCooldownWaitMs(pending));
    if (waitMs > 0) {
      logger.info('Waiting for application cooldown before review', {
        waitMs,
        cooldownMs: WAIT_MS,
        capped: waitMs === MAX_COOLDOWN_WAIT_MS,
      });
      await sleep(waitMs);
      issues = await listOpenIssues();
      pending = issues.filter((item) => !item.pull_request && item.title?.startsWith(ISSUE_PREFIX));
    }
  }

  const stats = { processed: 0, skipped: 0, rejected: 0, accepted: 0, exists: 0, failed: 0 };
  const batch = pending.slice(0, MAX_ISSUES_PER_BATCH);

  for (const issue of batch) {
    const issueNumber = issue.number;
    try {
      await logger.group(`Issue #${issueNumber}`, async () => {
        const result = await processIssue(issue);
        stats[result === 'skipped' ? 'skipped' : result] += 1;
        stats.processed += result === 'skipped' ? 0 : 1;
        logger.info('Issue processed', { issue: issueNumber, result });
      });
    } catch (error) {
      if (error instanceof RateLimitError) {
        logger.error('GitHub rate limit reached, pausing batch', {
          issue: issueNumber,
          error: formatError(error),
        });
        stats.failed += 1;
        break; // 限流：停止本批后续处理。
      }
      logger.error('Issue processing failed, continuing with next', {
        issue: issueNumber,
        error: formatError(error),
      });
      stats.failed += 1;
    }
  }

  // 审核通过 ≥1 个：触发部署工作流，让新增友链真正上线。
  // GITHUB_TOKEN 的 push 不会触发任何 workflow，必须显式 dispatch；
  // 批次内多次通过共享一次部署（deploy-site 的 cancel-in-progress 会
  // 自动合并连续触发，避免重复构建）。
  if (stats.accepted > 0) {
    await dispatchDeploy();
  }

  if (pending.length > batch.length) {
    logger.warn('More pending issues than batch limit, remaining queued for next cycle', {
      remaining: pending.length - batch.length,
    });
  }

  logger.summary({
    processed: stats.processed,
    skipped: stats.skipped,
    rejected: stats.rejected,
    accepted: stats.accepted,
    exists: stats.exists,
    failed: stats.failed,
  });
  logger.summaryTable('Friend Link Bot Review', [
    { metric: 'processed', value: stats.processed },
    { metric: 'skipped', value: stats.skipped },
    { metric: 'rejected', value: stats.rejected },
    { metric: 'accepted', value: stats.accepted },
    { metric: 'exists', value: stats.exists },
    { metric: 'failed', value: stats.failed },
  ]);
};

/* ------------------------------------------------------------------ */
/* 入口                                                                 */
/* ------------------------------------------------------------------ */

const main = async () => {
  const mode = process.argv[2];
  if (!['opened', 'review'].includes(mode)) {
    throw new Error('Usage: node scripts/friend-link-bot.mjs <opened|review>');
  }

  // 环境完备性检查：GITHUB_TOKEN 在 Actions 中自动注入；缺失属于配置错误。
  if (!token || !owner || !repo) {
    logger.error('GitHub Actions environment is incomplete', {
      hasToken: Boolean(token),
      repository: process.env.GITHUB_REPOSITORY || '(missing)',
    });
    process.exit(1);
  }

  if (mode === 'opened') {
    await processOpened();
  } else {
    await processReview();
  }
};

// 全局异常兜底：任何未捕获 rejection / 异常都结构化记录并以非零码退出。
installGlobalErrorHandlers(logger);

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((error) => {
    logger.error('Fatal: bot execution failed', { error: formatError(error) });
    process.exit(1);
  });
}
