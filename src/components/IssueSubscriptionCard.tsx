import { Bell, ExternalLink, Github } from 'lucide-react';

const ISSUE_SUBSCRIPTION_URL = 'https://github.com/ououduck/D-blog/issues/6';

export const IssueSubscriptionCard = ({ compact = false }: { compact?: boolean }) => {
  if (compact) {
    return (
      <a
        href={ISSUE_SUBSCRIPTION_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 transition-colors hover:text-ink dark:hover:text-white"
      >
        <Bell size={15} aria-hidden="true" />
        <span>订阅</span>
      </a>
    );
  }

  return (
    <aside
      className="rounded-surface border border-zinc-300 bg-zinc-50/70 p-4 dark:border-zinc-700 dark:bg-zinc-900/70 sm:p-5"
      aria-labelledby="issue-subscription-heading"
    >
      <div className="flex min-w-0 gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-icon border border-zinc-300 bg-paper text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
          <Bell size={18} aria-hidden="true" />
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Article updates</p>
          <h2 id="issue-subscription-heading" className="font-serif text-lg font-bold text-zinc-900 dark:text-zinc-100">订阅新文章提醒</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">在 GitHub Issue 中点击 Subscribe，即可接收 D-blog 的更新通知。</p>
        </div>
      </div>
      <a
        href={ISSUE_SUBSCRIPTION_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="editorial-button min-h-10 shrink-0 px-4 text-sm"
      >
        <Github size={16} aria-hidden="true" />
        <span>前往订阅</span>
        <ExternalLink size={14} aria-hidden="true" />
      </a>
    </aside>
  );
};
