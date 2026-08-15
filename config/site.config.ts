/**
 * 站点配置。
 *
 * 数据源为同目录下的 site.config.json —— 可在 PagesCMS「站点配置」中直接编辑，
 * 保存即推送仓库生效，无需改动代码。本文件仅负责加载 JSON 并提供类型约束：
 * JSON 缺字段/类型不符会在 `npm run typecheck` 时直接报错（fail-fast）。
 *
 * 构建脚本侧（sitemap / RSS / SSG / SEO 审计）通过 scripts/site-config-loader.mjs
 * 读取同一份 JSON，保证客户端与构建期配置一致。
 */
import siteConfigJson from './site.config.json';

export interface SiteAuthor {
  name: string;
  avatar: string;
  role: string;
  bio: string;
}

export interface SiteSocial {
  github: string;
  email: string;
  rawEmail: string;
}

export interface SiteToc {
  collapseInactiveRootBranches?: boolean;
}

export interface SiteComments {
  repo: string;
  repoId: string;
  category: string;
  categoryId: string;
  /**
   * giscus 脚本/iframe 来源，默认 https://giscus.app。
   * 大陆网络访问 giscus.app 不稳定时，可改为自托管 giscus 实例或可达的镜像地址
   * （脚本注入、iframe 主题同步、消息源校验三处均使用该地址）。
   */
  origin?: string;
  /**
   * 严格匹配（data-strict）：true 时按「正文 SHA-1 哈希」搜索 Discussion（新讨论由
   * giscus 自动附带哈希标记）；false 时按「标题」搜索并允许评论时自动创建讨论。
   * 注意：历史已存在的 Discussion 正文没有哈希标记时，严格匹配会搜不到（评论不显示），
   * 因此本仓库关闭严格匹配（现有讨论按标题 pathname 直接命中）。
   */
  strict?: boolean;
}

export interface SiteGuestbook {
  discussionId: number;
}

export interface SiteFriendsPage {
  repoUrl: string;
  repoFriendsUrl: string;
  repoFriendsDir: string;
}

export interface SiteBeian {
  text: string;
  url: string;
}

export interface SiteConfig {
  title: string;
  subtitle: string;
  /** 站点头条：首页 <title> 与 og:title 使用（含关键词，利于首页排名）。 */
  seoHomeTitle?: string;
  /** 首页 SEO 描述：仅用于 meta description / og:description / twitter:description 与站点级 schema，
      不改变页面可见文案（首页 Hero 与页脚可见文案仍使用 description）。 */
  seoHomeDescription?: string;
  description: string;
  logo: string;
  logoSmall: string;
  /** 社交分享卡片（1200×630，1.91:1），构建期生成于 public/og-card.png。 */
  seoImage: string;
  footerText: string;
  url: string;
  social: SiteSocial;
  author: SiteAuthor;
  toc?: SiteToc;
  /** 是否启用 Giscus（文章评论区 + 留言板统一开关）。 */
  giscusEnabled?: boolean;
  comments: SiteComments;
  guestbook: SiteGuestbook;
  friendsPage: SiteFriendsPage;
  beian: SiteBeian;
}

export const siteConfig: SiteConfig = siteConfigJson;
