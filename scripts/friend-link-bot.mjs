import fs from 'node:fs/promises';
import path from 'node:path';
import dns from 'node:dns/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const ISSUE_PREFIX = '[Friend Link]';
export const WAIT_MS = 10 * 60 * 1000;
const INITIAL_MARKER = '<!-- d-blog-friend-bot:initial -->';
const ACCEPTED_MARKER = '<!-- d-blog-friend-bot:accepted -->';
const REJECTED_MARKER = '<!-- d-blog-friend-bot:rejected -->';
const SITE_URL = 'https://blog.pldduck.com/';
const SITE_NAME = 'D-blog';
const SITE_DESCRIPTION = '跑路的duck的技术分享和生活随笔';
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

const owner = process.env.GITHUB_REPOSITORY?.split('/')[0];
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1];
const token = process.env.GITHUB_TOKEN;
const apiBase = `https://api.github.com/repos/${owner}/${repo}`;

const api = async (endpoint, options = {}) => {
  if (!token || !owner || !repo) throw new Error('GitHub Actions environment is incomplete.');
  const response = await fetch(`${apiBase}${endpoint}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.headers || {}),
    },
  });
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${await response.text()}`);
  return response.status === 204 ? null : response.json();
};

const field = (body, label) => {
  const line = body.split(/\r?\n/).find((item) => item.toLowerCase().startsWith(`- ${label.toLowerCase()}:`));
  return line ? line.slice(line.indexOf(':') + 1).trim() : '';
};

export const parseApplication = (body = '') => {
  const values = {
    name: field(body, 'Site Name'),
    url: field(body, 'Site URL'),
    friendPageUrl: field(body, 'Friend Page URL'),
    avatar: field(body, 'Avatar URL'),
    description: field(body, 'Short Description'),
    contact: field(body, 'Your Name / Contact'),
    filename: field(body, 'Filename'),
  };
  return Object.values(values).every(Boolean) ? values : null;
};

export const normalizeUrl = (value) => {
  try {
    const url = new URL(value);
    url.hash = '';
    url.pathname = url.pathname.replace(/\/+$/, '') || '/';
    return url.toString().toLowerCase();
  } catch {
    return '';
  }
};

const isPrivateAddress = (address) => {
  const value = address.toLowerCase();
  if (value.includes(':')) return value === '::1' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe80:');
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  return (
    parts[0] === 0 || parts[0] === 10 || parts[0] === 127 || (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168)
  );
};

export const isSafePublicHttpUrl = async (value) => {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) return false;
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost')) return false;
  try {
    const addresses = await dns.lookup(url.hostname, {
      all: true,
      verbatim: true,
    });
    return addresses.length > 0 && addresses.every(({ address }) => !isPrivateAddress(address));
  } catch {
    return false;
  }
};

const fetchPublicPage = async (value) => {
  let current = value;
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    if (!(await isSafePublicHttpUrl(current))) return null;
    const response = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(15000),
      headers: {
        'User-Agent': 'D-blogFriendLinkBot/1.0',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return null;
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) return null;
    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks = [];
    let total = 0;
    while (true) {
      const { done, value: chunk } = await reader.read();
      if (done) break;
      total += chunk.byteLength;
      if (total > MAX_RESPONSE_BYTES) return null;
      chunks.push(chunk);
    }
    return new TextDecoder().decode(Buffer.concat(chunks));
  }
  return null;
};

