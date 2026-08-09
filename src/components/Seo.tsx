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

// canonical 只保留影响页面内容的查询参数（如分类筛选），
// 丢弃搜索/分页/排序等衍生 UI 状态，避免软重复内容与 canonical 抖动。
const CANONICAL_QUERY_PARAMS = new Set(['category']);

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

export const Seo: React.FC<SeoProps> = ({
  title,
  description = siteConfig.description,
  image = siteConfig.seoImage,
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
  const fullTitle = title === siteConfig.title ? siteConfig.title : `${title} - ${siteConfig.title}`;
  const isSearchVariant = hasSearchParam(resolvedUrl);
  const canonicalUrl = toAbsoluteUrl(buildCanonicalPath(resolvedUrl || '/'));
  const imageUrl = toAbsoluteUrl(image);
  const schema = structuredData
    ? (Array.isArray(structuredData) ? structuredData : [structuredData]).map(withBaseUrls) as Array<Record<string, unknown>>
    : type === 'website'
      ? [{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: siteConfig.title,
          alternateName: siteConfig.subtitle,
          description,
          url: toAbsoluteUrl('/'),
          inLanguage: 'zh-CN',
          potentialAction: {
            '@type': 'SearchAction',
            target: {
              '@type': 'EntryPoint',
              urlTemplate: `${toAbsoluteUrl('/')}?q={search_term_string}`
            },
            'query-input': 'required name=search_term_string'
          }
        }, {
          // 全站 Organization 实体：Google 建议站点级 schema 在各页重复出现，
          // 文章页的 publisher 是独立 Organization 实体，两者互不影响。
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
        }]
      : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta key="robots" name="robots" content={noindex || isSearchVariant ? 'noindex,follow' : 'index,follow,max-image-preview:large'} />
      {keywords && <meta name="keywords" content={keywords} />}
      <link key="canonical" rel="canonical" href={canonicalUrl} />
      <link rel="alternate" type="application/rss+xml" title={`${siteConfig.title} RSS`} href={toAbsoluteUrl('/feed.xml')} />

      <meta property="og:locale" content="zh_CN" />
      <meta property="og:site_name" content={siteConfig.title} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:image:alt" content={fullTitle} />
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

