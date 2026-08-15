/**
 * http.mjs — 网络请求基础设施（供所有与外部网络交互的构建/自动化脚本复用）。
 *
 * 本文件为深度 Code Audit + 防御性重构的最终版（Phase 3 全量重写，Phase 4 红队修正），
 * 在上一版基础上的关键修复：
 *
 * 1. 【重试语义统一】fetchWithRetry 重试耗尽后对可重试状态码一律抛 RetryableHttpError，
 *    网络错误（TypeError / 内部超时 AbortError）也包装为同类型抛出 ——
 *    彻底消灭"重试耗尽后静默返回非 ok Response，由调用方自行判断"的歧义与死代码。
 *    上一版 `for (attempt <= retries)` 的末尾 `throw new RetryableHttpError` 对 5xx
 *    路径不可达（直接 return response），且 Akismet 曾把 500 页正文误当结论 —— 已修复。
 * 2. 【限流分类缺口】429（Secondary Rate Limit）与 403 统一识别：isRateLimitResponse
 *    检查 x-ratelimit-remaining=0 / 403 / 429 三条件；重试耗尽后仍命中限流抛 RateLimitError，
 *    friend-link-bot 的 `instanceof RateLimitError` 整批暂停机制不再失效。
 * 3. 【DNS 查询纳入超时】lookupWithTimeout 用 Promise.race 包裹 dns.lookup ——
 *    DNS 服务器无响应时不再无限阻塞（上一版该路径完全不受超时控制）。
 * 4. 【响应体限量读取】readResponseText 限量消费 body（防超大响应体拖垮 Runner 内存）。
 * 5. 【分页严格化】strictPagination=true 时达到 maxPages 仍存在 next 链接 → 抛
 *    PaginationLimitError，杜绝 1000 条以上数据被静默截断（fail-closed）。
 *
 * 全部函数均为纯函数/可注入依赖，便于单测与本地无网络环境复现。
 */

import dns from 'node:dns/promises';

/* ------------------------------------------------------------------ */
/* 常量与错误分类                                                       */
/* ------------------------------------------------------------------ */

/** 可安全重试的 HTTP 状态码集合（网络瞬时抖动、服务端过载、限流）。 */
export const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

/** 默认请求超时（毫秒）。Actions runner 到 GitHub/Akismet 的正常延迟远低于此。 */
export const DEFAULT_TIMEOUT_MS = 15000;

/** 最大重试次数（不含首次请求）。 */
export const DEFAULT_RETRIES = 3;

/** 重试基础退避（毫秒），每次重试按 2^attempt 指数放大后乘以 [0,1) 抖动。 */
export const DEFAULT_BASE_DELAY_MS = 500;

/** 单次退避上限（毫秒），防止重试间隔无限膨胀。 */
export const DEFAULT_MAX_DELAY_MS = 8000;

/** 因 GitHub 限流而等待 reset 的最大时长（毫秒）。超过则放弃并抛 RateLimitError，
 *  由调用方决定策略 —— 保证 job 永远有明确的退出路径，绝不无限挂起。 */
export const DEFAULT_MAX_RATE_LIMIT_WAIT_MS = 90000;

/** fetchGithubJson 单次调用最多拉取的页数（防御畸形 Link 头无限循环）。 */
export const DEFAULT_MAX_PAGES = 10;

/** GitHub 统一请求头（2022-11-28 为当前长期稳定 API 版本）。 */
export const GITHUB_API_VERSION = '2022-11-28';

/** readResponseText 默认读取上限（字节）。GitHub 错误响应体通常 < 1KB。 */
export const DEFAULT_MAX_RESPONSE_BYTES = 512 * 1024;

/** DNS 查询默认超时（毫秒）。超过视为不可达（fail-closed）。 */
export const DEFAULT_DNS_TIMEOUT_MS = 5000;

