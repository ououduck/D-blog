import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import { motion } from 'framer-motion';

// 动态加载代码高亮样式，避免阻塞首页渲染
if (typeof window !== 'undefined') {
  import('highlight.js/styles/github-dark.css');
}
import { ArrowLeft, Clock, Calendar, Shield, Share2, Copy, Check } from 'lucide-react';
import { getPostById } from '../services/posts';
import { Post as PostType } from '../types';
import { siteConfig } from '../site.config';
import { Seo } from '../components/Seo';
import { ImageViewer } from '../components/ImageViewer';
import { ShareModal } from '../components/ShareModal';

const PreBlock = ({ children, ...props }: React.DetailedHTMLProps<React.HTMLAttributes<HTMLPreElement>, HTMLPreElement>) => {
  const preRef = React.useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (preRef.current) {
      const code = preRef.current.innerText.replace(/\n$/, '');
      try {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } else {
            throw new Error('Clipboard API not available');
        }
      } catch (err) {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement("textarea");
        textArea.value = code;
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (e) {
          console.error('Copy failed', e);
        }
        document.body.removeChild(textArea);
      }
    }
  };

  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<any>, { isBlock: true });
    }
    return child;
  });

  return (
    <div className="relative group my-6 md:my-8">
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 p-2 rounded-lg bg-zinc-700/80 hover:bg-zinc-600/80 text-zinc-300 hover:text-white transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 z-10 backdrop-blur-sm"
        title="复制代码"
        aria-label="复制代码"
      >
        {copied ? <Check size={16} /> : <Copy size={16} />}
      </button>
      <pre ref={preRef} {...props} className={`${props.className || ''} !my-0 !p-4 md:!p-6 overflow-x-auto scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-transparent`}>
        {childrenWithProps}
      </pre>
    </div>
  );
};

