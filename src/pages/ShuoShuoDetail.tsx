import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { Seo, buildSiteSchemas } from '../components/Seo';
import { siteConfig } from '@config/site.config';
import { absoluteSiteUrl } from '@/utils/siteUrl';
import { getInitialShuoShuo } from '@/services/shuoshuo';
import type { ShuoShuo as ShuoShuoEntry } from '../types';
import { ShuoShuoItem } from '@/components/ShuoShuoItem';
import { ImageViewer } from '@/components/ImageViewer';
import { ShuoShuoShareModal } from '@/components/ShuoShuoShareModal';
import { NotFoundState } from '@/components/NotFoundState';
import { formatDate } from '@/utils/date';
import { stripMarkdown } from '@/utils/markdownText';
import { copyTextToClipboard } from '@/utils/clipboard';
import { useReducedMotion } from '@/hooks/useReducedMotion';

/**
 * 说说独立页：每条说说一个可索引的静态 URL /shuoshuo/<id>。
 * 与文章页同级输出完整 SEO（title/description/canonical/OG/Twitter/JSON-LD），
 * 让单条说说能被搜索引擎单独收录与搜索命中（此前只有 /shuoshuo 一个集合页）。
 */

/** 取说说正文首个非空行作为标题/h1（保持简洁，避免长标题被搜索引擎截断）。 */
const getTitleSnippet = (item: ShuoShuoEntry): string => {
  const firstLine = stripMarkdown(item.content)
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  const snippet = firstLine || item.date;
  return snippet.length > 40 ? `${snippet.slice(0, 40).trimEnd()}…` : snippet;
};

/** meta description：带作者与日期上下文，正文过长时截断（Google 摘要上限约 160 字）。 */
const getDescription = (item: ShuoShuoEntry): string => {
  const text = stripMarkdown(item.content).replace(/\s+/g, ' ').trim();
  const core = text.length > 120 ? `${text.slice(0, 120).trimEnd()}…` : text;
  return core
    ? `${siteConfig.author.name} 的说说（${item.date}）：${core}`
    : `${siteConfig.author.name} 于 ${item.date} 发布的一条说说`;
};

