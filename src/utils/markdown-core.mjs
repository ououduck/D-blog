/**
 * Markdown 文本的共享纯逻辑（客户端与构建脚本共用，保证两端处理一致）。
 * 与 headings-core.mjs 同级的模块：不依赖 React/DOM，Node 与浏览器均可运行。
 */

/**
 * 剥离 Markdown 的 YAML frontmatter（含 UTF-8 BOM 容错）。
 * 客户端（src/services/posts.ts）与构建脚本（scripts/ssg-data-loader.mjs）
 * 共用同一实现，确保构建期渲染的正文与浏览器端渲染的 Markdown 源完全一致。
 *
 * 分隔语义与 gray-matter 对齐：开/闭分隔符必须独立成行（行首 ---），
 * 允许空 frontmatter（--- 后紧跟 ---）。原实现用 `[\s\S]*?---` 会让
 * frontmatter 内嵌的 ---（YAML 块标量缩进行、值行中的 ---）被误判为闭
 * 分隔符，导致正文截断，且与构建期 gray-matter 解析（generate-site-data）
 * 的结果分裂（页面正文被截断、检索索引/llms 保留完整正文）。
 * @param {string} rawContent 原始 Markdown 内容。
 * @returns {string} 剥离 frontmatter 后的正文。
 */
export const stripFrontmatter = (rawContent) => {
  const normalized = rawContent.charCodeAt(0) === 0xfeff ? rawContent.slice(1) : rawContent;
  return normalized.replace(/^---[ \t]*(?:\r?\n)(?:[\s\S]*?\r?\n)?---(?:\r?\n)*/, '');
};
