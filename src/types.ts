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

export interface ImageAssetVariant {
  url: string;
  width: number;
}

export interface ImageAsset {
  url: string;
  source: string;
  width?: number;
  height?: number;
  variants: {
    webp: ImageAssetVariant[];
    fallback: ImageAssetVariant[];
  };
}

export interface ImageAssetManifest {
  version: number;
  assets: Record<string, ImageAsset>;
}

export interface ResponsiveImageProps {
  srcSet?: string;
  sources?: Array<{
    srcSet: string;
    type?: string;
    media?: string;
    sizes?: string;
  }>;
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

