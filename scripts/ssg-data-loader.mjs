/**
 * SSG 数据加载：从 generated/ 读取 posts/shuoshuo 等构建期数据并做契约校验，供 ssg.mjs 渲染静态页面。
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const POSTS_FILE = path.join(__dirname, '../generated/posts.json');

/**
 * 与客户端 src/services/posts.ts 的 stripFrontmatter 保持一致的 frontmatter 剥离逻辑，
 * 确保构建期渲染的正文与浏览器端渲染的 markdown 源完全一致。
 */
const stripFrontmatter = (rawContent) => {
  const normalized = rawContent.charCodeAt(0) === 0xfeff ? rawContent.slice(1) : rawContent;
  return normalized.replace(/^---[\s\S]*?---[\r\n]*/, '');
};

/**
 * 读取 generated/posts.json，并把每篇文章的 markdown 正文（已剥离 frontmatter）
 * 挂到 content 字段上。数组顺序与客户端 getPosts() 一致（新 → 旧）。
 *
 * Phase 3 加固：
 * - posts.json 缺失/损坏 → 抛带明确指引的错误（由 ssg.mjs 顶层兜底记录退出）；
 * - 单篇文章源文件读取失败（被删除/权限）→ 跳过该文章的 content 注入而非抛错，
 *   剩余文章正常渲染（与生成期的 fail-closed 校验互补：生成期已保证文件存在，
 *   这里只是防御运行期间的极端竞态）。
 */
export const loadPostsWithContent = () => {
  let posts;
  try {
    posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8'));
  } catch (error) {
    throw new Error(
      `Failed to load generated/posts.json (${error instanceof Error ? error.message : String(error)}); run "npm run gen:data" before SSG.`,
    );
  }
  if (!Array.isArray(posts)) {
    throw new Error('generated/posts.json is malformed: expected an array; run "npm run gen:data" to regenerate.');
  }

  return posts.map((post) => {
    if (!post || typeof post !== 'object' || !post.filePath) {
      return post;
    }
    const sourcePath = path.join(__dirname, '..', post.filePath.replace(/^\//, ''));
    if (!fs.existsSync(sourcePath)) return post;
    try {
      const raw = fs.readFileSync(sourcePath, 'utf-8');
      return { ...post, content: stripFrontmatter(raw) };
    } catch {
      // 防御性：单篇读取失败跳过 content 注入，不中断整站渲染。
      return post;
    }
  });
};