export const containsBacklink = (html) => {
  const normalized = html
    .toLowerCase()
    .replaceAll('\\/', '/')
    .replaceAll('&amp;', '&')
    .replace(/\/+(["'\s>])/g, '$1');
  const canonical = normalizeUrl(SITE_URL);
  const withoutSlash = canonical.endsWith('/') ? canonical.slice(0, -1) : canonical;
  return normalized.includes(canonical) || normalized.includes(withoutSlash);
};

const comment = (number, body) =>
  api(`/issues/${number}/comments`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
const close = (number, reason) =>
  api(`/issues/${number}`, {
    method: 'PATCH',
    body: JSON.stringify({ state: 'closed', state_reason: reason }),
  });

const validateApplication = async (application) => {
  if (!/^[A-Za-z0-9_-]+(?:\.json)?$/.test(application.filename) || application.filename.toLowerCase() === '.json') return '文件名不符合规则。';
  if (!(await isSafePublicHttpUrl(application.url))) return '站点地址不是安全的公开 HTTP(S) 地址。';
  if (!(await isSafePublicHttpUrl(application.friendPageUrl))) return '友链页地址不是安全的公开 HTTP(S) 地址。';
  if (!(await isSafePublicHttpUrl(application.avatar))) return '头像地址不是安全的公开 HTTP(S) 地址。';
  const filename = application.filename.toLowerCase().endsWith('.json') ? application.filename : `${application.filename}.json`;
  try {
    await fs.access(path.join('friends', filename));
    return '申请文件名已经被占用，请换一个文件名后重新提交。';
  } catch {
    // The filename is available.
  }
  const html = await fetchPublicPage(application.friendPageUrl);
  if (!html) return '友链页无法访问，或响应不是可读取的公开页面。';
  if (!containsBacklink(html)) return `未在 ${application.friendPageUrl} 的静态 HTML 中找到 ${SITE_URL}。`;
  return null;
};

const writeFriendFile = async (application) => {
  const filename = application.filename.toLowerCase().endsWith('.json') ? application.filename : `${application.filename}.json`;
  const filePath = path.join('friends', filename);
  const data = {
    name: application.name,
    description: application.description,
    avatar: application.avatar,
    url: application.url,
  };
  await fs.writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  return filePath;
};

const alreadyExists = async (application) => {
  const files = await fs.readdir('friends');
  const targetUrl = normalizeUrl(application.url);
  for (const filename of files.filter((item) => item.endsWith('.json'))) {
    try {
      const data = JSON.parse(await fs.readFile(path.join('friends', filename), 'utf8'));
      if (normalizeUrl(data.url) === targetUrl || data.name?.trim().toLowerCase() === application.name.toLowerCase()) return true;
    } catch {
      /* build validation will report malformed source files */
    }
  }
  return false;
};

const processOpened = async () => {
  const issue = JSON.parse(process.env.ISSUE_PAYLOAD || '{}');
  if (!issue.number || !issue.title?.startsWith(ISSUE_PREFIX)) return;
  const comments = await api(`/issues/${issue.number}/comments?per_page=100`);
  if (comments.some((item) => item.body?.includes(INITIAL_MARKER))) return;
  await comment(
    issue.number,
    `${INITIAL_MARKER}\n\n## 友链申请已收到\n\n- **当前状态**：等待自动审核\n- **预计时间**：提交满 10 分钟后开始检查，通常在 10 至 15 分钟内处理\n- **检查内容**：友链页是否公开可访问，并在静态 HTML 中包含 D-blog 反链\n\n审核通过后，友链会自动加入本站；如果检查失败，bot 会在此 Issue 中说明原因并关闭申请。`,
  );
};

const processReview = async () => {
  const issues = await api('/issues?state=open&per_page=100');
  const now = Date.now();
  for (const issue of issues.filter((item) => !item.pull_request && item.title?.startsWith(ISSUE_PREFIX))) {
    if (now - Date.parse(issue.created_at) < WAIT_MS) continue;
    const comments = await api(`/issues/${issue.number}/comments?per_page=100`);
    if (comments.some((item) => item.body?.includes(ACCEPTED_MARKER) || item.body?.includes(REJECTED_MARKER))) continue;
    const application = parseApplication(issue.body);
    const error = application ? await validateApplication(application) : 'Issue 内容不完整，请使用本站生成的申请草稿。';
    if (error) {
      await comment(
        issue.number,
        `${REJECTED_MARKER}\n\n## 友链申请未通过\n\n- **审核结果**：未通过\n- **失败原因**：${error}\n- **Issue 状态**：已关闭\n\n请根据上面的原因修正友链页或申请资料，然后重新生成并提交新的 Issue。`,
      );
      await close(issue.number, 'not_planned');
      continue;
    }
    if (await alreadyExists(application)) {
      await comment(
        issue.number,
        `${ACCEPTED_MARKER}\n\n## 友链申请已处理\n\n- **审核结果**：站点已存在\n- **处理说明**：该站点已经在友链目录中，无需重复添加\n- **Issue 状态**：已关闭\n\n感谢申请。`,
      );
      await close(issue.number, 'completed');
      continue;
    }
    const filePath = await writeFriendFile(application);
    execFileSync('git', ['add', filePath]);
    execFileSync('git', [
      '-c',
      'user.name=github-actions[bot]',
      '-c',
      'user.email=41898282+github-actions[bot]@users.noreply.github.com',
      'commit',
      '-m',
      `feat: add friend link ${application.name} (#${issue.number})`,
    ]);
    execFileSync('git', ['push', 'origin', 'HEAD:main']);
    const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], {
      encoding: 'utf8',
    }).trim();
    await comment(
      issue.number,
      `${ACCEPTED_MARKER}\n\n## 友链申请已通过\n\n- **审核结果**：通过\n- **反链检查**：已找到 D-blog 反链\n- **添加文件**：\`${filePath}\`\n- **Commit**：\`${sha}\`\n- **Issue 状态**：已关闭\n\n友链将在下一次站点部署后显示。感谢申请！`,
    );
    await close(issue.number, 'completed');
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const mode = process.argv[2];
  if (mode === 'opened') await processOpened();
  else if (mode === 'review') await processReview();
  else throw new Error('Usage: node scripts/friend-link-bot.mjs <opened|review>');
}
