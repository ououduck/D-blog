import React from 'react';
import { Github, Mail, Code, Terminal } from 'lucide-react';
import { siteConfig } from '@config/site.config';
import { Seo } from '../components/Seo';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { Surface } from '@/components/ui/Surface';

export const About = () => {
  return (
    <div className="mx-auto max-w-4xl pb-10 pt-6 md:pb-16 md:pt-10">
      <Seo title="关于" description="关于跑路的duck：前端开发者，热爱探索 Web 技术，致力于构建极致性能与优秀交互的用户界面。" />

      <header className="mb-6 md:mb-8">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400">About</p>
        <h1 className="font-serif text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 md:text-5xl">关于我</h1>
      </header>

      <Surface className="overflow-hidden">
        <div className="grid md:grid-cols-[13rem_minmax(0,1fr)]">
          <div className="flex min-h-56 items-center justify-center border-b border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-800 dark:bg-zinc-800/40 md:min-h-full md:border-b-0 md:border-r">
            <div className="h-32 w-32 overflow-hidden rounded-full border-4 border-zinc-300 bg-paper dark:border-zinc-700 dark:bg-zinc-900 md:h-36 md:w-36">
              <ProgressiveImage src={siteConfig.author.avatar} alt={`${siteConfig.author.name}的头像`} wrapperClassName="h-full w-full" className="h-full w-full object-cover" />
            </div>
          </div>

          <div className="p-6 sm:p-8">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Independent Developer</p>
            <h2 className="mb-2 font-serif text-3xl font-bold text-zinc-900 dark:text-zinc-100 md:text-4xl">
              {siteConfig.author.name}
            </h2>
            <p className="mb-6 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{siteConfig.author.role}</p>
            <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400 md:text-lg md:leading-8">{siteConfig.author.bio}</p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a href={siteConfig.social.github} target="_blank" rel="noopener noreferrer" className="editorial-button-primary min-h-11 px-5">
                <Github size={18} />
                <span>GitHub</span>
              </a>
              <a href={siteConfig.social.email} className="editorial-button min-h-11 px-5">
                <Mail size={18} />
                <span>Email</span>
              </a>
            </div>
          </div>
        </div>
      </Surface>

      <div className="mt-6 grid gap-4 md:mt-8 md:grid-cols-2">
        <Surface className="flex min-h-64 flex-col p-5 sm:p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-icon bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <Code size={20} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Toolkit</p>
              <h2 className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100">技术栈</h2>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {['React', 'TypeScript', 'Tailwind CSS', 'Vite', 'Node.js', 'Framer Motion'].map((tech) => (
              <span key={tech} className="rounded-control border border-zinc-300 bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-300">
                {tech}
              </span>
            ))}
          </div>
        </Surface>

        <Surface className="flex min-h-64 flex-col p-5 sm:p-6">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-icon bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              <Terminal size={20} />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Notes</p>
              <h2 className="font-serif text-2xl font-bold text-zinc-900 dark:text-zinc-100">折腾记录</h2>
            </div>
          </div>
          <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-400 md:text-base">
            热衷于探索前端 Web 技术，喜欢构建极致性能和优秀交互的用户界面，目前正致力于开源项目的贡献与个人产品的打磨。
          </p>
        </Surface>
      </div>
    </div>
  );
};
