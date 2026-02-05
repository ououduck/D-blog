import React from 'react';
import { motion } from 'framer-motion';
import { ExternalLink } from 'lucide-react';
import { siteConfig } from '../site.config';
import { Seo } from '../components/Seo';

export const Friends = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <div className="py-12 md:py-20">
      <Seo title="友情链接" description="我的朋友们和推荐的网站" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-16"
      >
        <h1 className="text-4xl md:text-5xl font-serif font-bold text-ink dark:text-white mb-6">
          友情链接
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 max-w-xl mx-auto">
          这里汇集了一些优秀的技术博客和有趣的朋友。如果你也想交换友链，欢迎随时联系我。
        </p>
      </motion.div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {siteConfig.friends && siteConfig.friends.map((friend, index) => (
          <motion.a
            key={index}
            variants={itemVariants}
            href={friend.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group block p-6 bg-white dark:bg-zinc-900/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 hover:border-accent/30 dark:hover:border-accent/30 hover:shadow-xl hover:shadow-accent/5 transition-all duration-300 relative overflow-hidden"
          >
             <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity text-accent">
                <ExternalLink size={16} />
             </div>
             
             <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 border border-zinc-100 dark:border-zinc-700">
                   <img src={friend.avatar} alt={friend.name} className="w-full h-full object-cover" />
                </div>
                <div>
                   <h3 className="font-serif font-bold text-lg text-ink dark:text-white group-hover:text-accent transition-colors mb-1">
                      {friend.name}
                   </h3>
                   <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                      {friend.description}
                   </p>
                </div>
             </div>
          </motion.a>
        ))}
        
        {/* 申请友链卡片 */}
        <motion.div variants={itemVariants} className="p-6 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center text-center hover:border-accent/50 hover:bg-accent/5 transition-colors group cursor-pointer">
           <a href={siteConfig.social.email} className="w-full h-full flex flex-col items-center justify-center">
             <div className="text-zinc-400 group-hover:text-accent mb-2 transition-colors font-serif font-bold text-xl">+</div>
             <p className="text-sm font-bold text-zinc-500 group-hover:text-accent transition-colors">申请友链</p>
           </a>
        </motion.div>
      </motion.div>
    </div>
  );
};