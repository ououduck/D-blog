import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';

import { ArrowLeft, ArrowRight, Clock, Calendar, ChevronRight, Share2, Copy, Check, Download, ChevronDown, ChevronUp, Users, ExternalLink, EyeOff, BookOpen, Bookmark, Minus, Plus, RotateCcw, LoaderCircle, TriangleAlert } from 'lucide-react';
import { getPostById, getPosts } from '@/services/posts';
import { getReadingHistoryEntry, saveReadingHistory } from '@/services/readingHistory';
import { getRelatedPosts, getSeriesNavigation, type SeriesNavigation } from '@/utils/postRelations';
import { getReadingProgress, getScrollTopForReadingProgress, isReadingComplete } from '@/utils/readingProgress';
import { Post as PostType, PostAuthor, PostMetadata } from '../types';
import { useOfflinePosts } from '@/hooks/useOfflinePosts';
import { assetUrl, absoluteSiteUrl, routeUrl } from '@/utils/siteUrl';
import { siteConfig } from '@config/site.config';
import { Seo, buildSiteSchemas } from '../components/Seo';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { NotFoundState } from '@/components/NotFoundState';
import { IssueSubscriptionCard } from '@/components/IssueSubscriptionCard';
import { ContentStatus, LoadingStatus } from '@/components/ContentStatus';
import { extractMarkdownHeadings, extractTextFromReactNode, slugifyHeading } from '@/utils/headings';
import type { MarkdownHeading } from '@/utils/headings';
import { formatDate } from '@/utils/date';
import { stripMarkdown } from '@/utils/markdownText';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { hasOpenOverlay } from '@/hooks/useModalOverlay';
import { useReadingMode } from '@/components/ReadingModeContext';
import { ReadingModeToggle } from '@/components/ReadingModeToggle';
import { GiscusComments } from '@/components/GiscusComments';
import { useSsgRouteData } from '@/ssr/routeData';


type BlockCodeProps = {
  isBlock?: boolean;
};

type MarkdownImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  previewSrc?: string;
  node?: unknown;
};

type MarkdownPlugin = import('unified').Pluggable;

type MermaidRenderer = {
  initialize: (config: Record<string, unknown>) => void;
  render: (id: string, text: string) => Promise<{ svg: string }>;
};

type MermaidStatus = 'idle' | 'loading' | 'ready' | 'error';

const getIsDarkTheme = () => typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

const getMermaidConfig = (isDark: boolean) => ({
  startOnLoad: false,
  securityLevel: 'strict',
  // Keep labels in SVG text nodes so DOMPurify's SVG profile preserves them.
  htmlLabels: false,
  theme: 'base',
  flowchart: { htmlLabels: false, curve: 'basis', padding: 16 },
  sequence: { useMaxWidth: true, diagramMarginX: 24, diagramMarginY: 20 },
  themeVariables: isDark
    ? {
        primaryColor: '#1e293b',
        primaryTextColor: '#f8fafc',
        primaryBorderColor: '#60a5fa',
        lineColor: '#94a3b8',
        secondaryColor: '#312e81',
        secondaryTextColor: '#eef2ff',
        secondaryBorderColor: '#a5b4fc',
        tertiaryColor: '#134e4a',
        tertiaryTextColor: '#ecfdf5',
        tertiaryBorderColor: '#5eead4',
        background: '#111827',
        mainBkg: '#1e293b',
        secondBkg: '#312e81',
        nodeBorder: '#60a5fa',
        clusterBkg: '#172033',
        clusterBorder: '#64748b',
        titleColor: '#f8fafc',
        edgeLabelBackground: '#111827',
        actorBkg: '#1e293b',
        actorBorder: '#60a5fa',
        actorTextColor: '#f8fafc',
        signalColor: '#cbd5e1',
        signalTextColor: '#f8fafc',
        noteBkgColor: '#422006',
        noteBorderColor: '#fbbf24',
        noteTextColor: '#fef3c7',
        fontSize: '16px',
        fontFamily: '"Microsoft YaHei", "PingFang SC", ui-sans-serif, system-ui, sans-serif'
      }
    : {
        primaryColor: '#eff6ff',
        primaryTextColor: '#172033',
        primaryBorderColor: '#2563eb',
        lineColor: '#475569',
        secondaryColor: '#eef2ff',
        secondaryTextColor: '#312e81',
        secondaryBorderColor: '#6366f1',
        tertiaryColor: '#ecfdf5',
        tertiaryTextColor: '#134e4a',
        tertiaryBorderColor: '#0f766e',
        background: '#ffffff',
        mainBkg: '#eff6ff',
        secondBkg: '#eef2ff',
        nodeBorder: '#2563eb',
        clusterBkg: '#f8fafc',
        clusterBorder: '#94a3b8',
        titleColor: '#172033',
        edgeLabelBackground: '#ffffff',
        actorBkg: '#eff6ff',
        actorBorder: '#2563eb',
        actorTextColor: '#172033',
        signalColor: '#334155',
        signalTextColor: '#172033',
        noteBkgColor: '#fffbeb',
        noteBorderColor: '#d97706',
        noteTextColor: '#78350f',
        fontSize: '16px',
        fontFamily: '"Microsoft YaHei", "PingFang SC", ui-sans-serif, system-ui, sans-serif'
      }
} as const);

const HIGHLIGHT_STYLE_ID = 'post-highlight-theme';

const loadHighlightThemeCss = async (isDark: boolean) => {
  const themeModule = isDark
    ? await import('highlight.js/styles/github-dark.css?raw')
    : await import('highlight.js/styles/github.css?raw');
  return themeModule.default;
};

const syncHighlightTheme = (css: string) => {
  const style = document.getElementById(HIGHLIGHT_STYLE_ID) ?? document.createElement('style');
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = css;
  document.head.appendChild(style);
};

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
const READING_SCROLL_KEYS = new Set([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
  ' '
]);

const isEditableKeyboardTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
};

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

const CODE_FILE_EXTENSIONS: Record<string, string> = {
  bash: 'sh', c: 'c', cpp: 'cpp', cs: 'cs', css: 'css', docker: 'dockerfile',
  dockerfile: 'dockerfile', go: 'go', gql: 'graphql', graphql: 'graphql', html: 'html',
  java: 'java', js: 'js', json: 'json', jsx: 'jsx', kt: 'kt', md: 'md', py: 'py',
  rb: 'rb', rs: 'rs', scss: 'scss', sh: 'sh', sql: 'sql', swift: 'swift', ts: 'ts',
  tsx: 'tsx', xml: 'xml', yaml: 'yaml', yml: 'yaml', zsh: 'sh'
};

const getCodeFileExtension = (lang?: string) => {
  if (!lang) return 'txt';
  return CODE_FILE_EXTENSIONS[lang.toLowerCase()] || 'txt';
};

const getCodeText = (children: React.ReactNode) => extractTextFromReactNode(children)
  .replace(/\r\n?/g, '\n')
  .replace(/\n$/, '');

