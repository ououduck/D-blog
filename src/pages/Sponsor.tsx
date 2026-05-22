import React from 'react';
import { motion } from 'framer-motion';
import { Code2, FileText, TrendingUp } from 'lucide-react';
import { Seo } from '../components/Seo';

/**
 * Represents a single sponsor option displayed on the sponsor page.
 * Each option can be either enabled (with a clickable link) or disabled (with a note).
 */
interface SponsorOption {
  /** Unique identifier for the sponsor option */
  id: string;
  /** Lucide React icon component to display */
  icon: React.ElementType;
  /** Display title of the sponsor option */
  title: string;
  /** Brief description of what this sponsor option entails */
  description: string;
  /** Text to display on the action button */
  buttonText: string;
  /** Optional URL to navigate to when button is clicked (required when disabled is false) */
  buttonLink?: string;
  /** Whether this sponsor option is currently disabled */
  disabled: boolean;
  /** Optional note to display when the option is disabled */
  disabledNote?: string;
}

/**
 * Props for the Sponsor page component.
 * Currently empty as the component doesn't accept any props.
 */
interface SponsorPageProps {}

/**
 * Sponsor Page Component
 * 
 * Displays three non-monetary sponsorship options for D-blog:
 * 1. Code sponsorship - Contributing code improvements via GitHub
 * 2. Article sponsorship - Providing quality articles via GitHub
 * 3. Ad sponsorship - Supporting through ad views (currently disabled)
 * 
 * Features:
 * - Responsive grid layout (1 column mobile, 3 columns desktop)
 * - Smooth entrance and hover animations using Framer Motion
 * - Full dark mode support
 * - Accessible with proper ARIA attributes
 * - SEO optimized with meta tags
 * - External links open in new tabs with security attributes
 * 
 * @returns The rendered sponsor page with three sponsor option cards
 */
export const Sponsor: React.FC<SponsorPageProps> = () => {
  /**
   * Array of sponsor options to display on the page.
   * 
   * - First two options (code and article) are enabled and link to GitHub
   * - Third option (ads) is disabled as ad integration is not yet implemented
   */
  const sponsorOptions: SponsorOption[] = [
    {
      id: 'code',
      icon: Code2,
      title: '赞助代码',
      description: '帮助我们改进 D-blog',
      buttonText: '前往 GitHub',
      buttonLink: 'https://github.com/ououduck/D-blog',
      disabled: false
    },
    {
      id: 'article',
      icon: FileText,
      title: '赞助文章',
      description: '为我们提供优质文章',
      buttonText: '前往 GitHub',
      buttonLink: 'https://github.com/ououduck/D-blog',
      disabled: false
    },
    {
      id: 'ads',
      icon: TrendingUp,
      title: '广告赞助',
      description: '通过光临我们的广告赞助商对我们进行间接赞助',
      buttonText: '看看下方广告吧',
      disabled: false,
      disabledNote: '广告赞助已经关闭'
    }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="mx-auto max-w-4xl py-12 md:py-20"
    >
      {/* SEO metadata for the sponsor page */}
      <Seo title="赞助支持" description="支持 D-blog 的多种方式：通过贡献代码、撰写文章或浏览广告来帮助博客持续成长。" />

      {/* Header Section */}
      <div className="mb-12 text-center">
        <h1 className="mb-6 font-serif text-4xl font-bold text-zinc-900 dark:text-zinc-100 md:text-5xl">
          不要Money的赞助
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          支持 D-blog 的多种方式
        </p>
      </div>

      {/* Sponsor Cards Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        {sponsorOptions.map((option) => {
          const Icon = option.icon;
          
          return (
            <motion.div
              key={option.id}
              // Hover animation only for enabled cards
              whileHover={!option.disabled ? { y: -6, scale: 1.01 } : undefined}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
            >
              {/* Icon container */}
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
                <Icon className="text-zinc-700 dark:text-zinc-300" size={24} />
              </div>
              
              {/* Card title */}
              <h2 className="mb-2 font-serif text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {option.title}
              </h2>
              
              {/* Card description */}
              <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                {option.description}
              </p>
              
              {/* Conditional rendering: disabled button or active link */}
              {option.disabled ? (
                <>
                  {/* Disabled button with no click handler */}
                  <button
                    disabled
                    className="w-full cursor-not-allowed rounded-lg border border-zinc-200 bg-zinc-100 px-4 py-2.5 text-sm font-semibold text-zinc-400 dark:border-zinc-800 dark:bg-zinc-800 dark:text-zinc-500"
                    aria-disabled="true"
                  >
                    {option.buttonText}
                  </button>
                  {/* Display disabled note if provided */}
                  {option.disabledNote && (
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                      {option.disabledNote}
                    </p>
                  )}
                </>
              ) : (
                // Active link that opens in new tab with security attributes
                <a
                  href={option.buttonLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full rounded-lg bg-zinc-900 px-4 py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
                >
                  {option.buttonText}
                </a>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Sponsor Ads */}
      <div className="mt-12 flex flex-col items-center gap-6">
        <a
          href="https://curl.qcloud.com/fBu6YgLR"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="/ads-img/tencent-cloud.png"
            alt="腾讯云广告"
            className="h-auto w-full max-w-2xl"
          />
        </a>
        <a
          href="https://1sdun.cn"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img
            src="/ads-img/fynxscdn.jpg"
            alt="1sudun 广告"
            className="h-auto w-full max-w-2xl"
          />
        </a>
      </div>
    </motion.div>
  );
};
