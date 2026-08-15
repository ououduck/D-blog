/**
 * Markdown 文本的共享纯逻辑（客户端与构建脚本共用，保证两端处理一致）。
 * 与 headings-core.mjs 同级的模块：不依赖 React/DOM，Node 与浏览器均可运行。
 */

/**
 * 剥离 Markdown 的 YAML frontmatter（含 UTF-8 BOM 容错）。
 * 客户端（src/services/posts.ts）与构建脚本（scripts/ssg-data-loader.mjs）
 * 共用同一实现，确保构建期渲染的正文与浏览器端渲染的 Markdown 源完全一致。
 * @param {string} rawContent 原始 Markdown 内容。
 * @returns {string} 剥离 frontmatter 后的正文。
 */
export const stripFrontmatter = (rawContent) => {
  const normalized = rawContent.charCodeAt(0) === 0xfeff ? rawContent.slice(1) : rawContent;
  return normalized.replace(/^---[\s\S]*?---[\r\n]*/, '');
};
