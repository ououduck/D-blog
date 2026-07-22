import { siteConfig } from '../../config/site.config';

/**
 * 赞助选项接口
 */
export interface SponsorOption {
  id: 'code' | 'article' | 'ad';
  title: string;
  description: string;
  icon: string; // lucide-react icon name
  buttonLabel: string;
  url: string;
  disabled?: boolean;
  comingSoon?: boolean;
}

/**
 * 赞助选项配置数组
 * 包含三种赞助方式：代码赞助、文章赞助、广告赞助
 */
export const sponsorOptions: SponsorOption[] = [
  {
    id: 'code',
    title: '赞助代码',
    description: '帮助我们改进 D-blog',
    icon: 'Code',
    buttonLabel: '前往 GitHub',
    url: siteConfig.social.github
  },
  {
    id: 'article',
    title: '赞助文章',
    description: '为我们提供优质文章',
    icon: 'FileText',
    buttonLabel: '前往 GitHub',
    url: siteConfig.social.github
  },
  {
    id: 'ad',
    title: '广告赞助',
    description: '通过查看和点击广告为我们带来收益',
    icon: 'Megaphone',
    buttonLabel: '敬请期待',
    url: '', // 暂未开放，无需 URL
    disabled: true,
    comingSoon: true
  }
];
