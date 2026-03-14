# D-blog

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)
![React](https://img.shields.io/badge/react-19-61dafb.svg)
![Vite](https://img.shields.io/badge/vite-6-646cff.svg)

一个基于 React + Vite 的静态博客项目，支持 Markdown 写作、全文搜索、RSS、Sitemap、预渲染、PWA 离线访问和 Cloudflare Analytics 统计。

[在线预览](https://blog.pldduck.com)

</div>

## 功能特性

### 内容驱动

- 使用 `posts/*.md` 管理文章，Front Matter 自动解析
- 使用 `friends/*.json` 管理友情链接
- 支持分类、标签、置顶、精选、封面图、`updatedAt`、`draft`、`author/authors`
- 构建时自动生成 `generated/posts.json`、`generated/friends.json`、`generated/cloudflare.json`
- `readTime` 根据文章内容自动计算，无需手动填写
- `draft: true` 的文章会在构建时自动过滤

### 阅读体验

- 首页支持分类筛选、排序切换、分页和全文搜索
- 文章页支持面包屑、代码高亮、数学公式、Mermaid 图表、图片预览和代码复制
- 全站提供明显的 RSS 订阅入口，并在页面 head 中声明订阅源
- 图片支持懒加载与模糊占位，深色模式切换带平滑过渡
- 构建时自动生成 RSS 与 Sitemap
- 构建后对文章页和主要静态页执行预渲染，提升 SEO 和首屏速度
- 内置 Service Worker 与 Web App Manifest，支持基础离线访问

### 部署友好

- 输出产物为纯静态文件，可部署到 Cloudflare Pages、Vercel、Netlify、Nginx
- 内置 `functions/api/cloudflare-stats.ts`，可在 Cloudflare Pages Functions 中实时拉取统计数据
- 未配置 Cloudflare 环境变量时，会自动回退到构建产出的静态快照

## 技术栈

| 类别 | 技术 |
| --- | --- |
| 前端框架 | React 19 |
| 构建工具 | Vite 6 |
| 语言 | TypeScript |
| 路由 | React Router DOM 6 |
| 样式 | Tailwind CSS |
| 动效 | Framer Motion |
| Markdown 渲染 | React Markdown + Remark GFM |
| 扩展能力 | Rehype Highlight、KaTeX、Mermaid |
| 数据解析 | Gray Matter |

## 目录结构

```text
D-blog/
|-- config/
|   |-- postcss.config.js
|   |-- site.config.ts
|   |-- tailwind.config.js
|   `-- tsconfig.json
|-- friends/                    # 友情链接 JSON
|-- functions/
|   `-- api/
|       `-- cloudflare-stats.ts # Cloudflare Pages Functions API
|-- generated/                  # 构建脚本生成的数据
|-- posts/                      # Markdown 文章
|-- public/                     # 静态资源与构建时生成的订阅/站点文件
|-- scripts/
|   |-- generate-site-data.mjs  # 生成文章/友链/统计快照/RSS/Sitemap
|   `-- prerender.mjs           # 预渲染文章与关键静态页
|-- src/
|   |-- components/
|   |-- hooks/
|   |-- pages/
|   |-- services/
|   |-- App.tsx
|   |-- index.css
|   |-- index.tsx
|   `-- types.ts
|-- .env.example
|-- index.html
|-- package.json
`-- vite.config.ts
```

## 快速开始

### 环境要求

- Node.js >= 20
- npm >= 10

### 安装依赖

```bash
git clone https://github.com/ououduck/D-blog.git
cd D-blog
npm install
```

### 本地开发

```bash
npm run dev
```

开发命令会先执行一次数据生成脚本，再启动 Vite 开发服务器。默认访问地址为 `http://localhost:5173`。

### 生产构建

```bash
npm run build
```

构建流程如下：

1. 读取 `posts/` 与 `friends/`，生成结构化数据
2. 拉取或生成 Cloudflare 统计快照
3. 生成 RSS 与 Sitemap
4. 执行 `vite build`
5. 对文章页和主要静态页进行预渲染

构建产物位于 `dist/`。

### 预览构建结果

```bash
npm run preview
```

## 可用脚本

```bash
npm run gen:data    # 生成文章/友链/统计快照/RSS/Sitemap
npm run dev         # 生成数据并启动开发环境
npm run build       # 生成数据、打包并预渲染
npm run preview     # 本地预览 dist
```

## 内容管理

### 新建文章

在 [`posts/`](./posts) 下新增 Markdown 文件，例如 `my-first-post.md`：

```yaml
---
id: my-first-post
title: 我的第一篇文章
excerpt: 这里填写文章摘要，会用于列表展示和 SEO 描述
date: 2026-03-14
updatedAt: 2026-03-20
category: 随笔
tags:
  - React
  - Vite
coverImage: /posts-img/example.png
featured: false
top: 1
draft: false
author:
  name: 跑路的duck
  role: 前端菜鸟
---

# 正文标题

这里开始写正文，支持标准 Markdown、GFM 表格、代码块等内容。
```

字段说明：

- `id`：文章唯一标识，对应路由 `/post/:id`
- `title`：文章标题
- `excerpt`：文章摘要
- `date`：发布日期，建议使用 `YYYY-MM-DD`
- `updatedAt`：最后更新时间，可选；存在时会显示在文章页并用于 SEO / RSS / Sitemap
- `category`：分类名称
- `tags`：标签数组
- `coverImage`：封面图路径
- `featured`：是否作为首页精选卡片展示
- `top`：置顶排序，数字越小优先级越高，可选
- `draft`：是否为草稿；`true` 时构建自动过滤
- `author`：单作者写法，支持字符串或对象
- `authors`：多作者写法，支持数组；如果未填写，会回退到 `site.config.ts` 中的默认作者
- `readTime`：无需填写，构建时会根据正文内容自动计算

多作者示例：

```yaml
authors:
  - name: 张三
    role: 编辑
  - name: 李四
    url: https://example.com
```

### Markdown 增强能力

文章页会按内容自动加载对应能力：

- 代码块：启用语法高亮和代码复制按钮
- 数学公式：启用 `remark-math` + `rehype-katex`
- Mermaid：渲染流程图、时序图等
- 图片：支持懒加载、模糊占位和点击放大预览

示例：

````md
```ts
console.log('hello D-blog');
```

$$
E = mc^2
$$

```mermaid
graph TD
  A[Write Markdown] --> B[Generate JSON]
  B --> C[Build]
  C --> D[Prerender]
```
````

### 新建友情链接

在 [`friends/`](./friends) 下新增 JSON 文件：

```json
{
  "name": "示例站点",
  "description": "这里填写站点简介",
  "avatar": "https://example.com/avatar.png",
  "url": "https://example.com"
}
```

所有字段都必须是非空字符串，构建脚本会跳过格式不正确的文件。

### 站点配置

主要配置位于 [`config/site.config.ts`](./config/site.config.ts)，可修改：

- 站点标题、副标题、描述、Logo、SEO 图片
- 默认作者信息
- 社交链接
- 友情链接页说明
- 备案信息

## 数据与构建流程

### 数据生成

[`scripts/generate-site-data.mjs`](./scripts/generate-site-data.mjs) 会完成以下工作：

- 解析 `posts/*.md` Front Matter
- 提取正文纯文本，生成搜索索引字段 `searchText`
- 自动计算 `readTime`
- 归一化 `author` / `authors`
- 过滤 `draft: true` 的文章
- 校验 `friends/*.json`
- 生成 `generated/posts.json` 与 `generated/friends.json`
- 在构建数据阶段生成 RSS 与 Sitemap
- 生成 `generated/cloudflare.json`

### 页面预渲染

[`scripts/prerender.mjs`](./scripts/prerender.mjs) 会基于 `dist/index.html` 生成以下页面的静态入口：

- 所有文章页 `/post/:id`
- `/archive`
- `/tags`
- `/stats`
- `/about`
- `/friends`

### 流程图

```mermaid
graph LR
  A[posts/*.md] --> B[generate-site-data]
  C[friends/*.json] --> B
  B --> D[generated/*.json]
  B --> E[RSS + Sitemap]
  D --> F[vite build]
  F --> G[prerender]
  G --> H[dist/]
```

## Cloudflare 统计配置

统计页依赖两个环境变量：

```bash
CLOUDFLARE_API_TOKEN=your_api_token
CLOUDFLARE_ZONE_ID=your_zone_id
```

相关行为：

- 构建阶段，`generate-site-data.mjs` 会尝试拉取最近 `1 / 7 / 30` 天的统计快照并写入 `generated/cloudflare.json`
- 运行阶段，Cloudflare Pages Functions 中的 [`functions/api/cloudflare-stats.ts`](./functions/api/cloudflare-stats.ts) 可实时返回最新统计
- 缺少环境变量时，统计页展示降级数据或空状态，不影响整体构建

建议为 API Token 至少授予 Cloudflare Analytics 的只读权限。

## 许可证

[MIT](./LICENSE)