/**
 * 可重试错误（重试耗尽后仍失败）：HTTP 状态码在可重试集合内，或网络层失败。
 * 调用方统一 catch 此类型即可覆盖"重试过仍失败"的所有场景。
 */
export class RetryableHttpError extends Error {
  /**
   * @param {string} message 错误描述（含 URL 与状态码，便于 Actions 日志定位）。
   * @param {number} status HTTP 状态码；网络错误时为 0。
   * @param {number} attempts 实际尝试次数（含重试）。
   * @param {string} [body] 最后一次响应体截断文本（可能有，便于排查）。
   */
  constructor(message, status, attempts, body = '') {
    super(message);
    this.name = 'RetryableHttpError';
    this.status = status;
    this.attempts = attempts;
    this.body = body;
  }
}

/**
 * 限流错误：GitHub 限流（403 或 429）且已等待至上限仍不可恢复。
 * 调用方应"暂停整批"而非逐条继续请求（继续只会放大限流）。
 */
export class RateLimitError extends Error {
  /**
   * @param {string} message
   * @param {number} retryAfterSeconds 服务器要求等待的秒数（reset 或 Retry-After）。
   * @param {number} waitedMs 实际等待后放弃时已经花费的毫秒。
   */
  constructor(message, retryAfterSeconds, waitedMs) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
    this.waitedMs = waitedMs;
  }
}

/**
 * 非可重试的 HTTP 业务错误（4xx 除 408/425/429 外）：携带状态码与响应体，
 * 调用方可用 status 区分（如 404 表示资源不存在，直接降级跳过）。
 */
export class HttpStatusError extends Error {
  /**
   * @param {string} message
   * @param {number} status HTTP 状态码。
   * @param {string} [body] 响应体截断文本。
   */
  constructor(message, status, body = '') {
    super(message);
    this.name = 'HttpStatusError';
    this.status = status;
    this.body = body;
  }
}

/**
 * 分页超限错误：strictPagination 模式下达到 maxPages 仍有下一页（数据被截断）。
 * 调用方应 fail-closed（中止批处理并报警），绝不静默丢失数据。
 */
export class PaginationLimitError extends Error {
  /**
   * @param {string} message
   * @param {number} pages 已拉取页数。
   * @param {string} nextUrl 下一跳 URL（留作排查）。
   */
  constructor(message, pages, nextUrl) {
    super(message);
    this.name = 'PaginationLimitError';
    this.pages = pages;
    this.nextUrl = nextUrl;
  }
}

/* ------------------------------------------------------------------ */
/* 工具函数                                                             */
/* ------------------------------------------------------------------ */

/**
 * 生成 [0, upperBound) 的随机抖动。
 * @param {number} upperBound 上界（毫秒）。
 * @returns {number}
 */
export const jitter = (upperBound) => Math.floor(Math.random() * upperBound);

/**
 * 计算第 attempt 次重试前的等待毫秒数（Full Jitter 指数退避）。
 * @param {number} attempt 从 1 开始计数（第一次重试）。
 * @param {number} baseDelayMs 基础退避。
 * @param {number} maxDelayMs 退避上限。
 * @returns {number}
 */
export const computeBackoffDelay = (
  attempt,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS,
) => {
  const exponent = Math.min(attempt, 10); // 2^10=1024 之后指数爆炸无意义，钳制。
  const cap = Math.min(baseDelayMs * 2 ** exponent, maxDelayMs);
  return jitter(cap);
};

/**
 * 把"内部超时计时"与"外部 AbortSignal"合并为一个 signal。
 * 外部信号触发 abort 时返回 { abortedByExternal: true }，供调用方区分
 * "主动取消"（不重试）与"超时"（可重试），避免误重试被用户取消的请求。
 *
 * @param {number} timeoutMs 超时毫秒。
 * @param {AbortSignal | undefined} externalSignal 外部取消信号。
 * @returns {{ signal: AbortSignal, cleanup: () => void }}
 */
