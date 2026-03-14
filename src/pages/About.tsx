import React from 'react';
import { motion } from 'framer-motion';
import { Github, Mail, Code, Terminal } from 'lucide-react';
import { siteConfig } from '@config/site.config';
import { Seo } from '../components/Seo';

export const About = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mx-auto max-w-4xl py-12 md:py-20"
    >
      <Seo title="关于我" />

      <div className="mb-12 flex flex-col items-center gap-8 rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-xl shadow-zinc-200/50 dark:border-zinc-800 dark:bg-zinc-900 dark:shadow-none md:flex-row md:gap-12 md:p-12 md:text-left">
        <div className="group relative">
          <div className="absolute inset-0 rounded-full bg-accent opacity-20 blur-xl transition-opacity group-hover:opacity-40" />
          <div className="relative z-10 h-32 w-32 overflow-hidden rounded-full border-4 border-white shadow-2xl dark:border-zinc-800 md:h-40 md:w-40">
            <img src={siteConfig.author.avatar} alt="Avatar" className="h-full w-full object-cover" />
          </div>
        </div>

        <div className="flex-1">
          <h1 className="mb-3 font-serif text-4xl font-bold text-ink dark:text-white md:text-5xl">
            {siteConfig.author.name}
          </h1>
          <p className="mb-6 text-xs font-bold uppercase tracking-widest text-accent">{siteConfig.author.role}</p>
          <p className="mb-8 font-sans text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">{siteConfig.author.bio}</p>

          <div className="flex items-center justify-center gap-4 md:justify-start">
            <a href={siteConfig.social.github} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-accent">
              <Github size={18} />
              <span>GitHub</span>
            </a>
            <a href={siteConfig.social.email} className="flex items-center gap-2 rounded-full bg-zinc-100 px-5 py-2.5 text-sm font-bold text-ink transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-white dark:hover:bg-zinc-700">
              <Mail size={18} />
              <span>Email</span>
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mb-6 flex items-center gap-3 text-ink dark:text-white">
            <Code className="text-accent" />
            <h2 className="font-serif text-2xl font-bold">技术栈</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {['React', 'TypeScript', 'Tailwind CSS', 'Next.js', 'Node.js', 'Vite', 'Framer Motion'].map((tech) => (
              <span key={tech} className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-bold text-zinc-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {tech}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-zinc-50 p-8 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mb-6 flex items-center gap-3 text-ink dark:text-white">
            <Terminal className="text-accent" />
            <h2 className="font-serif text-2xl font-bold">折腾记录</h2>
          </div>
          <p className="mb-4 leading-relaxed text-zinc-600 dark:text-zinc-400">
            热衷于探索前端 Web 技术，喜欢构建极致性能和优秀交互的用户界面，目前正致力于开源项目的贡献与个人产品的打磨。
          </p>
        </div>
      </div>
    </motion.div>
  );
};
