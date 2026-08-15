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

const normalizeBaseUrl = (value, logger) => {
  const rawUrl = String(value || DEFAULT_SITE_CONFIG.url)
    .trim()
    .replace(/\/+$/, '');

  try {
    return new URL(rawUrl).toString().replace(/\/+$/, '');
  } catch {
    logger?.warn('Invalid site URL, fallback to default', `${rawUrl} -> ${DEFAULT_SITE_CONFIG.url}`);
    return DEFAULT_SITE_CONFIG.url;
  }
};

export const loadSiteConfig = ({ logger } = {}) => {
  if (!fs.existsSync(SITE_CONFIG_FILE)) {
    logger?.warn('site.config.json not found, fallback to default config', { path: SITE_CONFIG_FILE });
    return DEFAULT_SITE_CONFIG;
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(SITE_CONFIG_FILE, 'utf-8'));
  } catch (error) {
    logger?.warn('Failed to parse site.config.json, fallback to default config', {
      path: SITE_CONFIG_FILE,
      error: error instanceof Error ? error.message : String(error),
    });
    return DEFAULT_SITE_CONFIG;
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    logger?.warn('site.config.json is not an object, fallback to default config', { path: SITE_CONFIG_FILE });
    return DEFAULT_SITE_CONFIG;
  }

  const configuredUrl = process.env.VITE_SITE_URL || raw.url || DEFAULT_SITE_CONFIG.url;

  return {
    ...raw,
    url: normalizeBaseUrl(configuredUrl, logger),
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