export const ShuoShuoDetail = () => {
  const { id } = useParams<{ id: string }>();
  const allItems = getInitialShuoShuo();
  const item = allItems.find((candidate) => candidate.id === id);
  const shouldReduceMotion = useReducedMotion();
  const [previewImage, setPreviewImage] = useState<{ src: string; alt?: string } | null>(null);
  const [shareTarget, setShareTarget] = useState<ShuoShuoEntry | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [autoCopied, setAutoCopied] = useState<boolean | null>(null);

  if (!item) {
    // 说说不存在：SPA 内以 200 响应返回该内容，必须 noindex，
    // 避免爬虫把已删除说说的 URL 视为可索引页面收录。
    return (
      <>
        <Seo title="未找到这条说说" description="你访问的说说不存在，可能已经删除或链接失效。" noindex />
        <NotFoundState
          title="未找到这条说说"
          description="这条说说可能已经被删除，或者链接地址已经发生变化。"
          debugLabel={`ShuoShuo ID: ${id || 'unknown'}`}
          backTo="/shuoshuo"
          backLabel="返回全部说说"
        />
      </>
    );
  }

  const snippet = getTitleSnippet(item);
  const description = getDescription(item);
  const shareImage = item.images && item.images.length > 0 ? item.images[0] : siteConfig.seoImage;

  const handleShare = async (target: ShuoShuoEntry) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : siteConfig.url;
    const url = absoluteSiteUrl(`/shuoshuo/${target.id}`, origin);

    setShareUrl(url);
    setShareTarget(target);
    setAutoCopied(null);

    const copied = await copyTextToClipboard(url);
    setAutoCopied(copied);
  };

  const structuredData = [
    ...buildSiteSchemas(description),
    {
      '@context': 'https://schema.org',
      // SocialMediaPosting 是 Article 的子类型，语义上最贴合「朋友圈式短动态」。
      '@type': 'SocialMediaPosting',
      headline: snippet,
      description,
      image: [absoluteSiteUrl(shareImage, siteConfig.url)],
      datePublished: item.date,
      author: {
        '@type': 'Person',
        name: siteConfig.author.name,
        url: siteConfig.social.github,
        email: siteConfig.social.rawEmail
      },
      articleBody: stripMarkdown(item.content),
      inLanguage: 'zh-CN',
      isPartOf: {
        '@type': 'WebSite',
        name: siteConfig.title,
        url: absoluteSiteUrl('/', siteConfig.url)
      },
      mainEntityOfPage: absoluteSiteUrl(`/shuoshuo/${item.id}`, siteConfig.url),
      publisher: {
        '@type': 'Organization',
        name: siteConfig.title,
        url: siteConfig.url,
        logo: {
          '@type': 'ImageObject',
          url: absoluteSiteUrl(siteConfig.logo, siteConfig.url)
        }
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: '首页', item: absoluteSiteUrl('/', siteConfig.url) },
        { '@type': 'ListItem', position: 2, name: '说说', item: absoluteSiteUrl('/shuoshuo', siteConfig.url) },
        { '@type': 'ListItem', position: 3, name: snippet, item: absoluteSiteUrl(`/shuoshuo/${item.id}`, siteConfig.url) }
      ]
    }
  ];

  return (
    <div className="mx-auto max-w-2xl pb-12 pt-6 md:pb-20 md:pt-10">
      <Seo
        title={`说说：${snippet}`}
        description={description}
        image={shareImage}
        url={`/shuoshuo/${item.id}`}
        type="article"
        publishedTime={item.date}
        structuredData={structuredData}
      />

      <nav aria-label="Breadcrumb" className="mb-6 flex min-w-0 items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        <Link to="/" className="inline-flex items-center gap-1 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300">
          <ArrowLeft size={13} />
          首页
        </Link>
        <ChevronRight size={11} aria-hidden="true" />
        <Link to="/shuoshuo" className="transition-colors hover:text-zinc-700 dark:hover:text-zinc-300">
          说说
        </Link>
        <ChevronRight size={11} aria-hidden="true" />
        <span className="truncate" aria-current="page">{snippet}</span>
      </nav>

      <header className="mb-8 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          <MessageCircle size={14} aria-hidden="true" />
          ShuoShuo · Moments
        </p>
        <h1 className="font-serif text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-4xl">
          {snippet}
        </h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          <time dateTime={item.date}>
            {formatDate(item.date, 'zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })}
          </time>
          {' · '}
          {siteConfig.author.name}
        </p>
      </header>

      <ol className="relative space-y-8">
        <span aria-hidden="true" className="absolute bottom-2 left-5 top-2 w-px bg-zinc-200 dark:bg-zinc-800" />
        <ShuoShuoItem
          item={item}
          onPreview={(src, alt) => setPreviewImage({ src, alt })}
          onShare={handleShare}
          showDetailLink={false}
          shouldReduceMotion={shouldReduceMotion}
        />
      </ol>

      <div className="mt-12 border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <Link
          to="/shuoshuo"
          className="inline-flex items-center gap-1.5 rounded-control px-2.5 py-1.5 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 active:scale-[0.98] dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 dark:focus-visible:outline-zinc-100"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          返回全部说说
        </Link>
      </div>

      {previewImage && (
        <ImageViewer src={previewImage.src} alt={previewImage.alt} onClose={() => setPreviewImage(null)} />
      )}

      {shareTarget && (
        <ShuoShuoShareModal
          isOpen={Boolean(shareTarget)}
          onClose={() => setShareTarget(null)}
          url={shareUrl}
          contentPreview={stripMarkdown(shareTarget.content)}
          date={shareTarget.date}
          autoCopied={autoCopied}
        />
      )}
    </div>
  );
};
