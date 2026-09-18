/**
 * 分享弹层（文章 / 说说共用）：复制完整文案 / 仅链接、Web Share API、
 * X / Telegram / QQ 空间分享、微信二维码（uqr 懒加载）。
 * 分享状态与意图链接逻辑在 useShareActions hook 中，本组件负责呈现。
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { X, Copy, Check, Link as LinkIcon, QrCode, Share2, MessageSquareShare } from 'lucide-react';
import { SlideModal } from './SlideModal';
import { useShareActions } from '@/hooks/useShareActions';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 文章标题 / 说说场景传「说说 · 日期」类标题。 */
  title: string;
  /** 文章摘要 / 说说正文预览。 */
  excerpt: string;
  /** 可分享的绝对链接（canonical）。 */
  url: string;
  /** 打开弹窗前父层已自动复制链接时传入结果：true/false，未自动复制时不传。 */
  autoCopied?: boolean | null;
  /** 卡片区标签文案（默认「当前文章」；说说传「这条说说」）。 */
  contentLabel?: string;
}

const XIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const TelegramIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
    <path d="M21.938 3.863 18.87 20.096c-.23 1.14-.935 1.42-1.895.885l-5.23-3.852-2.524 2.43c-.28.28-.515.515-1.055.515l.377-5.322 9.683-8.752c.422-.376-.094-.585-.655-.209L5.37 13.5l-5.16-1.612c-1.123-.352-1.14-1.123.234-1.662L20.484 2.29c.935-.352 1.753.209 1.454 1.573z" />
  </svg>
);

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  title,
  excerpt,
  url,
  autoCopied,
  contentLabel = '当前文章',
}) => {
  const [showQrCode, setShowQrCode] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  // 父层自动复制结果的本地快照：仅在打开且用户未手动复制时初始化。
  const [initialAutoCopied, setInitialAutoCopied] = useState<boolean | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const { copiedType, copyError, copyFullText, copyLink, canNativeShare, nativeShare, shareIntents, resetOnClose } =
    useShareActions({ title, excerpt, url });

  // 用户手动触发过复制后，父层迟到的 autoCopied 结果不再覆盖界面状态。
  const userCopiedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      resetOnClose();
      userCopiedRef.current = false;
      setInitialAutoCopied(null);
      setShowQrCode(false);
      setQrSvg(null);
      setQrFailed(false);
      return;
    }
    if (userCopiedRef.current) return;
    if (autoCopied === true || autoCopied === false) {
      setInitialAutoCopied(autoCopied);
    }
  }, [autoCopied, isOpen, resetOnClose]);

  // 二维码按需懒加载（uqr 不进首屏 chunk）：展开微信面板时才 import。
  useEffect(() => {
    if (!showQrCode || qrSvg || qrFailed) {
      return;
    }
    let cancelled = false;
    void import('uqr')
      .then(({ renderSVG }) => {
        if (!cancelled) {
          setQrSvg(renderSVG(url));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setQrFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [showQrCode, qrSvg, qrFailed, url]);

  const markUserCopied = () => {
    userCopiedRef.current = true;
  };

  const handleCopyFull = async () => {
    markUserCopied();
    await copyFullText(`标题：${title}\n简介：${excerpt}\n链接：${url}`);
  };

  const handleCopyLink = async () => {
    markUserCopied();
    await copyLink();
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
          分享内容
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
          复制完整分享文案，或者把链接带到你常用的平台。
        </p>

        <div className="mb-5 border-y border-zinc-200 py-4 dark:border-zinc-800">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            <LinkIcon size={14} />
            <span>{contentLabel}</span>
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
            onClick={handleCopyFull}
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
            onClick={handleCopyLink}
            className="editorial-button rounded-control active:scale-[0.98]"
            aria-label="仅复制链接"
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

        {/* 社交渠道：链接跳转各平台官方分享，不引入第三方 SDK */}
        <div className="mt-4 flex flex-wrap items-center gap-2" role="group" aria-label="分享到其他平台">
          {canNativeShare && (
            <button
              type="button"
              onClick={() => void nativeShare()}
              className="editorial-button rounded-control px-3 py-2 text-xs"
              aria-label="使用系统分享"
            >
              <Share2 size={14} aria-hidden="true" />
              系统分享
            </button>
          )}
          <a
            href={shareIntents.find((intent) => intent.id === 'x')?.href}
            target="_blank"
            rel="noopener noreferrer"
            className="editorial-button rounded-control px-3 py-2 text-xs"
            aria-label="分享到 X（推特）"
            title="分享到 X"
          >
            <XIcon size={14} />X
          </a>
          <a
            href={shareIntents.find((intent) => intent.id === 'telegram')?.href}
            target="_blank"
            rel="noopener noreferrer"
            className="editorial-button rounded-control px-3 py-2 text-xs"
            aria-label="分享到 Telegram"
            title="分享到 Telegram"
          >
            <TelegramIcon size={14} />
            Telegram
          </a>
          <a
            href={shareIntents.find((intent) => intent.id === 'qzone')?.href}
            target="_blank"
            rel="noopener noreferrer"
            className="editorial-button rounded-control px-3 py-2 text-xs"
            aria-label="分享到 QQ 空间"
            title="分享到 QQ 空间"
          >
            <MessageSquareShare size={14} aria-hidden="true" />
            QQ
          </a>
          <button
            type="button"
            onClick={() => setShowQrCode((value) => !value)}
            aria-expanded={showQrCode}
            aria-controls="share-wechat-qr"
            className="editorial-button rounded-control px-3 py-2 text-xs"
            aria-label="微信扫码分享"
          >
            <QrCode size={14} aria-hidden="true" />
            微信
          </button>
        </div>

        {showQrCode && (
          <div
            id="share-wechat-qr"
            className="mt-4 flex flex-col items-center gap-3 rounded-surface border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/40"
          >
            {qrSvg ? (
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(qrSvg)}`}
                alt="当前链接的微信分享二维码"
                width={168}
                height={168}
                className="h-[10.5rem] w-[10.5rem] rounded-[6px] bg-white p-1.5"
              />
            ) : qrFailed ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">二维码生成失败，可直接复制链接后在微信中打开。</p>
            ) : (
              <div
                aria-hidden="true"
                className="h-[10.5rem] w-[10.5rem] animate-pulse rounded-[6px] bg-zinc-200 dark:bg-zinc-800"
              />
            )}
            <p className="text-center text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              微信内长按识别或截图扫码；也可以复制链接后到微信粘贴发送。
            </p>
          </div>
        )}

        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
          {copyError ??
            (copiedType
              ? '复制成功'
              : initialAutoCopied === true
                ? '链接已自动复制'
                : initialAutoCopied === false
                  ? '自动复制失败，请点击下方按钮手动复制。'
                  : '选择一种分享方式')}
        </p>
      </div>
    </SlideModal>
  );
};
