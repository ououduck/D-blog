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

export interface ClarityMetricRow {
  [key: string]: string | number | null;
}

export interface ClarityMetric {
  metricName: string;
  information: ClarityMetricRow[];
}

export interface ClaritySnapshot {
  enabled: boolean;
  fetchedAt: string | null;
  request: {
    numOfDays: number;
    dimensions: string[];
  };
  metrics: ClarityMetric[];
  error: string | null;
}
