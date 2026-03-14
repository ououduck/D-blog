import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion } from 'framer-motion';

import { ArrowLeft, Clock, Calendar, Shield, Share2, Copy, Check } from 'lucide-react';
import { getPostById } from '@/services/posts';
import { Post as PostType } from '../types';
import { siteConfig } from '@config/site.config';
import { Seo } from '../components/Seo';
import { ImageViewer } from '../components/ImageViewer';
import { ShareModal } from '../components/ShareModal';
import { TableOfContents } from '../components/TableOfContents';

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

const PreBlock = ({ children, ...props }: React.DetailedHTMLProps<React.HTMLAttributes<HTMLPreElement>, HTMLPreElement>) => {
  const preRef = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!preRef.current) {
      return;
    }

    const code = preRef.current.innerText.replace(/\n$/, '');

    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
    <div className="group relative my-6 md:my-8">
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
  mermaidRenderer: MermaidRenderer | null
): Components => ({
  img: ({ ...props }) => (
    <img
      {...props}
      loading="lazy"
      onClick={() => onPreviewImage({ src: props.src || '', alt: props.alt })}
      className="my-12 cursor-zoom-in rounded-2xl shadow-lg"
    />
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
      <code className="rounded-md bg-zinc-100 px-1.5 py-0.5 font-bold text-accent before:content-none after:content-none dark:bg-zinc-900 dark:text-accent-light" {...restProps}>
        {children}
      </code>
    );
  },
  h1: ({ children, ...props }) => {
    const id = String(children).toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
    return <h1 id={id} {...props}>{children}</h1>;
  },
  h2: ({ children, ...props }) => {
    const id = String(children).toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
    return <h2 id={id} {...props}>{children}</h2>;
  },
  h3: ({ children, ...props }) => {
    const id = String(children).toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '');
    return <h3 id={id} {...props}>{children}</h3>;
  }
});

