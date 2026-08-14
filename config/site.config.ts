export const siteConfig = {
  title: 'D-blog',
  subtitle: '跑路的duck',
  // 站点头条：首页 <title> 与 og:title 使用（含关键词，利于首页排名），
  // 其他页面统一为「页面名 - D-blog」格式。
  seoHomeTitle: 'D-blog - 跑路的duck的技术分享与生活随笔',
  description: '跑路的duck的技术分享与生活随笔 追求极致的静态页面体验。',
  logo: 'https://blog.pldduck.com/logo.png',
  logoSmall: '/logo-96.png',
  // 社交分享卡片（1200×630，1.91:1），由 scripts/generate-og-card.mjs 在构建期生成。
  seoImage: 'https://blog.pldduck.com/og-card.png',
  footerText: '©2026 PLDDUCK',
  url: 'https://blog.pldduck.com',
  social: {
    github: 'https://github.com/ououduck/',
    email: 'mailto:i@pldduck.com',
    rawEmail: 'i@pldduck.com',
  },
  author: {
    name: '跑路的duck',
    avatar: 'https://q1.qlogo.cn/g?b=qq&nk=2472652060&s=100',
    role: '前端菜鸟',
    bio: '你好！我是跑路的duck，感谢你能来光临 D-blog。这个博客完全构建于 React 生态之上，旨在探索极致的静态页面体验。',
  },
  toc: {
    collapseInactiveRootBranches: true,
  },
  // 是否启用 Giscus（文章评论区 + 留言板统一开关）。
  // 设为 false 时：文章页不再渲染评论区，/guestbook 留言板不再渲染评论区块。
  giscusEnabled: true,
  comments: {
    repo: 'ououduck/D-blog',
    repoId: 'R_kgDORApwuA',
    category: '文章评论',
    categoryId: 'DIC_kwDORApwuM4DCztq',
  },
  guestbook: {
    // 留言板固定 Discussion（Giscus mapping=specific 指向它），
    // 位于「留言板」分类：https://github.com/ououduck/D-blog/discussions/9
    discussionId: 9,
  },
  friendsPage: {
    repoUrl: 'https://github.com/ououduck/D-blog',
    repoFriendsUrl: 'https://github.com/ououduck/D-blog/tree/main/friends',
    repoFriendsDir: 'friends',
  },
  beian: {
    text: '湘ICP备2025101669号',
    url: 'https://beian.miit.gov.cn',
  },
};
