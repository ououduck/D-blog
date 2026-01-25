export const siteConfig = {
  title: "D-blog",
  subtitle: "跑路的duck",
  description: "技术分享和生活随笔",
  footerText: "©2026 D工作室&duck",
  social: {
    github: "https://github.com/ououduck/",
    email: "mailto:dduck@qq.com"
  },
  author: {
    name: "跑路的duck",
    avatar: "http://q1.qlogo.cn/g?b=qq&nk=2472652060&s=100",
    role: "前端菜鸟",
    bio: "你好！我是跑路的duck。感谢你能来光临D-blog。这个博客完全构建在 React 生态之上，旨在探索极致的静态页面体验。"
  },
  beian: {
    text: "湘ICP备2025101669号-3",
    url: "https://beian.miit.gov.cn"
  }
};

export interface PostConfig {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  category: string;
  tags: string[];
  coverImage?: string;
  readTime: string;
  filePath: string; // Path to the .md file
  featured?: boolean; // Set to true for a large card
  top?: number; // Smaller number = higher rank (Pinned)
}

export const postsConfig: PostConfig[] = [
  {
    id: 'about-dblog',
    title: '关于D-blog',
    excerpt: '跑路的duck的胡言乱语',
    date: '2026-01-24',
    category: '随笔',
    tags: ['D-blog', 'D博客', '跑路的duck'],
    readTime: '1分钟阅读',
    coverImage: 'https://cdn.imgos.cn/vip/2026/01/25/69756e9938a02.jpg',
    filePath: '/posts/about-dblog.md',
    featured: true, // 自定义大卡片
    top: 1 // 置顶文章，排名第1
  },
  {
    id: 'cf-tunnel',
    title: '1',
    excerpt: '告别复杂的后端依赖，拥抱 Serverless 和 Edge Computing。一个赛博鸭子的独白。',
    date: '2026-01-25',
    category: '技术',
    tags: ['网络', 'Cloudflare', '内网穿透'],
    readTime: '10分钟阅读',
    coverImage: 'https://cdn.imgos.cn/vip/2026/01/25/6975b7847a444.png',
    filePath: '/posts/ecf-tunnel.md'
  }
];
