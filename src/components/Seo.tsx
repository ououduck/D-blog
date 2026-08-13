import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { siteConfig } from '@config/site.config';
import { absoluteSiteUrl, getSiteBasePath } from '@/utils/siteUrl';

type StructuredData = Record<string, unknown> | Array<Record<string, unknown>>;

interface SeoProps {
  title: string;
  description?: string;
  image?: string;
  imageWidth?: number;
  imageHeight?: number;
  url?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  authors?: string[];
  section?: string;
  tags?: string[];
  keywords?: string;
  structuredData?: StructuredData;
  noindex?: boolean;
}

const toAbsoluteUrl = (value?: string) => absoluteSiteUrl(value, siteConfig.url, getSiteBasePath());

// canonical 只保留影响页面内容的查询参数，丢弃搜索/分页/排序等衍生 UI 状态。
// 规则：
// - category / tag / q：内容型筛选参数，保留其 canonical，让筛选页自指而非指向无参版，
//   避免 Google 将真实内容页当作首页/列表页的软重复内容合并掉；
// - page：非首页页码自指（同一内容在不同页），首页无参（避免 canonical 抖动）；
// - sort / 其余：纯 UI 偏好，同一批内容，一律丢弃，统一归并。
const CANONICAL_QUERY_PARAMS = new Set(['category', 'tag', 'q']);

const buildCanonicalPath = (value: string) => {
  const withoutHash = value.split('#', 1)[0] || '/';
  const queryIndex = withoutHash.indexOf('?');
  const pathname = queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex) || '/';
  const query = queryIndex === -1 ? '' : withoutHash.slice(queryIndex + 1);
  if (!query) {
    return pathname;
  }

  // 只保留影响页面内容的参数（如分类筛选），并按固定顺序归一化：
  // 丢弃空值与重复值，避免同一页产生多条 canonical 或 canonical 抖动。
  const params = new URLSearchParams(query);
  const kept: string[] = [];
  CANONICAL_QUERY_PARAMS.forEach((key) => {
    const uniqueValues = Array.from(new Set(params.getAll(key))).filter((value) => value.trim() !== '');
    uniqueValues.forEach((paramValue) => {
      kept.push(`${key}=${encodeURIComponent(paramValue)}`);
    });
  });
  // 页码大于 1 时保留 page 参数（首页第 1 页不带参，避免 canonical 在 / 与 /?page=1 间抖动）。
  const pageValue = params.get('page');
  if (pageValue && pageValue !== '1') {
    kept.push(`page=${encodeURIComponent(pageValue)}`);
  }
  return kept.length ? `${pathname}?${kept.join('&')}` : pathname;
};

const hasSearchParam = (value: string) => {
  const withoutHash = value.split('#', 1)[0];
  const queryIndex = withoutHash.indexOf('?');
  if (queryIndex === -1) {
    return false;
  }
  return new URLSearchParams(withoutHash.slice(queryIndex + 1)).has('q');
};

/**
 * 全站级 WebSite + Organization 结构化数据。
 * Google 建议站点级 schema 在各页重复出现：文章页在传入自定义 structuredData
 * 后仍需带上这两条（publisher 里的 Organization 是独立实体，互不影响）。
 * 导出供文章页等自定义 schema 的页面合并使用。
 */
const buildSiteSchemas = (description: string): Array<Record<string, unknown>> => [
  {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: siteConfig.title,
    alternateName: siteConfig.subtitle,
    description,
    url: toAbsoluteUrl('/'),
    inLanguage: 'zh-CN',
    publisher: {
      '@type': 'Organization',
      name: siteConfig.title,
      url: toAbsoluteUrl('/'),
      logo: {
        '@type': 'ImageObject',
        url: toAbsoluteUrl(siteConfig.logo)
      }
    },
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${toAbsoluteUrl('/')}?q={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  },
  {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteConfig.title,
    alternateName: siteConfig.subtitle,
    url: toAbsoluteUrl('/'),
    logo: {
      '@type': 'ImageObject',
      url: toAbsoluteUrl(siteConfig.logo)
    },
    email: siteConfig.social.rawEmail,
    sameAs: [siteConfig.social.github]
  }
];

const withBaseUrls = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(withBaseUrls);
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    ['url', 'image', 'logo', 'mainEntityOfPage', 'item'].includes(key) && typeof entry === 'string'
      ? toAbsoluteUrl(entry)
      : withBaseUrls(entry)
  ]));
};