export const createTimeoutSignal = (timeoutMs, externalSignal) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`request timed out after ${timeoutMs}ms`)), timeoutMs);
  const onExternalAbort = () => controller.abort(externalSignal?.reason || new Error('request aborted by caller'));

  if (externalSignal) {
    if (externalSignal.aborted) {
      // 外部信号已提前 abort：立即反映，无需注册监听。
      controller.abort(externalSignal.reason || new Error('request aborted by caller'));
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup() {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    },
  };
};

/**
 * 从响应头解析 Retry-After：支持秒数或 HTTP 日期两种格式。
 * @param {Headers} headers
 * @returns {number | undefined} 应等待的秒数；无法解析时返回 undefined。
 */
export const parseRetryAfter = (headers) => {
  const raw = headers.get('retry-after');
  if (!raw) return undefined;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds;
  const date = Date.parse(raw);
  if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  return undefined;
};

/**
 * 解析 GitHub 的 Link 头，返回 next / last / first / prev 的完整 URL。
 * @param {Headers | HeadersInit | undefined} headers
 * @returns {Record<string, string>}
 */
export const parseLinkHeader = (headers) => {
  const result = {};
  if (!headers) return result;
  const raw = typeof headers.get === 'function' ? headers.get('link') : headers['link'];
  if (!raw) return result;
  for (const part of raw.split(',')) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="([^"]+)"/);
    if (match) result[match[2]] = match[1];
  }
  return result;
};

/**
 * 解析 GitHub Rate Limit 信息。
 * Phase 4 红队修复：缺失头（headers.get 返回 null）必须视为 undefined ——
 * 原实现 `Number(null) === 0` 会把"无限流头"误判为 remaining: 0（限流耗尽），
 * 在代理剥头/测试注入 baseUrl 等场景下误触发限流等待逻辑。
 * @param {Headers | HeadersInit | undefined} headers
 * @returns {{ limit: number | undefined, remaining: number | undefined, reset: number | undefined }}
 */
export const parseRateLimitHeaders = (headers) => {
  const get = (key) => {
    if (!headers) return undefined;
    if (typeof headers.get === 'function') {
      const value = headers.get(key);
      return value === null ? undefined : value;
    }
    return headers[key];
  };
  const limit = Number(get('x-ratelimit-limit'));
  const remaining = Number(get('x-ratelimit-remaining'));
  const reset = Number(get('x-ratelimit-reset'));
  return {
    limit: Number.isFinite(limit) ? limit : undefined,
    remaining: Number.isFinite(remaining) ? remaining : undefined,
    reset: Number.isFinite(reset) ? reset : undefined,
  };
};

/** GitHub 权限类 403 的特征消息（区别于限流 403）。 */
const PERMISSION_ERROR_PATTERNS = [
  /resource not accessible by integration/i,
  /resource not accessible/i,
  /insufficient permissions/i,
  /must have push/i,
  /repository was archived/i,
  /access blocked/i,
];

/**
 * 判断 403 是否为"权限不足"而非限流。
 * GITHUB_TOKEN 缺某项权限（如 issues:write / discussions:read）时 GitHub 返回
 * 403 + "Resource not accessible by integration"；若把这类 403 一律当限流，
 * 会先 sleep 到 reset、再补偿重试、最后抛 RateLimitError 让调用方"整批暂停"，
 * 报错信息误导为限流而实际是权限配置问题。
 * @param {Response} response
 * @param {string} [bodyText] 已读取的响应体文本（未读取时传空串，仅凭状态码判断）。
 * @returns {boolean}
 */
export const isPermissionDeniedResponse = (response, bodyText = '') => {
  if (!response || response.status !== 403) return false;
  return PERMISSION_ERROR_PATTERNS.some((pattern) => pattern.test(bodyText));
};

