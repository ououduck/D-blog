import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { fileURLToPath } from 'url';

// 获取当前文件路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 配置路径
// 假设脚本在 /scripts 目录，Markdown 在 /posts 目录
const POSTS_DIR = path.join(__dirname, '../posts');
// 输出到 src/generated 目录
const OUTPUT_DIR = path.join(__dirname, '../src/generated');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'posts.json');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// 扫描 Markdown 文件
// 过滤出 .md 文件
const files = fs.readdirSync(POSTS_DIR).filter(file => file.endsWith('.md'));

const posts = files.map(filename => {
  const filePath = path.join(POSTS_DIR, filename);
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  
  // 解析 Frontmatter (--- ... ---)
  const { data } = matter(fileContent);

  // 如果 Frontmatter 里没写 id，就用文件名(去掉后缀)作为 id
  const id = data.id || filename.replace(/\.md$/, '');

  return {
    ...data,
    id,
    // 生成前端 import 相对路径，供 import.meta.glob 使用
    // 注意：这里的路径是相对于 /posts 文件夹的
    filePath: `/posts/${filename}`
  };
});

// 按日期降序排序 (最新的在前面)
posts.sort((a, b) => new Date(b.date) - new Date(a.date));

// 写入 JSON 文件
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(posts, null, 2));

console.log(`✅ [Generate] 成功生成文章列表，共 ${posts.length} 篇`);
console.log(`📂 [Generate] 输出路径: ${OUTPUT_FILE}`);