const PreBlock = ({ children, node: _node, ...props }: React.DetailedHTMLProps<React.HTMLAttributes<HTMLPreElement>, HTMLPreElement> & { node?: unknown }) => {
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [needsExpand, setNeedsExpand] = useState(false);
  const resetTimerRef = useRef<number | null>(null);
  const lang = extractLangFromChildren(children);
  const isMermaidBlock = React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && child.type === MermaidBlock
  );
  const code = getCodeText(children);
  const lineCount = Math.max(1, code ? code.split('\n').length : 1);
  const lineNumbers = Array.from({ length: lineCount }, (_, index) => index + 1);

  useEffect(() => {
    setNeedsExpand(lineCount > MAX_CODE_LINES);
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, [lineCount]);

  const markCopied = () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    setCopied(true);
    resetTimerRef.current = window.setTimeout(() => setCopied(false), 2200);
  };

  const handleCopy = async () => {
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
      textArea.setAttribute('readonly', '');
      textArea.style.position = 'fixed';
      textArea.style.left = '-9999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        if (document.execCommand('copy')) markCopied();
      } finally {
        textArea.remove();
      }
    }
  };

  const handleDownload = () => {
    const objectUrl = URL.createObjectURL(new Blob([code], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = `code-snippet.${getCodeFileExtension(lang)}`;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  };

  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<BlockCodeProps>, { isBlock: true });
    }
    return child;
  });

  if (isMermaidBlock || lang?.toLowerCase() === 'mermaid') {
    return <>{children}</>;
  }

  return (
    <div className="code-block group relative my-5 md:my-7">
      <div className="code-toolbar">
        <span className="code-language" aria-label={`代码语言：${lang ? getLangDisplayName(lang) : '纯文本'}`}>
          {lang ? getLangDisplayName(lang) : '纯文本'}
        </span>
        <div className="code-toolbar-actions">
          {copied && <span className="code-copy-feedback" role="status" aria-live="polite">代码已复制</span>}
          <button type="button" onClick={handleCopy} className={`code-action-btn ${copied ? 'code-action-btn-success' : ''}`} title={copied ? '已复制' : '复制代码'} aria-label={copied ? '已复制' : '复制代码'}>
            {copied ? <span className="copy-pop"><Check size={15} aria-hidden="true" /></span> : <Copy size={15} aria-hidden="true" />}
            <span>{copied ? '已复制' : '复制'}</span>
          </button>
          <button type="button" onClick={handleDownload} className="code-action-btn" title="下载代码" aria-label="下载代码">
            <Download size={15} aria-hidden="true" />
            <span>下载</span>
          </button>
        </div>
      </div>

      <div className={`code-scroll ${needsExpand && !isExpanded ? 'code-block-collapsed' : 'code-block-expanded'}`}>
        <div className="code-content">
          <div className="code-line-numbers" aria-hidden="true">
            {lineNumbers.map((number) => <span key={number}>{number}</span>)}
          </div>
          <pre {...props} className={`${props.className || ''} !my-0 !min-w-max !bg-transparent !p-3.5 !leading-6 md:!p-5`}>
            {childrenWithProps}
          </pre>
        </div>
        {needsExpand && !isExpanded && (
          <button type="button" onClick={() => setIsExpanded(true)} className="code-expand-btn" aria-label="展开完整代码" aria-expanded="false">
            <ChevronDown size={15} aria-hidden="true" />
            展开完整代码（共 {lineCount} 行）
          </button>
        )}
        {needsExpand && isExpanded && (
          <button type="button" onClick={() => setIsExpanded(false)} className="code-collapse-btn" aria-label="折叠代码" aria-expanded="true">
            <ChevronUp size={15} aria-hidden="true" />
            折叠代码
          </button>
        )}
      </div>
    </div>
  );
};

const MERMAID_MIN_SCALE = 1;
const MERMAID_MAX_SCALE = 4;
const MERMAID_ZOOM_STEP = 0.25;

const clampMermaidScale = (scale: number) => Math.min(MERMAID_MAX_SCALE, Math.max(MERMAID_MIN_SCALE, scale));

function MermaidBlock({ children, renderer, theme }: { children: string; renderer: MermaidRenderer | null; theme: 'light' | 'dark' }) {
  const [svg, setSvg] = useState('');
  const [status, setStatus] = useState<MermaidStatus>('idle');
  const [scale, setScale] = useState(MERMAID_MIN_SCALE);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const mermaidIdRef = useRef<string | null>(null);
  const dragRef = useRef({ pointerId: -1, startX: 0, startY: 0, startPositionX: 0, startPositionY: 0 });

  const getMermaidId = () => {
    if (mermaidIdRef.current === null) {
      mermaidIdRef.current = `mermaid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    }
    return mermaidIdRef.current;
  };

  const resetView = () => {
    setScale(MERMAID_MIN_SCALE);
    setPosition({ x: 0, y: 0 });
  };

  const zoomTo = (nextScale: number) => {
    const clampedScale = clampMermaidScale(nextScale);
    setScale(clampedScale);
    if (clampedScale <= MERMAID_MIN_SCALE) {
      setPosition({ x: 0, y: 0 });
    }
  };

  const toggleZoom = () => zoomTo(scale > MERMAID_MIN_SCALE ? MERMAID_MIN_SCALE : 2);

  useEffect(() => {
    setSvg('');
    resetView();
    if (!renderer) {
      setStatus('idle');
      return;
    }

    let cancelled = false;
    setStatus('loading');

    const renderDiagram = async () => {
      try {
        const { svg: renderedSvg } = await renderer.render(getMermaidId(), children.trim());
        if (!cancelled) {
          setSvg(renderedSvg);
          setStatus('ready');
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Mermaid render error:', error);
          setSvg('');
          setStatus('error');
        }
      }
    };

    void renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [children, renderer, theme]);

  useEffect(() => {
    if (scale <= MERMAID_MIN_SCALE) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    if (!svg || (scale <= MERMAID_MIN_SCALE && !event.ctrlKey && !event.metaKey)) return;
    event.preventDefault();
    zoomTo(scale + (event.deltaY > 0 ? -MERMAID_ZOOM_STEP : MERMAID_ZOOM_STEP));
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (scale <= MERMAID_MIN_SCALE || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPositionX: position.x,
      startPositionY: position.y
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    setPosition({
      x: dragRef.current.startPositionX + event.clientX - dragRef.current.startX,
      y: dragRef.current.startPositionY + event.clientY - dragRef.current.startY
    });
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current.pointerId = -1;
    setIsDragging(false);
  };

  const handleDoubleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    toggleZoom();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomTo(scale + MERMAID_ZOOM_STEP);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomTo(scale - MERMAID_ZOOM_STEP);
    } else if (event.key === '0') {
      event.preventDefault();
      resetView();
    } else if (scale > MERMAID_MIN_SCALE && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const distance = event.shiftKey ? 48 : 24;
      const xDelta = event.key === 'ArrowLeft' ? distance * -1 : event.key === 'ArrowRight' ? distance : 0;
      const yDelta = event.key === 'ArrowUp' ? distance * -1 : event.key === 'ArrowDown' ? distance : 0;
      setPosition((current) => ({ x: current.x + xDelta, y: current.y + yDelta }));
    }
  };

  if (!svg) {
    const isError = status === 'error';
    return (
      <div className={`mermaid-container mermaid-status my-8 ${isError ? 'is-error' : ''}`} role={isError ? 'alert' : 'status'} aria-live="polite">
        <div className="mermaid-status-icon" aria-hidden="true">
          {isError ? <TriangleAlert size={20} /> : <LoaderCircle className="animate-spin" size={20} />}
        </div>
        <div>
          <p className="mermaid-status-title">{isError ? '图表渲染失败' : '正在生成图表'}</p>
          <p className="mermaid-status-description">
            {isError ? '请检查 Mermaid 语法，原始内容已保留在下方。' : '正在加载 Mermaid 并适配当前主题。'}
          </p>
        </div>
        {isError && <pre className="mermaid-source"><code>{children}</code></pre>}
      </div>
    );
  }

  const sanitizedSvg = typeof DOMPurify !== 'undefined'
    ? DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } })
    : svg;
  const scaleLabel = `${Math.round(scale * 100)}%`;

  return (
    <div className="mermaid-container my-8 rounded-none border border-zinc-300 bg-zinc-50 p-3 shadow-none dark:border-zinc-700 dark:bg-zinc-900/50 sm:p-4">
      <div className="mermaid-toolbar" role="toolbar" aria-label="Mermaid 图表工具">
        <span className="mermaid-toolbar-label">图表缩放</span>
        <div className="mermaid-toolbar-actions">
          <button type="button" className="mermaid-action-btn" onClick={() => zoomTo(scale - MERMAID_ZOOM_STEP)} disabled={scale <= MERMAID_MIN_SCALE} aria-label="缩小 Mermaid 图表" title="缩小">
            <Minus size={15} aria-hidden="true" />
          </button>
          <span className="mermaid-scale" aria-live="polite">{scaleLabel}</span>
          <button type="button" className="mermaid-action-btn" onClick={() => zoomTo(scale + MERMAID_ZOOM_STEP)} disabled={scale >= MERMAID_MAX_SCALE} aria-label="放大 Mermaid 图表" title="放大">
            <Plus size={15} aria-hidden="true" />
          </button>
          <button type="button" className="mermaid-action-btn" onClick={resetView} aria-label="重置 Mermaid 图表视图" title="重置">
            <RotateCcw size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        className={`mermaid-viewport ${scale > MERMAID_MIN_SCALE ? 'is-zoomed' : ''} ${isDragging ? 'is-dragging' : ''}`}
        tabIndex={0}
        role="application"
        aria-label="Mermaid 图表，可缩放和拖动"
        onWheel={handleWheel}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
      >
        <div className="mermaid-scene" style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})` }}>
          <div className="mermaid-diagram" dangerouslySetInnerHTML={{ __html: sanitizedSvg }} />
        </div>
      </div>
      <p className="mermaid-hint">滚轮或按钮缩放 · 放大后拖动平移 · 双击切换 · 按 0 重置</p>
    </div>
  );
}

