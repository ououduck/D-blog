/**
 * 文章详情页：Markdown 渲染（代码高亮/数学公式/Mermaid）、阅读进度、目录、分享与离线收藏。
 */

import React, { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import type { Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import DOMPurify from 'dompurify';
import { remarkCodeMeta } from '@/utils/remarkCodeMeta';

import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Calendar,
  ChevronRight,
  Share2,
  Copy,
  Check,
  Download,
  FileCode,
  WrapText,
  ChevronDown,
  ChevronUp,
  Users,
  ExternalLink,
  Eye,
  EyeOff,
  BookOpen,
  Bookmark,
  Minus,
  Plus,
  RotateCcw,
  LoaderCircle,
  TriangleAlert,
  Github,
} from 'lucide-react';
import { getPostById, getPosts } from '@/services/posts';
import { getReadingHistoryEntry, saveReadingHistory } from '@/services/readingHistory';
import { getRelatedPosts, getSeriesNavigation, type SeriesNavigation } from '@/utils/postRelations';
import { getReadingProgress, getScrollTopForReadingProgress, isReadingComplete } from '@/utils/readingProgress';
import type { Post as PostType, PostAuthor, PostMetadata } from '../types';
import { useOfflinePosts } from '@/hooks/useOfflinePosts';
import { assetUrl, absoluteSiteUrl, routeUrl } from '@/utils/siteUrl';
import { siteConfig } from '@config/site.config';
import { Seo, buildSiteSchemas } from '../components/Seo';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { CompactPostCard } from '@/components/CompactPostCard';
import { NotFoundState } from '@/components/NotFoundState';
import { IssueSubscriptionCard } from '@/components/IssueSubscriptionCard';
import { ContentStatus, LoadingStatus } from '@/components/ContentStatus';
import {
  extractMarkdownHeadings,
  extractTextFromReactNode,
  slugifyHeading,
  stripInlineMarkdown,
} from '@/utils/headings';
import type { MarkdownHeading } from '@/utils/headings';
import { formatDate } from '@/utils/date';
import { stripMarkdown } from '@/utils/markdownText';
import { copyTextToClipboard } from '@/utils/clipboard';
import { downloadBlob } from '@/utils/download';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { hasOpenOverlay } from '@/hooks/useModalOverlay';
import { useReadingMode } from '@/components/ReadingModeContext';
import { ReadingModeToggle } from '@/components/ReadingModeToggle';
import { GiscusComments } from '@/components/GiscusComments';
import { useSsgRouteData } from '@/ssr/routeData';
import { fillBusuanziSpans } from '@/services/busuanzi';
import { HEADING_SCROLL_OFFSET } from '@/utils/scroll';

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

const getMermaidConfig = (isDark: boolean) =>
  ({
    startOnLoad: false,
    securityLevel: 'strict',
    // 标签保留在 SVG 文本节点中，DOMPurify 的 SVG 配置才能保留它们。
    htmlLabels: false,
    theme: 'base',
    // GitHub 式渲染：字号提到 18px 并加大节点/层级间距，配合下方
    // 「按自然宽度渲染、宽图横向滚动」的基础视图，保证图表文字清晰可读。
    flowchart: { htmlLabels: false, curve: 'basis', padding: 20, nodeSpacing: 55, rankSpacing: 70, useMaxWidth: true },
    sequence: {
      useMaxWidth: true,
      diagramMarginX: 36,
      diagramMarginY: 28,
      actorMargin: 60,
      boxMargin: 12,
      messageMargin: 40,
    },
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
          fontSize: '18px',
          fontFamily: '"Microsoft YaHei", "PingFang SC", ui-sans-serif, system-ui, sans-serif',
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
          fontSize: '18px',
          fontFamily: '"Microsoft YaHei", "PingFang SC", ui-sans-serif, system-ui, sans-serif',
        },
  }) as const;

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
    day: '2-digit',
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
      bio: siteConfig.author.bio,
    },
  ];
};

const ImageViewer = lazy(() => import('../components/ImageViewer').then((m) => ({ default: m.ImageViewer })));
const ShareModal = lazy(() => import('../components/ShareModal').then((m) => ({ default: m.ShareModal })));
const TableOfContents = lazy(() =>
  import('../components/TableOfContents').then((m) => ({ default: m.TableOfContents })),
);
const ReadingProgressBadge = lazy(() =>
  import('../components/ReadingProgressBadge').then((m) => ({ default: m.ReadingProgressBadge })),
);
const MAX_CODE_LINES = 30;
/** hash 深链滚动校正上限：Mermaid/懒加载内容导致的布局变化最多校正次数。 */
const HASH_SCROLL_MAX_CORRECTIONS = 12;
/** hash 深链滚动校正时间窗（毫秒）：内容稳定后自动断开观察器。 */
const HASH_SCROLL_CORRECTION_WINDOW_MS = 3000;
const READING_SCROLL_KEYS = new Set([
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowUp',
  'End',
  'Home',
  'PageDown',
  'PageUp',
  ' ',
]);

const isEditableKeyboardTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName);
};

const extractLangFromChildren = (children: React.ReactNode): string | undefined => {
  const codeChild = React.Children.toArray(children).find(
    (child) => React.isValidElement(child) && typeof (child.props as Record<string, unknown>).className === 'string',
  ) as React.ReactElement | undefined;
  if (!codeChild) return undefined;
  const cls = (codeChild.props as Record<string, string>).className || '';
  const match = cls.match(/language-(\w+)/);
  return match ? match[1] : undefined;
};

const getLangDisplayName = (lang: string): string => {
  const langMap: Record<string, string> = {
    js: 'JavaScript',
    jsx: 'JSX',
    ts: 'TypeScript',
    tsx: 'TSX',
    py: 'Python',
    rb: 'Ruby',
    go: 'Go',
    rs: 'Rust',
    java: 'Java',
    kt: 'Kotlin',
    swift: 'Swift',
    html: 'HTML',
    css: 'CSS',
    scss: 'SCSS',
    json: 'JSON',
    yaml: 'YAML',
    yml: 'YAML',
    xml: 'XML',
    md: 'Markdown',
    sql: 'SQL',
    sh: 'Shell',
    bash: 'Bash',
    zsh: 'Zsh',
    dockerfile: 'Dockerfile',
    docker: 'Docker',
    graphql: 'GraphQL',
    gql: 'GraphQL',
    c: 'C',
    cpp: 'C++',
    cs: 'C#',
  };
  return langMap[lang] || lang;
};

const CODE_FILE_EXTENSIONS: Record<string, string> = {
  bash: 'sh',
  c: 'c',
  cpp: 'cpp',
  cs: 'cs',
  css: 'css',
  docker: 'dockerfile',
  dockerfile: 'dockerfile',
  go: 'go',
  gql: 'graphql',
  graphql: 'graphql',
  html: 'html',
  java: 'java',
  js: 'js',
  json: 'json',
  jsx: 'jsx',
  kt: 'kt',
  md: 'md',
  py: 'py',
  rb: 'rb',
  rs: 'rs',
  scss: 'scss',
  sh: 'sh',
  sql: 'sql',
  swift: 'swift',
  ts: 'ts',
  tsx: 'tsx',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  zsh: 'sh',
};

const getCodeFileExtension = (lang?: string) => {
  if (!lang) return 'txt';
  return CODE_FILE_EXTENSIONS[lang.toLowerCase()] || 'txt';
};

/** 从阅读时长文案解析分钟数：优先「N分钟」，其次「N小时」×60，最后回退首个数字。 */
const parseReadMinutes = (readTime: string): number => {
  const minutesMatch = readTime.match(/(\d+(?:\.\d+)?)\s*分钟/);
  if (minutesMatch) return Math.round(Number(minutesMatch[1]));
  const hoursMatch = readTime.match(/(\d+(?:\.\d+)?)\s*小时/);
  if (hoursMatch) return Math.round(Number(hoursMatch[1]) * 60);
  const firstNumber = readTime.match(/\d+/);
  return firstNumber ? Number(firstNumber[0]) : Number.NaN;
};

const getCodeText = (children: React.ReactNode) =>
  extractTextFromReactNode(children).replace(/\r\n?/g, '\n').replace(/\n$/, '');

/**
 * 从 code 子元素读取围栏代码块的 info 字符串（由 remarkCodeMeta 插件透传到
 * data-meta），解析出文件名等展示信息。写法：```ts title="app.ts"。
 */
const extractCodeMeta = (children: React.ReactNode): { filename?: string } => {
  const codeChild = React.Children.toArray(children).find(
    (child) => React.isValidElement(child) && typeof (child.props as Record<string, unknown>).className === 'string',
  ) as React.ReactElement | undefined;
  const meta = codeChild ? (codeChild.props as Record<string, unknown>)['data-meta'] : undefined;
  if (typeof meta !== 'string' || !meta.trim()) return {};
  const filenameMatch = meta.match(/title\s*=\s*["']([^"']+)["']/);
  return filenameMatch && filenameMatch[1].trim() ? { filename: filenameMatch[1].trim() } : {};
};