const stringifyJsonLd = (value: StructuredData | Record<string, unknown>) => JSON.stringify(value)
  .replace(/</g, '\\u003c')
  .replace(/>/g, '\\u003e')
  .replace(/&/g, '\\u0026')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');

export { buildSiteSchemas };
export const Seo: React.FC<SeoProps> = ({
  title,
  description = siteConfig.description,
  image = siteConfig.seoImage,
  imageWidth = 1200,
  imageHeight = 630,
  url,
  type = 'website',
  publishedTime,
  modifiedTime,
  authors = [],
  section,
  tags = [],
  keywords,
  structuredData,
  noindex = false
}) => {
  const location = useLocation();
  const resolvedUrl = url ?? location.pathname + location.search;
  // 首页使用带关键词的站点级标题（大厂站标配：品牌 + 一句话定位），
  // 其余页面统一为「页面名 - D-blog」格式。
  const fullTitle = title === siteConfig.title
    ? (siteConfig.seoHomeTitle || siteConfig.title)
    : `${title} - ${siteConfig.title}`;
  const isSearchVariant = hasSearchParam(resolvedUrl);
  const canonicalUrl = toAbsoluteUrl(buildCanonicalPath(resolvedUrl || '/'));
  const imageUrl = toAbsoluteUrl(image);
  const schema = structuredData
    ? (Array.isArray(structuredData) ? structuredData : [structuredData]).map(withBaseUrls) as Array<Record<string, unknown>>
    : buildSiteSchemas(description);

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="author" content={siteConfig.author.name} />
      <meta key="robots" name="robots" content={noindex || isSearchVariant ? 'noindex,follow' : 'index,follow,max-image-preview:large'} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link key="canonical" rel="canonical" href={canonicalUrl} />
      {/* hreflang 自引用：声明页面语言目标（zh-CN），谷歌据此处理语言与地区意图。
          全站单语言站点按 Google 官方建议加 x-default 与语言自引用。 */}
      <link rel="alternate" hrefLang="zh-CN" href={canonicalUrl} />
      <link rel="alternate" hrefLang="x-default" href={canonicalUrl} />
      <link rel="alternate" type="application/rss+xml" title={`${siteConfig.title} RSS`} href={toAbsoluteUrl('/feed.xml')} />

      <meta property="og:locale" content="zh_CN" />
      <meta property="og:site_name" content={siteConfig.title} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:alt" content={fullTitle} />
      {/* 显式声明分享图尺寸：社交平台抓取时可立即按比例裁剪展示，避免二次探测请求 */}
      <meta property="og:image:width" content={String(imageWidth)} />
      <meta property="og:image:height" content={String(imageHeight)} />
      <meta property="og:url" content={canonicalUrl} />
      {type === 'article' && publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {type === 'article' && modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
      {type === 'article' && authors.map((author) => <meta key={author} property="article:author" content={author} />)}
      {type === 'article' && section && <meta property="article:section" content={section} />}
      {type === 'article' && tags.map((tag) => <meta key={tag} property="article:tag" content={tag} />)}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:image:alt" content={fullTitle} />
      <meta name="twitter:url" content={canonicalUrl} />

      {schema.length > 0 && (
        <script type="application/ld+json">{stringifyJsonLd(schema.length === 1 ? schema[0] : schema)}</script>
      )}
    </Helmet>
  );
};