const isSafeMarkdownHref = (href?: string) => {
  if (!href || href.startsWith('//')) {
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

// 文章图片均使用外链（图床 URL）；此处仅对极少数未以 / 开头的站内相对路径做兜底归一化。
const isAbsoluteAssetPath = (value: string) => value.startsWith('/') || /^[a-z][a-z0-9+.-]*:/i.test(value);

const resolveSitePath = (value: string) => {
  const clean = value.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^(\.\.\/)+/g, '');
  return assetUrl(`/${clean}`);
};

const resolveBrowserAsset = (value?: string) => {
  if (!value || /^[a-z][a-z\d+.-]*:/i.test(value) || value.startsWith('//')) {
    return value;
  }
  return assetUrl(value);
};

const normalizeImageUrl = (value: string) => {
  const withoutHash = value.split('#', 1)[0];
  const withoutQuery = withoutHash.split('?', 1)[0];
  return withoutQuery.replace(/\\/g, '/').replace(/^\.\/+/, '').replace(/^\/+/, '').toLowerCase();
};

const getPostSourceUrl = (repoUrl: string, filePath: string) => {
  const sourcePath = filePath.replace(/\\/g, '/').replace(/^\/+/, '').split('/').filter(Boolean)
    .map((segment) => encodeURIComponent(segment)).join('/');
  return `${repoUrl.replace(/\/+$/, '')}/blob/main/${sourcePath}`;
};

const findImageDimensions = (imageDimensions: PostMetadata['imageDimensions'], src: string) => {
  if (!imageDimensions) {
    return undefined;
  }

  const normalizedSrc = normalizeImageUrl(src);
  const matchingKey = Object.keys(imageDimensions).find((key) => {
    const normalizedKey = normalizeImageUrl(key);
    return normalizedKey === normalizedSrc
      || normalizedKey.endsWith(`/${normalizedSrc}`)
      || normalizedSrc.endsWith(`/${normalizedKey}`);
  });
  return matchingKey ? imageDimensions[matchingKey] : undefined;
};

const createMarkdownComponents = (
  onPreviewImage: (image: { src: string; alt?: string }) => void,
  mermaidRenderer: MermaidRenderer | null,
  mermaidTheme: 'light' | 'dark',
  imageDimensions: PostMetadata['imageDimensions'],
  headings: MarkdownHeading[],
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

  const renderHeading = (level: number, Tag: string, { children, node: _node, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { node?: unknown }) => {
    const id = resolveHeadingId(level, children);
    return React.createElement(
      Tag,
      { ...props, id, className: 'heading-anchor-wrapper' },
      // 锚点用 span+role 模拟按钮而非 <button>：标题内部可能已有链接/交互元素，
      // 嵌套 <button> 属非法 HTML，会导致水合告警与点击行为异常。
      React.createElement(
        'span',
        {
          className: 'heading-anchor',
          role: 'button',
          tabIndex: 0,
          onClick: (e: React.MouseEvent) => { e.stopPropagation(); handleHeadingClick(id); },
          onKeyDown: (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); handleHeadingClick(id); } },
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
    a: ({ href, children, node: _node, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) => {
      const hrefIsImage = href ? isImageUrl(href) : false;
      const resolvedHref = href && hrefIsImage ? (isAbsoluteAssetPath(href) ? resolveBrowserAsset(href) : resolveSitePath(href)) : href;
      const safeHref = isSafeMarkdownHref(resolvedHref) ? resolvedHref : undefined;
      const normalizedHref = safeHref && safeHref.startsWith('/') ? routeUrl(safeHref) : safeHref;

      if (normalizedHref && isImageUrl(normalizedHref)) {
        const childElements = React.Children.toArray(children);
        const imageChild = childElements.find(
          (child): child is React.ReactElement<MarkdownImageProps> =>
            React.isValidElement(child) && typeof (child.props as Record<string, unknown>).src === 'string'
        );

        if (imageChild) {
          return React.cloneElement(imageChild, { previewSrc: normalizedHref });
        }

        // 自定义 img 渲染器会输出已含预览按钮的 <figure>，不能再包一层按钮
        // （嵌套交互元素属非法 HTML，且会双重触发预览）。
        const containsMarkdownFigure = childElements.some(
          (child) => React.isValidElement(child) && (child.props as Record<string, unknown>)['data-role'] === 'markdown-figure'
        );
        if (containsMarkdownFigure) {
          return <>{children}</>;
        }

        const imgAlt = childElements
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
            onClick={(e) => { e.preventDefault(); onPreviewImage({ src: normalizedHref, alt: imgAlt || undefined }); }}
            className="block w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100"
            aria-label={imgAlt ? `预览图片：${imgAlt}` : '预览图片'}
          >
            {children}
          </button>
        );
      }

      if (!normalizedHref) {
        return <>{children}</>;
      }

      // 站内链接保持 SPA 的同页导航；只有真正的 HTTP(S) 外链才新开标签。
      // 这样文章内锚点不会意外打开新页面，键盘和浏览器历史行为也与普通站内链接一致。
      const isInternalLink = normalizedHref.startsWith('#')
        || normalizedHref.startsWith('/')
        || normalizedHref.startsWith('./')
        || normalizedHref.startsWith('../');
      if (isInternalLink) {
        return <Link to={normalizedHref} {...props}>{children}</Link>;
      }

      const isHttpExternal = /^https?:/i.test(normalizedHref);
      return (
        <a
          href={normalizedHref}
          {...(isHttpExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          {...props}
        >
          {children}
        </a>
      );
    },
    img: ({ src, alt, title, previewSrc, node: _node, ...props }: MarkdownImageProps) => {
      const resolvedSrc = src ? (isAbsoluteAssetPath(src) ? resolveBrowserAsset(src) : resolveSitePath(src)) : src;
      const previewTarget = previewSrc || resolvedSrc || '';
      const dimensions = resolvedSrc ? findImageDimensions(imageDimensions, resolvedSrc) : undefined;
      return (
        <figure data-role="markdown-figure" className="group/myimage my-7 md:my-10">
          <button
            type="button"
            onClick={() => onPreviewImage({ src: previewTarget, alt })}
            className="relative block w-full overflow-hidden rounded-media border border-zinc-300 bg-zinc-50 shadow-none transition-colors duration-200 hover:border-zinc-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-zinc-500 dark:focus-visible:outline-zinc-100"
            aria-label={alt ? `预览图片：${alt}` : '预览图片'}
          >
            <ProgressiveImage
              {...props}
              src={resolvedSrc}
              alt={alt}
              loading="lazy"
              decoding="async"
              width={dimensions?.width ?? props.width}
              height={dimensions?.height ?? props.height}
              wrapperClassName="w-full rounded-media"
              className="h-auto w-full cursor-zoom-in rounded-media object-contain transition-opacity duration-200 group-hover/myimage:opacity-95"
            />
            <span className="pointer-events-none absolute right-3 top-3 rounded-micro border border-white/20 bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85 opacity-0 transition-opacity duration-200 group-hover/myimage:opacity-100 group-focus-visible/myimage:opacity-100">
              预览
            </span>
          </button>
          {(alt || title) && (
            <figcaption className="mt-2.5 text-center text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">
              {alt || title}
            </figcaption>
          )}
        </figure>
      );
    },
    pre: PreBlock,
    table: ({ children, node: _node, ...props }: React.TableHTMLAttributes<HTMLTableElement> & { node?: unknown }) => (
      <div className="table-wrapper">
        <table {...props} className="min-w-full">
          {children}
        </table>
      </div>
    ),
    code: ({ className, children, node: _node, ...props }) => {
      const { isBlock, ...restProps } = props as React.HTMLAttributes<HTMLElement> & BlockCodeProps;
      const isBlockCode = Boolean(isBlock) || /language-(\w+)/.test(className || '');

      if (className?.includes('language-mermaid')) {
        return <MermaidBlock renderer={mermaidRenderer} theme={mermaidTheme}>{String(children)}</MermaidBlock>;
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
  // SSG 场景：构建期已把文章数据（含正文）注入 routeData，首帧同步渲染正文；
  // SPA 导航到其他文章时 routeData 无数据，回落到异步加载（loading 初始 true）。
  const ssgRouteData = useSsgRouteData();
  const ssgPost = ssgRouteData?.post;
  const hasSsgPost = ssgPost !== undefined && ssgPost.id === id;
  const [post, setPost] = useState<PostType | null>(() => ssgPost ?? null);
  const [loading, setLoading] = useState(!hasSsgPost);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [previewImage, setPreviewImage] = useState<{ src: string; alt?: string } | null>(null);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [remarkPlugins, setRemarkPlugins] = useState<MarkdownPlugin[]>([remarkGfm]);
  const [rehypePlugins, setRehypePlugins] = useState<MarkdownPlugin[]>([]);
  const [mermaidRenderer, setMermaidRenderer] = useState<MermaidRenderer | null>(null);
  const [mermaidTheme, setMermaidTheme] = useState<'light' | 'dark'>('light');
  const [mobileFloatingVisible, setMobileFloatingVisible] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const { isReadingMode, exitReadingMode } = useReadingMode();
  const { isSaved, isSaving, error: offlineError, toggleSaved } = useOfflinePosts(post ?? undefined);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [adjacentPosts, setAdjacentPosts] = useState<{ prev: PostMetadata | null; next: PostMetadata | null }>(ssgRouteData?.adjacentPosts ?? { prev: null, next: null });
  const [seriesNavigation, setSeriesNavigation] = useState<SeriesNavigation | null>(ssgRouteData?.seriesNavigation ?? null);
  const [relatedPosts, setRelatedPosts] = useState<PostMetadata[]>(ssgRouteData?.relatedPosts ?? []);
  const articleBodyRef = useRef<HTMLDivElement>(null);
  const readingEndRef = useRef<HTMLDivElement>(null);
  const lastReadingSaveRef = useRef(0);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const updateTheme = () => {
      setMermaidTheme(getIsDarkTheme() ? 'dark' : 'light');
    };
    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    updateTheme();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!id) {
      setPost(null);
      setLoadError(null);
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    // SSG 场景：当前 id 与构建期注入的路由数据一致（首屏水合 / 从其他文章返回），
    // 直接同步使用 routeData 填充各状态。若此处也走异步重取，水合后会把已渲染的
    // 正文换成骨架屏、并清空相邻/系列/相关文章，造成可见闪烁与布局跳变。
    // 仅当 loadAttempt > 0（用户点击“重新加载”）时才允许绕过 SSG 数据强制重取。
    if (hasSsgPost && loadAttempt === 0) {
      setPost(ssgPost);
      setLoading(false);
      setLoadError(null);
      setAdjacentPosts(ssgRouteData?.adjacentPosts ?? { prev: null, next: null });
      setSeriesNavigation(ssgRouteData?.seriesNavigation ?? null);
      setRelatedPosts(ssgRouteData?.relatedPosts ?? []);
      return () => {
        cancelled = true;
      };
    }

    setLoading(true);
    setPost(null);
    setLoadError(null);
    // Do not expose the previous article's navigation while the next article is loading.
    setAdjacentPosts({ prev: null, next: null });
    setSeriesNavigation(null);
    setRelatedPosts([]);

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
  }, [hasSsgPost, id, loadAttempt, ssgPost, ssgRouteData]);

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
      const containsMermaid = hasMermaidDiagrams(post.content);

      if (containsMermaid) {
        setMermaidRenderer(null);
      }

      if (hasCodeBlocks(post.content)) {
        tasks.push((async () => {
          const { default: rehypeHighlight } = await import('rehype-highlight');

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
          if (cancelled) {
            return;
          }

          mermaid.initialize(getMermaidConfig(mermaidTheme === 'dark'));
          nextMermaidRenderer = mermaid as MermaidRenderer;
        })());
      }

      try {
        await Promise.all(tasks);
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load markdown enhancements:', error);
          setRemarkPlugins([remarkGfm]);
          setRehypePlugins([]);
          setMermaidRenderer(null);
        }
        return;
      }

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
  }, [mermaidTheme, post?.content]);

  useEffect(() => {
    if (!post?.content || !hasCodeBlocks(post.content)) {
      // 当前内容无需高亮主题时，移除历史残留的样式节点，避免泄漏到其他页面。
      document.getElementById(HIGHLIGHT_STYLE_ID)?.remove();
      return;
    }

    let cancelled = false;
    void loadHighlightThemeCss(mermaidTheme === 'dark')
      .then((css) => {
        if (!cancelled) {
          syncHighlightTheme(css);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to sync highlight.js theme:', error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mermaidTheme, post?.content]);

  // 离开文章页时移除注入的高亮主题样式，避免跨路由泄漏。
  useEffect(() => {
    return () => {
      document.getElementById(HIGHLIGHT_STYLE_ID)?.remove();
    };
  }, []);

  const headings = useMemo(() => extractMarkdownHeadings(post?.content ?? ''), [post?.content]);

  useEffect(() => {
    if (!post?.content || headings.length === 0 || typeof window === 'undefined') {
      return;
    }

    let hashId = '';
    try {
      hashId = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      // Ignore malformed URL fragments instead of interrupting article rendering.
      return;
    }

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

  useEffect(() => {
    if (!post) return;
    // SSG 首帧已用 routeData 填充 adjacent/series/related，无需再异步重取；
    // 跳过可避免冗余网络请求，并消除 SSG 数据被异步结果覆盖的时序窗口。
    if (hasSsgPost && loadAttempt === 0) return;
    let cancelled = false;

    getPosts()
      .then((allPosts) => {
        if (cancelled) return;
        const currentIndex = allPosts.findIndex((p) => p.id === post.id);
        const previous = currentIndex > 0 ? allPosts[currentIndex - 1] : null;
        const next = currentIndex < allPosts.length - 1 ? allPosts[currentIndex + 1] : null;
        setAdjacentPosts({ prev: previous, next });
        setSeriesNavigation(getSeriesNavigation(allPosts, post));
        setRelatedPosts(getRelatedPosts(allPosts, post, {
          limit: 3,
          excludeIds: [previous?.id, next?.id].filter((value): value is string => Boolean(value))
        }));
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('Failed to load adjacent posts:', error);
        }
      });

    return () => { cancelled = true; };
  }, [post, hasSsgPost, loadAttempt]);

  useEffect(() => {
    const target = articleBodyRef.current;
    if (!post || !target || typeof window === 'undefined' || window.location.hash) {
      return;
    }

    const savedEntry = getReadingHistoryEntry(post.id);
    if (!savedEntry || isReadingComplete(savedEntry.progress)) return;

    let cancelled = false;
    let userIntent = false;
    let frame = 0;
    let lastDocumentHeight = -1;
    let stableFrames = 0;
    let programmaticScroll = false;
    let resetProgrammaticFrame = 0;
    let restoreDelay = 0;
    // 结尾哨兵（readingEndRef）只在非专注阅读模式渲染。进入专注阅读后该节点
    // 会从 DOM 移除，若此时恢复流程仍未结束，restore() 将无限重排（100% CPU）。
    // 连续多次找不到结尾哨兵即放弃恢复，避免死循环。
    let missingEndRefCount = 0;
    const MAX_MISSING_END_REF = 8;
    const restoreGraceUntil = performance.now() + 500;

    const stopRestore = () => {
      userIntent = true;
    };
    const handleScroll = () => {
      if (!programmaticScroll && performance.now() >= restoreGraceUntil) stopRestore();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isEditableKeyboardTarget(event.target) && READING_SCROLL_KEYS.has(event.key)) stopRestore();
    };
    const scheduleRestore = () => {
      if (!frame && !cancelled && !userIntent) frame = window.requestAnimationFrame(restore);
    };
    const scheduleDelayedRestore = () => {
      if (restoreDelay || cancelled || userIntent) return;
      const delay = Math.max(restoreGraceUntil - performance.now(), 0);
      restoreDelay = window.setTimeout(() => {
        restoreDelay = 0;
        scheduleRestore();
      }, delay);
    };
    const scheduleLayoutRestore = () => {
      if (performance.now() < restoreGraceUntil) {
        scheduleDelayedRestore();
        return;
      }
      scheduleRestore();
    };
    const restore = () => {
      frame = 0;
      if (cancelled || userIntent) return;
      const documentHeight = document.documentElement.scrollHeight;
      stableFrames = documentHeight === lastDocumentHeight ? stableFrames + 1 : 0;
      lastDocumentHeight = documentHeight;
      const rect = target.getBoundingClientRect();
      const endTarget = readingEndRef.current;
      const endRect = endTarget?.getBoundingClientRect();
      if (!endTarget || !endRect) {
        missingEndRefCount += 1;
        // 结尾哨兵持续缺失（如已进入专注阅读模式）：放弃恢复，避免无限重排。
        if (missingEndRefCount >= MAX_MISSING_END_REF) {
          return;
        }
        scheduleLayoutRestore();
        return;
      }
      missingEndRefCount = 0;
      const top = getScrollTopForReadingProgress({
        rect,
        endRect,
        viewportHeight: window.innerHeight,
        scrollY: window.scrollY,
        documentHeight
      }, savedEntry.progress);
      programmaticScroll = true;
      window.scrollTo({ top, behavior: 'auto' });
      if (resetProgrammaticFrame) window.cancelAnimationFrame(resetProgrammaticFrame);
      resetProgrammaticFrame = window.requestAnimationFrame(() => {
        resetProgrammaticFrame = window.requestAnimationFrame(() => { programmaticScroll = false; });
      });
      // Re-apply after layout settles (images, syntax highlighting, and math can resize the article).
      if (stableFrames < 2) scheduleRestore();
    };
    const resizeObserver = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(scheduleLayoutRestore)
      : null;

    window.addEventListener('wheel', stopRestore, { passive: true });
    window.addEventListener('touchstart', stopRestore, { passive: true });
    window.addEventListener('pointerdown', stopRestore, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', scheduleLayoutRestore);
    resizeObserver?.observe(target);
    resizeObserver?.observe(document.documentElement);
    if (readingEndRef.current) resizeObserver?.observe(readingEndRef.current);
    scheduleDelayedRestore();

    return () => {
      cancelled = true;
      window.removeEventListener('wheel', stopRestore);
      window.removeEventListener('touchstart', stopRestore);
      window.removeEventListener('pointerdown', stopRestore);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', scheduleLayoutRestore);
      resizeObserver?.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      if (restoreDelay) window.clearTimeout(restoreDelay);
      if (resetProgrammaticFrame) window.cancelAnimationFrame(resetProgrammaticFrame);
    };
  }, [post?.id, headings.length]);

  useEffect(() => {
    const target = articleBodyRef.current;
    if (!post || !target || typeof window === 'undefined') {
      return;
    }

    let animationFrame = 0;
    let latestProgress = 0;
    let hasProgressSnapshot = false;
    let hasScrolledSinceMount = false;
    let completionSaved = false;
    lastReadingSaveRef.current = 0;
    const saveLatestProgress = () => {
      if (!hasProgressSnapshot || completionSaved || isReadingComplete(latestProgress)) return;
      lastReadingSaveRef.current = Date.now();
      saveReadingHistory({ postId: post.id, progress: latestProgress });
    };
    const updateReadingHistory = () => {
      animationFrame = 0;
      const rect = target.getBoundingClientRect();
      const endRect = readingEndRef.current?.getBoundingClientRect();
      const progress = getReadingProgress({
        rect,
        endRect,
        viewportHeight: window.innerHeight,
        scrollY: window.scrollY,
        documentHeight: document.documentElement.scrollHeight
      });
      latestProgress = progress;
      hasProgressSnapshot = true;
      const now = Date.now();
      // The first measurement is only a baseline. Reaching the end counts as
      // complete after a real scroll event, preventing short posts from being
      // completed merely because their initial page has no scroll range.
      if (hasScrolledSinceMount && isReadingComplete(progress)) {
        if (!completionSaved) {
          completionSaved = true;
          lastReadingSaveRef.current = now;
          saveReadingHistory({ postId: post.id, progress });
        }
        return;
      }
      if (isReadingComplete(progress) || now - lastReadingSaveRef.current < 1000) return;
      lastReadingSaveRef.current = now;
      saveReadingHistory({ postId: post.id, progress });
    };
    const scheduleUpdate = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateReadingHistory);
    };
    const handleScroll = () => {
      hasScrolledSinceMount = true;
      scheduleUpdate();
    };

    scheduleUpdate();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', scheduleUpdate);
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      saveLatestProgress();
    };
  }, [post?.id, post?.content, relatedPosts.length]);

  useEffect(() => {
    if (isReadingMode && shareModalOpen) {
      setShareModalOpen(false);
    }
  }, [isReadingMode, shareModalOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (hasOpenOverlay()) {
        return;
      }

      if (e.key === 'Escape') {
        if (previewImage) { setPreviewImage(null); return; }
        if (shareModalOpen) { setShareModalOpen(false); return; }
      }
      if (e.key === 'ArrowLeft' && e.altKey && adjacentPosts.prev) {
        e.preventDefault();
        navigate(`/post/${adjacentPosts.prev.id}`);
      }
      if (e.key === 'ArrowRight' && e.altKey && adjacentPosts.next) {
        e.preventDefault();
        navigate(`/post/${adjacentPosts.next.id}`);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage, shareModalOpen, adjacentPosts, navigate]);

  const markdownComponents = useMemo(
    () => createMarkdownComponents((image) => setPreviewImage(image), mermaidRenderer, mermaidTheme, post?.imageDimensions, headings),
    [mermaidRenderer, mermaidTheme, post?.id, post?.imageDimensions, headings]
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl pt-10" aria-busy="true">
        <LoadingStatus label="正在加载文章内容" />
        <div aria-hidden="true" className={`mb-16 text-center ${shouldReduceMotion ? '' : 'animate-pulse'}`}>
          <div className="mx-auto mb-10 h-6 w-24 rounded-micro bg-zinc-200 dark:bg-zinc-800" />
          <div className="mx-auto mb-8 h-12 w-3/4 rounded-micro bg-zinc-200 dark:bg-zinc-800 md:h-16" />
          <div className="flex justify-center space-x-6">
            <div className="h-4 w-28 rounded-micro bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-32 rounded-micro bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-4 w-20 rounded-micro bg-zinc-200 dark:bg-zinc-800" />
          </div>
        </div>

        <div aria-hidden="true" className="mb-20 aspect-[21/9] w-full animate-pulse rounded-media bg-zinc-200 dark:bg-zinc-800" />

        <div aria-hidden="true" className="mx-auto max-w-3xl animate-pulse space-y-6 pb-32">
          <div className="h-5 w-full rounded-micro bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-11/12 rounded-micro bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-full rounded-micro bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-4/5 rounded-micro bg-zinc-200 dark:bg-zinc-800" />
          <div className="my-10 h-40 w-full rounded-media bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-full rounded-micro bg-zinc-200 dark:bg-zinc-800" />
          <div className="h-5 w-5/6 rounded-micro bg-zinc-200 dark:bg-zinc-800" />
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
      <>
        {/* 文章不存在：SPA 内以 200 响应返回该内容，必须 noindex，
            避免爬虫把已删除文章的 URL 视为可索引页面收录。 */}
        <Seo title="未找到这篇文章" description="你访问的文章不存在，可能已经删除或链接失效。" noindex />
        <NotFoundState
          title="未找到这篇文章"
          description="这篇文章可能还在草稿中、已经被删除，或者链接地址已经发生变化。"
          debugLabel={`Post ID: ${id || 'unknown'}`}
        />
      </>
    );
  }

  const authors = getDisplayAuthors(post);
  const authorsLabel = authors.map((author) => author.name).join('\u3001');
  const postStructuredData = {
    '@context': 'https://schema.org',
    // BlogPosting 是 Article 的子类型，Google 对博客文章富结果更认可该类型。
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt,
    image: post.coverImage ? [absoluteSiteUrl(post.coverImage, siteConfig.url)] : [absoluteSiteUrl(siteConfig.seoImage, siteConfig.url)],
    datePublished: post.date,
    dateModified: post.updatedAt || post.date,
    author: authors.map((author) => {
      const isSiteAuthor = author.name === siteConfig.author.name;
      return {
        '@type': 'Person',
        name: author.name,
        ...(author.url ? { url: author.url } : {}),
        // 站点作者补齐同源社交链接与邮箱，增强实体可信度；
        // 其他作者沿用其 frontmatter 提供的 url。
        ...(isSiteAuthor
          ? {
              sameAs: [siteConfig.social.github],
              email: siteConfig.social.rawEmail
            }
          : {})
      };
    }),
    articleBody: stripMarkdown(post.content),
    wordCount: post.wordCount,
    inLanguage: 'zh-CN',
    articleSection: post.category,
    isPartOf: {
      '@type': 'WebSite',
      name: siteConfig.title,
      url: absoluteSiteUrl('/', siteConfig.url)
    },
    mainEntityOfPage: absoluteSiteUrl(`/post/${post.id}`, siteConfig.url),
    publisher: {
      '@type': 'Organization',
      name: siteConfig.title,
      url: siteConfig.url,
      logo: {
        '@type': 'ImageObject',
        url: absoluteSiteUrl(siteConfig.logo, siteConfig.url)
      }
    },
    keywords: post.tags?.join(', ')
  };

  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首页', item: absoluteSiteUrl('/', siteConfig.url) },
      { '@type': 'ListItem', position: 2, name: post.category, item: absoluteSiteUrl(`/?category=${encodeURIComponent(post.category)}`, siteConfig.url) },
      { '@type': 'ListItem', position: 3, name: post.title, item: absoluteSiteUrl(`/post/${post.id}`, siteConfig.url) }
    ]
  };

  return (
    <>
      <ReadingModeToggle />

      <Suspense fallback={null}>
        {previewImage && <ImageViewer src={previewImage.src} alt={previewImage.alt} onClose={() => setPreviewImage(null)} />}
        {!isReadingMode && <ReadingProgressBadge targetRef={articleBodyRef} endRef={readingEndRef} onVisibilityChange={setMobileFloatingVisible} />}
        {!isReadingMode && headings.length > 0 && (
          <TableOfContents
            headings={headings}
            mobileShowTrigger={mobileFloatingVisible}
            desktopShowTrigger={headings.length > 0}
          />
        )}
      </Suspense>

      <article className={isReadingMode ? 'post-article reading-mode-article' : 'post-article'}>
        {isReadingMode && (
          <button
            type="button"
            onClick={exitReadingMode}
            className="reading-mode-exit print-hidden fixed right-4 top-[calc(1rem+env(safe-area-inset-top,0px))] z-floating inline-flex min-h-11 items-center gap-2 rounded-control border border-zinc-300 bg-paper px-3 py-2 text-sm font-semibold text-zinc-700 transition-colors hover:border-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-500 dark:hover:bg-zinc-800 sm:right-6 sm:top-[calc(1.5rem+env(safe-area-inset-top,0px))]"
            aria-label="退出专注阅读"
          >
            <EyeOff size={16} />
            <span className="hidden sm:inline">退出专注阅读</span>
          </button>
        )}

        <Seo
          title={post.title}
          description={post.excerpt}
          image={post.coverImage}
          imageWidth={post.coverWidth}
          imageHeight={post.coverHeight}
          url={`/post/${post.id}`}
          type="article"
          publishedTime={post.date}
          modifiedTime={post.updatedAt || post.date}
          authors={authors.map((author) => author.name)}
          section={post.category}
          tags={post.tags}
          keywords={post.tags?.join(', ')}
          // 站点级 WebSite + Organization schema 与文章级 BlogPosting 一并输出，
          // 保证全站各页 schema 一致（publisher 的 Organization 与站点级互不影响）。
          structuredData={[...buildSiteSchemas(post.excerpt), postStructuredData, breadcrumbData]}
        />

        <header className="post-header mx-auto mb-8 max-w-3xl px-3 pt-4 text-center md:mb-12 md:pt-8">
          {!isReadingMode && (
            <div className="print-hidden mb-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-zinc-500 dark:text-zinc-400 md:mb-7">
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
          )}

          {/* LCP 元素首帧即渲染最终可见状态，不设入场动画（避免 SSR 输出 opacity:0） */}
          <div>
            <h1 className="mb-5 break-words text-balance font-serif text-3xl font-bold leading-[1.18] tracking-[-0.02em] text-ink [overflow-wrap:anywhere] dark:text-white md:mb-6 md:text-5xl lg:text-[3.5rem]">
              {post.title}
            </h1>

            {!isReadingMode && (
              <div className="post-meta print-hidden mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-500 sm:gap-2 md:gap-2.5 md:text-xs">
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-micro border border-zinc-300 bg-white/70 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/70">
                  <Users size={14} />
                  <span className="truncate">{authorsLabel}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-micro border border-zinc-300 bg-white/70 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/70">
                  <Calendar size={14} />
                  <span>发布于 {formatMetaDate(post.date)}</span>
                </span>
                {post.updatedAt && post.updatedAt !== post.date && (
                  <span className="inline-flex items-center gap-1.5 rounded-micro border border-zinc-300 bg-white/70 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/70">
                    <Calendar size={14} />
                    <span>更新 {formatMetaDate(post.updatedAt)}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5 rounded-micro border border-zinc-300 bg-white/70 px-3 py-1.5 dark:border-zinc-700 dark:bg-zinc-900/70">
                  <Clock size={14} />
                  <span>{post.readTime}</span>
                </span>
                <button type="button" onClick={() => setShareModalOpen(true)} className="print-hidden inline-flex min-h-11 items-center gap-1.5 rounded-control border border-zinc-400 bg-zinc-100 px-3 py-2 text-zinc-800 transition-colors active:scale-[.98] hover:border-zinc-600 hover:bg-zinc-200 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-400" aria-label={`分享文章：${post.title}`}>
                  <Share2 size={14} />
                  分享
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const wasSaved = isSaved;
                    void toggleSaved()
                      .then(() => setSavedFeedback(wasSaved ? '已取消收藏' : '已保存，可离线阅读'))
                      .catch(() => undefined);
                  }}
                  disabled={isSaving}
                  aria-pressed={isSaved}
                  aria-label={isSaved ? `取消收藏：${post.title}` : `收藏文章：${post.title}`}
                  className="print-hidden inline-flex min-h-11 items-center gap-1.5 rounded-control border border-zinc-400 bg-zinc-100 px-3 py-2 text-zinc-800 transition-colors active:scale-[.98] hover:border-zinc-600 hover:bg-zinc-200 disabled:cursor-wait disabled:opacity-60 disabled:active:scale-100 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:border-zinc-400"
                >
                  <Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} />
                  {isSaving ? '保存中' : isSaved ? '已收藏' : '收藏'}
                </button>
                <span className="sr-only" role="status" aria-live="polite">{savedFeedback || offlineError || ''}</span>
              </div>
            )}
          </div>
        </header>

        {post.coverImage && (
          <button type="button" className="post-cover print-hidden mx-auto block w-full max-w-5xl px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100 sm:px-4 lg:px-0" onClick={() => setPreviewImage({ src: resolveBrowserAsset(post.coverImage!)!, alt: post.title })} aria-label={`预览文章封面：${post.title}`}>
            <div className="mb-8 aspect-[16/10] cursor-zoom-in overflow-hidden rounded-media border border-zinc-300 bg-zinc-100 shadow-none dark:border-zinc-700 dark:bg-zinc-900 sm:aspect-[16/8] md:mb-14 lg:aspect-[21/9]">
              <ProgressiveImage src={resolveBrowserAsset(post.coverImage)} alt={post.title} loading="eager" fetchPriority="high" width={post.coverWidth} height={post.coverHeight} sizes="(max-width: 767px) 100vw, (max-width: 1279px) 80vw, 1024px" wrapperClassName="h-full w-full" className="h-full w-full object-cover" />
            </div>
          </button>
        )}

        <div ref={articleBodyRef} className="post-body mx-auto w-full max-w-5xl px-3 pb-12 sm:px-4 md:pb-20 lg:px-0">
          <div className="mx-auto max-w-[46rem]">
            <div className="post-prose prose prose-stone max-w-none dark:prose-invert md:prose-lg prose-headings:scroll-mt-24 prose-headings:font-serif prose-headings:tracking-tight prose-h2:border-b prose-h2:border-zinc-200 prose-h2:pb-3 dark:prose-h2:border-zinc-800 prose-p:leading-8 prose-li:leading-8 prose-a:break-words prose-a:underline-offset-4 prose-img:rounded-media prose-img:shadow-none prose-blockquote:rounded-none prose-blockquote:border-l-zinc-600 prose-blockquote:bg-zinc-100/70 prose-blockquote:not-italic dark:prose-blockquote:border-l-zinc-400 dark:prose-blockquote:bg-zinc-900 prose-pre:rounded-none prose-pre:border prose-pre:border-zinc-700 prose-pre:bg-[#0d0d0f] prose-pre:p-0">
              <ReactMarkdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={markdownComponents}
              >
                {post.content}
              </ReactMarkdown>
            </div>

            {!isReadingMode && (
              <aside className="post-license mt-14 border-l-2 border-zinc-200 pl-4 text-sm leading-relaxed text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 md:mt-16 md:pl-5" aria-labelledby="license-heading">
              <h2 id="license-heading" className="mb-1 font-semibold text-zinc-700 dark:text-zinc-200">CC BY-SA 4.0 许可协议</h2>
              <p>
                本文由 <strong className="font-semibold text-zinc-700 dark:text-zinc-200">{authorsLabel}</strong> 原创。除非另有声明，可在署名并以相同协议发布衍生作品的前提下自由复制、传播和修改。详见
                <a href="https://creativecommons.org/licenses/by-sa/4.0/deed.zh" target="_blank" rel="noopener noreferrer" className="ml-1 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800 dark:decoration-zinc-700 dark:hover:text-zinc-200">
                  CC BY-SA 4.0
                </a>
                。
              </p>
              </aside>
            )}

            {!isReadingMode && (
              <>
                <div className="mt-8 flex flex-col gap-3 border-t border-zinc-200 pt-6 text-sm sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
                  <p className="text-zinc-500 dark:text-zinc-400">
                    作者 <span className="font-semibold text-zinc-800 dark:text-zinc-200">{authorsLabel}</span>
                  </p>
                  <a
                    href={getPostSourceUrl(siteConfig.friendsPage.repoUrl, post.filePath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-zinc-500 underline decoration-zinc-300 underline-offset-4 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:decoration-zinc-700 dark:hover:text-zinc-100"
                  >
                    <ExternalLink size={14} />
                    <span>帮助改进本文</span>
                  </a>
                </div>

                <div className="post-actions mt-8">
                  <IssueSubscriptionCard />
                </div>

                {seriesNavigation && (
                  <section className="post-series mt-10 border-t border-zinc-200 pt-7 dark:border-zinc-800 md:mt-12 md:pt-8" aria-labelledby="series-heading">
                    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">系列文章</p>
                        <h2 id="series-heading" className="font-serif text-xl font-bold text-ink dark:text-white">{seriesNavigation.name}</h2>
                      </div>
                      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">第 {seriesNavigation.currentIndex + 1} / {seriesNavigation.posts.length} 篇</span>
                    </div>
                    <ol className="space-y-2">
                      {seriesNavigation.posts.map((seriesPost, index) => (
                        <li key={seriesPost.id}>
                          <Link
                            to={`/post/${seriesPost.id}`}
                            aria-current={seriesPost.id === post.id ? 'page' : undefined}
                            className={`flex min-h-11 items-center gap-3 rounded-control border px-3 py-2 text-sm transition-colors ${seriesPost.id === post.id ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-200 text-zinc-700 hover:border-zinc-500 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600'}`}
                          >
                            <span className="w-7 shrink-0 text-center text-xs tabular-nums opacity-60">{index + 1}</span>
                            <span className="min-w-0 flex-1 truncate">{seriesPost.title}</span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                    {(seriesNavigation.previous || seriesNavigation.next) && (
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {seriesNavigation.previous ? <Link to={`/post/${seriesNavigation.previous.id}`} className="editorial-button inline-flex min-h-11 items-center justify-center gap-2 text-sm"><ArrowLeft size={15} />上一章</Link> : <span />}
                        {seriesNavigation.next ? <Link to={`/post/${seriesNavigation.next.id}`} className="editorial-button inline-flex min-h-11 items-center justify-center gap-2 text-sm">下一章<ArrowRight size={15} /></Link> : <span />}
                      </div>
                    )}
                  </section>
                )}

                <nav aria-label="文章导航" className="post-navigation mt-10 border-t border-zinc-200 pt-7 dark:border-zinc-800 md:mt-12 md:pt-8">
                    <div className="grid gap-5 sm:grid-cols-2 sm:gap-10">
                    {adjacentPosts.prev ? (
                      <Link
                        to={`/post/${adjacentPosts.prev.id}`}
                        className="group flex min-h-11 min-w-0 items-start gap-3 rounded-control py-1 text-left"
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
                        className="group flex min-h-11 min-w-0 items-start gap-3 rounded-control py-1 text-left sm:justify-end sm:text-right"
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

                  <div className="mt-5 hidden text-center md:block">
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                      快捷键：<kbd className="kbd">Alt</kbd> + <kbd className="kbd">←</kbd> 上一篇 · <kbd className="kbd">Alt</kbd> + <kbd className="kbd">→</kbd> 下一篇 · <kbd className="kbd">Esc</kbd> 关闭弹窗
                    </span>
                  </div>
                </nav>

                <div ref={readingEndRef} aria-hidden="true" className="h-0" />

                {relatedPosts.length > 0 && (
                  <section className="post-related mt-10 border-t border-zinc-200 pt-7 dark:border-zinc-800 md:mt-12 md:pt-8" aria-labelledby="related-heading">
                    <div className="mb-5 flex items-center gap-2">
                      <BookOpen size={16} className="text-zinc-400" />
                      <h2 id="related-heading" className="font-serif text-xl font-bold text-ink dark:text-white">你可能还喜欢</h2>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
                      {relatedPosts.map((relatedPost) => (
                        <Link key={relatedPost.id} to={`/post/${relatedPost.id}`} className="group flex h-24 overflow-hidden rounded-surface border border-zinc-200 bg-white transition-colors hover:border-zinc-500 focus-visible:border-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600 dark:focus-visible:border-zinc-500 sm:block sm:h-auto">
                          {relatedPost.coverImage ? <ProgressiveImage src={resolveBrowserAsset(relatedPost.coverImage)} alt="" loading="lazy" width={relatedPost.coverWidth} height={relatedPost.coverHeight} wrapperClassName="aspect-video h-24 w-auto flex-none bg-zinc-100 dark:bg-zinc-800 sm:h-auto sm:w-full sm:aspect-[16/10]" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" /> : <div className="flex aspect-video h-24 w-auto flex-none items-center justify-center bg-zinc-100 text-xs text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 sm:h-auto sm:w-full sm:aspect-[16/10]">无封面</div>}
                          <div className="min-w-0 flex-1 overflow-hidden p-2 sm:p-3.5">
                            <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-400 dark:text-zinc-500">
                              <span className="truncate">{relatedPost.category}</span>
                              <span aria-hidden="true">·</span>
                              <span className="shrink-0 normal-case tracking-normal">{formatMetaDate(relatedPost.date)}</span>
                            </div>
                            <h3 className="line-clamp-2 text-sm font-semibold leading-relaxed text-zinc-800 group-hover:text-black dark:text-zinc-200 dark:group-hover:text-white">{relatedPost.title}</h3>
                            <p className="mt-0.5 line-clamp-1 text-xs leading-relaxed text-zinc-500 dark:text-zinc-400 sm:mt-2 sm:line-clamp-2">{relatedPost.excerpt}</p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                <GiscusComments postId={post.id} />
              </>
            )}
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
            url={absoluteSiteUrl(`/post/${post.id}`, typeof window !== 'undefined' ? window.location.origin : siteConfig.url)}
          />
        )}
      </Suspense>
    </>
  );
};


