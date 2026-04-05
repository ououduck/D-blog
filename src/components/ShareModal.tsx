import React, { useId, useRef, useState } from 'react';
import { X, Copy, Check, Link as LinkIcon } from 'lucide-react';
import { SlideModal } from './SlideModal';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen?: () => void;
  onCloseCallback?: () => void;
  title: string;
  excerpt: string;
  url: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ 
  isOpen, 
  onClose, 
  onOpen,
  onCloseCallback,
  title, 
  excerpt, 
  url 
}) => {
  const [copiedType, setCopiedType] = useState<'all' | 'link' | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const resetTimerRef = useRef<number | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  const clearResetTimer = () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  };

  const scheduleReset = () => {
    clearResetTimer();
    resetTimerRef.current = window.setTimeout(() => {
      setCopiedType(null);
      setCopyError(null);
    }, 2000);
  };

  React.useEffect(() => {
    if (!isOpen) {
      clearResetTimer();
      setCopiedType(null);
      setCopyError(null);
    }
  }, [isOpen]);

  React.useEffect(() => {
    return () => {
      clearResetTimer();
    };
  }, []);

  const writeToClipboard = async (value: string) => {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return true;
    }

    const textArea = document.createElement('textarea');
    textArea.value = value;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } finally {
      document.body.removeChild(textArea);
    }

    return copied;
  };

  const handleCopy = async (type: 'all' | 'link') => {
    const text = type === 'all' ? `标题：${title}\n简介：${excerpt}\n链接：${url}` : url;

    try {
      const copied = await writeToClipboard(text);
      if (!copied) {
        throw new Error('Copy command was rejected');
      }

      setCopiedType(type);
      setCopyError(null);
      scheduleReset();
    } catch (error) {
      console.error('Copy failed:', error);
      setCopiedType(null);
      setCopyError('复制失败，请手动复制链接。');
      scheduleReset();
    }
  };

  return (
    <SlideModal
      isOpen={isOpen}
      onClose={onClose}
      onOpen={onOpen}
      onCloseCallback={onCloseCallback}
      initialFocusRef={closeButtonRef}
      ariaLabelledby={titleId}
      className="mobile:border-t-0"
    >
      <div className="relative overflow-hidden rounded-[24px] border border-zinc-200/70 bg-white/80 p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:border-zinc-800/70 dark:bg-zinc-950/40 dark:shadow-none sm:p-6">
        <div className="pointer-events-none absolute inset-x-6 top-0 h-24 rounded-full bg-accent/10 blur-3xl dark:bg-accent/15" />
        <button
          ref={closeButtonRef}
          onClick={onClose}
          className="absolute right-4 top-4 z-10 rounded-xl border border-zinc-200/80 bg-white/80 p-2 text-zinc-400 transition-all hover:border-accent/30 hover:text-accent dark:border-zinc-700/80 dark:bg-zinc-900/80 dark:hover:border-accent/30"
          aria-label="关闭分享弹窗"
        >
          <X size={18} />
        </button>

        <div className="relative pr-12">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.28em] text-accent/80">Share</p>
          <h3 id={titleId} className="text-xl font-serif font-bold text-ink dark:text-white sm:text-2xl">分享文章</h3>
          <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">复制完整分享文案，或者只带走这篇文章的链接。</p>
        </div>

        <div className="relative mt-5 rounded-2xl border border-zinc-200/80 bg-white/85 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-accent/15 bg-accent/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.24em] text-accent/80">
            <LinkIcon size={12} />
            当前文章
          </div>
          <h4 className="mb-2 line-clamp-2 text-base font-bold leading-7 text-ink dark:text-white">{title}</h4>
          <p id={descriptionId} className="mb-4 line-clamp-3 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{excerpt}</p>
          <div className="break-all rounded-2xl border border-dashed border-zinc-300/90 bg-zinc-50/90 p-3 text-sm font-mono leading-6 text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">{url}</div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            onClick={() => handleCopy('all')}
            className="flex items-center justify-center gap-2 rounded-2xl bg-ink py-3 text-sm font-bold text-white shadow-lg shadow-zinc-900/10 transition-all hover:-translate-y-0.5 hover:opacity-95 dark:bg-white dark:text-ink dark:shadow-none"
            aria-label="复制标题、简介和链接"
          >
            {copiedType === 'all' ? <Check size={16} /> : <Copy size={16} />}
            {copiedType === 'all' ? '已复制全部' : '复制完整分享'}
          </button>
          <button
            onClick={() => handleCopy('link')}
            className="flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-zinc-100/90 py-3 text-sm font-bold text-ink transition-all hover:-translate-y-0.5 hover:border-accent/30 hover:bg-accent/5 dark:border-zinc-700 dark:bg-zinc-800/90 dark:text-white dark:hover:bg-zinc-800"
            aria-label="仅复制文章链接"
          >
            {copiedType === 'link' ? <Check size={16} /> : <LinkIcon size={16} />}
            {copiedType === 'link' ? '链接已复制' : '仅复制链接'}
          </button>
        </div>

        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
          {copyError ?? (copiedType ? '复制成功。' : '可复制完整分享文案或单独链接。')}
        </p>
      </div>
    </SlideModal>
  );
};
