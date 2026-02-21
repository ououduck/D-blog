import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExternalLink, X, Copy, Check } from 'lucide-react';
import { siteConfig } from '../site.config';
import { Seo } from '../components/Seo';

export const Friends = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  const siteInfo = {
    name: siteConfig.title,
    description: siteConfig.description,
    url: siteConfig.url,
    avatar: siteConfig.logo
  };

  const templateText = `网站名：\n网站简介：\n网站链接：\n网站LOGO链接：`;

  const handleCopyTemplate = async () => {
    await navigator.clipboard.writeText(templateText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="py-12 md:py-20">
      <Seo title="友情链接" description="我的朋友们和推荐的网站" />
      
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-ink dark:text-white mb-6">友情链接</h1>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
          这里汇集了一些优秀的技术博客和有趣的朋友。如果你也想交换友链，欢迎随时联系我。
        </p>
      </motion.div>

      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {siteConfig.friends && siteConfig.friends.map((friend, index) => (
          <motion.a key={index} variants={itemVariants} href={friend.url} target="_blank" rel="noopener noreferrer" className="group block p-6 bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-accent/30 dark:hover:border-accent/30 hover:shadow-xl hover:shadow-accent/5 transition-all duration-300 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity text-accent">
                <ExternalLink size={16} />
             </div>
             <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 border border-zinc-100 dark:border-zinc-700">
                   <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" />
                </div>
                <div>
                   <h3 className="font-serif font-bold text-lg text-ink dark:text-white group-hover:text-accent transition-colors mb-1">{friend.name}</h3>
                   <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">{friend.description}</p>
                </div>
             </div>
          </motion.a>
        ))}
        
        <motion.div variants={itemVariants} onClick={() => setIsModalOpen(true)} className="p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center hover:border-accent/50 hover:bg-accent/5 transition-colors group cursor-pointer">
           <div className="w-full h-full flex flex-col items-center justify-center">
             <div className="text-zinc-400 group-hover:text-accent mb-2 transition-colors font-serif font-bold text-xl">+</div>
             <p className="text-sm font-bold text-zinc-500 group-hover:text-accent transition-colors">申请友链</p>
           </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-void/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col max-h-[90vh] z-10">
              
              <div className="flex items-center justify-between p-5 border-b border-zinc-100 dark:border-zinc-800">
                <h3 className="text-xl font-serif font-bold text-ink dark:text-white">申请友链</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-1.5 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors">
                  <X size={20} />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-6">
                <div className="bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900/50 rounded-xl p-4 text-sm text-orange-800 dark:text-orange-300 leading-relaxed">
                  <strong>公告：</strong>{siteConfig.friendsPage.announcement} <span className="font-bold select-all">{siteConfig.social.rawEmail}</span>
                </div>

                <div>
                  <h4 className="font-bold text-ink dark:text-white mb-3 text-sm">本站信息（请先添加本站）</h4>
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <img src={siteInfo.avatar} alt={siteInfo.name} className="w-16 h-16 rounded-full border border-zinc-200 dark:border-zinc-600 bg-white flex-shrink-0" />
                    <div className="flex-1 w-full space-y-1">
                      <div className="font-bold text-ink dark:text-white">{siteInfo.name}</div>
                      <div className="text-sm text-zinc-500 dark:text-zinc-400">{siteInfo.description}</div>
                      <div className="text-xs font-mono text-accent break-all select-all pt-1">链接：{siteInfo.url}</div>
                      <div className="text-xs font-mono text-accent break-all select-all">LOGO：{siteInfo.avatar}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-ink dark:text-white text-sm">友链申请模板</h4>
                    <button onClick={handleCopyTemplate} className="flex items-center gap-1.5 text-xs font-bold text-accent hover:opacity-80 transition-opacity bg-accent/10 px-3 py-1.5 rounded-md">
                      {isCopied ? <Check size={14} /> : <Copy size={14} />}
                      {isCopied ? '已复制' : '复制模板'}
                    </button>
                  </div>
                  <pre className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-600 dark:text-zinc-300 font-mono whitespace-pre-wrap select-all">
                    {templateText}
                  </pre>
                </div>
              </div>

              <div className="p-5 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-end">
                <a 
                  href={siteConfig.social.email}
                  className="px-6 py-2.5 bg-ink dark:bg-white text-white dark:text-ink rounded-xl font-bold text-sm hover:opacity-90 transition-opacity flex items-center justify-center shadow-md"
                >
                  去发送
                </a>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};