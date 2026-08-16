/**
 * 将 Markdown 文本转换为纯文本。
 *
 * 用途：JSON-LD Article 的 articleBody 字段应使用无格式文本，直接内嵌原始
 * Markdown（#、**、``` 等）会降低结构化数据的语义质量，影响富媒体结果展示。
 * 这里只做轻量标记剥离：保留段落结构与链接/图片的文字内容，
 * 不引入完整 Markdown 解析器（文章正文渲染仍由 react-markdown 负责）。
 */
export const stripMarkdown = (markdown: string): string => {
  let text = markdown
    // 代码块整体替换为占位空行（代码对读者/搜索价值低于可读正文）
    .replace(/```[\s\S]*?```/g, ' ')
    // 行内代码 `code` → code
    .replace(/`([^`]*)`/g, '$1')
    // 图片 ![alt](url) → alt 文字（URL 段支持一层嵌套括号，如维基百科链接）
    .replace(/!\[([^\]]*)\]\((?:[^()]|\([^)]*\))*\)/g, '$1')
    // 链接 [text](url) → text（同上）
    .replace(/\[([^\]]*)\]\((?:[^()]|\([^)]*\))*\)/g, '$1')
    // 标题符号 # 与列表符号 - * + 数字.
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+[.)]\s+/gm, '')
    // 粗体/斜体（注意先处理双符号，避免单符号吞掉双符号）
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    // 下划线斜体仅在两侧非单词字符时剥离：避免吞掉 snake_case 标识符
    // （如 my_variable_name / MAX_BUFFER_SIZE 中的下划线）。
    .replace(/(?<!\w)_([^_]+)_(?!\w)/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    // 删除线/脚注等残余标记
    .replace(/~~([^~]*)~~/g, '$1')
    // HTML 标签（原始 markdown 里的内嵌标签）
    .replace(/<[^>]*>/g, ' ')
    // 多余空白归一化
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // articleBody 属长文本：截断到合理长度，避免超大 JSON-LD 拖慢首字节。
  const MAX_ARTICLE_BODY_CHARS = 6000;
  if (text.length > MAX_ARTICLE_BODY_CHARS) {
    text = `${text.slice(0, MAX_ARTICLE_BODY_CHARS).trimEnd()}…`;
  }
  return text;
};
