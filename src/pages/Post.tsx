import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { easeOut } from '@/utils/motion';
import DOMPurify from 'dompurify';

import { ArrowLeft, ArrowRight, Clock, Calendar, ChevronRight, Shield, Share2, Copy, Check, Users, ExternalLink } from 'lucide-react';
import { getPostById, getPosts } from '@/services/posts';
import { Post as PostType, PostAuthor, PostMetadata } from '../types';
import { siteConfig } from '@config/site.config';
import { Seo } from '../components/Seo';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { NotFoundState } from '@/components/NotFoundState';
import { extractMarkdownHeadings, extractTextFromReactNode, slugifyHeading } from '@/utils/headings';
import type { MarkdownHeading } from '@/utils/headings';
import { formatDate } from '@/utils/date';


type BlockCodeProps = {
  isBlock?: boolean;
};

type MarkdownPlugin = unknown;

type MermaidRenderer = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, text: string) => Promise<{ svg: string }>;
};

const MERMAID_CONFIG = {
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#f97316',
    primaryTextColor: '#fff',
    primaryBorderColor: '#ea580c',
    lineColor: '#71717a',
    secondaryColor: '#27272a',
    tertiaryColor: '#18181b'
  }
} as const;

const hasCodeBlocks = (content: string) => /^```[\w-]*[\s\S]*?^```/m.test(content);
const hasMathExpressions = (content: string) => /\$\$[\s\S]*?\$\$|\\\(|\\\[/m.test(content);
const hasMermaidDiagrams = (content: string) => /```mermaid\b/.test(content);

const formatMetaDate = (dateText?: string) => {
  if (!dateText) {
    return '';
  }

  return formatDate(dateText, 'zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

const getDisplayAuthors = (post: PostType): PostAuthor[] => {
  if (post.authors && post.authors.length > 0) {
    return post.authors;
  }

  return [
    {
      name: siteConfig.author.name,
      avatar: siteConfig.author.avatar,
      role: siteConfig.author.role,
      bio: siteConfig.author.bio
    }
  ];
};

const ImageViewer = lazy(() => import('../components/ImageViewer').then((m) => ({ default: m.ImageViewer })));
const ShareModal = lazy(() => import('../components/ShareModal').then((m) => ({ default: m.ShareModal })));
const TableOfContents = lazy(() => import('../components/TableOfContents').then((m) => ({ default: m.TableOfContents })));
const ReadingProgressBadge = lazy(() => import('../components/ReadingProgressBadge').then((m) => ({ default: m.ReadingProgressBadge })));
const MAX_CODE_LINES = 30;

const extractLangFromChildren = (children: React.ReactNode): string | undefined => {
  const codeChild = React.Children.toArray(children).find(
    (child) => React.isValidElement(child) && typeof (child.props as Record<string, unknown>).className === 'string'
  ) as React.ReactElement | undefined;
  if (!codeChild) return undefined;
  const cls = (codeChild.props as Record<string, string>).className || '';
  const match = cls.match(/language-(\w+)/);
  return match ? match[1] : undefined;
};

const getLangDisplayName = (lang: string): string => {

  const langMap: Record<string, string> = {
    js: 'JavaScript', jsx: 'JSX', ts: 'TypeScript', tsx: 'TSX',
    py: 'Python', rb: 'Ruby', go: 'Go', rs: 'Rust',
    java: 'Java', kt: 'Kotlin', swift: 'Swift',
    html: 'HTML', css: 'CSS', scss: 'SCSS', json: 'JSON',
    yaml: 'YAML', yml: 'YAML', xml: 'XML', md: 'Markdown',
    sql: 'SQL', sh: 'Shell', bash: 'Bash', zsh: 'Zsh',
    dockerfile: 'Dockerfile', docker: 'Docker',
    graphql: 'GraphQL', gql: 'GraphQL',
    c: 'C', cpp: 'C++', cs: 'C#',
  };
  return langMap[lang] || lang;
};

const PreBlock = ({ children, ...props }: React.DetailedHTMLProps<React.HTMLAttributes<HTMLPreElement>, HTMLPreElement>) => {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);
  const resetTimerRef = useRef<number | null>(null);
  const lang = extractLangFromChildren(children);

  useEffect(() => {
    if (preRef.current) {
      const lineCount = (preRef.current.innerText.match(/\n/g) || []).length + 1;
      setNeedsExpand(lineCount > MAX_CODE_LINES);
    }
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, []);

  const markCopied = () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    setCopied(true);
    resetTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
  };

  const handleCopy = async () => {
    if (!preRef.current) return;
    const code = preRef.current.innerText.replace(/\n$/, '');
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
        markCopied();
        return;
      }
      throw new Error('Clipboard API not available');
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = code;
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        const ok = document.execCommand('copy');
        if (ok) markCopied();
      } catch { /* ignore */ }
      document.body.removeChild(textArea);
    }
  };

  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<BlockCodeProps>, { isBlock: true });
    }
    return child;
  });

  return (
    <div className="group relative my-5 md:my-6">
      {/* Language badge */}
      {lang && (
        <span className="code-lang-badge">{getLangDisplayName(lang)}</span>
      )}

      {/* Copy button */}
      <button
        type="button"
        onClick={handleCopy}
        className={`absolute z-10 rounded-lg p-2 backdrop-blur-sm transition-all ${
          lang ? 'right-3 top-3' : 'right-3 top-3'
        } ${
          copied
            ? 'bg-green-600/80 text-white'
            : 'bg-zinc-700/80 text-zinc-300 hover:bg-zinc-600/80 hover:text-white md:opacity-0 md:group-hover:opacity-100'
        }`}
        title={copied ? '已复制' : '复制代码'}
        aria-label={copied ? '已复制' : '复制代码'}
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>

      {/* Code block with optional collapse */}
      <div className="relative">
        <pre
          ref={preRef}
          {...props}
          className={`${props.className || ''} !my-0 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-600 touch-pan-x !p-3 !pt-10 md:!p-6 md:!pt-7 ${needsExpand && !isExpanded ? 'code-block-collapsed' : 'code-block-expanded'}`}
        >
          {childrenWithProps}
        </pre>

        {/* Expand/collapse overlay */}
        {needsExpand && !isExpanded && (
          <button
            onClick={() => setIsExpanded(true)}
            className="code-expand-btn"
            aria-label="展开完整代码"
          >
            展开完整代码
          </button>
        )}
        {needsExpand && isExpanded && (
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 rounded-full bg-zinc-700/80 px-3 py-1 text-xs text-zinc-300 backdrop-blur-sm hover:bg-zinc-600/80 hover:text-white"
            aria-label="折叠代码"
          >
            折叠
          </button>
        )}
      </div>
    </div>
  );
};

const MermaidBlock = ({ children, renderer }: { children: string; renderer: MermaidRenderer | null }) => {
  const [svg, setSvg] = useState('');
  const mermaidIdRef = useRef(`mermaid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`);

  useEffect(() => {
    if (!renderer) {
      setSvg('');
      return;
    }

    let cancelled = false;

    const renderDiagram = async () => {
      try {
        const { svg: renderedSvg } = await renderer.render(mermaidIdRef.current, children);
        if (!cancelled) {
          setSvg(renderedSvg);
        }
      } catch (error) {
        console.error('Mermaid render error:', error);
      }
    };

    void renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [children, renderer]);

  if (!renderer && !svg) {
    return (
      <pre className="my-8 overflow-x-auto rounded-2xl border border-zinc-800 bg-[#0d1117] p-4 text-sm text-zinc-300">
        <code>{children}</code>
      </pre>
    );
  }

  const sanitizedSvg = typeof DOMPurify !== 'undefined'
    ? DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } })
    : svg;

  return (
    <div className="my-8 flex justify-center overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div dangerouslySetInnerHTML={{ __html: sanitizedSvg }} />
    </div>
  );
};

const isSafeMarkdownHref = (href?: string) => {
  if (!href) {
    return false;
  }

  if (href.startsWith('#') || href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
    return true;
  }

  try {
    return ['http:', 'https:', 'mailto:'].includes(new URL(href).protocol);
  } catch {
    return false;
  }
};

const createMarkdownComponents = (
  onPreviewImage: (image: { src: string; alt?: string }) => void,
  mermaidRenderer: MermaidRenderer | null,
  headings: MarkdownHeading[]
): Components => {
  let headingCursor = 0;
  const fallbackHeadingIds = new Map<string, number>();

  const resolveHeadingId = (level: number, children: React.ReactNode) => {
    const rawText = extractTextFromReactNode(children);
    const text = rawText.trim();

    for (let index = headingCursor; index < headings.length; index += 1) {
      const heading = headings[index];
      if (heading.level === level && heading.rawText === text) {
        headingCursor = index + 1;
        return heading.id;
      }
    }

    for (const heading of headings) {
      if (heading.level === level && heading.rawText === text) {
        return heading.id;
      }
    }

    const fallbackBaseId = slugifyHeading(text) || 'section';
    const duplicateCount = (fallbackHeadingIds.get(fallbackBaseId) ?? 0) + 1;
    fallbackHeadingIds.set(fallbackBaseId, duplicateCount);
    return duplicateCount === 1 ? fallbackBaseId : `${fallbackBaseId}-${duplicateCount}`;
  };

  const handleHeadingClick = (id: string) => {
    if (typeof window === 'undefined') {
      return;
    }

    const url = new URL(window.location.href);
    url.hash = id;
    window.history.replaceState({}, '', url.toString());

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url.toString()).catch(() => {});
    }
  };

  const renderHeading = (level: number, Tag: string, { children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => {
    const id = resolveHeadingId(level, children);
    return React.createElement(
      Tag,
      { ...props, id, className: 'heading-anchor-wrapper' },
      React.createElement(
        'button',
        {
          type: 'button',
          className: 'heading-anchor',
          onClick: (e: React.MouseEvent) => { e.stopPropagation(); handleHeadingClick(id); },
          'aria-label': `复制标题链接：${extractTextFromReactNode(children)}`,
          title: '复制链接',
        },
        '#'
      ),
      children
    );
  };

  const isImageUrl = (url: string) => /\.(jpe?g|png|gif|webp|avif|svg|bmp|ico)(\?.*)?$/i.test(url);

  return {
    a: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
      const safeHref = isSafeMarkdownHref(href) ? href : undefined;

      if (safeHref && isImageUrl(safeHref)) {
        const imgAlt = React.Children.toArray(children)
          .map((child) => {
            if (React.isValidElement(child) && (child.props as Record<string, unknown>).alt) {
              return (child.props as Record<string, unknown>).alt as string;
            }
            return '';
          })
          .join('');
        return (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); onPreviewImage({ src: safeHref, alt: imgAlt || undefined }); }}
            className="block w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100"
            aria-label={imgAlt ? `预览图片：${imgAlt}` : '预览图片'}
          >
            {children}
          </button>
        );
      }

      if (!safeHref) {
        return <>{children}</>;
      }

      return <a href={safeHref} target="_blank" rel="noopener noreferrer" {...props}>{children}</a>;
    },
    img: ({ title, ...props }: React.ImgHTMLAttributes<HTMLImageElement>) => (
      <figure className="group/myimage my-8 md:my-12">
        <button
          type="button"
          onClick={() => onPreviewImage({ src: props.src || '', alt: props.alt })}
          className="relative block w-full overflow-hidden rounded-2xl border border-zinc-200/80 bg-zinc-100/70 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 dark:border-zinc-800/80 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:focus-visible:outline-zinc-100"
          aria-label={props.alt ? `预览图片：${props.alt}` : '预览图片'}
        >
          <ProgressiveImage
            {...props}
            loading="lazy"
            decoding="async"
            wrapperClassName="rounded-2xl"
            className="cursor-zoom-in rounded-2xl shadow-lg transition duration-500 group-hover/myimage:scale-[1.015]"
          />
          <span className="pointer-events-none absolute right-3 top-3 rounded-full border border-white/30 bg-black/45 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/90 opacity-0 shadow-lg backdrop-blur-md transition duration-300 group-hover/myimage:opacity-100 group-focus-visible/myimage:opacity-100">
            点击预览
          </span>
        </button>
        {(props.alt || title) && (
          <figcaption className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
            {props.alt || title}
          </figcaption>
        )}
      </figure>
    ),
    pre: PreBlock,
    table: ({ children, ...props }: React.TableHTMLAttributes<HTMLTableElement>) => (
      <div className="table-wrapper">
        <table {...props} className="min-w-full">
          {children}
        </table>
      </div>
    ),
    code: ({ className, children, ...props }) => {
      const { isBlock, ...restProps } = props as React.HTMLAttributes<HTMLElement> & BlockCodeProps;
      const isBlockCode = Boolean(isBlock) || /language-(\w+)/.test(className || '');

      if (className?.includes('language-mermaid')) {
        return <MermaidBlock renderer={mermaidRenderer}>{String(children)}</MermaidBlock>;
      }

      if (isBlockCode) {
        return (
          <code className={className} {...restProps}>
            {children}
          </code>
        );
      }

      return (
        <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-bold text-zinc-900 before:content-none after:content-none dark:bg-zinc-900 dark:text-zinc-100" {...restProps}>
          {children}
        </code>
      );
    },
    h1: ({ children, ...props }) => renderHeading(1, 'h2', { children, ...props }),
    h2: ({ children, ...props }) => renderHeading(2, 'h3', { children, ...props }),
    h3: ({ children, ...props }) => renderHeading(3, 'h4', { children, ...props }),
  };
};

export const Post = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [post, setPost] = useState<PostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt?: string } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [remarkPlugins, setRemarkPlugins] = useState<MarkdownPlugin[]>([remarkGfm]);
  const [rehypePlugins, setRehypePlugins] = useState<MarkdownPlugin[]>([]);
  const [mermaidRenderer, setMermaidRenderer] = useState<MermaidRenderer | null>(null);
  const [mobileFloatingVisible, setMobileFloatingVisible] = useState(false);
  const [adjacentPosts, setAdjacentPosts] = useState<{ prev: PostMetadata | null; next: PostMetadata | null }>({ prev: null, next: null });
  const articleBodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    window.scrollTo(0, 0);

    if (!id) {
      setPost(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setPost(null);

    getPostById(id)
      .then((data) => {
        if (cancelled) {
          return;
        }

        setPost(data || null);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.error('Failed to load post:', error);
        setPost(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!post?.content) {
      setRemarkPlugins([remarkGfm]);
      setRehypePlugins([]);
      setMermaidRenderer(null);
      return;
    }

    let cancelled = false;

    const loadMarkdownEnhancements = async () => {
      const nextRemarkPlugins: MarkdownPlugin[] = [remarkGfm];
      const nextRehypePlugins: MarkdownPlugin[] = [];
      let nextMermaidRenderer: MermaidRenderer | null = null;
      const tasks: Promise<void>[] = [];

      if (hasCodeBlocks(post.content)) {
        tasks.push((async () => {
          const isDark = document.documentElement.classList.contains('dark');
          const highlightCss = isDark ? import('highlight.js/styles/github-dark.css') : import('highlight.js/styles/github.css');

          const [{ default: rehypeHighlight }] = await Promise.all([
            import('rehype-highlight'),
            highlightCss
          ]);

          if (cancelled) return;
          nextRehypePlugins.push(rehypeHighlight);
        })());
      }

      if (hasMathExpressions(post.content)) {
        tasks.push((async () => {
          const [{ default: remarkMath }, { default: rehypeKatex }] = await Promise.all([
            import('remark-math'),
            import('rehype-katex'),
            import('katex/dist/katex.min.css')
          ]);

          nextRemarkPlugins.push(remarkMath);
          nextRehypePlugins.push(rehypeKatex);
        })());
      }

      if (hasMermaidDiagrams(post.content)) {
        tasks.push((async () => {
          const { default: mermaid } = await import('mermaid');
          mermaid.initialize(MERMAID_CONFIG);
          nextMermaidRenderer = mermaid as MermaidRenderer;
        })());
      }

      await Promise.all(tasks);

      if (cancelled) {
        return;
      }

      setRemarkPlugins(nextRemarkPlugins);
      setRehypePlugins(nextRehypePlugins);
      setMermaidRenderer(nextMermaidRenderer);
    };

    void loadMarkdownEnhancements();

    return () => {
      cancelled = true;
    };
  }, [post?.content]);

  const headings = useMemo(() => extractMarkdownHeadings(post?.content ?? ''), [post?.content]);

  useEffect(() => {
    if (!post?.content || headings.length === 0 || typeof window === 'undefined') {
      return;
    }

    const hashId = decodeURIComponent(window.location.hash.slice(1));

    if (!hashId) {
      return;
    }

    const scrollToHashHeading = () => {
      const element = document.getElementById(hashId);

      if (!element) {
        return;
      }

      window.scrollTo({
        top: Math.max(0, element.getBoundingClientRect().top + window.scrollY - 104),
        behavior: 'auto'
      });
    };

    const timeoutId = window.setTimeout(scrollToHashHeading, 0);
    return () => window.clearTimeout(timeoutId);
  }, [headings, post?.content]);

  // 加载相邻文章（上一篇/下一篇）
  useEffect(() => {
    if (!post) return;
    let cancelled = false;

    getPosts().then((allPosts) => {
      if (cancelled) return;
      const currentIndex = allPosts.findIndex((p) => p.id === post.id);
      setAdjacentPosts({
        prev: currentIndex > 0 ? allPosts[currentIndex - 1] : null,
        next: currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null,
      });
    });

    return () => { cancelled = true; };
  }, [post]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewImage) { setPreviewImage(null); return; }
        if (shareModalOpen) { setShareModalOpen(false); return; }
      }
      if (e.key === 'ArrowLeft' && e.altKey && adjacentPosts.prev) {
        navigate(`/post/${adjacentPosts.prev.id}`);
      }
      if (e.key === 'ArrowRight' && e.altKey && adjacentPosts.next) {
        navigate(`/post/${adjacentPosts.next.id}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage, shareModalOpen, adjacentPosts, navigate]);

  const markdownComponents = useMemo(
    () => createMarkdownComponents((image) => setPreviewImage(image), mermaidRenderer, headings),
    [mermaidRenderer, headings]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl pt-10">
        <div className="mb-16 text-center">
          <div className="mx-auto mb-10 h-6 w-24 overflow-hidden rounded-md shimmer-mask bg-zinc-200 dark:bg-zinc-800" />
          <div className="mx-auto mb-8 h-12 w-3/4 md:h-16 overflow-hidden rounded-lg shimmer-mask bg-zinc-200 dark:bg-zinc-800" />
          <div className="flex justify-center space-x-6">
            <div className="h-4 w-28 overflow-hidden rounded shimmer-mask bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-32 overflow-hidden rounded shimmer-mask bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-20 overflow-hidden rounded shimmer-mask bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>

        <div className="mb-20 aspect-[21/9] w-full overflow-hidden rounded-3xl shadow-sm shimmer-mask bg-zinc-200 dark:bg-zinc-800" />

        <div className="mx-auto max-w-3xl space-y-6 pb-32">
          <div className="h-5 w-full overflow-hidden rounded shimmer-mask bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-11/12 overflow-hidden rounded shimmer-mask bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-full overflow-hidden rounded shimmer-mask bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-4/5 overflow-hidden rounded shimmer-mask bg-zinc-200 dark:bg-zinc-800" />
          <div className="my-10 h-40 w-full overflow-hidden rounded-xl shimmer-mask bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-full overflow-hidden rounded shimmer-mask bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-5/6 overflow-hidden rounded shimmer-mask bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <NotFoundState
        title="未找到这篇文章"
        description="这篇文章可能还在草稿中、已经被删除，或者链接地址已经发生变化。"
        debugLabel={`Post ID: ${id || 'unknown'}`}
      />
    );
  }

  const authors = getDisplayAuthors(post);
  const authorsLabel = authors.map((author) => author.name).join('\u3001');
  const postStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage ? [new URL(post.coverImage, siteConfig.url).toString()] : [siteConfig.seoImage],
    datePublished: post.date,
    dateModified: post.updatedAt || post.date,
    author: authors.map((author) => ({
      '@type': 'Person',
      name: author.name,
      url: author.url
    })),
    mainEntityOfPage: `${siteConfig.url}/post/${post.id}`,
    publisher: {
      '@type': 'Organization',
      name: siteConfig.title,
      url: siteConfig.url,
      logo: {
        '@type': 'ImageObject',
        url: siteConfig.logo
      }
    },
    keywords: post.tags?.join(', ')
  };

  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首页', item: siteConfig.url },
      { '@type': 'ListItem', position: 2, name: post.category, item: `${siteConfig.url}/?category=${encodeURIComponent(post.category)}` },
      { '@type': 'ListItem', position: 3, name: post.title, item: `${siteConfig.url}/post/${post.id}` }
    ]
  };

  return (
    <>
      <Suspense fallback={null}>
        {previewImage && <ImageViewer src={previewImage.src} alt={previewImage.alt} onClose={() => setPreviewImage(null)} />}
        <ReadingProgressBadge targetRef={articleBodyRef} onVisibilityChange={setMobileFloatingVisible} />
        {headings.length > 0 && (
          <TableOfContents
            headings={headings}
            mobileShowTrigger={mobileFloatingVisible}
            desktopShowTrigger={headings.length > 0}
          />
        )}
      </Suspense>

      <article>

        <Seo
          title={post.title}
          description={post.excerpt}
          image={post.coverImage}
          url={`/post/${post.id}`}
          type="article"
          publishedTime={post.date}
          modifiedTime={post.updatedAt || post.date}
          authors={authors.map((author) => author.name)}
          section={post.category}
          tags={post.tags}
          keywords={post.tags?.join(', ')}
          structuredData={[postStructuredData, breadcrumbData]}
        />

        <header className="mx-auto mb-10 max-w-4xl pt-6 text-center md:mb-16 md:pt-10">
          <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-400 md:mb-6">
            <Link to="/" className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
              首页
            </Link>
            <ChevronRight size={14} className="text-zinc-300 dark:text-zinc-600" />
            <Link to={`/?category=${encodeURIComponent(post.category)}`} className="transition-colors hover:text-zinc-900 dark:hover:text-zinc-100">
              {post.category}
            </Link>
            <ChevronRight size={14} className="text-zinc-300 dark:text-zinc-600" />
            <span className="max-w-[14rem] truncate text-zinc-500 dark:text-zinc-400 md:max-w-xl">{post.title}</span>
          </nav>
          <Link to="/" className="group mb-6 inline-flex items-center text-xs font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:text-zinc-900 dark:hover:text-zinc-100 md:mb-10">
            <ArrowLeft size={16} className="mr-2 transition-transform group-hover:-translate-x-1" />
            返回文章
          </Link>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: 0.3, ease: easeOut }}>
            <div className="mb-8 flex flex-col items-center gap-4">
              <span className="rounded-full border border-zinc-200 bg-zinc-100 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-zinc-900 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">
                {post.category}
              </span>
            </div>

            <h1 className="mb-6 font-serif text-3xl font-bold leading-[1.2] text-ink dark:text-white md:mb-8 md:text-5xl lg:text-6xl">
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3 text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 md:gap-x-6">
              <span className="flex items-center">
                <Users size={14} className="mr-2" /> {authorsLabel}
              </span>
              <span className="hidden h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700 md:block" />
              <span className="flex items-center">
                <Calendar size={14} className="mr-2" /> 发布于 {formatMetaDate(post.date)}
              </span>
              {post.updatedAt && post.updatedAt !== post.date && (
                <>
                  <span className="hidden h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700 md:block" />
                  <span className="flex items-center">
                    <Calendar size={14} className="mr-2" /> 最后更新 {formatMetaDate(post.updatedAt)}
                  </span>
                </>
              )}
              <span className="hidden h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700 md:block" />
              <span className="flex items-center">
                <Clock size={14} className="mr-2" /> {post.readTime}
              </span>
              <span className="hidden h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700 md:block" />
              <button type="button" onClick={() => setShareModalOpen(true)} className="flex items-center transition-colors hover:text-zinc-900 dark:hover:text-zinc-100" aria-label={`分享文章：${post.title}`}>
                <Share2 size={14} className="mr-1.5" /> 分享
              </button>
            </div>
          </motion.div>
        </header>

        {post.coverImage && (
          <button type="button" className="mx-auto block w-full max-w-6xl px-4 md:px-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100" onClick={() => setPreviewImage({ src: post.coverImage, alt: post.title })} aria-label={`预览文章封面：${post.title}`}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.22, ease: easeOut }} className="mb-10 aspect-[4/3] cursor-zoom-in overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 sm:aspect-[16/9] md:mb-20 md:aspect-[21/9] md:rounded-3xl">
              <ProgressiveImage src={post.coverImage} alt={post.title} loading="eager" fetchPriority="high" width={1600} height={686} aspectRatio="21/9" sizes="(max-width: 767px) 100vw, (max-width: 1279px) 80vw, 1152px" wrapperClassName="h-full w-full" className="h-full w-full object-cover" />
            </motion.div>
          </button>
        )}

        <div ref={articleBodyRef} className="mx-auto flex max-w-4xl flex-col gap-4 px-2 pb-12 sm:max-w-5xl sm:gap-6 sm:px-4 md:max-w-6xl md:pb-16 lg:max-w-7xl lg:px-8 md:pb-24">
          <div className="flex-1 rounded-xl bg-white px-5 py-6 shadow-sm dark:bg-zinc-900 sm:rounded-2xl sm:px-8 sm:py-8 md:px-10 md:py-12 lg:px-12">
            <div className="prose prose-base mx-auto max-w-none prose-stone dark:prose-invert md:prose-lg
              prose-headings:scroll-mt-24 prose-headings:font-serif prose-headings:font-bold prose-headings:text-ink dark:prose-headings:text-white
              prose-h2:mb-6 prose-h2:mt-10 prose-h2:text-3xl md:prose-h2:mb-8 md:prose-h2:mt-14 md:prose-h2:text-5xl
              prose-h3:mb-4 prose-h3:mt-8 prose-h3:text-2xl md:prose-h3:mb-5 md:prose-h3:mt-10 md:prose-h3:text-3xl
              prose-h4:mb-3 prose-h4:mt-6 prose-h4:text-xl md:prose-h4:mb-4 md:prose-h4:mt-8 md:prose-h4:text-2xl
              prose-p:font-sans prose-p:text-[16px] md:prose-p:text-[18px] prose-p:leading-[1.85] md:prose-p:leading-[1.9]
              prose-a:break-words prose-a:font-semibold prose-a:decoration-zinc-300 prose-a:decoration-2 prose-a:underline-offset-[3px] hover:prose-a:decoration-zinc-900 hover:prose-a:underline-offset-[5px] dark:prose-a:decoration-zinc-700 dark:hover:prose-a:decoration-zinc-400
              prose-strong:font-bold prose-strong:text-ink dark:prose-strong:text-white
              prose-img:my-8 prose-img:h-auto prose-img:w-full prose-img:max-w-full prose-img:cursor-zoom-in prose-img:rounded-xl prose-img:shadow-lg hover:prose-img:scale-[1.005] dark:prose-img:rounded-2xl dark:prose-img:ring-1 dark:prose-img:ring-white/10 md:prose-img:my-12
              prose-blockquote:my-7 prose-blockquote:rounded-r-xl prose-blockquote:border-l-4 prose-blockquote:border-l-accent prose-blockquote:bg-accent/5 prose-blockquote:px-6 prose-blockquote:py-5 prose-blockquote:font-serif prose-blockquote:not-italic prose-blockquote:text-[16px] md:prose-blockquote:text-[18px] prose-blockquote:leading-[1.8] dark:prose-blockquote:border-l-accent dark:prose-blockquote:bg-accent/5 dark:prose-blockquote:text-zinc-200 md:prose-blockquote:my-9 md:prose-blockquote:rounded-r-2xl md:prose-blockquote:px-8 md:prose-blockquote:py-6
              prose-ul:my-6 prose-ul:space-y-2 md:prose-ul:my-8 md:prose-ul:space-y-3
              prose-ol:my-6 prose-ol:space-y-2 md:prose-ol:my-8 md:prose-ol:space-y-3
              prose-li:text-[16px] prose-li:leading-[1.85] md:prose-li:text-[18px] md:prose-li:leading-[1.9]
              prose-hr:my-10 prose-hr:border-zinc-200 dark:prose-hr:border-zinc-800 md:prose-hr:my-14
              prose-code:font-mono prose-code:text-[13px] prose-code:font-semibold md:prose-code:text-[14px]
              prose-pre:overflow-hidden prose-pre:rounded-xl prose-pre:border prose-pre:border-zinc-700/80 prose-pre:bg-[#0d1117] prose-pre:p-0 md:prose-pre:rounded-2xl
              dark:prose-body:text-zinc-300
            ">
              <ReactMarkdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={markdownComponents}
              >
                {post.content}
              </ReactMarkdown>
            </div>

            <div className="relative mt-16 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/70 md:mt-20 md:rounded-2xl md:p-8">
              <div className="absolute -right-6 -top-6 rotate-12 text-zinc-200 opacity-50 dark:text-zinc-800">
                <Shield size={120} strokeWidth={0.5} />
              </div>
              <div className="relative z-10 flex flex-col items-start gap-6 md:flex-row">
                <div className="flex-shrink-0">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-300">
                    <span className="font-serif text-xl font-bold">CC</span>
                  </div>
                </div>
                <div>
                  <h2 className="mb-2 text-lg font-serif font-bold text-ink dark:text-white">CC BY-SA 4.0 许可协议</h2>
                  <p className="mb-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    本文由 <strong className="text-ink dark:text-zinc-200">{authorsLabel}</strong> 原创。除非另有声明，本站文章采用
                    <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.zh" target="_blank" rel="noopener noreferrer" className="mx-1 font-medium text-zinc-900 hover:underline dark:text-zinc-100">
                      CC BY-SA 4.0
                    </a>
                    协议进行授权。
                  </p>
                  <div className="inline-block rounded-lg border border-zinc-200/50 bg-zinc-100 p-3 text-xs text-zinc-500 dark:border-zinc-800/50 dark:bg-zinc-950/50 dark:text-zinc-500">
                    <strong>协议含义：</strong>
                    您可以自由复制、传播、修改本作品，但必须 <span className="text-zinc-900 dark:text-zinc-100">署名作者</span>，并 <span className="text-zinc-900 dark:text-zinc-100">以相同许可协议发布</span> 衍生作品。
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 border-t border-zinc-200 pt-10 dark:border-zinc-800">
              <div>
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-400">作者</span>
                <span className="font-serif text-lg font-bold text-ink dark:text-white">{authorsLabel}</span>
              </div>
            </div>

            <div className="mt-8 flex items-center justify-center">
              <a
                href={`${siteConfig.friendsPage.repoUrl}/blob/main/posts/${post.id}.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
              >
                <ExternalLink size={16} />
                <span>此文章有问题？帮助改进！</span>
              </a>
            </div>

            {/* 上一篇 / 下一篇导航 */}
            <nav aria-label="文章导航" className="mt-12 border-t border-zinc-200 pt-8 dark:border-zinc-800 md:mt-16 md:pt-10">
              <div className="flex flex-col gap-4 sm:flex-row">
                {adjacentPosts.prev ? (
                  <Link
                    to={`/post/${adjacentPosts.prev.id}`}
                    className="post-nav-item group flex items-start gap-3"
                  >
                    <ArrowLeft size={18} className="mt-0.5 flex-shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-900 dark:text-zinc-600 dark:group-hover:text-zinc-100" />
                    <div className="min-w-0 text-left">
                      <span className="post-nav-label">上一篇</span>
                      <span className="post-nav-title">{adjacentPosts.prev.title}</span>
                    </div>
                  </Link>
                ) : (
                  <div className="flex-1" />
                )}
                {adjacentPosts.next ? (
                  <Link
                    to={`/post/${adjacentPosts.next.id}`}
                    className="post-nav-item group flex items-start justify-end gap-3 text-right"
                  >
                    <div className="min-w-0">
                      <span className="post-nav-label justify-end">下一篇</span>
                      <span className="post-nav-title">{adjacentPosts.next.title}</span>
                    </div>
                    <ArrowRight size={18} className="mt-0.5 flex-shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-900 dark:text-zinc-600 dark:group-hover:text-zinc-100" />
                  </Link>
                ) : (
                  <div className="flex-1" />
                )}
              </div>

              {/* 键盘快捷键提示 */}
              <div className="mt-6 text-center">
                <span className="text-[11px] text-zinc-400 dark:text-zinc-600">
                  快捷键：<kbd className="kbd">Alt</kbd> + <kbd className="kbd">←</kbd> 上一篇 · <kbd className="kbd">Alt</kbd> + <kbd className="kbd">→</kbd> 下一篇 · <kbd className="kbd">Esc</kbd> 关闭弹窗
                </span>
              </div>
            </nav>
          </div>
        </div>
      </article>

      <Suspense fallback={null}>
        {shareModalOpen && (
          <ShareModal
            isOpen={shareModalOpen}
            onClose={() => setShareModalOpen(false)}
            title={post.title}
            excerpt={post.excerpt}
            url={`${typeof window !== 'undefined' ? window.location.origin : siteConfig.url}/post/${post.id}`}
          />
        )}
      </Suspense>
    </>
  );
};


