import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SeoProps {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article';
}

export const Seo: React.FC<SeoProps> = ({ 
  title, 
  description = "跑路的duck的技术分享和生活随笔", 
  image = "https://aliyun-oss.pldduck.com/logo.png", 
  url = window.location.href,
  type = 'website' 
}) => {
  const siteTitle = "D-blog | 跑路的duck";
  const fullTitle = title === "D-blog" ? siteTitle : `${title} - ${siteTitle}`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      
      {/* Open Graph / Facebook / WeChat */}
      <meta property="og:type" content={type} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
    </Helmet>
  );
};
