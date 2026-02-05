import React from 'react';
import { motion } from 'framer-motion';
import { Github, Mail, Code, Terminal } from 'lucide-react';
import { siteConfig } from '../site.config';
import { Seo } from '../components/Seo';

export const About = () => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="max-w-4xl mx-auto py-12 md:py-20"
    >
      <Seo title="关于我" />
      
      {/* 头部卡片 */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-8 md:p-12 border border-zinc-200 dark:border-zinc-800 shadow-xl shadow-zinc-200/50 dark:shadow-none mb-12 flex flex-col md:flex-row items-center gap-8 md:gap-12 text-center md:text-left">
        <div className="relative group">
           <div className="absolute inset-0 bg-accent rounded-full blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
           <div className="w-32 h-32 md:w-40 md:h-40 rounded-full overflow-hidden border-4 border-white dark:border-zinc-800 shadow-2xl relative z-10">
              <img src={siteConfig.author.avatar} alt="Avatar" className="w-full h-full object-cover" />
           </div>
        </div>
        
        <div className="flex-1">
           <h1 className="text-4xl md:text-5xl font-serif font-bold text-ink dark:text-white mb-3">
             {siteConfig.author.name}
           </h1>
           <p className="text-accent font-bold tracking-widest uppercase text-xs mb-6">
             {siteConfig.author.role}
           </p>
           <p className="text-lg text-zinc-600 dark:text-zinc-300 leading-relaxed font-sans mb-8">
             {siteConfig.author.bio}
           </p>
           
           <div className="flex items-center justify-center md:justify-start gap-4">
              <a href={siteConfig.social.github} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2.5 bg-zinc-900 text-white rounded-full hover:bg-accent transition-colors font-bold text-sm">
                <Github size={18} />
                <span>Github</span>
              </a>
              <a href={siteConfig.social.email} className="flex items-center gap-2 px-5 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-ink dark:text-white rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors font-bold text-sm">
                <Mail size={18} />
                <span>Email</span>
              </a>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 技能卡片 */}
        <div className="p-8 rounded-3xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
           <div className="flex items-center gap-3 mb-6 text-ink dark:text-white">
              <Code className="text-accent" />
              <h2 className="text-2xl font-serif font-bold">技术栈</h2>
           </div>
           <div className="flex flex-wrap gap-2">
              {['React', 'TypeScript', 'Tailwind CSS', 'Next.js', 'Node.js', 'Vite', 'Framer Motion'].map(tech => (
                 <span key={tech} className="px-3 py-1.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs font-bold text-zinc-600 dark:text-zinc-300">
                    {tech}
                 </span>
              ))}
           </div>
        </div>

        {/* 理念卡片 */}
        <div className="p-8 rounded-3xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800">
           <div className="flex items-center gap-3 mb-6 text-ink dark:text-white">
              <Terminal className="text-accent" />
              <h2 className="text-2xl font-serif font-bold">折腾记录</h2>
           </div>
           <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4">
              热衷于探索前沿 Web 技术，喜欢构建极致性能和优秀交互的用户界面。
              目前正致力于开源项目的贡献与个人产品的打磨。
           </p>
        </div>
      </div>

    </motion.div>
  );
};