/**
 * 判断响应是否为"GitHub 限流响应"：
 * - 显式 x-ratelimit-remaining=0（主限流耗尽）；
 * - 403（GitHub 主限流/二次限流的经典返回码）；但带权限类错误消息的 403 除外；
 * - 429（二次限流 Too Many Requests，可能不携带限流头）。
 * 命中即视为限流，由调用方决定等待 reset 或整批暂停。
 * @param {Response} response
 * @param {string} [bodyText] 已读取的响应体文本（403 时用于排除权限错误）。
 * @returns {boolean}
 */
export const isRateLimitResponse = (response, bodyText = '') => {
  if (!response) return false;
  if (parseRateLimitHeaders(response.headers).remaining === 0) return true;
  if (response.status === 429) return true;
  if (response.status === 403) {
    // 带权限类错误消息的 403 不是限流：避免误判后整批暂停、误导排障。
    return !isPermissionDeniedResponse(response, bodyText);
  }
  return false;
};

/**
 * 限量读取响应体文本（防超大响应体拖垮内存）。超过上限即截断并在结尾标记。
 * 读取过程受外部 signal 保护（AbortError 由调用方处理）。
 * @param {Response} response
 * @param {object} [options]
 * @param {number} [options.maxBytes=DEFAULT_MAX_RESPONSE_BYTES] 读取上限（字节）。
 * @returns {Promise<string>}
 */
export const readResponseText = async (response, { maxBytes = DEFAULT_MAX_RESPONSE_BYTES } = {}) => {
  const reader = response.body?.getReader();
  if (!reader) {
    // 无 body（如 204）：直接返回空串。
    return '';
  }
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      // 超过上限：放弃继续读取并取消底层流（释放 socket）。
      chunks.push(value.subarray(0, Math.max(0, maxBytes - (total - value.byteLength))));
      await reader.cancel().catch(() => {});
      return `${Buffer.concat(chunks).toString('utf8')}\n…<truncated at ${maxBytes} bytes>`;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
};

/**
 * 休眠指定毫秒（可被外部 signal 提前打断）。
 * @param {number} ms
 * @param {AbortSignal | undefined} signal
 * @returns {Promise<void>}
 */
export const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason || new Error('sleep aborted'));
    };
    if (signal) {
      if (signal.aborted) {
        clearTimeout(timer);
        reject(signal.reason || new Error('sleep aborted'));
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }
  });

/**
 * 带超时的 DNS 解析：Promise.race 包裹 dns.lookup，超过 timeoutMs 视为不可达。
 * 解决"DNS 服务器无响应时 lookup 无限阻塞、完全不受外层超时控制"的隐患。
 * @param {string} hostname
 * @param {number} [timeoutMs=DEFAULT_DNS_TIMEOUT_MS]
 * @returns {Promise<Array<{ address: string, family: number }>>} 超时或失败时返回 []。
 */
