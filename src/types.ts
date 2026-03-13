export interface PostMetadata {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  tags: string[];
  category: string;
  filePath: string;
  coverImage?: string;
  readTime: string;
  featured?: boolean;
  top?: number;
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

export interface CloudflareAnalyticsData {
  requests: number;
  pageViews: number;
  uniques: number;
  bandwidth: number;
}

export interface CloudflareTopItem {
  path: string;
  requests: number;
  pageViews: number;
}

export interface CloudflareCountryItem {
  country: string;
  requests: number;
}

export interface CloudflareTimeWindow {
  days: number;
  data: CloudflareAnalyticsData;
  topPages: CloudflareTopItem[];
  topCountries: CloudflareCountryItem[];
  error: string | null;
}

export interface CloudflareSnapshot {
  enabled: boolean;
  fetchedAt: string | null;
  domain: string;
  timeWindows: CloudflareTimeWindow[];
}
