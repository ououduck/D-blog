export interface PostMetadata {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  tags: string[];
  category: string;
  coverImage?: string;
  readTime: string;
  featured?: boolean;
  top?: number; // 0 or undefined means no pin, 1 is highest priority, 2 is second, etc.
}

export interface Post extends PostMetadata {
  content: string;
}

export type Theme = 'light' | 'dark';

export interface RouteState {
  isPageLoading: boolean;
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
