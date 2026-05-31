import React from 'react';
import { Github, Mail, Code, Terminal } from 'lucide-react';
import { siteConfig } from '@config/site.config';
import { Seo } from '../components/Seo';
import { ProgressiveImage } from '@/components/ProgressiveImage';

export const About = () => {
  return (
    <div className="mx-auto max-w-4xl py-12 md:py-20">
      <Seo title="关于我" description="关于跑路的duck：前端开发者，热爱探索 Web 技术，致力于构建极致性能与优秀交互的用户界面。" />

      <div className="mb-12 flex flex-col items-center gap-8 rounded-2xl liquid-glass backdrop-blur-xl p-8 text-center md:flex-row md:gap-12 md:p-12 md:text-left">
        <div className="group relative">
          <div className="relative z-10 h-32 w-32 overflow-hidden rounded-full border-4 border-zinc-200 dark:border-zinc-800 md:h-40 md:w-40">
            <ProgressiveImage src={siteConfig.author.avatar} alt="Avatar" wrapperClassName="h-full w-full" className="h-full w-full object-cover" />
          </div>
        </div>

        <div className="flex-1">
          <h1 className="mb-3 font-serif text-4xl font-bold text-zinc-900 dark:text-zinc-100 md:text-5xl">
            {siteConfig.author.name}
          </h1>
          <p className="mb-6 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">{siteConfig.author.role}</p>
          <p className="mb-8 font-sans text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">{siteConfig.author.bio}</p>

          <div className="flex items-center justify-center gap-4 md:justify-start">
            <a href={siteConfig.social.github} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200">
              <Github size={18} />
              <span>GitHub</span>
            </a>
            <a href={siteConfig.social.email} className="flex items-center gap-2 rounded-full liquid-glass backdrop-blur-xl px-5 py-2.5 text-sm font-bold text-zinc-900 transition-colors dark:text-zinc-100">
              <Mail size={18} />
              <span>Email</span>
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-2xl liquid-glass backdrop-blur-xl p-8">
          <div className="mb-6 flex items-center gap-3 text-zinc-900 dark:text-zinc-100">
            <Code className="text-zinc-700 dark:text-zinc-300" />
            <h2 className="font-serif text-2xl font-bold">技术栈</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {['React', 'TypeScript', 'Tailwind CSS', 'Next.js', 'Node.js', 'Vite', 'Framer Motion'].map((tech) => (
              <span key={tech} className="rounded-lg liquid-glass backdrop-blur-md px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                {tech}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-2xl liquid-glass backdrop-blur-xl p-8">
          <div className="mb-6 flex items-center gap-3 text-zinc-900 dark:text-zinc-100">
            <Terminal className="text-zinc-700 dark:text-zinc-300" />
            <h2 className="font-serif text-2xl font-bold">折腾记录</h2>
          </div>
          <p className="mb-4 leading-relaxed text-zinc-600 dark:text-zinc-400">
            热衷于探索前端 Web 技术，喜欢构建极致性能和优秀交互的用户界面，目前正致力于开源项目的贡献与个人产品的打磨。
          </p>
        </div>
      </div>
    </div>
  );
};
