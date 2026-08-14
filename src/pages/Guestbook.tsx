import { MessageSquareText, LogIn, ShieldCheck, Lightbulb } from 'lucide-react';
import { siteConfig } from '@config/site.config';
import { absoluteSiteUrl } from '@/utils/siteUrl';
import { Seo } from '../components/Seo';
import { Surface } from '@/components/ui/Surface';
import { GiscusComments } from '@/components/GiscusComments';

export const Guestbook = () => {
  return (
    <div className="mx-auto max-w-4xl pb-10 pt-6 md:pb-16 md:pt-10">
      <Seo
        title="留言板"
        description="在 D-blog 留言板留下你的足迹：闲聊、建议、问题反馈都可以，登录 GitHub 账号即可留言。"
        url="/guestbook"
        structuredData={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: `${siteConfig.title} - 留言板`,
          description: 'D-blog 访客留言板：闲聊、建议与问题反馈。',
          url: absoluteSiteUrl('/guestbook', siteConfig.url),
          inLanguage: 'zh-CN',
          isPartOf: {
            '@type': 'WebSite',
            name: siteConfig.title,
            url: absoluteSiteUrl('/', siteConfig.url)
          }
        }}
      />

      <header className="mb-6 md:mb-8">
        <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
          <MessageSquareText size={14} aria-hidden="true" />
          Guestbook
        </p>
        <h1 className="font-serif text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl">留言板</h1>
      </header>

      <Surface className="mb-8 p-5 sm:p-6">
        <p className="text-base leading-7 text-zinc-600 dark:text-zinc-400 md:text-lg md:leading-8">
          欢迎在 D-blog 留下你的足迹：闲聊、建议、问题反馈都可以。文章相关的讨论请直接在对应文章页面的评论区进行。
        </p>
        <ul className="mt-5 space-y-2.5 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          <li className="flex items-start gap-2.5">
            <LogIn size={16} className="mt-0.5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
            <span>登录 GitHub 账号即可留言，无需注册新账号。</span>
          </li>
          <li className="flex items-start gap-2.5">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
            <span>友善交流，广告与垃圾内容会被 Akismet 自动清理。</span>
          </li>
          <li className="flex items-start gap-2.5">
            <Lightbulb size={16} className="mt-0.5 shrink-0 text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
            <span>好的建议会认真阅读，可能成为下一篇博客的选题。</span>
          </li>
        </ul>
      </Surface>

      {siteConfig.giscusEnabled ? (
        <GiscusComments mapping="specific" term={siteConfig.guestbook.discussionId} />
      ) : (
        <Surface className="flex flex-col items-center gap-3 p-8 text-center sm:p-10">
          <MessageSquareText size={24} className="text-zinc-400 dark:text-zinc-500" aria-hidden="true" />
          <p className="text-sm leading-6 text-zinc-500 dark:text-zinc-400">留言功能暂未开启，敬请期待。</p>
        </Surface>
      )}
    </div>
  );
};
