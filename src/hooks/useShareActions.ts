/**
 * 分享动作共享逻辑（文章 / 说说共用）：
 * - 复制反馈状态（seq 竞态守卫：快速开关弹窗时迟到的复制结果不串台）
 * - Web Share API 探测与调用
 * - X / Telegram / QQ(QZone) 分享意图链接（encodeURIComponent 编码）
 * 分享渠道按钮的 UI 渲染见 ShareActions 组件；本 hook 只负责状态与数据。
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { copyTextToClipboard } from '@/utils/clipboard';
import { useResetTimer } from '@/hooks/useResetTimer';

export type ShareCopyType = 'all' | 'link';

export interface ShareIntent {
  id: 'x' | 'telegram' | 'qzone';
  label: string;
  href: string;
}

interface UseShareActionsOptions {
  title: string;
  excerpt: string;
  url: string;
}

export const useShareActions = ({ title, excerpt, url }: UseShareActionsOptions) => {
  const [copiedType, setCopiedType] = useState<ShareCopyType | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  // 复制会话序号：弹窗重开或连续复制时，先发出的异步结果晚到会被丢弃。
  const copySeqRef = useRef(0);
  const { clear: clearResetTimer, schedule: scheduleReset } = useResetTimer();

  const resetFeedback = useCallback(() => {
    setCopiedType(null);
    setCopyError(null);
  }, []);

  const scheduleFeedbackReset = useCallback(
    () =>
      // 2 秒后自动清除复制反馈（连续复制会重置计时）。
      scheduleReset(resetFeedback, 2000),
    [resetFeedback, scheduleReset],
  );

  // 弹窗关闭时清空反馈与挂起的计时器。
  const resetOnClose = useCallback(() => {
    clearResetTimer();
    copySeqRef.current += 1;
    resetFeedback();
  }, [clearResetTimer, resetFeedback]);

  const copy = useCallback(
    async (type: ShareCopyType, text: string): Promise<boolean> => {
      const seq = ++copySeqRef.current;
      try {
        const copied = await copyTextToClipboard(text);
        // 结果晚到（弹窗已关闭/用户再次触发复制）：丢弃，不覆盖最新状态。
        if (seq !== copySeqRef.current) {
          return copied;
        }
        if (!copied) {
          setCopiedType(null);
          setCopyError('复制失败，请手动复制链接。');
          scheduleFeedbackReset();
          return false;
        }
        setCopiedType(type);
        setCopyError(null);
        scheduleFeedbackReset();
        return true;
      } catch (error) {
        console.error('复制失败:', error);
        if (seq !== copySeqRef.current) {
          return false;
        }
        setCopiedType(null);
        setCopyError('复制失败，请手动复制链接。');
        scheduleFeedbackReset();
        return false;
      }
    },
    [scheduleFeedbackReset],
  );

  const copyFullText = useCallback((fullText: string) => copy('all', fullText), [copy]);
  const copyLink = useCallback(() => copy('link', url), [copy, url]);

  /** Web Share API（仅安全上下文且浏览器实现时可用）。 */
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const nativeShare = useCallback(async (): Promise<boolean> => {
    if (!canNativeShare) {
      return false;
    }
    try {
      await navigator.share({ title, text: excerpt, url });
      return true;
    } catch (error) {
      // 用户取消分享（AbortError）属正常操作，不算失败。
      if (error instanceof DOMException && error.name === 'AbortError') {
        return false;
      }
      console.error('系统分享失败:', error);
      return false;
    }
  }, [canNativeShare, excerpt, title, url]);

  /** 社交平台分享意图链接（encodeURIComponent 保证中文标题与特殊 URL 正确编码）。 */
  const shareIntents = useMemo<ShareIntent[]>(
    () => [
      {
        id: 'x',
        label: '分享到 X',
        href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
      },
      {
        id: 'telegram',
        label: '分享到 Telegram',
        href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
      },
      {
        id: 'qzone',
        label: '分享到 QQ 空间',
        href: `https://sns.qzone.qq.com/cgi-bin/qzshare/cgi_qzshare_onekey?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}&summary=${encodeURIComponent(excerpt)}`,
      },
    ],
    [excerpt, title, url],
  );

  return {
    copiedType,
    copyError,
    copyFullText,
    copyLink,
    canNativeShare,
    nativeShare,
    shareIntents,
    resetOnClose,
  };
};
