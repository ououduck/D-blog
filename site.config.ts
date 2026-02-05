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
  friends: [
    {
      name: "React 官网",
      description: "构建 Web 和原生交互界面的库",
      avatar: "https://react.dev/favicon.ico",
      url: "https://react.dev/"
    },
    {
      name: "Vite",
      description: "下一代前端开发与构建工具",
      avatar: "https://vitejs.dev/logo.svg",
      url: "https://vitejs.dev/"
    }
  ],
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
    coverImage: 'https://aliyun-oss.pldduck.com/logo.png',
    filePath: '/posts/about-dblog.md',
    featured: true, // 自定义大卡片
    top: 1 // 置顶文章，排名第1
  },
  {
    id: 'cf-tunnel',
    title: 'Cloudflare Tunnel内网穿透',
    excerpt: '教你使用Cloudflare Tunnel轻松实现内网穿透',
    date: '2026-01-25',
    category: '技术',
    tags: ['网络', 'Cloudflare', '内网穿透'],
    readTime: '10分钟阅读',
    coverImage: 'https://aliyun-oss.pldduck.com/D-blog/cloudflare.png',
    filePath: '/posts/cf-tunnel.md'
  },
  {
    id: 'Ddomain',
    title: 'Ddomain二级域名',
    excerpt: '精品实惠二级域名',
    date: '2026-02-03',
    category: '技术',
    tags: ['Ddomain', '二级域名', '备案域名'],
    readTime: '1分钟阅读',
    coverImage: 'https://aliyun-oss.pldduck.com/D-blog/6981b42b3aa28.jpg',
    filePath: '/posts/Ddomain.md'
  },
  {
    id: 'weixin-vs-yuanbao',
    title: '元宝被微信封了？',
    excerpt: '腾讯内斗还是别有用心？',
    date: '2026-02-04',
    category: '随笔',
    tags: ['腾讯元宝', '腾讯',],
    readTime: '3分钟阅读',
    coverImage: 'https://aliyun-oss.pldduck.com/D-blog/weixinvsyuanbao.png',
    filePath: '/posts/weixin-vs-yuanbao.md'
  }
];