const PreBlock = ({
  children,
  node: _node,
  ...props
}: React.DetailedHTMLProps<React.HTMLAttributes<HTMLPreElement>, HTMLPreElement> & { node?: unknown }) => {
  const [copied, setCopied] = useState(false);
  const [copiedLine, setCopiedLine] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isWrapped, setIsWrapped] = useState(false);
  const resetTimerRef = useRef<number | null>(null);
  const lang = extractLangFromChildren(children);
  const { filename } = extractCodeMeta(children);
  const isMermaidBlock = React.Children.toArray(children).some(
    (child) => React.isValidElement(child) && child.type === MermaidBlock,
  );
  const code = getCodeText(children);
  const lineCount = Math.max(1, code ? code.split('\n').length : 1);
  // 惰性初始化折叠态：超大代码块首帧即折叠，只渲染 MAX_CODE_LINES 行号；
  // 此前初始 false 会让首帧为上千行生成上千个行号 span，再在 effect 里折叠。
  const [needsExpand, setNeedsExpand] = useState(() => lineCount > MAX_CODE_LINES);
  const lineNumbers = Array.from({ length: lineCount }, (_, index) => index + 1);
  // 折叠状态下只渲染可见范围内的行号（MAX_CODE_LINES 行）：超大代码块首屏
  // 无需为上千行生成上千个行号 span，展开时才渲染全部，减少 DOM 节点数。
  const visibleLineNumbers = needsExpand && !isExpanded ? lineNumbers.slice(0, MAX_CODE_LINES) : lineNumbers;

  // 给 <pre> 内的 <code> 子元素注入块级标记：无语言围栏块 / 缩进代码块没有
  // language-* 类，仅靠 className 判定会被 code 组件误判为行内样式渲染。
  const childrenWithBlockMark = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, { 'data-block-code': 'true' });
    }
    return child;
  });

  useEffect(() => {
    setNeedsExpand(lineCount > MAX_CODE_LINES);
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    };
  }, [lineCount]);

  const clearCopyFeedback = () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      setCopiedLine(null);
    }, 2200);
  };

  const markCopied = () => {
    setCopied(true);
    setCopiedLine(null);
    clearCopyFeedback();
  };

  const markLineCopied = (line: number) => {
    setCopied(false);
    setCopiedLine(line);
    clearCopyFeedback();
  };

  const handleCopy = async () => {
    try {
      const copiedOk = await copyTextToClipboard(code);
      if (copiedOk) markCopied();
    } catch {
      // 复制失败时静默，不打断阅读。
    }
  };

  const handleCopyLine = async (line: number) => {
    const lines = code.split('\n');
    const lineText = lines[line - 1];
    if (lineText === undefined) return;
    try {
      const copiedOk = await copyTextToClipboard(lineText);
      if (copiedOk) markLineCopied(line);
    } catch {
      // 同上，静默失败。
    }
  };

  const handleDownload = () => {
    // title="app.ts" 已带扩展名时不再追加，避免生成 app.ts.ts。
    const baseName = filename || 'code-snippet';
    const extension = getCodeFileExtension(lang);
    const downloadName = baseName.toLowerCase().endsWith(`.${extension}`) ? baseName : `${baseName}.${extension}`;
    downloadBlob(new Blob([code], { type: 'text/plain;charset=utf-8' }), downloadName);
  };

  if (isMermaidBlock || lang?.toLowerCase() === 'mermaid') {
    return <>{children}</>;
  }

  return (
    <div
      className="code-block group relative my-5 md:my-7"
      data-lang={lang ? lang.toLowerCase() : undefined}
      data-wrapped={isWrapped ? 'true' : undefined}
    >
      <div className="code-toolbar">
        <div className="code-toolbar-info">
          {filename && (
            <span className="code-filename" title={filename}>
              <FileCode size={13} aria-hidden="true" />
              <span className="truncate">{filename}</span>
            </span>
          )}
          <span className="code-language" aria-label={`代码语言：${lang ? getLangDisplayName(lang) : '纯文本'}`}>
            {lang ? getLangDisplayName(lang) : '纯文本'}
          </span>
        </div>
        <div className="code-toolbar-actions">
          {copiedLine !== null ? (
            <span className="code-copy-feedback" role="status" aria-live="polite">
              已复制第 {copiedLine} 行
            </span>
          ) : copied ? (
            <span className="code-copy-feedback" role="status" aria-live="polite">
              代码已复制
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setIsWrapped((wrapped) => !wrapped)}
            className={`code-action-btn ${isWrapped ? 'code-action-btn-active' : ''}`}
            title={isWrapped ? '关闭自动换行' : '开启自动换行'}
            aria-label={isWrapped ? '关闭自动换行' : '开启自动换行'}
            aria-pressed={isWrapped}
          >
            <WrapText size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className={`code-action-btn ${copied || copiedLine !== null ? 'code-action-btn-success' : ''}`}
            title={copied || copiedLine !== null ? '已复制' : '复制代码'}
            aria-label={copied || copiedLine !== null ? '已复制' : '复制代码'}
          >
            {copied || copiedLine !== null ? (
              <span className="copy-pop">
                <Check size={15} aria-hidden="true" />
              </span>
            ) : (
              <Copy size={15} aria-hidden="true" />
            )}
            <span>{copied || copiedLine !== null ? '已复制' : '复制'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="code-action-btn"
            title="下载代码"
            aria-label="下载代码"
          >
            <Download size={15} aria-hidden="true" />
            <span>下载</span>
          </button>
        </div>
      </div>

      <div className={`code-scroll ${needsExpand && !isExpanded ? 'code-block-collapsed' : 'code-block-expanded'}`}>
        <div className="code-content">
          <div className="code-line-numbers" aria-hidden="true">
            {visibleLineNumbers.map((number) => (
              <span
                key={number}
                data-line={number}
                title={`复制第 ${number} 行`}
                onClick={() => {
                  void handleCopyLine(number);
                }}
              >
                {number}
              </span>
            ))}
          </div>
          <pre
            {...props}
            className={`${props.className || ''} !my-0 !min-w-max !bg-transparent !p-3.5 !leading-6 md:!p-5`}
          >
            {childrenWithBlockMark}
          </pre>
        </div>
        {needsExpand && !isExpanded && (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="code-expand-btn"
            aria-label="展开完整代码"
            aria-expanded="false"
          >
            <ChevronDown size={15} aria-hidden="true" />
            展开完整代码（共 {lineCount} 行）
          </button>
        )}
        {needsExpand && isExpanded && (
          <button
            type="button"
            onClick={() => setIsExpanded(false)}
            className="code-collapse-btn"
            aria-label="折叠代码"
            aria-expanded="true"
          >
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

/**
 * 从渲染后的 <svg> 读取图表自然宽度（viewBox 宽 / 数值型 width 属性 / 内联
 * max-width 三者取最大）。用于把基础视图限制在图表原始尺寸内，避免容器比
 * 图表宽时被 CSS 拉伸放大而变糊。
 */
const getMermaidNaturalWidth = (svgElement: SVGSVGElement): number => {
  const viewBox = svgElement.getAttribute('viewBox');
  const viewBoxMatch = viewBox?.match(/(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$/);
  const viewBoxWidth = viewBoxMatch ? Number.parseFloat(viewBoxMatch[1]) : 0;
  const widthAttr = svgElement.getAttribute('width');
  const attrWidth = widthAttr && /^\d+(?:\.\d+)?$/.test(widthAttr) ? Number.parseFloat(widthAttr) : 0;
  const inlineMaxWidth = svgElement.style?.maxWidth ? Number.parseFloat(svgElement.style.maxWidth) : 0;
  const natural = Math.max(viewBoxWidth, attrWidth, inlineMaxWidth);
  return Number.isFinite(natural) && natural > 0 ? natural : 0;
};

function MermaidBlock({
  children,
  renderer,
  theme,
}: {
  children: string;
  renderer: MermaidRenderer | null;
  theme: 'light' | 'dark';
}) {
  const [svg, setSvg] = useState('');
  const [status, setStatus] = useState<MermaidStatus>('idle');
  const [scale, setScale] = useState(MERMAID_MIN_SCALE);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  /** 图表在 scale=1 时适配容器后的实际宽度（矢量缩放的基准尺寸）。 */
  const [fitWidth, setFitWidth] = useState(0);
  /** 图表自然宽度（viewBox），用于限制基础视图不超出原始尺寸。 */
  const [naturalWidth, setNaturalWidth] = useState(0);
  const mermaidIdRef = useRef<string | null>(null);
  const dragRef = useRef({ pointerId: -1, startX: 0, startY: 0, startPositionX: 0, startPositionY: 0 });
  // pointermove 的 rAF 合并帧：拖动大图表时避免每事件整块重渲染。
  const dragFrameRef = useRef(0);
  const diagramRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(scale);

  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

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

  // 缩放/平移使用 scaleRef.current 作为增量基准：快速滚轮或键盘连按时，
  // React 闭包中的 scale 状态可能尚未提交，直接计算会丢步。
  const zoomTo = useCallback((nextScale: number) => {
    const clampedScale = clampMermaidScale(nextScale);
    setScale(clampedScale);
    if (clampedScale <= MERMAID_MIN_SCALE) {
      setPosition({ x: 0, y: 0 });
    }
  }, []);

  const zoomBy = useCallback((delta: number) => zoomTo(scaleRef.current + delta), [zoomTo]);

  const toggleZoom = () => zoomTo(scaleRef.current > MERMAID_MIN_SCALE ? MERMAID_MIN_SCALE : 2);

  useEffect(() => {
    resetView();
    if (!renderer) {
      // 渲染器重建中（懒加载 / 主题切换）：保留现有 svg，避免图表闪回
      // 「正在生成图表」的加载态；渲染器就绪后本 effect 重跑并重新渲染。
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
          console.error('Mermaid 图表渲染失败:', error);
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

  // 读取图表自然宽度（viewBox / 数值 width / 内联 max-width 取最大），
  // 作为基础视图宽度与矢量缩放基准；svg 内容变化时重新测量。
  useLayoutEffect(() => {
    const element = svg ? (diagramRef.current?.querySelector('svg') ?? null) : null;
    setNaturalWidth(element ? getMermaidNaturalWidth(element) : 0);
  }, [svg]);

  // 套用显示尺寸。
  //
  // 注意本 effect 不带依赖数组：Post 每次重渲染都会重建 createMarkdownComponents
  // 返回的渲染组件对象，ReactMarkdown 判定组件类型引用变化后可能重建正文子树，
  // 使 .mermaid-diagram 的 dangerouslySetInnerHTML 重新写入、旧 <svg> 节点被
  // 替换为全新节点（内联尺寸随之丢失）。无依赖 + 每次重新 querySelector 保证
  // 任意一次提交后都基于「当前连接中的节点」套用尺寸，宽图永不退回容器宽度
  // 而把文字压缩到看不清（曾出现此问题：ref 指向被替换的旧节点，样式写到了
  // 已脱离文档的节点上）。
  useLayoutEffect(() => {
    const element = svg ? (diagramRef.current?.querySelector('svg') ?? null) : null;
    if (!element) return;
    if (scale > MERMAID_MIN_SCALE && fitWidth > 0) {
      element.style.width = `${fitWidth * scale}px`;
      element.style.maxWidth = 'none';
    } else {
      // GitHub 式基础视图：按图表自然宽度渲染，绝不把宽图压缩到容器宽度
      // （压缩会让图表文字等比缩小、小到看不清）。超出容器宽度时由
      // .mermaid-viewport 横向滚动查看，文字始终保持自然大小。
      element.style.width = naturalWidth > 0 ? `${naturalWidth}px` : '100%';
      element.style.maxWidth = 'none';
    }
    element.style.height = 'auto';
  });

  // 采样 scale=1 时图表容器的实际宽度作为缩放基准；缩放状态下容器会随 SVG
  // 变宽（max-content），因此只在未缩放时更新，避免反馈循环。
  // 同样不带依赖数组：正文子树重建后重新观察当前节点，避免观察器绑定到
  // 已被替换的旧节点上。
  useEffect(() => {
    const element = diagramRef.current;
    if (!element) return;
    const updateFitWidth = () => {
      if (scaleRef.current <= MERMAID_MIN_SCALE && element.clientWidth > 0) {
        setFitWidth(element.clientWidth);
      }
    };
    updateFitWidth();
    const observer = new ResizeObserver(updateFitWidth);
    observer.observe(element);
    return () => observer.disconnect();
  });

  useEffect(() => {
    if (scale <= MERMAID_MIN_SCALE) {
      setPosition({ x: 0, y: 0 });
    }
  }, [scale]);

  // 滚轮缩放使用原生非 passive 监听器：React 19 的 onWheel 注册为 passive，
  // preventDefault 无效，缩放图表时页面会同步滚动。缩放基于 scaleRef.current，
  // 避免快速滚轮时闭包中的 scale 过期导致丢步。
  useEffect(() => {
    const element = viewportRef.current;
    if (!element) {
      return;
    }
    const handleWheel = (event: WheelEvent) => {
      if (!svg || (scaleRef.current <= MERMAID_MIN_SCALE && !event.ctrlKey && !event.metaKey)) return;
      event.preventDefault();
      zoomBy(event.deltaY > 0 ? -MERMAID_ZOOM_STEP : MERMAID_ZOOM_STEP);
    };
    // 原生非 passive wheel 监听：preventDefault 才能阻止页面随图表缩放同步滚动。
    element.addEventListener('wheel', handleWheel, { passive: false });
    return () => element.removeEventListener('wheel', handleWheel);
  }, [svg, zoomBy]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (scale <= MERMAID_MIN_SCALE || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPositionX: position.x,
      startPositionY: position.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    // rAF 节流：pointermove 频率可高于帧率，拖动大图表时每帧直接 setPosition
    // 会整块重渲染（含 SVG 子树）；合并到帧内只更新一次。
    if (dragFrameRef.current) return;
    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = 0;
      setPosition({
        x: dragRef.current.startPositionX + event.clientX - dragRef.current.startX,
        y: dragRef.current.startPositionY + event.clientY - dragRef.current.startY,
      });
    });
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.pointerId !== event.pointerId) return;
    if (dragFrameRef.current) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = 0;
    }
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
      zoomBy(MERMAID_ZOOM_STEP);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomBy(-MERMAID_ZOOM_STEP);
    } else if (event.key === '0') {
      event.preventDefault();
      resetView();
    } else if (
      scaleRef.current > MERMAID_MIN_SCALE &&
      ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
    ) {
      event.preventDefault();
      const distance = event.shiftKey ? 48 : 24;
      const xDelta = event.key === 'ArrowLeft' ? distance * -1 : event.key === 'ArrowRight' ? distance : 0;
      const yDelta = event.key === 'ArrowUp' ? distance * -1 : event.key === 'ArrowDown' ? distance : 0;
      setPosition((current) => ({ x: current.x + xDelta, y: current.y + yDelta }));
    }
  };

  // sanitize 输出对同一 svg 恒定：记忆化避免每帧重渲染（拖动/缩放大图表时）
  // 对整段 SVG 重复 DOMPurify 净化。须在条件早退（!svg）之前调用（Hooks 顺序）。
  // 注意两个守卫缺一不可：
  // 1) svg 为空（SSR 恒为空）时短路，不触碰 DOMPurify —— 此前 useMemo 前移后
  //    SSR 首帧即执行 sanitize，而 SSR bundle 中 import DOMPurify 的模块形态
  //    与客户端不同（sanitize 不存在），含 Mermaid 的文章整页渲染崩溃；
  // 2) typeof DOMPurify.sanitize 形态守卫：客户端 interop 下 DOMPurify 是函数，
  //    异常形态时回退原始 svg（不崩溃）。
  const sanitizedSvg = useMemo(
    () =>
      svg && typeof DOMPurify.sanitize === 'function' ? DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } }) : svg,
    [svg],
  );

  if (!svg) {
    const isError = status === 'error';
    return (
      <div
        className={`mermaid-container mermaid-status my-8 ${isError ? 'is-error' : ''}`}
        role={isError ? 'alert' : 'status'}
        aria-live="polite"
      >
        <div className="mermaid-status-icon" aria-hidden="true">
          {isError ? <TriangleAlert size={20} /> : <LoaderCircle className="animate-spin" size={20} />}
        </div>
        <div>
          <p className="mermaid-status-title">{isError ? '图表渲染失败' : '正在生成图表'}</p>
          <p className="mermaid-status-description">
            {isError ? '请检查 Mermaid 语法，原始内容已保留在下方。' : '正在加载 Mermaid 并适配当前主题。'}
          </p>
        </div>
        {isError && (
          <pre className="mermaid-source">
            <code>{children}</code>
          </pre>
        )}
      </div>
    );
  }
  const scaleLabel = `${Math.round(scale * 100)}%`;

  return (
    <div className="mermaid-container my-8 rounded-none border border-zinc-300 bg-zinc-50 p-3 shadow-none dark:border-zinc-700 dark:bg-zinc-900/50 sm:p-4">
      <div className="mermaid-toolbar" role="toolbar" aria-label="Mermaid 图表工具">
        <span className="mermaid-toolbar-label">图表缩放</span>
        <div className="mermaid-toolbar-actions">
          <button
            type="button"
            className="mermaid-action-btn"
            onClick={() => zoomBy(-MERMAID_ZOOM_STEP)}
            disabled={scale <= MERMAID_MIN_SCALE}
            aria-label="缩小 Mermaid 图表"
            title="缩小"
          >
            <Minus size={15} aria-hidden="true" />
          </button>
          <span className="mermaid-scale" aria-live="polite">
            {scaleLabel}
          </span>
          <button
            type="button"
            className="mermaid-action-btn"
            onClick={() => zoomBy(MERMAID_ZOOM_STEP)}
            disabled={scale >= MERMAID_MAX_SCALE}
            aria-label="放大 Mermaid 图表"
            title="放大"
          >
            <Plus size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="mermaid-action-btn"
            onClick={resetView}
            aria-label="重置 Mermaid 图表视图"
            title="重置"
          >
            <RotateCcw size={15} aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className={`mermaid-viewport ${scale > MERMAID_MIN_SCALE ? 'is-zoomed' : ''} ${isDragging ? 'is-dragging' : ''}`}
        tabIndex={0}
        role="application"
        aria-label="Mermaid 图表，可缩放和拖动"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
      >
        <div
          className="mermaid-scene"
          style={{
            // 未缩放且未平移时保持 transform: none：任何非 none 的 transform（包括
            // translate3d(0,0,0)）都会让浏览器把 SVG 图层化光栅化，缩放或下采样时
            // 文字变糊。缩放改为直接调整 SVG 宽度（矢量重绘），这里只负责平移。
            transform:
              scale > MERMAID_MIN_SCALE || position.x !== 0 || position.y !== 0
                ? `translate3d(${position.x}px, ${position.y}px, 0)`
                : 'none',
          }}
        >
          <div className="mermaid-diagram" ref={diagramRef} dangerouslySetInnerHTML={{ __html: sanitizedSvg }} />
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
  const clean = value
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^(\.\.\/)+/g, '');
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
  return withoutQuery
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '')
    .toLowerCase();
};

/**
 * 把仓库地址归一化为 GitHub 网页形态（https://github.com/<owner>/<repo>）：
 * - 去掉末尾斜杠与 .git 后缀；
 * - SSH 形态（git@github.com:owner/repo.git）转换为 HTTPS 网页地址。
 */
const normalizeRepoUrl = (repoUrl: string) => {
  let url = repoUrl.trim().replace(/\/+$/, '');
  const sshMatch = url.match(/^git@([^:]+):(.+)$/);
  if (sshMatch) {
    url = `https://${sshMatch[1]}/${sshMatch[2]}`;
  }
  return url.replace(/\.git$/i, '');
};

/** 文章源文件在仓库中的路径：filePath 形如 /posts/xxx.md，去掉前导斜杠并逐段 URL 编码。 */
const getSourceFilePath = (filePath: string) =>
  filePath
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join('/');

/** 文章内容仓库与默认分支（"编辑此文"/查看源文件入口）：独立配置，缺省回退友链仓库。
 *  不再复用 friendsPage.repoUrl 直拼，避免内容仓库与友链仓库分离时链接指向错误仓库。 */
const CONTENT_REPO_URL = siteConfig.content?.repoUrl || siteConfig.friendsPage.repoUrl;
const CONTENT_DEFAULT_BRANCH = siteConfig.content?.defaultBranch || 'main';

/** 查看源文件（页尾"帮助改进本文"）。 */
const getPostSourceUrl = (filePath: string) =>
  `${normalizeRepoUrl(CONTENT_REPO_URL)}/blob/${CONTENT_DEFAULT_BRANCH}/${getSourceFilePath(filePath)}`;

/** "在 GitHub 上编辑此文"：跳转到 Markdown 源文件的 GitHub 编辑页。 */
const getPostEditUrl = (filePath: string) =>
  `${normalizeRepoUrl(CONTENT_REPO_URL)}/edit/${CONTENT_DEFAULT_BRANCH}/${getSourceFilePath(filePath)}`;

const findImageDimensions = (imageDimensions: PostMetadata['imageDimensions'], src: string) => {
  if (!imageDimensions) {
    return undefined;
  }

  const normalizedSrc = normalizeImageUrl(src);
  const matchingKey = Object.keys(imageDimensions).find((key) => {
    const normalizedKey = normalizeImageUrl(key);
    return (
      normalizedKey === normalizedSrc ||
      normalizedKey.endsWith(`/${normalizedSrc}`) ||
      normalizedSrc.endsWith(`/${normalizedKey}`)
    );
  });
  return matchingKey ? imageDimensions[matchingKey] : undefined;
};

const createMarkdownComponents = (
  onPreviewImage: (image: { src: string; alt?: string }) => void,
  mermaidRenderer: MermaidRenderer | null,
  mermaidTheme: 'light' | 'dark',
  imageDimensions: PostMetadata['imageDimensions'],
  headings: MarkdownHeading[],
  shouldReduceMotion: boolean,
): Components => {
  let headingCursor = 0;
  const fallbackHeadingIds = new Map<string, number>();
  // 已分配出去的 heading id：二次扫描（顺序匹配落空后的全表兜底）必须跳过，
  // 否则「渲染文本与 rawText 不一致」的标题（含图片/公式）会让后续标题错配到
  // 同一 id，DOM 出现重复 id、TOC 锚点失效。
  const usedHeadingIds = new Set<string>();

  const resolveHeadingId = (level: number, children: React.ReactNode) => {
    // 与构建期 TOC 相同的归一化：折叠空白、解码实体、移除尾部 #。
    // 渲染侧文本与 headings 数组的 rawText 因此保持一致，避免锚点 id 错位。
    const text = stripInlineMarkdown(extractTextFromReactNode(children));

    for (let index = headingCursor; index < headings.length; index += 1) {
      const heading = headings[index];
      if (heading.level === level && heading.rawText === text) {
        headingCursor = index + 1;
        usedHeadingIds.add(heading.id);
        return heading.id;
      }
    }

    for (const heading of headings) {
      if (heading.level === level && heading.rawText === text && !usedHeadingIds.has(heading.id)) {
        usedHeadingIds.add(heading.id);
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

  const renderHeading = (
    level: number,
    Tag: string,
    { children, node: _node, ...props }: React.HTMLAttributes<HTMLHeadingElement> & { node?: unknown },
  ) => {
    const id = resolveHeadingId(level, children);
    return React.createElement(
      Tag,
      { ...props, id, className: 'heading-anchor-wrapper' },
      // 锚点用 span+role 模拟按钮而非 <button>：标题内部可能已有链接/交互元素，
      // 嵌套 <button> 属非法 HTML，会导致水合告警与点击行为异常。
      // 锚点置于标题文本之后（GitHub 风格：悬停标题时在文字末尾显示 #）。
      children,
      React.createElement(
        'span',
        {
          className: 'heading-anchor',
          role: 'button',
          tabIndex: 0,
          onClick: (e: React.MouseEvent) => {
            e.stopPropagation();
            handleHeadingClick(id);
          },
          onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              e.stopPropagation();
              handleHeadingClick(id);
            }
          },
          'aria-label': `复制标题链接：${extractTextFromReactNode(children)}`,
          title: '复制链接',
        },
        '#',
      ),
    );
  };

  const isImageUrl = (url: string) => /\.(jpe?g|png|gif|webp|avif|svg|bmp|ico)(\?.*)?$/i.test(url);

  return {
    a: ({
      href,
      children,
      node: _node,
      ...props
    }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) => {
      const hrefIsImage = href ? isImageUrl(href) : false;
      const resolvedHref =
        href && hrefIsImage ? (isAbsoluteAssetPath(href) ? resolveBrowserAsset(href) : resolveSitePath(href)) : href;
      const safeHref = isSafeMarkdownHref(resolvedHref) ? resolvedHref : undefined;
      const normalizedHref = safeHref && safeHref.startsWith('/') ? routeUrl(safeHref) : safeHref;

      if (normalizedHref && isImageUrl(normalizedHref)) {
        const childElements = React.Children.toArray(children);
        const imageChild = childElements.find(
          (child): child is React.ReactElement<MarkdownImageProps> =>
            React.isValidElement(child) && typeof (child.props as Record<string, unknown>).src === 'string',
        );

        if (imageChild) {
          return React.cloneElement(imageChild, { previewSrc: normalizedHref });
        }

        // 自定义 img 渲染器会输出已含预览按钮的 <figure>，不能再包一层按钮
        // （嵌套交互元素属非法 HTML，且会双重触发预览）。
        const containsMarkdownFigure = childElements.some(
          (child) =>
            React.isValidElement(child) && (child.props as Record<string, unknown>)['data-role'] === 'markdown-figure',
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
            onClick={(e) => {
              e.preventDefault();
              onPreviewImage({ src: normalizedHref, alt: imgAlt || undefined });
            }}
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
      // 页内锚点（#heading）用原生 <a> + 手动滚动：react-router 的 <Link> 对 hash-only
      // 变化不触发滚动（App 路由 effect 直接返回），原生 <a> 则由浏览器默认跳转到锚点。
      if (normalizedHref.startsWith('#')) {
        return (
          <a
            href={normalizedHref}
            onClick={(event) => {
              // 手动滚动并让浏览器更新 hash（默认行为已覆盖跳转，这里仅保持滚动位置一致，
              // 避免浏览器默认定位到元素顶部时被固定头部遮挡）。
              const targetId = normalizedHref.slice(1);
              const target = targetId ? document.getElementById(targetId) : null;
              if (!target) {
                return;
              }
              event.preventDefault();
              window.scrollTo({
                top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - HEADING_SCROLL_OFFSET),
                behavior: shouldReduceMotion ? 'auto' : 'smooth',
              });
              const url = new URL(window.location.href);
              url.hash = targetId;
              window.history.replaceState({}, '', url.toString());
            }}
            {...props}
          >
            {children}
          </a>
        );
      }

      const isInternalLink =
        normalizedHref.startsWith('/') || normalizedHref.startsWith('./') || normalizedHref.startsWith('../');
      if (isInternalLink) {
        return (
          <Link to={normalizedHref} {...props}>
            {children}
          </Link>
        );
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
      // 深色模式图片适配的豁免约定：![alt](url "no-dark") 表示保持原亮度
      // （如深色截图/图表），其余正文图片在暗色下自动柔和降亮。
      const isNoDarkAdapt = title === 'no-dark';
      return (
        <figure data-role="markdown-figure" className="group/myimage my-6 md:my-8">
          <button
            type="button"
            onClick={() => onPreviewImage({ src: previewTarget, alt })}
            className="relative block w-full overflow-hidden rounded-[6px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100"
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
              wrapperClassName="w-full rounded-[6px]"
              className={`h-auto w-full cursor-zoom-in rounded-[6px] object-contain ${isNoDarkAdapt ? 'no-dark-adapt' : ''}`}
            />
            <span className="pointer-events-none absolute right-3 top-3 rounded-[6px] border border-white/20 bg-black/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/85 opacity-0 transition-opacity duration-200 group-hover/myimage:opacity-100 group-focus-visible/myimage:opacity-100">
              预览
            </span>
          </button>
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
      // 块级代码判定：位于 <pre> 内（PreBlock 注入 data-block-code）或带 language-* 类。
      // 无语言围栏块 / 缩进代码块只有前者，仅看 className 会被误判为行内样式。
      const isBlockCode =
        (props as Record<string, unknown>)['data-block-code'] === 'true' || /language-(\w+)/.test(className || '');

      if (className?.includes('language-mermaid')) {
        return (
          <MermaidBlock renderer={mermaidRenderer} theme={mermaidTheme}>
            {String(children)}
          </MermaidBlock>
        );
      }

      if (isBlockCode) {
        return (
          <code className={className} {...props}>
            {children}
          </code>
        );
      }

      return (
        <code className="font-mono font-medium before:content-none after:content-none" {...props}>
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
  const [remarkPlugins, setRemarkPlugins] = useState<MarkdownPlugin[]>([remarkGfm, remarkCodeMeta]);
  const [rehypePlugins, setRehypePlugins] = useState<MarkdownPlugin[]>([]);
  const [mermaidRenderer, setMermaidRenderer] = useState<MermaidRenderer | null>(null);
  const [mermaidTheme, setMermaidTheme] = useState<'light' | 'dark'>('light');
  const shouldReduceMotion = useReducedMotion();
  const { isReadingMode, exitReadingMode } = useReadingMode();
  const { isSaved, isSaving, error: offlineError, toggleSaved } = useOfflinePosts(post ?? undefined);
  const [savedFeedback, setSavedFeedback] = useState<string | null>(null);
  const [adjacentPosts, setAdjacentPosts] = useState<{ prev: PostMetadata | null; next: PostMetadata | null }>(
    ssgRouteData?.adjacentPosts ?? { prev: null, next: null },
  );
  const [seriesNavigation, setSeriesNavigation] = useState<SeriesNavigation | null>(
    ssgRouteData?.seriesNavigation ?? null,
  );
  const [relatedPosts, setRelatedPosts] = useState<PostMetadata[]>(ssgRouteData?.relatedPosts ?? []);
  const articleBodyRef = useRef<HTMLDivElement>(null);
  const readingEndRef = useRef<HTMLDivElement>(null);
  const lastReadingSaveRef = useRef(0);
  // hash 深链跳转 / 阅读位置恢复触发的程序化滚动标记：此类滚动不应被视为
  // 真实阅读进度（否则 hash 打开会覆盖历史中更高的继续阅读记录）。
  const programmaticScrollRef = useRef(false);
  // 异步回调（收藏反馈等）的挂载守卫：组件卸载后不再 setState。
  // 挂载态必须由 effect 置 true（不能只依赖初始值）：StrictMode 开发态
  // cleanup 先执行，会把初始 true 清掉导致守卫失效。
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // 阅读进度保存的会话状态。必须放在组件级 ref 中：relatedPosts 等异步数据加载会
  // 触发保存 effect 重跑，若用 effect 内局部变量保存“已读完”等标记，重跑后会被重置，
  // 导致读完后再滚回上方时重新写入部分进度、让主页“继续阅读”卡片复活。
  const readingSessionRef = useRef<{
    postId: string;
    hasScrolled: boolean;
    completed: boolean;
    lastWrittenPercent: number;
  } | null>(null);

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

  // 不蒜子阅读量 span 在阅读模式切换时才随 meta 行挂载/卸载；从缓存回填一次，
  // 保证退出阅读模式后能即时显示（路由级 Ping 在 Layout 已完成上报）。
  useEffect(() => {
    fillBusuanziSpans();
  }, [isReadingMode, post?.id]);

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
    // 加载下一篇文章期间不暴露上一篇文章的导航。
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

        console.error('文章加载失败:', error);
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
      setRemarkPlugins([remarkGfm, remarkCodeMeta]);
      setRehypePlugins([]);
      setMermaidRenderer(null);
      return;
    }

    let cancelled = false;

    const loadMarkdownEnhancements = async () => {
      // 保持 remarkCodeMeta 常驻：pre 渲染依赖它透传代码块 data-meta
      // （title="..." 文件名等），异步增强加载时若被移除，文件名展示与
      // 下载命名会失效。
      const nextRemarkPlugins: MarkdownPlugin[] = [remarkGfm, remarkCodeMeta];
      const nextRehypePlugins: MarkdownPlugin[] = [];
      let nextMermaidRenderer: MermaidRenderer | null = null;
      const tasks: Promise<void>[] = [];
      const containsMermaid = hasMermaidDiagrams(post.content);

      if (containsMermaid) {
        setMermaidRenderer(null);
      }

      if (hasCodeBlocks(post.content)) {
        tasks.push(
          (async () => {
            const { default: rehypeHighlight } = await import('rehype-highlight');

            if (cancelled) return;
            nextRehypePlugins.push(rehypeHighlight);
          })(),
        );
      }

      if (hasMathExpressions(post.content)) {
        tasks.push(
          (async () => {
            const [{ default: remarkMath }, { default: rehypeKatex }] = await Promise.all([
              import('remark-math'),
              import('rehype-katex'),
              import('katex/dist/katex.min.css'),
            ]);

            nextRemarkPlugins.push(remarkMath);
            nextRehypePlugins.push(rehypeKatex);
          })(),
        );
      }

      if (hasMermaidDiagrams(post.content)) {
        tasks.push(
          (async () => {
            const { default: mermaid } = await import('mermaid');
            if (cancelled) {
              return;
            }

            mermaid.initialize(getMermaidConfig(mermaidTheme === 'dark'));
            nextMermaidRenderer = mermaid as MermaidRenderer;
          })(),
        );
      }

      try {
        await Promise.all(tasks);
      } catch (error) {
        if (!cancelled) {
          console.error('Markdown 增强组件加载失败:', error);
          // 失败回退同样保持 remarkCodeMeta 常驻，避免代码块 data-meta 丢失。
          setRemarkPlugins([remarkGfm, remarkCodeMeta]);
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
          console.error('代码高亮主题同步失败:', error);
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
  // 正文剥离结果只依赖 post.content，记忆化避免每次重渲染（阅读模式切换、
  // 弹窗开关、收藏反馈等）对全文（30-80KB）重跑 12+ 正则链两次
  // （meta description 与 articleBody 共用）。
  const strippedContent = useMemo(() => stripMarkdown(post?.content ?? ''), [post?.content]);

  useEffect(() => {
    if (!post?.content || headings.length === 0 || typeof window === 'undefined') {
      return;
    }

    let hashId = '';
    try {
      hashId = decodeURIComponent(window.location.hash.slice(1));
    } catch {
      // 忽略格式非法的 URL 片段，不中断文章渲染。
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

      // 标记为程序化滚动：hash 深链跳转不是用户阅读行为，不得计入阅读进度。
      programmaticScrollRef.current = true;
      window.scrollTo({
        top: Math.max(0, element.getBoundingClientRect().top + window.scrollY - HEADING_SCROLL_OFFSET),
        behavior: 'auto',
      });
      // 双 rAF 后清除标记：与恢复逻辑保持一致，等待程序化滚动完全落定。
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          programmaticScrollRef.current = false;
        });
      });
    };

    const timeoutId = window.setTimeout(scrollToHashHeading, 0);

    // Mermaid/懒加载内容渲染完成后会改变上方布局（占位高度 → 成图高度），把
    // 深链目标标题推离落点；单次 setTimeout 只覆盖首帧。用 ResizeObserver 监听
    // 正文容器，在内容加载导致的布局变化期间重复校正滚动位置。限次/限时自动
    // 断开：内容稳定后不再校正，避免用户手动滚动后仍被迟到的加载（如慢图）
    // 拉回深链位置。
    const articleBody = articleBodyRef.current;
    let corrections = 0;
    // 用户是否已主动中断深链校正（滚动/输入/点击）：一旦中断，迟到的布局变化
    // （慢图、Mermaid）不得再把用户拉回深链位置。
    let userInterrupted = false;
    let resizeObserver: ResizeObserver | undefined;
    const stopCorrecting = () => {
      userInterrupted = true;
      resizeObserver?.disconnect();
    };
    const handleUserScroll = () => {
      // 程序化校正产生的滚动（programmaticScrollRef 为 true）不算用户主动滚动。
      if (!programmaticScrollRef.current) stopCorrecting();
    };
    if (articleBody && typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        if (userInterrupted) return;
        corrections += 1;
        if (corrections > HASH_SCROLL_MAX_CORRECTIONS) {
          resizeObserver?.disconnect();
          return;
        }
        scrollToHashHeading();
      });
      resizeObserver.observe(articleBody);
    }
    const disconnectTimer = window.setTimeout(() => resizeObserver?.disconnect(), HASH_SCROLL_CORRECTION_WINDOW_MS);
    // 校正窗口内监听用户输入：wheel/touch/pointer/键盘滚动都会产生 scroll 事件，
    // 一旦用户主动滚动即永久放弃后续校正（与阅读位置恢复的 stopRestore 同一套路）。
    window.addEventListener('wheel', stopCorrecting, { passive: true });
    window.addEventListener('touchstart', stopCorrecting, { passive: true });
    window.addEventListener('pointerdown', stopCorrecting, { passive: true });
    window.addEventListener('scroll', handleUserScroll, { passive: true });

    return () => {
      window.clearTimeout(timeoutId);
      window.clearTimeout(disconnectTimer);
      window.removeEventListener('wheel', stopCorrecting);
      window.removeEventListener('touchstart', stopCorrecting);
      window.removeEventListener('pointerdown', stopCorrecting);
      window.removeEventListener('scroll', handleUserScroll);
      resizeObserver?.disconnect();
    };
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
        setRelatedPosts(
          getRelatedPosts(allPosts, post, {
            limit: 3,
            excludeIds: [previous?.id, next?.id].filter((value): value is string => Boolean(value)),
          }),
        );
      })
      .catch((error) => {
        if (!cancelled) {
          console.error('相邻文章加载失败:', error);
        }
      });

    return () => {
      cancelled = true;
    };
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
    // 结尾哨兵（readingEndRef）紧跟在正文末尾，专注阅读模式下也保留渲染；
    // 若因异常原因持续找不到该节点（如 DOM 尚未就绪），restore() 将无限重排
    // （100% CPU）。连续多次找不到结尾哨兵即放弃恢复，避免死循环。
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
      const top = getScrollTopForReadingProgress(
        {
          rect,
          endRect,
          viewportHeight: window.innerHeight,
          scrollY: window.scrollY,
          documentHeight,
        },
        savedEntry.progress,
      );
      programmaticScroll = true;
      programmaticScrollRef.current = true;
      window.scrollTo({ top, behavior: 'auto' });
      if (resetProgrammaticFrame) window.cancelAnimationFrame(resetProgrammaticFrame);
      resetProgrammaticFrame = window.requestAnimationFrame(() => {
        resetProgrammaticFrame = window.requestAnimationFrame(() => {
          programmaticScroll = false;
          programmaticScrollRef.current = false;
        });
      });
      // 布局稳定后重新应用（图片、代码高亮、数学公式会改变文章高度）。
      if (stableFrames < 2) scheduleRestore();
    };
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(scheduleLayoutRestore) : null;

    window.addEventListener('wheel', stopRestore, { passive: true });
    window.addEventListener('touchstart', stopRestore, { passive: true });
    window.addEventListener('pointerdown', stopRestore, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', scheduleLayoutRestore);
    // 仅观察正文容器：正文内图片/高亮/Mermaid 的布局变化需要重排恢复；正文下方
    // （许可/相关文章/评论区）高度变化不影响正文内容位置，且会把静止用户反复
    // 钉回保存进度。窗口 resize 已由上方事件监听兜底。
    resizeObserver?.observe(target);
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
  }, [post, headings.length]);

  useEffect(() => {
    const target = articleBodyRef.current;
    if (!post || !target || typeof window === 'undefined') {
      return;
    }

    // 同一篇文章的会话状态跨 effect 重跑复用；切换文章时重置。
    const session = readingSessionRef.current;
    if (!session || session.postId !== post.id) {
      readingSessionRef.current = {
        postId: post.id,
        hasScrolled: false,
        completed: false,
        // 上次写入的整百分数。挂载时的基线测量（通常在滚动恢复前为 0）不允许直接写库，
        // 否则会覆盖既有的继续阅读记录（如带 hash 打开文章、或用户在恢复窗口内滚动时）。
        lastWrittenPercent: Math.round((getReadingHistoryEntry(post.id)?.progress ?? 0) * 100),
      };
    }
    const state = readingSessionRef.current!;

    let animationFrame = 0;
    let latestProgress = 0;
    let hasProgressSnapshot = false;
    lastReadingSaveRef.current = 0;
    const saveLatestProgress = () => {
      // 仅真实用户滚动后才允许落库：程序化滚动（hash 深链/位置恢复）期间的
      // 进度快照不得覆盖既有的继续阅读记录。
      if (
        !hasProgressSnapshot ||
        !state.hasScrolled ||
        state.completed ||
        latestProgress <= 0 ||
        isReadingComplete(latestProgress)
      )
        return;
      const percent = Math.round(latestProgress * 100);
      if (percent === state.lastWrittenPercent) return;
      state.lastWrittenPercent = percent;
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
        documentHeight: document.documentElement.scrollHeight,
      });
      latestProgress = progress;
      hasProgressSnapshot = true;
      const now = Date.now();
      // 首次测量仅为基线：仅在真实滚动事件后到达结尾才判定读完，
      // 避免短文章因首页没有滚动区间而被误判为已完成。
      if (state.hasScrolled && isReadingComplete(progress)) {
        if (!state.completed) {
          // 读完即视为结束：删除“继续阅读”记录；本次会话内不再写任何部分进度，
          // 避免滚回上方后把已完成的文章重新加回主页卡片。
          state.completed = true;
          state.lastWrittenPercent = 100;
          lastReadingSaveRef.current = now;
          saveReadingHistory({ postId: post.id, progress });
        }
        return;
      }
      // 会话已完成：丢弃后续一切写入（含 effect 重跑后的首次测量）。
      if (state.completed) {
        return;
      }
      // 进度为 0（正文尚未进入阅读区，或滚回页面顶部）时不写入，避免覆盖既有记录；
      // 未发生真实用户滚动（仅程序化 hash/恢复滚动）时同样不写入。
      if (!state.hasScrolled || progress <= 0 || isReadingComplete(progress) || now - lastReadingSaveRef.current < 1000)
        return;
      const percent = Math.round(progress * 100);
      if (percent === state.lastWrittenPercent) return;
      state.lastWrittenPercent = percent;
      lastReadingSaveRef.current = now;
      saveReadingHistory({ postId: post.id, progress });
    };
    const scheduleUpdate = () => {
      if (!animationFrame) animationFrame = window.requestAnimationFrame(updateReadingHistory);
    };
    const handleScroll = () => {
      // 程序化滚动（hash 深链跳转、阅读位置恢复）不代表用户阅读行为，
      // 不标记 hasScrolled，也不触发进度测量写入。
      if (programmaticScrollRef.current) {
        return;
      }
      state.hasScrolled = true;
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
    // 只依赖 post：relatedPosts 等异步数据到达会触发 effect 重跑，但 effect
    // 内部不使用它们，依赖它们的 length 只会无谓重置 1s 节流窗口（cleanup 的
    // saveLatestProgress 还会多一次不受节流的写入）。
  }, [post]);

  useEffect(() => {
    if (isReadingMode && shareModalOpen) {
      setShareModalOpen(false);
    }
  }, [isReadingMode, shareModalOpen]);

  // 键盘快捷键通过 ref 读取最新值，而不是把 state 闭包进 listener：
  // 否则每次 adjacentPosts/previewImage/shareModalOpen 变化都要卸载重挂
  // listener，存在「状态已更新、listener 尚未换新」的竞态窗口 —— 期间
  // Alt+←/→ 会命中旧闭包（如 adjacentPosts 仍为空）静默不导航。
  // ref 在渲染期同步最新值，一旦 UI 已展示相邻导航，快捷键必然拿到最新数据。
  const adjacentPostsRef = useRef(adjacentPosts);
  adjacentPostsRef.current = adjacentPosts;
  const previewImageRef = useRef(previewImage);
  previewImageRef.current = previewImage;
  const shareModalOpenRef = useRef(shareModalOpen);
  shareModalOpenRef.current = shareModalOpen;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (hasOpenOverlay()) {
        return;
      }

      // 按住不放时 keydown 以 ~30ms 间隔连续触发（repeat），而首次 navigate 后
      // adjacentPosts 要到 effect 阶段才清空 —— 期间的 repeat 事件仍持有旧值，
      // 会对同一篇文章重复入栈（浏览器返回要多按几次才能回原页）。
      if (e.repeat) {
        return;
      }

      if (e.key === 'Escape') {
        if (previewImageRef.current) {
          setPreviewImage(null);
          return;
        }
        if (shareModalOpenRef.current) {
          setShareModalOpen(false);
          return;
        }
      }
      // 无相邻文章（首篇/末篇/加载中）时 Alt+←/→ 也必须 preventDefault：
      // 否则退化为浏览器历史后退/前进，用户会意外离开当前页面。
      if (e.key === 'ArrowLeft' && e.altKey) {
        e.preventDefault();
        if (adjacentPostsRef.current.prev) {
          navigate(`/post/${adjacentPostsRef.current.prev.id}`);
        }
      }
      if (e.key === 'ArrowRight' && e.altKey) {
        e.preventDefault();
        if (adjacentPostsRef.current.next) {
          navigate(`/post/${adjacentPostsRef.current.next.id}`);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // 每次渲染重建渲染组件对象（不做 useMemo 缓存）：resolveHeadingId 的
  // heading id 游标/兜底计数活在 createMarkdownComponents 的闭包里，缓存复用
  // 时 ReactMarkdown 在任意状态变化（相邻/相关文章加载、收藏反馈、弹窗开关等）
  // 后重渲染正文都会沿用已走到末尾的游标，全部标题 id 退化为 slug-N 兜底并逐
  // 次递增（-1、-2…），与构建期 headings 数组的 id 发散——目录点击找不到
  // 锚点、hash 深链失效。每次渲染重建即游标归零，DOM id 恒与 headings 一致。
  const markdownComponents = createMarkdownComponents(
    (image) => setPreviewImage(image),
    mermaidRenderer,
    mermaidTheme,
    post?.imageDimensions,
    headings,
    shouldReduceMotion,
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

        <div
          aria-hidden="true"
          className="mb-20 aspect-[21/9] w-full animate-pulse rounded-media bg-zinc-200 dark:bg-zinc-800"
        />

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

  // 摘录过短时（<30 字）meta description 会显得贫瘠，搜索摘要也不完整。
  // 此时从正文中取首个有实质内容的段落作为描述；摘录够长时仍以作者
  // 撰写的摘录为准（语义更精准）。
  const MAX_DESC_PARAGRAPH_CHARS = 110;
  const buildMetaDescription = (currentPost: PostType): string => {
    const excerpt = (currentPost.excerpt || '').trim();
    if (excerpt.length >= 30) {
      return excerpt;
    }
    const firstSubstantial = strippedContent
      .split(/\n{2,}/)
      .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
      .find((paragraph) => paragraph.length >= 20);
    if (!firstSubstantial) {
      return excerpt;
    }
    return firstSubstantial.length > MAX_DESC_PARAGRAPH_CHARS
      ? `${firstSubstantial.slice(0, MAX_DESC_PARAGRAPH_CHARS).trimEnd()}…`
      : firstSubstantial;
  };

  const authors = getDisplayAuthors(post);
  const authorsLabel = authors.map((author) => author.name).join('\u3001');
  const postDescription = buildMetaDescription(post);
  // 阅读时长（分钟）：由 readTime 文案（如「7分钟阅读」）解析，用于 Article 的 timeRequired。
  // 优先匹配「N分钟」，其次「N小时」×60；不能直接取第一个数字——文案含多个数字
  // （如"约 10 分钟（2 小时更新）"）或小时制时都会解析出错。
  const readMinutes = parseReadMinutes(post.readTime);
  const postStructuredData = {
    '@context': 'https://schema.org',
    // BlogPosting 是 Article 的子类型，Google 对博客文章富结果更认可该类型。
    '@type': 'BlogPosting',
    headline: post.title,
    description: postDescription,
    image: post.coverImage
      ? [absoluteSiteUrl(post.coverImage, siteConfig.url)]
      : [absoluteSiteUrl(siteConfig.seoImage, siteConfig.url)],
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
              email: siteConfig.social.rawEmail,
            }
          : {}),
      };
    }),
    articleBody: strippedContent,
    wordCount: post.wordCount,
    // timeRequired（ISO 8601 时长，如 PT7M）：Article 富结果字段，助搜索结果展示阅读时长。
    ...(Number.isInteger(readMinutes) && readMinutes > 0 ? { timeRequired: `PT${readMinutes}M` } : {}),
    inLanguage: 'zh-CN',
    articleSection: post.category,
    isPartOf: {
      '@type': 'WebSite',
      name: siteConfig.title,
      url: absoluteSiteUrl('/', siteConfig.url),
    },
    mainEntityOfPage: absoluteSiteUrl(`/post/${post.id}`, siteConfig.url),
    publisher: {
      '@type': 'Organization',
      name: siteConfig.title,
      url: siteConfig.url,
      logo: {
        '@type': 'ImageObject',
        url: absoluteSiteUrl(siteConfig.logo, siteConfig.url),
      },
    },
    keywords: post.tags?.join(', '),
  };

  const breadcrumbData = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首页', item: absoluteSiteUrl('/', siteConfig.url) },
      {
        '@type': 'ListItem',
        position: 2,
        name: post.category,
        item: absoluteSiteUrl(`/?category=${encodeURIComponent(post.category)}`, siteConfig.url),
      },
      { '@type': 'ListItem', position: 3, name: post.title, item: absoluteSiteUrl(`/post/${post.id}`, siteConfig.url) },
    ],
  };

  return (
    <>
      <ReadingModeToggle />

      <Suspense fallback={null}>
        {previewImage && (
          <ImageViewer src={previewImage.src} alt={previewImage.alt} onClose={() => setPreviewImage(null)} />
        )}
        {/* 阅读进度徽标与目录按钮常驻：不随滚动位置显隐（用户反馈需求）。 */}
        {!isReadingMode && <ReadingProgressBadge targetRef={articleBodyRef} endRef={readingEndRef} />}
        {!isReadingMode && headings.length > 0 && <TableOfContents headings={headings} />}
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
          description={postDescription}
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
            <div className="print-hidden mb-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400 md:mb-7">
              <Link
                to="/"
                className="inline-flex items-center gap-1 transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                <ArrowLeft size={13} />
                返回文章
              </Link>
              <span aria-hidden="true">/</span>
              <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
                <Link to="/" className="transition-colors hover:text-zinc-700 dark:hover:text-zinc-300">
                  首页
                </Link>
                <ChevronRight size={11} aria-hidden="true" />
                <Link
                  to={`/?category=${encodeURIComponent(post.category)}`}
                  className="truncate transition-colors hover:text-zinc-700 dark:hover:text-zinc-300"
                >
                  {post.category}
                </Link>
              </nav>
            </div>
          )}

          {/* LCP 元素首帧即渲染最终可见状态，不设入场动画（避免 SSR 输出 opacity:0） */}
          <div>
            <h1 className="mb-5 break-words text-balance text-[1.875rem] font-bold leading-[1.25] tracking-[-0.01em] text-ink [overflow-wrap:anywhere] dark:text-white md:mb-6 md:text-[2.5rem] lg:text-[2.75rem]">
              {post.title}
            </h1>

            {!isReadingMode && (
              <div className="post-meta print-hidden mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-zinc-600 dark:text-zinc-400 sm:gap-x-5">
                <span className="inline-flex max-w-full items-center gap-1.5">
                  <Users size={14} className="shrink-0 opacity-70" />
                  <span className="truncate font-semibold text-zinc-800 dark:text-zinc-200">{authorsLabel}</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar size={14} className="shrink-0 opacity-70" />
                  <span>发布于 {formatMetaDate(post.date)}</span>
                </span>
                {post.updatedAt && post.updatedAt !== post.date && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar size={14} className="shrink-0 opacity-70" />
                    <span>更新 {formatMetaDate(post.updatedAt)}</span>
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  <Clock size={14} className="shrink-0 opacity-70" />
                  <span>{post.readTime}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 tabular-nums" title="由不蒜子提供本页阅读量">
                  <Eye size={14} className="shrink-0 opacity-70" />
                  <span>
                    <span id="busuanzi_page_pv">加载中</span> 次阅读
                  </span>
                </span>
                {post.filePath && (
                  <a
                    href={getPostEditUrl(post.filePath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`在 GitHub 上编辑此文：${post.title}`}
                    className="print-hidden inline-flex min-h-10 items-center gap-1.5 rounded-[6px] border border-[#d0d7de] bg-white px-3 py-1.5 text-xs font-semibold text-[#57606a] transition-colors hover:border-[#0969da] hover:text-[#0969da] dark:border-[#30363d] dark:bg-transparent dark:text-[#8b949e] dark:hover:border-[#58a6ff] dark:hover:text-[#58a6ff]"
                  >
                    <Github size={14} />
                    编辑
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setShareModalOpen(true)}
                  className="print-hidden inline-flex min-h-10 items-center gap-1.5 rounded-[6px] border border-[#d0d7de] bg-white px-3 py-1.5 text-xs font-semibold text-[#57606a] transition-colors hover:border-[#0969da] hover:text-[#0969da] dark:border-[#30363d] dark:bg-transparent dark:text-[#8b949e] dark:hover:border-[#58a6ff] dark:hover:text-[#58a6ff]"
                  aria-label={`分享文章：${post.title}`}
                >
                  <Share2 size={14} />
                  分享
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const wasSaved = isSaved;
                    void toggleSaved().then((saved) => {
                      // toggleSaved 失败时不抛出（错误经 offlineError 状态反馈），
                      // 这里按返回值决定是否展示成功文案，避免失败时显示假成功。
                      // mountedRef 防护：IndexedDB 读写耗时可能跨过组件卸载
                      // （点收藏后立刻导航离开），卸载后不再 setState。
                      if (saved && mountedRef.current) {
                        setSavedFeedback(wasSaved ? '已取消收藏' : '已保存，可离线阅读');
                      }
                    });
                  }}
                  disabled={isSaving}
                  aria-pressed={isSaved}
                  aria-label={isSaved ? `取消收藏：${post.title}` : `收藏文章：${post.title}`}
                  className="print-hidden inline-flex min-h-10 items-center gap-1.5 rounded-[6px] border border-[#d0d7de] bg-white px-3 py-1.5 text-xs font-semibold text-[#57606a] transition-colors hover:border-[#0969da] hover:text-[#0969da] disabled:cursor-wait disabled:opacity-60 dark:border-[#30363d] dark:bg-transparent dark:text-[#8b949e] dark:hover:border-[#58a6ff] dark:hover:text-[#58a6ff]"
                >
                  <Bookmark size={14} fill={isSaved ? 'currentColor' : 'none'} />
                  {isSaving ? '保存中' : isSaved ? '已收藏' : '收藏'}
                </button>
                <span className="sr-only" role="status" aria-live="polite">
                  {savedFeedback || offlineError || ''}
                </span>
              </div>
            )}
          </div>
        </header>

        {post.coverImage && (
          <button
            type="button"
            className="post-cover print-hidden mx-auto block w-full max-w-5xl px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-900 dark:focus-visible:outline-zinc-100 sm:px-4 lg:px-0"
            onClick={() => setPreviewImage({ src: resolveBrowserAsset(post.coverImage!)!, alt: post.title })}
            aria-label={`预览文章封面：${post.title}`}
          >
            <div className="mb-8 aspect-[16/10] cursor-zoom-in overflow-hidden rounded-[6px] sm:aspect-[16/8] md:mb-14 lg:aspect-[21/9]">
              <ProgressiveImage
                src={resolveBrowserAsset(post.coverImage)}
                alt={post.title}
                loading="eager"
                fetchPriority="high"
                width={post.coverWidth}
                height={post.coverHeight}
                sizes="(max-width: 767px) 100vw, (max-width: 1279px) 80vw, 1024px"
                wrapperClassName="h-full w-full"
                className="h-full w-full object-cover"
              />
            </div>
          </button>
        )}

        <div ref={articleBodyRef} className="post-body mx-auto w-full max-w-5xl px-3 pb-12 sm:px-4 md:pb-20 lg:px-0">
          <div className="mx-auto max-w-[46rem]">
            <div className="post-prose prose max-w-none dark:prose-invert md:prose-lg prose-headings:scroll-mt-24 prose-a:break-words">
              <ReactMarkdown
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={markdownComponents}
              >
                {post.content}
              </ReactMarkdown>
            </div>

            {/* 结尾哨兵紧跟正文末尾：正文最后一行进入视口中间即视为读完。
                许可协议/作者/导航/推荐/评论等均不计入文章长度。此节点在专注阅读
                模式下也保留渲染，保证两种模式下的进度口径完全一致。 */}
            <div ref={readingEndRef} aria-hidden="true" className="h-0" />

            {!isReadingMode && (
              <aside
                className="post-license mt-14 border-l-2 border-zinc-200 pl-4 text-sm leading-relaxed text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 md:mt-16 md:pl-5"
                aria-labelledby="license-heading"
              >
                <h2 id="license-heading" className="mb-1 font-semibold text-zinc-700 dark:text-zinc-200">
                  CC BY-SA 4.0 许可协议
                </h2>
                <p>
                  本文由 <strong className="font-semibold text-zinc-700 dark:text-zinc-200">{authorsLabel}</strong>{' '}
                  原创。除非另有声明，可在署名并以相同协议发布衍生作品的前提下自由复制、传播和修改。详见
                  <a
                    href="https://creativecommons.org/licenses/by-sa/4.0/deed.zh"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-1 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800 dark:decoration-zinc-700 dark:hover:text-zinc-200"
                  >
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
                    href={getPostSourceUrl(post.filePath)}
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
                  <section
                    className="post-series mt-10 border-t border-zinc-200 pt-7 dark:border-zinc-800 md:mt-12 md:pt-8"
                    aria-labelledby="series-heading"
                  >
                    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
                          系列文章
                        </p>
                        <h2 id="series-heading" className="text-xl font-bold text-ink dark:text-white">
                          {seriesNavigation.name}
                        </h2>
                      </div>
                      <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                        第 {seriesNavigation.currentIndex + 1} / {seriesNavigation.posts.length} 篇
                      </span>
                    </div>
                    <ol className="space-y-2">
                      {seriesNavigation.posts.map((seriesPost, index) => (
                        <li key={seriesPost.id}>
                          <Link
                            to={`/post/${seriesPost.id}`}
                            aria-current={seriesPost.id === post.id ? 'page' : undefined}
                            className={`flex min-h-11 items-center gap-3 rounded-control border px-3 py-2 text-sm transition-colors ${seriesPost.id === post.id ? 'border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900' : 'border-zinc-200 text-zinc-700 hover:border-zinc-500 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-600'}`}
                          >
                            <span className="w-7 shrink-0 text-center text-xs tabular-nums opacity-60">
                              {index + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate">{seriesPost.title}</span>
                          </Link>
                        </li>
                      ))}
                    </ol>
                    {(seriesNavigation.previous || seriesNavigation.next) && (
                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        {seriesNavigation.previous ? (
                          <Link
                            to={`/post/${seriesNavigation.previous.id}`}
                            className="editorial-button inline-flex min-h-11 items-center justify-center gap-2 text-sm"
                          >
                            <ArrowLeft size={15} />
                            上一章
                          </Link>
                        ) : (
                          <span />
                        )}
                        {seriesNavigation.next ? (
                          <Link
                            to={`/post/${seriesNavigation.next.id}`}
                            className="editorial-button inline-flex min-h-11 items-center justify-center gap-2 text-sm"
                          >
                            下一章
                            <ArrowRight size={15} />
                          </Link>
                        ) : (
                          <span />
                        )}
                      </div>
                    )}
                  </section>
                )}

                <nav
                  aria-label="文章导航"
                  className="post-navigation mt-10 border-t border-zinc-200 pt-7 dark:border-zinc-800 md:mt-12 md:pt-8"
                >
                  <div className="grid gap-5 sm:grid-cols-2 sm:gap-10">
                    {adjacentPosts.prev ? (
                      <Link
                        to={`/post/${adjacentPosts.prev.id}`}
                        className="group flex min-h-11 min-w-0 items-start gap-3 rounded-control py-1 text-left"
                      >
                        <ArrowLeft
                          size={17}
                          className="mt-0.5 flex-shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100"
                        />
                        <span className="min-w-0">
                          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                            上一篇
                          </span>
                          <span className="line-clamp-2 text-sm font-semibold leading-relaxed text-zinc-700 transition-colors group-hover:text-zinc-950 dark:text-zinc-300 dark:group-hover:text-white">
                            {adjacentPosts.prev.title}
                          </span>
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
                          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                            下一篇
                          </span>
                          <span className="line-clamp-2 text-sm font-semibold leading-relaxed text-zinc-700 transition-colors group-hover:text-zinc-950 dark:text-zinc-300 dark:group-hover:text-white">
                            {adjacentPosts.next.title}
                          </span>
                        </span>
                        <ArrowRight
                          size={17}
                          className="mt-0.5 flex-shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-900 dark:text-zinc-700 dark:group-hover:text-zinc-100"
                        />
                      </Link>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                  </div>

                  <div className="mt-5 hidden text-center md:block">
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                      快捷键：<kbd className="kbd">Alt</kbd> + <kbd className="kbd">←</kbd> 上一篇 ·{' '}
                      <kbd className="kbd">Alt</kbd> + <kbd className="kbd">→</kbd> 下一篇 ·{' '}
                      <kbd className="kbd">Esc</kbd> 关闭弹窗
                    </span>
                  </div>
                </nav>

                {relatedPosts.length > 0 && (
                  <section
                    className="post-related mt-10 border-t border-zinc-200 pt-7 dark:border-zinc-800 md:mt-12 md:pt-8"
                    aria-labelledby="related-heading"
                  >
                    <div className="mb-5 flex items-center gap-2">
                      <BookOpen size={16} className="text-zinc-400" />
                      <h2 id="related-heading" className="text-xl font-bold text-ink dark:text-white">
                        你可能还喜欢
                      </h2>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
                      {relatedPosts.map((relatedPost) => (
                        <CompactPostCard key={relatedPost.id} post={relatedPost} />
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
            url={absoluteSiteUrl(
              `/post/${post.id}`,
              typeof window !== 'undefined' ? window.location.origin : siteConfig.url,
            )}
            category={post.category}
            date={post.date}
            coverImage={post.coverImage}
            siteName={siteConfig.title}
            siteSubtitle={siteConfig.subtitle}
            siteUrl={siteConfig.url}
            logo={assetUrl('/logo.png')}
          />
        )}
      </Suspense>
    </>
  );
};