export const Post = () => {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<PostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt?: string } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [remarkPlugins, setRemarkPlugins] = useState<MarkdownPlugin[]>([remarkGfm]);
  const [rehypePlugins, setRehypePlugins] = useState<MarkdownPlugin[]>([]);
  const [mermaidRenderer, setMermaidRenderer] = useState<MermaidRenderer | null>(null);

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
          const [{ default: rehypeHighlight }] = await Promise.all([
            import('rehype-highlight'),
            import('highlight.js/styles/github-dark.css')
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

  const markdownComponents = createMarkdownComponents((image) => setPreviewImage(image), mermaidRenderer);

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl animate-pulse pt-10">
        <div className="mb-16 text-center">
          <div className="mb-10 inline-block h-4 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mb-8 flex flex-col items-center gap-4">
            <div className="h-6 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800" />
          </div>
          <div className="mx-auto mb-8 h-12 w-3/4 rounded-lg bg-zinc-200 dark:bg-zinc-800 md:h-16" />
          <div className="flex justify-center space-x-6">
            <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-24 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-16 rounded bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>

        <div className="mb-20 aspect-[21/9] w-full rounded-3xl bg-zinc-200 shadow-sm dark:bg-zinc-800" />

        <div className="mx-auto max-w-3xl space-y-6 pb-32">
          <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-11/12 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-5/6 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="my-8 h-32 w-full rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-full rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-4 w-4/5 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
        <Seo title="404 Not Found" />
        <div className="mb-4 text-9xl font-serif font-bold text-zinc-200 dark:text-zinc-800">404</div>
        <h2 className="mb-4 font-serif text-3xl font-bold text-ink dark:text-white">未找到文章</h2>
        <p className="mb-8 max-w-md text-zinc-500">很抱歉，您访问的文章可能已被删除、移动或不存在。</p>
        <div className="mb-8 rounded-lg bg-zinc-100 p-4 font-mono text-xs text-zinc-500 dark:bg-zinc-800">Debug Info: ID=&quot;{id}&quot;</div>
        <Link to="/" className="rounded-full bg-ink px-6 py-3 font-bold tracking-wide text-white transition-transform hover:scale-105 dark:bg-white dark:text-ink">
          返回首页
        </Link>
      </div>
    );
  }

  return (
    <>
      <ImageViewer src={previewImage?.src || null} alt={previewImage?.alt} onClose={() => setPreviewImage(null)} />

      <motion.article initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: 'easeOut' }}>
        <Seo title={post.title} description={post.excerpt} image={post.coverImage} type="article" />

        <header className="mx-auto mb-10 max-w-4xl pt-6 text-center md:mb-16 md:pt-10">
          <Link to="/" className="group mb-6 inline-flex items-center text-xs font-bold uppercase tracking-widest text-zinc-500 transition-colors hover:text-accent md:mb-10">
            <ArrowLeft size={16} className="mr-2 transition-transform group-hover:-translate-x-1" />
            返回文章
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="mb-8 flex flex-col items-center gap-4">
              <span className="rounded-full border border-accent/20 bg-accent/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-accent">
                {post.category}
              </span>
            </div>

            <h1 className="mb-6 font-serif text-3xl font-bold leading-[1.2] text-ink dark:text-white md:mb-8 md:text-5xl lg:text-6xl">
              {post.title}
            </h1>

            <div className="flex items-center justify-center space-x-4 text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 md:space-x-6">
              <span className="flex items-center">
                <Calendar size={14} className="mr-2" /> {post.date}
              </span>
              <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <span className="flex items-center">
                <Clock size={14} className="mr-2" /> {post.readTime}
              </span>
              <span className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-zinc-700" />
              <button onClick={() => setShareModalOpen(true)} className="flex items-center transition-colors hover:text-accent">
                <Share2 size={14} className="mr-1.5" /> 分享
              </button>
            </div>
          </motion.div>
        </header>

        {post.coverImage && (
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, duration: 0.8 }} className="mx-auto mb-10 aspect-[4/3] max-w-6xl cursor-zoom-in overflow-hidden rounded-2xl px-4 shadow-2xl shadow-zinc-200/50 dark:shadow-none sm:aspect-[16/9] md:mb-20 md:aspect-[21/9] md:rounded-3xl md:px-0" onClick={() => setPreviewImage({ src: post.coverImage, alt: post.title })}>
            <img src={post.coverImage} alt={post.title} className="h-full w-full object-cover" loading="eager" decoding="async" fetchpriority="high" />
          </motion.div>
        )}

        <div className="flex gap-8">
          <div className="max-w-3xl flex-1 px-4 pb-20 md:pb-32">
            <div className="prose prose-base max-w-none prose-stone dark:prose-invert md:prose-lg prose-headings:scroll-mt-24 prose-headings:font-serif prose-headings:font-bold prose-headings:text-ink dark:prose-headings:text-white prose-p:font-sans prose-p:text-base prose-p:leading-relaxed md:prose-p:text-lg prose-a:break-words prose-a:text-accent prose-a:font-medium prose-a:no-underline hover:prose-a:underline prose-strong:font-bold prose-strong:text-ink dark:prose-strong:text-white prose-img:my-6 prose-img:h-auto prose-img:w-full prose-img:max-w-full prose-img:cursor-zoom-in prose-img:rounded-xl prose-img:shadow-lg prose-img:transition-transform hover:prose-img:scale-[1.01] dark:prose-img:rounded-2xl md:prose-img:my-12 md:prose-img:rounded-2xl prose-blockquote:rounded-r-xl prose-blockquote:border-l-accent prose-blockquote:bg-zinc-50 prose-blockquote:px-4 prose-blockquote:py-3 prose-blockquote:font-serif prose-blockquote:not-italic prose-blockquote:text-base dark:prose-blockquote:bg-zinc-900 md:prose-blockquote:rounded-r-2xl md:prose-blockquote:px-8 md:prose-blockquote:py-6 md:prose-blockquote:text-xl prose-code:font-mono prose-code:text-xs md:prose-code:text-sm prose-pre:overflow-hidden prose-pre:rounded-xl prose-pre:border prose-pre:border-zinc-800 prose-pre:bg-[#0d1117] prose-pre:p-0 prose-pre:shadow-xl md:prose-pre:rounded-2xl">
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
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-accent/30 bg-accent/5 text-accent">
                    <span className="font-serif text-xl font-bold">CC</span>
                  </div>
                </div>
                <div>
                  <h3 className="mb-2 text-lg font-serif font-bold text-ink dark:text-white">CC BY-SA 4.0 许可协议</h3>
                  <p className="mb-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                    本文由 <strong className="text-ink dark:text-zinc-200">{siteConfig.author.name}</strong> 原创。除非另有声明，本站文章采用
                    <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.zh" target="_blank" rel="noopener noreferrer" className="mx-1 font-medium text-accent hover:underline">
                      CC BY-SA 4.0
                    </a>
                    协议进行授权。
                  </p>
                  <div className="inline-block rounded-lg border border-zinc-200/50 bg-zinc-100 p-3 text-xs text-zinc-500 dark:border-zinc-800/50 dark:bg-zinc-950/50 dark:text-zinc-500">
                    <strong>协议含义：</strong>
                    您可以自由复制、传播、修改本作品，但必须 <span className="text-accent">署名作者</span>，并 <span className="text-accent">以相同许可协议发布</span> 衍生作品。
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-10 flex items-center justify-between border-t border-zinc-200 pt-10 dark:border-zinc-800">
              <div>
                <span className="mb-1 block text-xs font-bold uppercase tracking-wider text-zinc-400">作者</span>
                <span className="font-serif text-lg font-bold text-ink dark:text-white">{siteConfig.author.name}</span>
              </div>
            </div>
          </div>

          <div className="hidden flex-shrink-0 lg:block">
            <TableOfContents content={post.content} />
          </div>
        </div>
      </motion.article>

      <ShareModal isOpen={shareModalOpen} onClose={() => setShareModalOpen(false)} title={post.title} excerpt={post.excerpt} url={`${window.location.origin}/post/${post.id}`} />
    </>
  );
};
