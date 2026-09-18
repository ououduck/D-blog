/**
 * 代码块（从 Post.tsx 抽出）：语言/文件名工具栏、整块与单行复制、下载、
 * 自动换行、长代码折叠。复制失败如实反馈（AGENT.md 错误处理约束）。
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, Download, FileCode, WrapText } from 'lucide-react';
import { copyTextToClipboard } from '@/utils/clipboard';
import { downloadBlob } from '@/utils/download';
import { extractTextFromReactNode } from '@/utils/headings';

export const MAX_CODE_LINES = 30;

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

const extractLangFromChildren = (children: React.ReactNode): string | undefined => {
  const codeChild = React.Children.toArray(children).find(
    (child) => React.isValidElement(child) && typeof (child.props as Record<string, unknown>).className === 'string',
  ) as React.ReactElement | undefined;
  if (!codeChild) return undefined;
  const cls = (codeChild.props as Record<string, string>).className || '';
  const match = cls.match(/language-(\w+)/);
  return match ? match[1] : undefined;
};

export const CodeBlock = ({
  children,
  node: _node,
  ...props
}: React.DetailedHTMLProps<React.HTMLAttributes<HTMLPreElement>, HTMLPreElement> & { node?: unknown }) => {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const [copiedLine, setCopiedLine] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isWrapped, setIsWrapped] = useState(false);
  const resetTimerRef = useRef<number | null>(null);
  const lang = extractLangFromChildren(children);
  const { filename } = extractCodeMeta(children);
  const code = getCodeText(children);
  const lineCount = Math.max(1, code ? code.split('\n').length : 1);
  // 惰性初始化折叠态：超大代码块首帧即折叠，只渲染 MAX_CODE_LINES 行号；
  // 此前初始 false 会让首帧为上千行生成上千个行号 span，再在 effect 里折叠。
  const [needsExpand, setNeedsExpand] = useState(() => lineCount > MAX_CODE_LINES);
  const lineNumbers = Array.from({ length: lineCount }, (_, index) => index + 1);
  // 折叠状态下只渲染可见范围内的行号（MAX_CODE_LINES 行）：超大代码块首屏
  // 无需为上千行生成上千个行号节点，展开时才渲染全部，减少 DOM 节点数。
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
      setCopyFailed(false);
      setCopiedLine(null);
    }, 2200);
  };

  const markCopied = () => {
    setCopied(true);
    setCopyFailed(false);
    setCopiedLine(null);
    clearCopyFeedback();
  };

  const markCopyFailed = () => {
    setCopied(false);
    setCopiedLine(null);
    setCopyFailed(true);
    clearCopyFeedback();
  };

  const markLineCopied = (line: number) => {
    setCopied(false);
    setCopyFailed(false);
    setCopiedLine(line);
    clearCopyFeedback();
  };

  const handleCopy = async () => {
    try {
      const copiedOk = await copyTextToClipboard(code);
      if (copiedOk) {
        markCopied();
      } else {
        markCopyFailed();
      }
    } catch {
      markCopyFailed();
    }
  };

  const handleCopyLine = async (line: number) => {
    const lines = code.split('\n');
    const lineText = lines[line - 1];
    if (lineText === undefined) return;
    try {
      const copiedOk = await copyTextToClipboard(lineText);
      if (copiedOk) {
        markLineCopied(line);
      } else {
        markCopyFailed();
      }
    } catch {
      markCopyFailed();
    }
  };

  const handleDownload = () => {
    // title="app.ts" 已带扩展名时不再追加，避免生成 app.ts.ts。
    const baseName = filename || 'code-snippet';
    const extension = getCodeFileExtension(lang);
    const downloadName = baseName.toLowerCase().endsWith(`.${extension}`) ? baseName : `${baseName}.${extension}`;
    downloadBlob(new Blob([code], { type: 'text/plain;charset=utf-8' }), downloadName);
  };

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
          <span className="code-line-count" aria-label={`共 ${lineCount} 行`}>
            {lineCount} 行
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
          ) : copyFailed ? (
            <span className="code-copy-feedback code-copy-feedback-error" role="status" aria-live="assertive">
              复制失败，请重试
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
          {/* 行号是可聚焦的复制按钮（键盘可达）；换行模式下整列隐藏（display:none
              同步移出可访问性树与 Tab 序）。 */}
          <div className="code-line-numbers">
            {visibleLineNumbers.map((number) => (
              <button
                key={number}
                type="button"
                data-line={number}
                title={`复制第 ${number} 行`}
                aria-label={`复制第 ${number} 行`}
                onClick={() => {
                  void handleCopyLine(number);
                }}
              >
                {number}
              </button>
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
            aria-label={`显示全部 ${lineCount} 行`}
            aria-expanded="false"
          >
            <ChevronDown size={15} aria-hidden="true" />
            显示全部 {lineCount} 行
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