export const Post = () => {
  const { id } = useParams<{ id: string }>();
  const [post, setPost] = useState<PostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<{src: string, alt?: string} | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (id) {
      setLoading(true);
      getPostById(id).then(data => {
        setPost(data || null);
        setLoading(false);
      });
    }
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto pt-10 animate-pulse">
        {/* Header Skeleton */}
        <div className="text-center mb-16">
           <div className="inline-block w-20 h-4 bg-zinc-200 dark:bg-zinc-800 rounded mb-10"></div>
           
           <div className="flex flex-col items-center gap-4 mb-8">
              <div className="w-16 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full"></div>
           </div>
           
           <div className="h-12 md:h-16 bg-zinc-200 dark:bg-zinc-800 rounded-lg w-3/4 mx-auto mb-8"></div>
           
           <div className="flex justify-center space-x-6">
              <div className="w-24 h-4 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
              <div className="w-24 h-4 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
              <div className="w-16 h-4 bg-zinc-200 dark:bg-zinc-800 rounded"></div>
           </div>
        </div>

        {/* Image Skeleton */}
        <div className="mb-20 rounded-3xl bg-zinc-200 dark:bg-zinc-800 aspect-[21/9] w-full shadow-sm"></div>

        {/* Content Skeleton */}
        <div className="max-w-3xl mx-auto space-y-6 pb-32">
           <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
           <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-11/12"></div>
           <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
           <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4"></div>
           <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-5/6"></div>
           <div className="h-32 bg-zinc-200 dark:bg-zinc-800 rounded-xl w-full my-8"></div>
           <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
           <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-4/5"></div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Seo title="404 Not Found" />
        <div className="text-9xl font-serif font-bold text-zinc-200 dark:text-zinc-800 mb-4">404</div>
        <h2 className="text-3xl font-serif font-bold mb-4 text-ink dark:text-white">未找到文章</h2>
        <p className="text-zinc-500 mb-8 max-w-md">很抱歉，您访问的文章可能已被删除、移动或不存在。</p>
        <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs font-mono text-zinc-500 mb-8">
            Debug Info: ID="{id}"
        </div>
        <Link to="/" className="px-6 py-3 bg-ink dark:bg-white text-white dark:text-ink rounded-full font-bold tracking-wide hover:scale-105 transition-transform">
          返回首页
        </Link>
      </div>
    );
  }

  return (
    <>
      <ImageViewer src={previewImage?.src || null} alt={previewImage?.alt} onClose={() => setPreviewImage(null)} />
      
      <motion.article initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.6, ease: "easeOut" }}>
        <Seo title={post.title} description={post.excerpt} image={post.coverImage} type="article" />

        <header className="max-w-4xl mx-auto pt-6 md:pt-10 mb-10 md:mb-16 text-center">
          <Link to="/" className="inline-flex items-center text-zinc-500 hover:text-accent transition-colors mb-6 md:mb-10 group font-bold text-xs tracking-widest uppercase">
            <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" />
            返回文章
          </Link>
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex flex-col items-center gap-4 mb-8">
              <span className="px-4 py-1.5 text-xs font-bold tracking-widest uppercase bg-accent/10 text-accent rounded-full border border-accent/20">
                  {post.category}
              </span>
            </div>
            
            <h1 className="text-3xl md:text-5xl lg:text-6xl font-serif font-bold mb-6 md:mb-8 text-ink dark:text-white leading-[1.2]">
              {post.title}
            </h1>
            
            <div className="flex items-center justify-center space-x-4 md:space-x-6 text-zinc-500 dark:text-zinc-400 font-bold text-xs tracking-wide uppercase">
              <span className="flex items-center"><Calendar size={14} className="mr-2" /> {post.date}</span>
              <span className="w-1 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full"></span>
              <span className="flex items-center"><Clock size={14} className="mr-2" /> {post.readTime}</span>
              <span className="w-1 h-1 bg-zinc-300 dark:bg-zinc-700 rounded-full"></span>
              <button onClick={() => setShareModalOpen(true)} className="flex items-center hover:text-accent transition-colors">
                <Share2 size={14} className="mr-1.5" /> 分享
              </button>
            </div>
          </motion.div>
        </header>

        {post.coverImage && (
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, duration: 0.8 }} className="mb-10 md:mb-20 rounded-3xl overflow-hidden shadow-2xl shadow-zinc-200/50 dark:shadow-none mx-auto max-w-6xl aspect-[21/9] cursor-zoom-in" onClick={() => setPreviewImage({ src: post.coverImage!, alt: post.title })}>
            <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" loading="eager" decoding="async" fetchpriority="high" />
          </motion.div>
        )}

        <div className="max-w-3xl mx-auto px-4 pb-20 md:pb-32">
          <div className="prose prose-base md:prose-lg prose-stone dark:prose-invert max-w-none 
            prose-headings:font-serif prose-headings:font-bold prose-headings:text-ink dark:prose-headings:text-white 
            prose-p:font-sans prose-p:text-base md:prose-p:text-lg prose-p:leading-relaxed 
            prose-a:text-accent prose-a:font-medium prose-a:no-underline hover:prose-a:underline 
            prose-strong:text-ink dark:prose-strong:text-white prose-strong:font-bold 
            prose-img:rounded-2xl prose-img:shadow-lg prose-img:my-6 md:prose-img:my-12 prose-img:cursor-zoom-in prose-img:transition-transform hover:prose-img:scale-[1.01] 
            prose-blockquote:border-l-accent prose-blockquote:bg-zinc-50 dark:prose-blockquote:bg-zinc-900 prose-blockquote:py-4 prose-blockquote:px-6 md:prose-blockquote:py-6 md:prose-blockquote:px-8 prose-blockquote:rounded-r-2xl prose-blockquote:not-italic prose-blockquote:font-serif prose-blockquote:text-lg md:prose-blockquote:text-xl 
            prose-code:font-mono prose-code:text-sm 
            prose-pre:bg-[#0d1117] prose-pre:p-0 prose-pre:rounded-2xl prose-pre:shadow-xl prose-pre:overflow-hidden prose-pre:border prose-pre:border-zinc-800">
            <ReactMarkdown
               remarkPlugins={[remarkGfm]}
               rehypePlugins={[rehypeHighlight]}
               components={{
                 img: ({node, ...props}) => <img {...props} loading="lazy" onClick={() => setPreviewImage({ src: props.src as string, alt: props.alt })} className="cursor-zoom-in rounded-2xl shadow-lg my-12" />,
                 pre: PreBlock,
                 code({node, className, children, isBlock, ...props}: any) {
                    if (isBlock || /language-(\w+)/.exec(className || '')) {
                        return <code className={className} {...props}>{children}</code>
                    }
                    return <code className="text-accent dark:text-accent-light bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded-md font-bold before:content-none after:content-none" {...props}>{children}</code>
                 }
               }}
            >
              {post.content}
            </ReactMarkdown>
          </div>
          
          <div className="mt-20 p-8 rounded-2xl bg-zinc-50/80 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute -top-6 -right-6 text-zinc-200 dark:text-zinc-800 transform rotate-12 group-hover:rotate-0 transition-transform duration-500 opacity-50"><Shield size={120} strokeWidth={0.5} /></div>
            <div className="relative z-10 flex flex-col md:flex-row gap-6 items-start">
               <div className="flex-shrink-0">
                  <div className="w-12 h-12 rounded-full border-2 border-accent/30 flex items-center justify-center text-accent bg-accent/5"><span className="font-serif font-bold text-xl">CC</span></div>
               </div>
               <div>
                  <h3 className="text-lg font-serif font-bold text-ink dark:text-white mb-2">CC BY-SA 4.0 许可协议</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-3">
                    本文由 <strong className="text-ink dark:text-zinc-200">{siteConfig.author.name}</strong> 原创。除非另有声明，本站文章采用 
                    <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.zh" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline font-medium mx-1">CC BY-SA 4.0</a>协议进行授权。
                  </p>
                  <div className="text-xs text-zinc-500 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-950/50 p-3 rounded-lg border border-zinc-200/50 dark:border-zinc-800/50 inline-block">
                    <strong>协议含义：</strong> 您可以自由复制、传播、修改本作品，但必须<span className="text-accent">署名作者</span>且<span className="text-accent">以相同许可协议发布</span>衍生作品。
                  </div>
               </div>
            </div>
          </div>

          <div className="mt-10 pt-10 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
               <div>
                  <span className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">作者</span>
                  <span className="font-serif text-lg font-bold text-ink dark:text-white">{siteConfig.author.name}</span>
               </div>
          </div>
        </div>
      </motion.article>

      <ShareModal 
        isOpen={shareModalOpen} 
        onClose={() => setShareModalOpen(false)} 
        title={post.title} 
        excerpt={post.excerpt} 
        url={`${window.location.origin}/post/${post.id}`} 
      />
    </>
  );
};