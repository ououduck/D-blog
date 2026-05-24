import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';

import { ArrowLeft, Clock, Calendar, ChevronRight, Shield, Share2, Copy, Check, Users, ExternalLink } from 'lucide-react';
import { getPostById } from '@/services/posts';
import { Post as PostType, PostAuthor } from '../types';
import { siteConfig } from '@config/site.config';
import { Seo } from '../components/Seo';
import { ImageViewer } from '../components/ImageViewer';
import { ShareModal } from '../components/ShareModal';
import { TableOfContents } from '../components/TableOfContents';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { NotFoundState } from '@/components/NotFoundState';
import { ReadingProgressBadge } from '@/components/ReadingProgressBadge';
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
} satisfies Record<string, unknown>;

const hasCodeBlocks = (content: string) => /```[\w-]*\s*[\r\n]/.test(content);
const hasMathExpressions = (content: string) => /(^|[\r\n])\$\$[\s\S]*?\$\$|\\\(|\\\[/.test(content);
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

const PreBlock = ({ children, ...props }: React.DetailedHTMLProps<React.HTMLAttributes<HTMLPreElement>, HTMLPreElement>) => {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
  }, []);

  const markCopied = () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    setCopied(true);
    resetTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
  };

  const handleCopy = async () => {
    if (!preRef.current) {
      return;
    }

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
        const copiedSuccessfully = document.execCommand('copy');
        if (!copiedSuccessfully) {
          throw new Error('Copy command was rejected');
        }

        markCopied();
      } catch (error) {
        console.error('Copy failed', error);
      }

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
      <button
        onClick={handleCopy}
        className="absolute right-3 top-3 z-10 rounded-lg bg-zinc-700/80 p-2 text-zinc-300 opacity-100 backdrop-blur-sm transition-all hover:bg-zinc-600/80 hover:text-white md:opacity-0 md:group-hover:opacity-100"
        title="复制代码"
        aria-label="复制代码"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <pre ref={preRef} {...props} className={`${props.className || ''} !my-0 overflow-x-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-zinc-600 touch-pan-x !p-3 md:!p-6`}>
        {childrenWithProps}
      </pre>
    </div>
  );
};

const MermaidBlock = ({ children, renderer }: { children: string; renderer: MermaidRenderer | null }) => {
  const [svg, setSvg] = useState('');
  const mermaidIdRef = useRef(`mermaid-${Math.random().toString(36).slice(2, 11)}`);

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

  return (
    <div className="my-8 flex justify-center overflow-x-auto rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/50">
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
};

const createMarkdownComponents = (
  onPreviewImage: (image: { src: string; alt?: string }) => void,
  mermaidRenderer: MermaidRenderer | null,
  headings: MarkdownHeading[],
  headingIdMap: Map<string, string>
): Components => {
  let headingCursor = 0;
  const fallbackHeadingIds = new Map<string, number>();

  const resolveHeadingId = (level: number, children: React.ReactNode) => {
    const rawText = extractTextFromReactNode(children);

    // 先尝试从缓存的 Map 中查找
    const slugId = slugifyHeading(rawText);
    const cachedId = headingIdMap.get(slugId);
    if (cachedId) {
      return cachedId;
    }

    // 如果缓存中没有，使用原有逻辑
    for (let index = headingCursor; index < headings.length; index += 1) {
      const heading = headings[index];

      if (heading.level === level && heading.rawText === rawText) {
        headingCursor = index + 1;
        return heading.id;
      }
    }

    const fallbackBaseId = slugId || 'section';
    const duplicateCount = (fallbackHeadingIds.get(fallbackBaseId) ?? 0) + 1;

    fallbackHeadingIds.set(fallbackBaseId, duplicateCount);

    return duplicateCount === 1 ? fallbackBaseId : `${fallbackBaseId}-${duplicateCount}`;
  };

  return {
    img: ({ ...props }) => (
      <button
        type="button"
        onClick={() => onPreviewImage({ src: props.src || '', alt: props.alt })}
        className="my-12 block w-full rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100"
        aria-label={props.alt ? `预览图片：${props.alt}` : '预览图片'}
      >
        <ProgressiveImage
          {...props}
          loading="lazy"
          wrapperClassName="rounded-2xl"
          className="cursor-zoom-in rounded-2xl shadow-lg"
        />
      </button>
    ),
    pre: PreBlock,
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
    // Markdown 标题降级渲染：h1→h2, h2→h3, h3→h4
    // 确保文章正文标题不会与页面主标题(h1)冲突
    h1: ({ children, ...props }) => {
      const id = resolveHeadingId(1, children);
      return <h2 id={id} {...props}>{children}</h2>;
    },
    h2: ({ children, ...props }) => {
      const id = resolveHeadingId(2, children);
      return <h3 id={id} {...props}>{children}</h3>;
    },
    h3: ({ children, ...props }) => {
      const id = resolveHeadingId(3, children);
      return <h4 id={id} {...props}>{children}</h4>;
    }
  };
};

export const Post = () => {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<PostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt?: string } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [remarkPlugins, setRemarkPlugins] = useState<MarkdownPlugin[]>([remarkGfm]);
  const [rehypePlugins, setRehypePlugins] = useState<MarkdownPlugin[]>([]);
  const [mermaidRenderer, setMermaidRenderer] = useState<MermaidRenderer | null>(null);
  const [mobileFloatingVisible, setMobileFloatingVisible] = useState(false);
  const articleBodyRef = useRef<HTMLDivElement>(null);

  // 使用 Map 缓存标题映射
  const headingIdMapRef = useRef<Map<string, string>>(new Map());

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
  
  // 当标题列表变化时，重建映射缓存
  useEffect(() => {
    const newMap = new Map<string, string>();
    headings.forEach((heading) => {
      const slugId = slugifyHeading(heading.text);
      newMap.set(slugId, heading.id);
    });
    headingIdMapRef.current = newMap;
  }, [headings]);

  const markdownComponents = createMarkdownComponents((image) => setPreviewImage(image), mermaidRenderer, headings, headingIdMapRef.current);

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
      <ImageViewer src={previewImage?.src || null} alt={previewImage?.alt} onClose={() => setPreviewImage(null)} />
      <ReadingProgressBadge targetRef={articleBodyRef} onVisibilityChange={setMobileFloatingVisible} />
      <TableOfContents
        headings={headings}
        mobileShowTrigger={mobileFloatingVisible}
        desktopShowTrigger={headings.length > 0}
      />

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

          <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.4 }}>
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
              <button onClick={() => setShareModalOpen(true)} className="flex items-center transition-colors hover:text-zinc-900 dark:hover:text-zinc-100" aria-label={`分享文章：${post.title}`}>
                <Share2 size={14} className="mr-1.5" /> 分享
              </button>
            </div>
          </motion.div>
        </header>

        {post.coverImage && (
          <button type="button" className="mx-auto block w-full max-w-6xl px-4 md:px-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100" onClick={() => setPreviewImage({ src: post.coverImage, alt: post.title })} aria-label={`预览文章封面：${post.title}`}>
            <motion.div initial={{ scale: 0.97, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15, duration: 0.5 }} className="mb-10 aspect-[4/3] cursor-zoom-in overflow-hidden rounded-2xl shadow-2xl shadow-zinc-200/50 dark:shadow-none sm:aspect-[16/9] md:mb-20 md:aspect-[21/9] md:rounded-3xl">
              <ProgressiveImage src={post.coverImage} alt={post.title} loading="eager" fetchPriority="auto" wrapperClassName="h-full w-full" className="h-full w-full object-cover" />
            </motion.div>
          </button>
        )}

        <div ref={articleBodyRef} className="mx-auto flex max-w-3xl flex-col gap-8 px-4 pb-16 md:px-0 md:pb-24">
          <div className="flex-1 rounded-2xl bg-white px-6 py-8 shadow-sm dark:bg-zinc-900 md:px-12 md:py-12">
            <div className="prose prose-base mx-auto max-w-[72ch] prose-stone dark:prose-invert md:prose-lg prose-headings:scroll-mt-24 prose-headings:font-serif prose-headings:font-bold prose-headings:text-ink dark:prose-headings:text-white prose-h2:mb-8 prose-h2:mt-12 prose-h2:text-4xl md:prose-h2:mb-10 md:prose-h2:mt-16 md:prose-h2:text-5xl prose-h3:mb-5 prose-h3:mt-10 prose-h3:text-3xl md:prose-h3:mb-6 md:prose-h3:mt-12 md:prose-h3:text-4xl prose-h4:mb-4 prose-h4:mt-8 prose-h4:text-2xl md:prose-h4:mb-5 md:prose-h4:mt-10 md:prose-h4:text-3xl prose-p:mb-5 prose-p:font-sans prose-p:text-[16px] md:prose-p:text-[18px] prose-p:leading-[1.8] md:prose-p:leading-[1.9] prose-p:tracking-[0.01em] prose-a:break-words prose-a:text-zinc-900 prose-a:font-semibold prose-a:underline prose-a:decoration-zinc-300 prose-a:decoration-2 prose-a:underline-offset-[3px] prose-a:transition-all hover:prose-a:decoration-zinc-900 hover:prose-a:underline-offset-[5px] dark:prose-a:text-zinc-100 dark:prose-a:decoration-zinc-700 dark:hover:prose-a:decoration-zinc-400 prose-strong:font-bold prose-strong:text-ink dark:prose-strong:text-white prose-img:my-6 prose-img:h-auto prose-img:w-full prose-img:max-w-full prose-img:cursor-zoom-in prose-img:rounded-xl prose-img:shadow-lg prose-img:transition-transform hover:prose-img:scale-[1.01] dark:prose-img:rounded-2xl md:prose-img:my-10 md:prose-img:rounded-2xl prose-blockquote:my-7 prose-blockquote:rounded-r-xl prose-blockquote:border-l-4 prose-blockquote:border-l-zinc-900 prose-blockquote:bg-zinc-50 prose-blockquote:px-7 prose-blockquote:py-6 prose-blockquote:font-serif prose-blockquote:not-italic prose-blockquote:text-[16px] md:prose-blockquote:text-[18px] prose-blockquote:leading-[1.8] dark:prose-blockquote:border-l-zinc-100 dark:prose-blockquote:bg-zinc-900 md:prose-blockquote:my-9 md:prose-blockquote:rounded-r-2xl md:prose-blockquote:px-10 md:prose-blockquote:py-8 prose-code:font-mono prose-code:text-[13px] prose-code:font-medium md:prose-code:text-[14px] prose-pre:overflow-hidden prose-pre:rounded-xl prose-pre:border prose-pre:border-zinc-800 prose-pre:bg-[#0d1117] prose-pre:p-0 prose-pre:shadow-xl md:prose-pre:rounded-2xl prose-ul:my-6 prose-ul:space-y-3 md:prose-ul:my-8 md:prose-ul:space-y-4 prose-ol:my-6 prose-ol:space-y-3 md:prose-ol:my-8 md:prose-ol:space-y-4 prose-li:text-[17px] prose-li:leading-[1.85] prose-li:marker:text-zinc-500 dark:prose-li:marker:text-zinc-500 md:prose-li:text-[19px] md:prose-li:leading-[1.9] prose-hr:my-10 prose-hr:border-zinc-200 dark:prose-hr:border-zinc-800 md:prose-hr:my-14 prose-table:my-8 md:prose-table:my-10">
              <ReactMarkdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={markdownComponents}
              >
                {post.content}
              </ReactMarkdown>
            </div>

            <div className="group relative mt-16 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-50/80 p-6 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/50 md:mt-20 md:rounded-2xl md:p-8">
              <div className="absolute -right-6 -top-6 rotate-12 text-zinc-200 opacity-50 transition-transform duration-500 group-hover:rotate-0 dark:text-zinc-800">
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
                className="group inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50/50 px-4 py-2.5 text-sm font-medium text-zinc-600 transition-all hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900/30 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
              >
                <ExternalLink size={16} className="transition-transform group-hover:scale-110" />
                <span>此文章有问题？帮助改进！</span>
              </a>
            </div>
          </div>
        </div>
      </article>

      <ShareModal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} title={post.title} excerpt={post.excerpt} url={`${typeof window !== 'undefined' ? window.location.origin : siteConfig.url}/post/${post.id}`} />
    </>
  );
};

