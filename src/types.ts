/**
 * 全站共享数据类型：文章（Post/PostMetadata/PostAuthor）、友链（Friend）
 * 与说说（ShuoShuo）。数据源为构建期生成的 JSON（generated/*），
 * 客户端数据层（services/*）按本文件契约读写。
 */
export interface PostAuthor {
  name: string;
  avatar?: string;
  role?: string;
  bio?: string;
  url?: string;
}

interface ImageDimensions {
  width: number;
  height: number;
}

export interface PostMetadata {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  updatedAt?: string;
  authors?: PostAuthor[];
  tags: string[];
  category: string;
  filePath: string;
  searchText?: string;
  coverImage?: string;
  coverWidth?: number;
  coverHeight?: number;
  imageDimensions?: Record<string, ImageDimensions>;
  readTime: string;
  wordCount?: number;
  /** Giscus 评论数：构建期快照（generated/posts.json 注入），无数据时为 undefined（页面不展示）。 */
  commentCount?: number;
  featured?: boolean;
  'featured-top'?: number;
  series?: boolean;
  seriesName?: string;
  seriesOrder?: number;
}

export interface Post extends PostMetadata {
  content: string;
}

export interface Friend {
  name: string;
  description: string;
  avatar: string;
  url: string;
  /** 已失联标记：由友链可用状态检查 Action 自动维护，true 时在友链页归入「已失联的博客」板块。 */
  unavailable?: boolean;
}

/** 说说（短动态）：类似朋友圈的一句话内容，正文为 Markdown，images 为可选九宫格图片。 */
export interface ShuoShuo {
  id: string;
  date: string;
  images?: string[];
  content: string;
  filePath: string;
}
