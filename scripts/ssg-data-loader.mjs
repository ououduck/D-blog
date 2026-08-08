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
 */
export const loadPostsWithContent = () => {
  const posts = JSON.parse(fs.readFileSync(POSTS_FILE, 'utf-8'));
  return posts.map((post) => {
    if (!post.filePath) return post;
    const sourcePath = path.join(__dirname, '..', post.filePath.replace(/^\//, ''));
    if (!fs.existsSync(sourcePath)) return post;
    const raw = fs.readFileSync(sourcePath, 'utf-8');
    return { ...post, content: stripFrontmatter(raw) };
  });
};