export const lookupWithTimeout = async (hostname, timeoutMs = DEFAULT_DNS_TIMEOUT_MS) => {
  let timer;
  try {
    return await Promise.race([
      dns.lookup(hostname, { all: true, verbatim: true }),
      new Promise((resolve) => {
        timer = setTimeout(() => resolve([]), timeoutMs);
      }),
    ]);
  } catch {
    // 解析失败（NXDOMAIN / 服务器异常）：fail-closed，返回空数组由调用方判定。
    return [];
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * 判断一个 fetch 抛出的异常是否为"网络层失败"（可重试）。
 * 超时导致的 AbortError 视为可重试；调用方 signal 触发的 abort 不可重试
 * （通过错误 message 前缀区分，见 createTimeoutSignal 的构造）。
 * @param {unknown} error
 * @returns {boolean}
 */
export const isNetworkError = (error) => {
  if (!(error instanceof Error)) return false;
  // AbortError：仅"内部超时"可重试。Node fetch（undici）在 signal abort 时抛出的
  // DOMException message 恒为 "This operation was aborted"，reason 不会进入 message，
  // 因此不能依赖 message 区分内外部取消 —— 外部取消由 fetchWithRetry 在调用本函数
  // 之前通过 externalSignal.aborted 状态拦截（见 fetchWithRetry 的 catch 分支）。
  if (error.name === 'AbortError') {
    return true;
  }
  // fetch 网络故障（DNS 失败、连接拒绝、TLS 失败等）统一抛 TypeError。
  return error instanceof TypeError || error.name === 'FetchError';
};

/* ------------------------------------------------------------------ */
/* 核心：带超时与退避重试的 fetch                                      */
/* ------------------------------------------------------------------ */

/**
 * 带超时、指数退避（Full Jitter）与 Retry-After 尊重的 fetch 封装。
 *
 * 失败语义（Phase 3 统一）：
 * - 可重试状态码（408/425/429/5xx）在网络次耗尽后：抛 RetryableHttpError(status, attempts, body)。
 * - 网络层错误（TypeError / 内部超时）在网络次耗尽后：抛 RetryableHttpError(status=0, attempts)。
 * - 外部 signal 触发 abort：抛原始 abort 错误（绝不重试）。
 * - 非可重试状态码（401/404 等）：返回 Response（调用方检查 response.ok 即可，
 *   或直接使用 fetchGithubJson 等高层封装，它们会转 HttpStatusError）。
 *
 * @param {string} url 请求地址。
 * @param {RequestInit} options fetch 选项（method/headers/body 等）。
 * @param {object} config
 * @param {number} [config.timeoutMs=DEFAULT_TIMEOUT_MS] 单次请求超时（毫秒）。
 * @param {number} [config.retries=DEFAULT_RETRIES] 最大重试次数（不含首次）。
 * @param {number} [config.baseDelayMs=DEFAULT_BASE_DELAY_MS] 基础退避。
 * @param {number} [config.maxDelayMs=DEFAULT_MAX_DELAY_MS] 退避上限。
 * @param {AbortSignal} [config.signal] 外部取消信号。
 * @param {(info: { attempt: number, status: number | null, error: Error | null, delayMs: number, url: string }) => void} [config.onRetry]
 *        每次决定重试前的回调（供结构化日志记录重试事件）。
 * @returns {Promise<Response>} 成功时返回 response（由调用方按需消费 body）。
 */
export const fetchWithRetry = async (url, options = {}, config = {}) => {
  const timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retries = config.retries ?? DEFAULT_RETRIES;
  const baseDelayMs = config.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const maxDelayMs = config.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
  const externalSignal = config.signal;

  let lastStatus = null;
  let lastBody = '';

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const { signal, cleanup } = createTimeoutSignal(timeoutMs, externalSignal);
    let response;
    try {
      response = await fetch(url, {
        ...options,
        signal,
        // 默认用户代理：GitHub 拒绝无 UA 的 API 请求，Akismet 也要求合法 UA。
        headers: {
          'User-Agent': 'D-blog-Automation/2.0',
          ...(options.headers || {}),
        },
      });
      lastStatus = response.status;

      // 可重试状态码：在未耗尽重试次数时退避重试。
      if (RETRYABLE_STATUS_CODES.has(response.status) && attempt < retries) {
        const retryAfterSeconds = parseRetryAfter(response.headers);
        const delayMs =
          retryAfterSeconds !== undefined
            ? Math.min(retryAfterSeconds * 1000, maxDelayMs)
            : computeBackoffDelay(attempt + 1, baseDelayMs, maxDelayMs);
        config.onRetry?.({
          attempt: attempt + 1,
          status: response.status,
          error: null,
          delayMs,
          url,
        });
        // 读取（并丢弃）body 以释放连接，避免滞留 socket；失败不影响重试。
        await response.text().catch(() => {});
        await sleep(delayMs, externalSignal);
        cleanup();
        continue;
      }

      // 可重试状态码但重试已耗尽：统一包装为 RetryableHttpError（Phase 3 核心修复）。
      // 上一版此处直接 return response，导致 Akismet 把 500 页正文误当结论。
      if (RETRYABLE_STATUS_CODES.has(response.status)) {
        lastBody = await readResponseText(response, { maxBytes: 4096 });
        cleanup();
        throw new RetryableHttpError(
          `request failed after ${retries + 1} attempts: ${url} (status ${response.status})`,
          response.status,
          retries + 1,
          lastBody,
        );
      }

      cleanup();
      return response;
    } catch (error) {
      cleanup();

      // 外部取消：绝不重试，直接抛出。
      // 注意：不能依赖错误 message 判断 —— Node fetch（undici）在 signal
      // abort 时抛出的 DOMException message 恒为 "This operation was aborted"，
      // 不含 createTimeoutSignal 注入的 reason。因此以外部 signal 的实际
      // aborted 状态为准（Phase 4 红队实测发现）。
      if (externalSignal?.aborted) {
        throw error;
      }
      // 非网络层错误（如 body 序列化失败、JSON 处理异常）也不重试。
      if (!isNetworkError(error)) {
        throw error;
      }

      // 超时或网络错误：可重试。
      if (attempt < retries) {
        const delayMs = computeBackoffDelay(attempt + 1, baseDelayMs, maxDelayMs);
        config.onRetry?.({ attempt: attempt + 1, status: null, error, delayMs, url });
        await sleep(delayMs, externalSignal);
        continue;
      }

      // 网络错误重试耗尽：包装为 RetryableHttpError（status=0），统一调用方 catch 边界。
      throw new RetryableHttpError(
        `request failed after ${retries + 1} attempts: ${url} (network error: ${error.message})`,
        0,
        retries + 1,
      );
    }
  }

  // 理论不可达（循环内必然 return 或 throw）；保留防御性兜底以防未来修改破坏不变量。
  throw new RetryableHttpError(
    `request failed after ${retries + 1} attempts: ${url}`,
    lastStatus ?? 0,
    retries + 1,
    lastBody,
  );
};

/* ------------------------------------------------------------------ */
/* GitHub REST API 封装（鉴权头 / 限流 / 分页 / 透传 method/body）      */
/* ------------------------------------------------------------------ */

/**
 * 带鉴权、限流等待、退避重试与自动分页的 GitHub REST API 请求。
 * 支持非 GET 方法：method/body/自定义 headers 通过 fetchOptions 透传。
 *
 * @param {string} endpoint 相对端点，如 '/repos/{owner}/{repo}/issues?state=open' 或
 *        '/repos/{owner}/{repo}/issues/{number}/comments'。注意：仓库内资源必须带
 *        /repos/{owner}/{repo} 前缀；裸 '/issues'（List issues assigned to the
 *        authenticated user）等用户级端点在 GITHUB_TOKEN（仓库级令牌）下会返回 404。
 * @param {object} options
 * @param {string} options.token GitHub Token（必填；缺失时抛出明确错误）。
 * @param {string} [options.baseUrl='https://api.github.com'] API 基地址（可测注入）。
 * @param {Record<string, string | number | boolean | undefined>} [options.params] 查询参数。
 * @param {boolean} [options.paginate=true] 是否自动分页（Link 头 rel="next"）。
 * @param {number} [options.maxPages=DEFAULT_MAX_PAGES] 最大页数。
 * @param {boolean} [options.strictPagination=false] 达到 maxPages 仍有 next 时抛
 *        PaginationLimitError（fail-closed，防止静默截断）。默认 false 保持宽松。
 * @param {number} [options.timeoutMs] 单请求超时。
 * @param {number} [options.retries] 重试次数。
 * @param {number} [options.maxRateLimitWaitMs=DEFAULT_MAX_RATE_LIMIT_WAIT_MS] 限流等待上限。
 * @param {AbortSignal} [options.signal] 外部取消信号。
 * @param {(info: object) => void} [options.onRetry] 重试回调（透传 fetchWithRetry）。
 * @param {(info: { page: number, rateLimit: object }) => void} [options.onPage] 每页回调。
 * @param {RequestInit} [options.fetchOptions] 透传给 fetch 的额外选项（method/body/自定义 headers）。
 *       注意：鉴权头与 X-GitHub-Api-Version 由本函数强制注入，调用方无需重复设置。
 * @returns {Promise<{ data: any, headers: Headers, rateLimit: object, pages: number, lastLink: object }>}
 *          分页模式下 data 为合并后的数组；单页非数组时 data 为原始 JSON 值。
 */
export const fetchGithubJson = async (endpoint, options = {}) => {
  const {
    token,
    baseUrl = 'https://api.github.com',
    params = {},
    paginate = true,
    maxPages = DEFAULT_MAX_PAGES,
    strictPagination = false,
    timeoutMs,
    retries,
    maxRateLimitWaitMs = DEFAULT_MAX_RATE_LIMIT_WAIT_MS,
    signal,
    onRetry,
    onPage,
    fetchOptions = {},
  } = options;

  if (!token) {
    throw new Error('fetchGithubJson requires a token (GITHUB_TOKEN / GH_TOKEN).');
  }

  // 基础请求配置：鉴权头强制注入；调用方透传字段叠加。
  // 兼容两种调用风格：顶层 method/body/headers（GitHub 客户端惯例），
  // 或 fetchOptions 包裹（更明确的命名）。headers 合并顺序为：
  // 默认鉴权头 < fetchOptions.headers < 顶层 headers（调用方优先级最高，
  // 用于 Content-Type 等业务头）。
  const baseRequest = {
    method: options.method,
    body: options.body,
    ...fetchOptions,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      ...(fetchOptions.headers || {}),
      ...(options.headers || {}),
    },
  };

  const buildUrl = (page) => {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        query.set(key, String(value));
      }
    }
    // 端点里已有的查询参数（如 per_page）保留，params 覆盖。
    const endpointQuery = endpoint.includes('?') ? new URLSearchParams(endpoint.split('?')[1]) : new URLSearchParams();
    for (const [key, value] of query.entries()) endpointQuery.set(key, value);
    if (page > 1) endpointQuery.set('page', String(page));
    const queryString = endpointQuery.toString();
    const base = endpoint.split('?')[0];
    return `${base}${queryString ? `?${queryString}` : ''}`;
  };

  const merged = [];
  let pages = 0;
  let lastResponse = null;
  let rateLimit = {};
  let link = {};

  /**
   * 执行单页请求（含限流等待后的补偿重试）。
   * @param {number} page
   * @returns {Promise<any>} 该页 JSON 数据。
   */
  const fetchPage = async (page) => {
    const url = `${baseUrl}${buildUrl(page)}`;

    // 429（二次限流）在 fetchWithRetry 内已做退避重试，耗尽后以
    // RetryableHttpError(status=429) 抛出，不会作为响应返回 —— 因此下方
    // isRateLimitResponse 分支永远看不到 429（Phase 4 红队遗留缺口）。
    // 这里把 429 归一为 RateLimitError，让调用方（friend-link-bot）的
    // “整批暂停”机制真正覆盖二次限流，而不是把每个请求的失败当成普通
    // 错误记录后继续下一个请求（只会继续放大限流）。
    const fetchPageRequest = async (retryBudget) => {
      let response;
      try {
        response = await fetchWithRetry(url, baseRequest, { timeoutMs, retries: retryBudget, signal, onRetry });
      } catch (error) {
        if (error instanceof RetryableHttpError && error.status === 429) {
          throw new RateLimitError(
            `GitHub secondary rate limit exceeded after ${error.attempts} attempts: ${url}`,
            60,
            0,
          );
        }
        throw error;
      }
      return response;
    };

    // 发起请求；429/5xx 由 fetchWithRetry 自动退避重试。
    let response = await fetchPageRequest(retries);

    // 403 且无显式限流头时，先读响应体以区分「权限不足」与「限流」：
    // 权限类 403 不应按限流等待/整批暂停，应以普通错误抛出便于排障。
    let responseBodyText = '';
    if (response.status === 403 && parseRateLimitHeaders(response.headers).remaining !== 0) {
      responseBodyText = await readResponseText(response, { maxBytes: 4096 }).catch(() => '');
    }

    // 限流保护：429/403/remaining=0 时休眠到 reset（或 Retry-After），
    // 有上限（maxRateLimitWaitMs），超限直接抛 RateLimitError，绝不无限等待。
    // Phase 3 修复：isRateLimitResponse 覆盖 403 与 429 两种限流形态
    // （上一版只识别 403 && remaining===0，二次限流的 429 完全漏检）。
    if (isRateLimitResponse(response, responseBodyText)) {
      const parsedRateLimit = parseRateLimitHeaders(response.headers);
      const waitMs = parsedRateLimit.reset ? Math.max(0, parsedRateLimit.reset * 1000 - Date.now()) : 0;
      const retryAfterSeconds = parseRetryAfter(response.headers);
      const retryAfterMs = retryAfterSeconds !== undefined ? retryAfterSeconds * 1000 : Number.POSITIVE_INFINITY;
      const boundedWaitMs = Math.min(waitMs || Number.POSITIVE_INFINITY, retryAfterMs, maxRateLimitWaitMs);

      if (Number.isFinite(boundedWaitMs) && boundedWaitMs > 0) {
        await sleep(boundedWaitMs, signal);
        // 等待补偿后重试一次；若仍被限流，走下方 isRateLimitResponse 抛错分支。
        response = await fetchPageRequest(1);
      }
    }

    rateLimit = parseRateLimitHeaders(response.headers);
    link = parseLinkHeader(response.headers);
    lastResponse = response;

    if (!response.ok) {
      // 限流且等待补偿后仍失败：抛 RateLimitError（调用方整批暂停）。
      if (isRateLimitResponse(response, responseBodyText)) {
        const parsedRateLimit = parseRateLimitHeaders(response.headers);
        throw new RateLimitError(
          `GitHub rate limit exceeded: ${url}`,
          parsedRateLimit.reset ? Math.max(0, Math.ceil(parsedRateLimit.reset - Date.now() / 1000)) : 60,
          maxRateLimitWaitMs,
        );
      }
      // 其余 4xx/5xx：复用已读取的响应体（避免对已消费的流再次读取），
      // 限量读取后抛出带状态码的普通错误（重试已在 fetchWithRetry 耗尽）。
      const bodyText = responseBodyText || (await readResponseText(response, { maxBytes: 4096 }).catch(() => ''));
      throw new HttpStatusError(
        `GitHub API HTTP ${response.status}: ${bodyText.slice(0, 500)}`,
        response.status,
        bodyText,
      );
    }

    onPage?.({ page, rateLimit });
    return response.json();
  };

  let page = 1;
  for (;;) {
    const data = await fetchPage(page);
    pages += 1;
    if (Array.isArray(data)) {
      merged.push(...data);
    } else if (page === 1) {
      // 非数组响应（如 POST 创建评论返回单个对象）：不翻页，直接返回。
      return { data, headers: lastResponse.headers, rateLimit, pages, lastLink: link };
    }

    if (!paginate || !link.next || pages >= maxPages) {
      // strictPagination：达到上限且仍存在下一页 → fail-closed，禁止静默截断。
      if (strictPagination && link.next && pages >= maxPages) {
        throw new PaginationLimitError(
          `Pagination limit reached (${maxPages} pages) but more pages exist; refusing to silently truncate: ${baseUrl}${buildUrl(page)}`,
          pages,
          link.next,
        );
      }
      break;
    }
    page += 1;
  }

  return {
    data: merged,
    headers: lastResponse.headers,
    rateLimit,
    pages,
    lastLink: link,
  };
};
