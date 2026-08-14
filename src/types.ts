export interface PostAuthor {
  name: string;
  avatar?: string;
  role?: string;
  bio?: string;
  url?: string;
}

export interface ImageDimensions {
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
}

/** 说说（短动态）：类似朋友圈的一句话内容，正文为 Markdown，images 为可选九宫格图片。 */
export interface ShuoShuo {
  id: string;
  date: string;
  images?: string[];
  content: string;
  filePath: string;
}

