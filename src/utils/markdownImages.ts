/**
 * Markdown 图片引用提取（轻量正则）：供说说正文把 ![alt](src "title") 转换为
 * 统一画廊数据。与构建端 parseMarkdownImages 的口径差异可接受：说说正文短、
 * 图片语法简单，仅用于预览导航，不参与统计/校验。
 */

export interface MarkdownImageRef {
  src: string;
  alt?: string;
  title?: string;
}

// ![alt](src) / ![alt](src "title") / ![alt](src 'title')；src 不含空白（Markdown 规范）。
const IMAGE_PATTERN = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+["']([^"']*)["'])?\)/g;

/** 提取 Markdown 正文中的全部图片引用（按文档顺序）。 */
export const extractMarkdownImages = (markdown: string): MarkdownImageRef[] => {
  if (!markdown) {
    return [];
  }
  const images: MarkdownImageRef[] = [];
  for (const match of markdown.matchAll(IMAGE_PATTERN)) {
    const src = match[2];
    if (!src) {
      continue;
    }
    images.push({
      src,
      alt: match[1] || undefined,
      title: match[3] || undefined,
    });
  }
  return images;
};
