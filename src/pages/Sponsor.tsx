import React from 'react';
import { Code2, ExternalLink, FileText, Megaphone } from 'lucide-react';

import { Seo } from '../components/Seo';
import { adsConfig } from '../../config/ads.config';
import { siteConfig } from '@config/site.config';

interface SponsorOption {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  detail: string;
  buttonText: string;
  buttonLink?: string;
  disabled?: boolean;
}

const sponsorOptions: SponsorOption[] = [
  {
    id: 'code',
    icon: Code2,
    title: '赞助代码',
    description: '提交修复、优化体验，或补充新功能。',
    detail: '适合熟悉 React、TypeScript、构建脚本或博客内容工作流的朋友。',
    buttonText: '前往仓库',
    buttonLink: siteConfig.social.github
  },
  {
    id: 'article',
    icon: FileText,
    title: '赞助文章',
    description: '提供优质文章、勘误或内容建议。',
    detail: '欢迎通过 PR 补充技术文章、使用心得、教程或修正文档问题。',
    buttonText: '提交内容',
    buttonLink: siteConfig.social.github
  },
  {
    id: 'ads',
    icon: Megaphone,
    title: '广告赞助',
    description: '通过访问赞助商链接间接支持本站。',
    detail: '广告内容集中展示在下方，页面不插入弹窗或侵入式广告。',
    buttonText: adsConfig.length > 0 ? '查看下方广告' : '暂无广告',
    disabled: true
  }
];

export const Sponsor: React.FC = () => {
  return (
    <div className="mx-auto max-w-5xl pb-12 pt-6 md:pb-20 md:pt-10">
      <Seo title="赞助" description="支持 D-blog 的多种方式：贡献代码、撰写文章或通过赞助商链接帮助博客持续成长。" />

      <header className="mb-10 border-b border-zinc-200 pb-8 text-center dark:border-zinc-800 md:pb-10">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.28em] text-zinc-500 dark:text-zinc-400">Support D-blog</p>
        <h1 className="mb-4 font-serif text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl">
          没有收款码的赞助
        </h1>
        <p className="mx-auto max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-400 md:text-base">
          如果这个项目帮到了你，可以通过代码、文章或赞助商链接支持它继续维护。

        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5" aria-label="赞助方式">
        {sponsorOptions.map((option) => {
          const Icon = option.icon;
          const cardContent = (
            <>
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-control bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
                <Icon size={21} />
              </div>
              <h2 className="mb-2 font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100">{option.title}</h2>
              <p className="mb-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{option.description}</p>
              <p className="mb-5 text-xs leading-5 text-zinc-500 dark:text-zinc-500">{option.detail}</p>
              <span className={`mt-auto inline-flex items-center gap-2 text-sm font-semibold transition-colors ${
                option.disabled
                  ? 'cursor-default text-zinc-400 dark:text-zinc-500'
                  : 'text-zinc-900 hover:text-zinc-600 dark:text-zinc-100 dark:hover:text-zinc-300'
              }`}>
                {option.buttonText}
                {!option.disabled && <ExternalLink size={14} />}
              </span>
            </>
          );

          if (option.disabled || !option.buttonLink) {
            return (
              <article key={option.id} className="flex min-h-64 flex-col rounded-surface border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
                {cardContent}
              </article>
            );
          }

          return (
            <a
              key={option.id}
              href={option.buttonLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-64 flex-col rounded-surface border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-600"
            >
              {cardContent}
            </a>
          );
        })}
      </section>

      <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800" aria-label="赞助商广告">
        <div className="mb-5 flex flex-col gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500 dark:text-zinc-400">Sponsor Ads</p>
            <h2 className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100">赞助商链接</h2>
          </div>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">共 {adsConfig.length} 个赞助项</p>
        </div>

        {adsConfig.length > 0 ? (
          <div className="grid gap-4">
            {adsConfig.map((ad) => (
              <a
                key={ad.id}
                href={ad.link}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded-surface border border-zinc-200 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
                aria-label={`打开赞助商链接：${ad.title}`}
              >
                <img
                  src={ad.image}
                  alt={ad.alt}
                  loading="lazy"
                  decoding="async"
                  className="h-auto w-full"
                />
                <div className="flex items-center justify-between border-t border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{ad.title}</span>
                  <ExternalLink size={15} className="text-zinc-500" />
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div className="border-y border-dashed border-zinc-300 py-8 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
            当前暂无赞助商广告。
          </div>
        )}
      </section>
    </div>
  );
};
