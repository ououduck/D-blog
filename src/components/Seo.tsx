import React from 'react';
import { Helmet } from 'react-helmet-async';
import { siteConfig } from '@config/site.config';

interface SeoProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
}

export const Seo: React.FC<SeoProps> = ({
  title,
  description = siteConfig.description,
  image = siteConfig.seoImage,
  url = typeof window !== 'undefined' ? window.location.href : '',
  type = 'website'
}) => {
  const siteTitle = `${siteConfig.title} | ${siteConfig.author.name}`;
  const fullTitle = title === siteConfig.title ? siteTitle : `${title} - ${siteTitle}`;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />

      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
};