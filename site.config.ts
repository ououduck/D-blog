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
    id: 'escape-plan',
    title: '跑路的 Duck：我的逃跑计划',
    excerpt: '告别复杂的后端依赖，拥抱 Serverless 和 Edge Computing。一个赛博鸭子的独白。',
    date: '2023-11-15',
    category: '随笔',
    tags: ['生活', 'Cloudflare', 'Duck'],
    readTime: '2 分钟阅读',
    coverImage: 'https://picsum.photos/seed/duck/800/400',
    filePath: '/posts/escape.md'
  },
  {
    id: 'future-web',
    title: 'Web 3.0 与去中心化存储',
    excerpt: '虽然是个热词，但其中的技术原理值得探究。IPFS 在前端部署中的应用前景。',
    date: '2023-12-01',
    category: '技术',
    tags: ['Web3', '区块链'],
    readTime: '7 分钟阅读',
    filePath: '/posts/web3.md'
  },
  {
    id: 'react-server-components',
    title: 'RSC: 前端的又一次革命？',
    excerpt: 'React Server Components 到底解决了什么问题？它是 Next.js 的专属吗？',
    date: '2023-12-10',
    category: '技术',
    tags: ['React', 'RSC'],
    readTime: '6 分钟阅读',
    filePath: '/posts/rsc.md'
  }
];