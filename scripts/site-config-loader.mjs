/**
 * 站点配置加载器：从 config/site.config.json 读取并校验配置（含环境变量覆盖），供全部构建脚本共用。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getBasePath, withBasePath } from './base-path.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// 站点配置数据源：与客户端 site.config.ts 共用同一份 JSON（PagesCMS「站点配置」可编辑）。
const SITE_CONFIG_FILE = path.join(__dirname, '../config/site.config.json');

const DEFAULT_SITE_CONFIG = {
  title: 'D-blog',
  subtitle: '',
  description: '',
  url: 'http://localhost:3000',
  logo: '/logo.png',
  seoImage: '/logo.png',
  author: {
    name: '作者',
    avatar: '',
    role: '',
    bio: '',
  },
};

const normalizeBaseUrl = (value, logger, allowFallback) => {
  const rawUrl = String(value || '').trim().replace(/\/+$/, '');

  if (!rawUrl) {
    if (allowFallback) {
      logger?.warn('Site URL is empty, fallback to default', DEFAULT_SITE_CONFIG.url);
      return DEFAULT_SITE_CONFIG.url;
    }
    throw new Error('site.config.json 缺少 url 字段（或 VITE_SITE_URL 为空）');
  }

  try {
    return new URL(rawUrl).toString().replace(/\/+$/, '');
  } catch (error) {
    if (allowFallback) {
      logger?.warn('Invalid site URL, fallback to default', `${rawUrl} -> ${DEFAULT_SITE_CONFIG.url}`);
      return DEFAULT_SITE_CONFIG.url;
    }
    throw new Error(`site.config.json 的 url 字段非法（${rawUrl}）：${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * 读取并校验站点配置（含环境变量覆盖）。
 *
 * fail-closed：配置文件缺失/损坏/URL 非法时默认抛错中止构建 —— 静默回退到
 * localhost 默认值会让 sitemap/robots/feed 全部生成 localhost 地址却正常出包
 * （且回退分支在 VITE_SITE_URL 覆盖之前提前 return，CI 设置的 URL 也不生效）。
 * 仅在显式传入 allowFallback（本地调试等场景）时才回退默认配置。
 */
export const loadSiteConfig = ({ logger, allowFallback = false } = {}) => {
  const fallback = (reason) => {
    if (allowFallback) {
      logger?.warn(reason, { path: SITE_CONFIG_FILE });
      return DEFAULT_SITE_CONFIG;
    }
    throw new Error(`${reason}（${SITE_CONFIG_FILE}）`);
  };

  if (!fs.existsSync(SITE_CONFIG_FILE)) {
    return fallback('site.config.json not found');
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(SITE_CONFIG_FILE, 'utf-8'));
  } catch (error) {
    return fallback(
      `Failed to parse site.config.json: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return fallback('site.config.json is not an object');
  }

  const configuredUrl = process.env.VITE_SITE_URL || raw.url;

  return {
    ...raw,
    url: normalizeBaseUrl(configuredUrl, logger, allowFallback),
    author: {
      name: raw.author?.name || DEFAULT_SITE_CONFIG.author.name,
      avatar: raw.author?.avatar || DEFAULT_SITE_CONFIG.author.avatar,
      role: raw.author?.role || DEFAULT_SITE_CONFIG.author.role,
      bio: raw.author?.bio || DEFAULT_SITE_CONFIG.author.bio,
    },
  };
};

export const getSiteBasePath = () => getBasePath(process.env.VITE_BASE_PATH);

export const toAbsoluteUrl = (value, baseUrl, basePath = getSiteBasePath()) => {
  if (!value) {
    return new URL(withBasePath('/', basePath), `${baseUrl.replace(/\/+$/, '')}/`).toString();
  }

  const rawValue = String(value);
  if (/^[a-z][a-z\d+.-]*:/i.test(rawValue)) {
    try {
      const candidate = new URL(rawValue);
      const site = new URL(baseUrl);
      if (candidate.origin !== site.origin) {
        return rawValue;
      }
      return new URL(
        withBasePath(`${candidate.pathname}${candidate.search}${candidate.hash}`, basePath),
        `${baseUrl.replace(/\/+$/, '')}/`,
      ).toString();
    } catch {
      return rawValue;
    }
  }

  return new URL(withBasePath(rawValue, basePath), `${baseUrl.replace(/\/+$/, '')}/`).toString();
};
