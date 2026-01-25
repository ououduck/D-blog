import React from 'react';
import { motion } from 'framer-motion';
import { Github, Mail, Coffee } from 'lucide-react';
import { siteConfig } from '../site.config';

export const About = () => {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1 }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, y: -20 }}
      className="max-w-2xl mx-auto py-12"
    >
      <motion.div variants={itemVariants} className="text-center mb-12">
        <div className="w-32 h-32 mx-auto mb-6 rounded-full overflow-hidden border-4 border-white dark:border-slate-800 shadow-2xl relative">
            <img src={siteConfig.author.avatar} alt="Avatar" className="w-full h-full object-cover" />
        </div>
        <h1 className="text-4xl font-bold mb-2 text-slate-900 dark:text-white">{siteConfig.author.name}</h1>
        <p className="text-indigo-600 dark:text-indigo-400 font-medium">{siteConfig.author.role}</p>
      </motion.div>

      <motion.div variants={itemVariants} className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-800 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Coffee size={120} />
        </div>
        <h2 className="text-2xl font-bold mb-4">关于我</h2>
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
          {siteConfig.author.bio}
        </p>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { icon: <Github size={24} />, label: "Github", link: siteConfig.social.github },
          { icon: <Mail size={24} />, label: "Email", link: siteConfig.social.email }
        ].map((item, i) => (
          <a
            key={i}
            href={item.link}
            target={item.link.startsWith('http') ? "_blank" : undefined}
            rel={item.link.startsWith('http') ? "noopener noreferrer" : undefined}
            className="flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 rounded-xl shadow-sm hover:shadow-md border border-slate-100 dark:border-slate-800 hover:-translate-y-1 transition-all duration-300 group"
          >
            <div className="text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 mb-2 transition-colors">
              {item.icon}
            </div>
            <span className="font-medium text-slate-700 dark:text-slate-300">{item.label}</span>
          </a>
        ))}
      </motion.div>
    </motion.div>
  );
};