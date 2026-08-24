/**
 * 反馈侧签（FeedbackDock）：固定在视口右侧中下部、紧贴侧边的反馈入口。
 * 常态即一个立着的小长方形侧签，上竖向显示「反馈」二字，点击直接跳转
 * 外部反馈表单（Tally），不弹窗、不展开。
 */

import React from 'react';
import { siteConfig } from '@config/site.config';

// 侧签固定在视口中下部，紧贴右侧边缘（含刘海屏安全区）。
// top 用 50%：文章阅读页右下角的固定控件栈（「专注阅读」/「目录」/进度徽标）
// 最高探至视口底部上方约 13rem + 44px；62% 在常见矮视口（如 1366×768）下会与其
// 重叠，上移至 50% 后可在常见视口高度（≥632px）下完全错开。
const FEEDBACK_DOCK_TOP = '50%';
const FEEDBACK_DOCK_RIGHT = 'env(safe-area-inset-right, 0px)';

export const FeedbackDock: React.FC = () => (
  <a
    href={siteConfig.feedback.url}
    target="_blank"
    rel="noopener noreferrer"
    aria-label="提交反馈与建议"
    className="feedback-dock fixed z-floating inline-flex h-16 w-9 flex-col items-center justify-center gap-0.5 rounded-l-md border border-r-0 border-zinc-950 bg-zinc-950 text-xs font-semibold leading-none text-white shadow-sm transition-colors hover:bg-zinc-800 active:bg-zinc-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-950 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
    style={{ top: FEEDBACK_DOCK_TOP, right: FEEDBACK_DOCK_RIGHT }}
  >
    <span>反</span>
    <span>馈</span>
  </a>
);
