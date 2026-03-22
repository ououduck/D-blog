import React from 'react';
import { Helmet } from 'react-helmet-async';
import { siteConfig } from '@config/site.config';

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
  structuredData?: StructuredData;
  noindex?: boolean;
}

const toAbsoluteUrl = (value?: string) => {
  if (!value) {
    return siteConfig.url;
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return new URL(value.startsWith('/') ? value : `/${value}`, siteConfig.url).toString();
};

export const Seo: React.FC<SeoProps> = ({
  title,
  description = siteConfig.description,
  image = siteConfig.seoImage,
  url = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/',
  type = 'website',
  publishedTime,
  modifiedTime,
  authors = [],
  structuredData,
  noindex = false
}) => {
  const siteTitle = `${siteConfig.title} | ${siteConfig.author.name}`;
  const fullTitle = title === siteConfig.title ? siteTitle : `${title} - ${siteTitle}`;
  const canonicalUrl = toAbsoluteUrl(url);
  const imageUrl = toAbsoluteUrl(image);
  const schema = structuredData
    ? Array.isArray(structuredData)
      ? structuredData
      : [structuredData]
    : type === 'website'
      ? [{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: siteConfig.title,
          alternateName: siteConfig.subtitle,
          description,
          url: siteConfig.url,
          inLanguage: 'zh-CN'
        }]
      : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large'} />
      <link rel="canonical" href={canonicalUrl} />
      <link rel="alternate" type="application/rss+xml" title={`${siteConfig.title} RSS`} href={`${siteConfig.url}/feed.xml`} />

      <meta property="og:locale" content="zh_CN" />
      <meta property="og:site_name" content={siteConfig.title} />
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={imageUrl} />
      <meta property="og:url" content={canonicalUrl} />
      {type === 'article' && publishedTime && <meta property="article:published_time" content={publishedTime} />}
      {type === 'article' && modifiedTime && <meta property="article:modified_time" content={modifiedTime} />}
      {type === 'article' && authors.map((author) => <meta key={author} property="article:author" content={author} />)}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={imageUrl} />
      <meta name="twitter:url" content={canonicalUrl} />

      {schema.length > 0 && (
        <script type="application/ld+json">{JSON.stringify(schema.length === 1 ? schema[0] : schema)}</script>
      )}
    </Helmet>
  );
};

