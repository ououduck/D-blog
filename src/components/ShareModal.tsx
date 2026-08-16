/**
 * 分享弹层：复制链接 + 生成并下载分享海报（canvas 合成封面/二维码/头像）。
 */

import React, { useId, useRef, useState } from 'react';
import { X, Copy, Check, Link as LinkIcon, Image as ImageIcon, Download, LoaderCircle, RefreshCw } from 'lucide-react';
import { SlideModal } from './SlideModal';
import { generateSharePoster } from '@/utils/sharePoster';
import { copyTextToClipboard } from '@/utils/clipboard';
import { useResetTimer } from '@/hooks/useResetTimer';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  excerpt: string;
  url: string;
  category?: string;
  date?: string;
  coverImage?: string;
  siteName?: string;
  siteSubtitle?: string;
  siteUrl?: string;
  logo?: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  title,
  excerpt,
  url,
  category,
  date,
  coverImage,
  siteName,
  siteSubtitle,
  siteUrl,
  logo,
}) => {
  const [copiedType, setCopiedType] = useState<'all' | 'link' | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [posterDataUrl, setPosterDataUrl] = useState<string | null>(null);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const [posterError, setPosterError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const { clear: clearResetTimer, schedule: scheduleReset } = useResetTimer();
  const titleId = useId();
  const descriptionId = useId();
  // 海报生成代际：关闭弹窗后重新打开时，在途的旧生成结果不得覆盖新会话
  // （否则会显示上一篇文章的海报）。声明在 useEffect 之前，避免 TDZ 窗口。
  const posterGenerationRef = useRef(0);

  React.useEffect(() => {
    if (!isOpen) {
      clearResetTimer();
      // 使在途的海报生成结果失效（旧会话不得写入新会话状态）。
      posterGenerationRef.current += 1;
      setCopiedType(null);
      setCopyError(null);
      setPosterDataUrl(null);
      setPosterError(null);
      setIsGeneratingPoster(false);
    }
  }, [clearResetTimer, isOpen]);

  React.useEffect(() => {
    return () => {
      clearResetTimer();
    };
  }, [clearResetTimer]);

  const handleCopy = async (type: 'all' | 'link') => {
    const text = type === 'all' ? `标题：${title}\n简介：${excerpt}\n链接：${url}` : url;

    const scheduleCopyReset = () =>
      // 2 秒后自动清除复制反馈（连续复制会重置计时）。
      scheduleReset(() => {
        setCopiedType(null);
        setCopyError(null);
      }, 2000);

    try {
      const copied = await copyTextToClipboard(text);
      if (!copied) {
        throw new Error('复制命令被浏览器拒绝');
      }

      setCopiedType(type);
      setCopyError(null);
      scheduleCopyReset();
    } catch (error) {
      console.error('复制失败:', error);
      setCopiedType(null);
      setCopyError('复制失败，请手动复制链接。');
      scheduleCopyReset();
    }
  };

  // 海报生成代际：关闭弹窗后重新打开时，在途的旧生成结果不得覆盖新会话
  // （否则会显示上一篇文章的海报）。
  const handleGeneratePoster = async () => {
    if (isGeneratingPoster) return;
    const generationId = ++posterGenerationRef.current;
    setIsGeneratingPoster(true);
    setPosterError(null);
    try {
      const dataUrl = await generateSharePoster({
        title,
        excerpt,
        url,
        category,
        date,
        coverImage,
        siteName,
        siteSubtitle,
        siteUrl,
        logo,
      });
      if (generationId !== posterGenerationRef.current) return;
      setPosterDataUrl(dataUrl);
    } catch (error) {
      if (generationId !== posterGenerationRef.current) return;
      console.error('分享海报生成失败:', error);
      setPosterError('海报生成失败，请重试。');
    } finally {
      if (generationId === posterGenerationRef.current) {
        setIsGeneratingPoster(false);
      }
    }
  };

  const handleDownloadPoster = () => {
    if (!posterDataUrl) return;
    const safeTitle = title.replace(/[\\/:*?"<>|\s]+/g, '-').slice(0, 30) || 'post';
    const link = document.createElement('a');
    link.href = posterDataUrl;
    link.download = `share-poster-${safeTitle}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <SlideModal
      isOpen={isOpen}
      onClose={onClose}
      initialFocusRef={closeButtonRef}
      ariaLabelledby={titleId}
      ariaDescribedby={descriptionId}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <h3 id={titleId} className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          分享文章
        </h3>
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          className="inline-flex h-11 w-11 items-center justify-center rounded-icon border border-transparent text-zinc-500 transition-colors hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 active:scale-[0.98] dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          aria-label="关闭分享弹窗"
        >
          <X size={16} />
        </button>
      </div>

      <div className="p-5 sm:p-6">
        <p className="mb-5 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          复制完整分享文案、生成分享海报，或者只带走这篇文章的链接。
        </p>

        <div className="mb-5 border-y border-zinc-200 py-4 dark:border-zinc-800">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <LinkIcon size={14} />
            <span>当前文章</span>
          </div>
          <h4 className="mb-2 line-clamp-2 text-base font-bold leading-snug text-zinc-900 dark:text-zinc-100">
            {title}
          </h4>
          <p id={descriptionId} className="mb-3 line-clamp-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
            {excerpt}
          </p>
          <div className="break-all rounded-control border border-zinc-200 bg-zinc-50 px-3 py-2 font-mono text-xs leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
            {url}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => handleCopy('all')}
            className="editorial-button-primary rounded-control active:scale-[0.98]"
            aria-label="复制标题、简介和链接"
          >
            {copiedType === 'all' ? (
              <span className="copy-pop">
                <Check size={16} />
              </span>
            ) : (
              <Copy size={16} />
            )}
            {copiedType === 'all' ? '已复制全部' : '复制完整分享'}
          </button>
          <button
            type="button"
            onClick={() => handleCopy('link')}
            className="editorial-button rounded-control active:scale-[0.98]"
            aria-label="仅复制文章链接"
          >
            {copiedType === 'link' ? (
              <span className="copy-pop">
                <Check size={16} />
              </span>
            ) : (
              <LinkIcon size={16} />
            )}
            {copiedType === 'link' ? '链接已复制' : '仅复制链接'}
          </button>
        </div>

        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400 dark:text-zinc-500">
            分享海报
          </span>
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        {posterDataUrl ? (
          <div>
            <div className="mx-auto max-h-[420px] w-fit max-w-full overflow-hidden rounded-surface border border-zinc-200 shadow-sm dark:border-zinc-800">
              <img
                src={posterDataUrl}
                alt={`分享海报：${title}`}
                className="mx-auto block h-auto max-h-[420px] w-auto max-w-full"
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={handleDownloadPoster}
                className="editorial-button-primary rounded-control active:scale-[0.98]"
                aria-label="下载分享海报"
              >
                <Download size={16} />
                下载海报
              </button>
              <button
                type="button"
                onClick={() => {
                  setPosterDataUrl(null);
                  setPosterError(null);
                }}
                className="editorial-button rounded-control active:scale-[0.98]"
                aria-label="重新生成分享海报"
              >
                <RefreshCw size={16} />
                重新生成
              </button>
            </div>
            <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
              移动端可长按海报图片保存到相册。
            </p>
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={() => {
                void handleGeneratePoster();
              }}
              disabled={isGeneratingPoster}
              className="editorial-button w-full rounded-control active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              aria-label="生成文章分享海报"
            >
              {isGeneratingPoster ? (
                <>
                  <LoaderCircle
                    size={16}
                    className={isGeneratingPoster ? 'animate-spin' : undefined}
                    aria-hidden="true"
                  />
                  正在生成海报…
                </>
              ) : (
                <>
                  <ImageIcon size={16} />
                  生成分享海报
                </>
              )}
            </button>
            {posterError && (
              <p className="mt-3 text-center text-xs text-red-600 dark:text-red-400" role="alert">
                {posterError}
              </p>
            )}
            <p className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
              自动排版标题、摘要、封面与二维码，适合分享到社交平台。
            </p>
          </>
        )}

        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
          {copyError ?? (copiedType ? '复制成功' : '选择一种分享方式')}
        </p>
      </div>
    </SlideModal>
  );
};
