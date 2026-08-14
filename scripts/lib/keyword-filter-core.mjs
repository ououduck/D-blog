/**
 * keyword-filter-core.mjs — 评论/讨论关键词过滤的共享纯逻辑。
 *
 * 供两个脚本复用（单一事实来源，避免配置语义漂移）：
 *   - comment-keyword-filter.mjs  事件触发：只检查新增评论/讨论；
 *   - comment-keyword-recheck.mjs 手动全量复查：遍历仓库内全部评论。
 *
 * 本模块只包含无网络依赖的纯函数（配置加载、文本规范化、内容匹配），
 * 网络请求与 GraphQL 变更留在各脚本内。
 */

import fs from 'node:fs';

/** 关键词配置路径（相对仓库根目录）。 */
export const CONFIG_PATH = 'config/comment-keywords.json';

/** 自动豁免的机器人账号（giscus 公告类讨论/评论不应被关键词审核）。 */
export const ALWAYS_EXEMPT_USERS = new Set(['giscus[bot]', 'github-actions[bot]']);

/**
 * 文本规范化：小写 + 去除零宽字符（防绕过） + 连续空白折叠为单空格。
 * @param {string | null | undefined} text
 * @returns {string}
 */
export const normalizeText = (text) => String(text ?? '')
  .toLowerCase()
  .replace(/[\u200b-\u200f\ufeff]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

/**
 * 加载并校验关键词配置。
 * @param {{ warn: (message: string, fields?: object) => void }} logger 结构化日志器。
 * @returns {null | { action: string, discussionAction: string, exemptUsers: Set<string>, keywords: string[], patterns: RegExp[] }}
 *          配置缺失/为空/解析失败时返回 null（调用方优雅跳过）。
 */
export const loadConfig = (logger) => {
  if (!fs.existsSync(CONFIG_PATH)) {
    logger?.warn('Keyword config file not found; filter skipped', { path: CONFIG_PATH });
    return null;
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch (error) {
    logger?.warn('Failed to parse keyword config; filter skipped', { path: CONFIG_PATH, error: error instanceof Error ? error.message : String(error) });
    return null;
  }

  const keywords = (Array.isArray(raw.keywords) ? raw.keywords : [])
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim());

  const patterns = [];
  for (const item of Array.isArray(raw.patterns) ? raw.patterns : []) {
    if (typeof item !== 'string' || !item.trim()) continue;
    try {
      patterns.push(new RegExp(item, 'i'));
    } catch (error) {
      // 单条正则非法只跳过该条，不拖垮整份配置。
      logger?.warn('Invalid keyword regex pattern skipped', { pattern: item, error: error instanceof Error ? error.message : String(error) });
    }
  }

  if (keywords.length === 0 && patterns.length === 0) {
    logger?.warn('No keywords or patterns configured; filter skipped', { path: CONFIG_PATH });
    return null;
  }

  const exemptUsers = new Set(
    (Array.isArray(raw.exemptUsers) ? raw.exemptUsers : [])
      .filter((item) => typeof item === 'string')
      .map((item) => item.toLowerCase())
  );

  return {
    // 非法 action 值一律回退到安全默认（minimize 可撤销，杜绝误删）。
    action: raw.action === 'delete' ? 'delete' : raw.action === 'none' ? 'none' : 'minimize',
    discussionAction: raw.discussionAction === 'none' ? 'none' : 'delete',
    exemptUsers,
    keywords,
    patterns
  };
};

/**
 * 对正文执行关键词/正则匹配。
 * @param {{ keywords: string[], patterns: RegExp[] }} config
 * @param {string} text 原始正文。
 * @returns {null | { type: 'keyword' | 'pattern', value: string }}
 */
export const matchContent = (config, text) => {
  const normalized = normalizeText(text);
  for (const keyword of config.keywords) {
    if (normalized.includes(keyword.toLowerCase())) {
      return { type: 'keyword', value: keyword };
    }
  }
  for (const pattern of config.patterns) {
    if (pattern.test(normalized)) {
      return { type: 'pattern', value: pattern.source };
    }
  }
  return null;
};

/**
 * 判断作者是否应豁免审核：仅配置名单（config/comment-keywords.json 的 exemptUsers）
 * 与机器人账号。仓库主不再自动豁免，如需豁免请在配置中显式列出。
 * @param {string} author 评论作者 login。
 * @param {Set<string>} exemptUsers 配置的豁免用户（小写）。
 * @returns {boolean}
 */
export const isExemptAuthor = (author, exemptUsers) => {
  const authorLower = String(author ?? '').toLowerCase();
  if (!authorLower) return false;
  if (exemptUsers.has(authorLower)) return true;
  return ALWAYS_EXEMPT_USERS.has(authorLower);
};
