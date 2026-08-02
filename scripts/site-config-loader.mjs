import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SITE_CONFIG_FILE = path.join(__dirname, '../config/site.config.ts');

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
    bio: ''
  }
};

const extractString = (content, key, fallback = '') => {
  const match = content.match(new RegExp(`${key}:\\s*["']([^"']*)["']`));
  return match?.[1]?.trim() || fallback;
};

const extractBlock = (content, key) => {
  const match = content.match(new RegExp(`${key}:\\s*\\{([\\s\\S]*?)\\n\\s*\\}`, 'm'));
  return match?.[1] || '';
};

const normalizeBaseUrl = (value, logger) => {
  const rawUrl = String(value || DEFAULT_SITE_CONFIG.url).trim().replace(/\/+$/, '');

  try {
    return new URL(rawUrl).toString().replace(/\/+$/, '');
  } catch {
    logger?.warn('Invalid site URL, fallback to default', `${rawUrl} -> ${DEFAULT_SITE_CONFIG.url}`);
    return DEFAULT_SITE_CONFIG.url;
  }
};

export const loadSiteConfig = ({ logger } = {}) => {
  if (!fs.existsSync(SITE_CONFIG_FILE)) {
    return DEFAULT_SITE_CONFIG;
  }

  const content = fs.readFileSync(SITE_CONFIG_FILE, 'utf-8');
  const authorBlock = extractBlock(content, 'author');
  const configuredUrl = process.env.VITE_SITE_URL || extractString(content, 'url', DEFAULT_SITE_CONFIG.url);

  return {
    title: extractString(content, 'title', DEFAULT_SITE_CONFIG.title),
    subtitle: extractString(content, 'subtitle', DEFAULT_SITE_CONFIG.subtitle),
    description: extractString(content, 'description', DEFAULT_SITE_CONFIG.description),
    url: normalizeBaseUrl(configuredUrl, logger),
    logo: extractString(content, 'logo', DEFAULT_SITE_CONFIG.logo),
    seoImage: extractString(content, 'seoImage', DEFAULT_SITE_CONFIG.seoImage),
    author: {
      name: extractString(authorBlock, 'name', DEFAULT_SITE_CONFIG.author.name),
      avatar: extractString(authorBlock, 'avatar', DEFAULT_SITE_CONFIG.author.avatar),
      role: extractString(authorBlock, 'role', DEFAULT_SITE_CONFIG.author.role),
      bio: extractString(authorBlock, 'bio', DEFAULT_SITE_CONFIG.author.bio)
    }
  };
};

export const toAbsoluteUrl = (value, baseUrl) => {
  if (!value) {
    return baseUrl;
  }

  return new URL(value, baseUrl).toString();
};
