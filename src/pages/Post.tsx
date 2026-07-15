import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';
import { easeOut } from '@/utils/motion';
import DOMPurify from 'dompurify';

import { ArrowLeft, ArrowRight, Clock, Calendar, ChevronRight, Share2, Copy, Check, Users, ExternalLink } from 'lucide-react';
import { getPostById, getPosts } from '@/services/posts';
import { Post as PostType, PostAuthor, PostMetadata } from '../types';
import { siteConfig } from '@config/site.config';
import { Seo } from '../components/Seo';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { NotFoundState } from '@/components/NotFoundState';
import { ContentStatus, LoadingStatus } from '@/components/ContentStatus';
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
    primaryColor: '#27272a',
    primaryTextColor: '#fafafa',
    primaryBorderColor: '#a1a1aa',
    lineColor: '#71717a',
    secondaryColor: '#3f3f46',
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
    <div className="group relative my-5 md:my-7">
      {/* Language badge */}
      {lang && (
        <span className="code-lang-badge">{getLangDisplayName(lang)}</span>
      )}

      {/* Copy button */}
      <button
        type="button"
        onClick={handleCopy}
        className={`absolute z-10 rounded-none border border-zinc-600 p-2 transition-colors ${
          lang ? 'right-3 top-3' : 'right-3 top-3'
        } ${
          copied
            ? 'bg-zinc-100 text-zinc-950'
            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white md:opacity-0 md:group-hover:opacity-100'
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
          className={`${props.className || ''} !my-0 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-600 touch-pan-x !p-3.5 !pt-10 md:!p-5 md:!pt-7 ${needsExpand && !isExpanded ? 'code-block-collapsed' : 'code-block-expanded'}`}
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
            className="absolute bottom-2 left-1/2 z-10 -translate-x-1/2 border border-zinc-600 bg-zinc-800 px-3 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
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
      <pre className="my-8 overflow-x-auto rounded-none border border-zinc-800 bg-[#0d0d0f] p-4 text-sm text-zinc-300">
        <code>{children}</code>
      </pre>
    );
  }

  const sanitizedSvg = typeof DOMPurify !== 'undefined'
    ? DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } })
    : svg;

  return (
    <div className="my-8 flex justify-center overflow-x-auto rounded-none border border-zinc-300 bg-zinc-50 p-6 shadow-none dark:border-zinc-700 dark:bg-zinc-900/50">
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
      <figure className="group/myimage my-7 md:my-10">
        <button
          type="button"
          onClick={() => onPreviewImage({ src: props.src || '', alt: props.alt })}
          className="relative block w-full overflow-hidden rounded-none border border-zinc-300 bg-zinc-50 shadow-none transition-colors duration-200 hover:border-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500 dark:focus-visible:outline-zinc-100"
          aria-label={props.alt ? `预览图片：${props.alt}` : '预览图片'}
        >
          <ProgressiveImage
            {...props}
            loading="lazy"
            decoding="async"
            wrapperClassName="rounded-none"
            className="cursor-zoom-in rounded-none transition-opacity duration-200 group-hover/myimage:opacity-95"
          />
          <span className="pointer-events-none absolute right-3 top-3 border border-white/20 bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85 opacity-0 transition-opacity duration-200 group-hover/myimage:opacity-100 group-focus-visible/myimage:opacity-100">
            预览
          </span>
        </button>
        {(props.alt || title) && (
          <figcaption className="mt-2.5 text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
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
        <code className="rounded-none bg-zinc-100 px-1.5 py-0.5 font-bold text-zinc-900 before:content-none after:content-none dark:bg-zinc-900 dark:text-zinc-100" {...restProps}>
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
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
    setLoadError(null);

    getPostById(id)
      .then((data) => {
        if (cancelled) {
          return;
        }

        setPost(data || null);
        setLoadError(null);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.error('Failed to load post:', error);
        setPost(null);
        setLoadError('文章内容加载失败，请检查网络后重试。');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, loadAttempt]);

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
      <div className="mx-auto max-w-4xl pt-10" aria-busy="true">
        <LoadingStatus label="正在加载文章内容" />
        <div aria-hidden="true" className="mb-16 animate-pulse text-center">
          <div className="mx-auto mb-10 h-6 w-24 rounded-none bg-zinc-200 dark:bg-zinc-800" />
          <div className="mx-auto mb-8 h-12 w-3/4 rounded-none bg-zinc-200 dark:bg-zinc-800 md:h-16" />
          <div className="flex justify-center space-x-6">
            <div className="h-4 w-28 rounded-none bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-32 rounded-none bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-20 rounded-none bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>

        <div aria-hidden="true" className="mb-20 aspect-[21/9] w-full animate-pulse rounded-none bg-zinc-200 dark:bg-zinc-800" />

        <div aria-hidden="true" className="mx-auto max-w-3xl animate-pulse space-y-6 pb-32">
          <div className="h-5 w-full rounded-none bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-11/12 rounded-none bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-full rounded-none bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-4/5 rounded-none bg-zinc-200 dark:bg-zinc-800" />
          <div className="my-10 h-40 w-full rounded-none bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-full rounded-none bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-5/6 rounded-none bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="mx-auto max-w-3xl pt-10">
        <ContentStatus
          variant="error"
          title="文章加载失败"
          description={loadError}
          actionLabel="重新加载"
          onAction={() => setLoadAttempt((attempt) => attempt + 1)}
        />
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

        <header className="mx-auto mb-8 max-w-3xl px-3 pt-4 text-center md:mb-12 md:pt-8">
          <div className="mb-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400 md:mb-7">
            <Link to="/" className="inline-flex items-center gap-1 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300">
              <ArrowLeft size={13} />
              返回文章
            </Link>
            <span aria-hidden="true">/</span>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
              <Link to="/" className="transition-colors hover:text-zinc-700 dark:hover:text-zinc-300">
                首页
              </Link>
              <ChevronRight size={11} aria-hidden="true" />
              <Link to={`/?category=${encodeURIComponent(post.category)}`} className="truncate transition-colors hover:text-zinc-700 dark:hover:text-zinc-300">
                {post.category}
              </Link>
            </nav>
          </div>

          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06, duration: 0.3, ease: easeOut }}>
            <h1 className="mb-5 text-balance font-serif text-3xl font-bold leading-[1.18] tracking-[-0.02em] text-ink dark:text-white md:mb-6 md:text-5xl lg:text-[3.5rem]">
              {post.title}
            </h1>

            <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-zinc-500 dark:text-zinc-500 md:gap-2.5 md:text-xs">
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-none border border-zinc-300 bg-white/70 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/70">
                <Users size={14} />
                <span className="truncate">{authorsLabel}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-none border border-zinc-300 bg-white/70 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/70">
                <Calendar size={14} />
                <span>发布于 {formatMetaDate(post.date)}</span>
              </span>
              {post.updatedAt && post.updatedAt !== post.date && (
                <span className="inline-flex items-center gap-1.5 rounded-none border border-zinc-300 bg-white/70 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/70">
                  <Calendar size={14} />
                  <span>更新 {formatMetaDate(post.updatedAt)}</span>
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 rounded-none border border-zinc-300 bg-white/70 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/70">
                <Clock size={14} />
                <span>{post.readTime}</span>
              </span>
              <button type="button" onClick={() => setShareModalOpen(true)} className="inline-flex items-center gap-1.5 rounded-none border border-zinc-400 bg-zinc-100 px-3 py-1.5 text-zinc-800 transition-colors hover:border-zinc-600 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-400" aria-label={`分享文章：${post.title}`}>
                <Share2 size={14} />
                分享
              </button>
            </div>
          </motion.div>
        </header>

        {post.coverImage && (
          <button type="button" className="mx-auto block w-full max-w-5xl px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100 sm:px-4 lg:px-0" onClick={() => setPreviewImage({ src: post.coverImage, alt: post.title })} aria-label={`预览文章封面：${post.title}`}>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1, duration: 0.22, ease: easeOut }} className="mb-8 aspect-[16/10] cursor-zoom-in overflow-hidden rounded-none border border-zinc-300 bg-zinc-100 shadow-none dark:border-zinc-700 dark:bg-zinc-900 sm:aspect-[16/8] md:mb-14 lg:aspect-[21/9]">
              <ProgressiveImage src={post.coverImage} alt={post.title} loading="eager" fetchPriority="high" width={1600} height={686} aspectRatio="21/9" sizes="(max-width: 767px) 100vw, (max-width: 1279px) 80vw, 1024px" wrapperClassName="h-full w-full" className="h-full w-full object-cover" />
            </motion.div>
          </button>
        )}

        <div ref={articleBodyRef} className="mx-auto w-full max-w-5xl px-3 pb-12 sm:px-4 md:pb-20 lg:px-0">
          <div className="mx-auto max-w-[46rem]">
            <div className="prose prose-stone max-w-none dark:prose-invert md:prose-lg prose-headings:scroll-mt-24 prose-headings:font-serif prose-headings:tracking-tight prose-h2:border-b prose-h2:border-zinc-200 prose-h2:pb-3 dark:prose-h2:border-zinc-800 prose-p:leading-8 prose-li:leading-8 prose-a:break-words prose-a:underline-offset-4 prose-img:rounded-none prose-img:shadow-none prose-blockquote:rounded-none prose-blockquote:border-l-zinc-600 prose-blockquote:bg-zinc-100/70 prose-blockquote:not-italic dark:prose-blockquote:border-l-zinc-400 dark:prose-blockquote:bg-zinc-900 prose-pre:rounded-none prose-pre:border prose-pre:border-zinc-700 prose-pre:bg-[#0d0d0f] prose-pre:p-0">
              <ReactMarkdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={markdownComponents}
              >
                {post.content}
              </ReactMarkdown>
            </div>

            <aside className="mt-14 border-l-2 border-zinc-200 pl-4 text-sm leading-relaxed text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 md:mt-16 md:pl-5" aria-labelledby="license-heading">
              <h2 id="license-heading" className="mb-1 font-semibold text-zinc-700 dark:text-zinc-200">CC BY-SA 4.0 许可协议</h2>
              <p>
                本文由 <strong className="font-semibold text-zinc-700 dark:text-zinc-200">{authorsLabel}</strong> 原创。除非另有声明，可在署名并以相同协议发布衍生作品的前提下自由复制、传播和修改。详见
                <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.zh" target="_blank" rel="noopener noreferrer" className="ml-1 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800 dark:decoration-zinc-700 dark:hover:text-zinc-200">
                  CC BY-SA 4.0
                </a>
                。
              </p>
            </aside>

            <div className="mt-8 flex flex-col gap-3 border-t border-zinc-200 pt-6 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
              <p className="text-zinc-500 dark:text-zinc-400">
                作者 <span className="font-semibold text-zinc-800 dark:text-zinc-200">{authorsLabel}</span>
              </p>
              <a
                href={`${siteConfig.friendsPage.repoUrl}/blob/main/posts/${post.id}.md`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-zinc-500 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:decoration-zinc-700 dark:hover:text-zinc-100"
              >
                <ExternalLink size={14} />
                <span>帮助改进本文</span>
              </a>
            </div>

            {/* 上一篇 / 下一篇导航 */}
            <nav aria-label="文章导航" className="mt-10 border-t border-zinc-200 pt-7 dark:border-zinc-800 md:mt-12 md:pt-8">
              <div className="grid gap-6 sm:grid-cols-2 sm:gap-10">
                {adjacentPosts.prev ? (
                  <Link
                    to={`/post/${adjacentPosts.prev.id}`}
                    className="group flex min-w-0 items-start gap-3 text-left"
                  >
                    <ArrowLeft size={17} className="mt-0.5 flex-shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100" />
                    <span className="min-w-0">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">上一篇</span>
                      <span className="line-clamp-2 text-sm font-semibold leading-relaxed text-zinc-700 transition-colors group-hover:text-zinc-950 dark:text-zinc-300 dark:group-hover:text-white">{adjacentPosts.prev.title}</span>
                    </span>
                  </Link>
                ) : (
                  <span aria-hidden="true" />
                )}
                {adjacentPosts.next ? (
                  <Link
                    to={`/post/${adjacentPosts.next.id}`}
                    className="group flex min-w-0 items-start justify-end gap-3 text-right"
                  >
                    <span className="min-w-0">
                      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">下一篇</span>
                      <span className="line-clamp-2 text-sm font-semibold leading-relaxed text-zinc-700 transition-colors group-hover:text-zinc-950 dark:text-zinc-300 dark:group-hover:text-white">{adjacentPosts.next.title}</span>
                    </span>
                    <ArrowRight size={17} className="mt-0.5 flex-shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100" />
                  </Link>
                ) : (
                  <span aria-hidden="true" />
                )}
              </div>

              {/* 键盘快捷键提示 */}
              <div className="mt-5 hidden text-center md:block">
                <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
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


