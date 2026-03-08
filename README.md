# D-blog

一个基于 React + Vite 构建的静态博客项目，内容以 Markdown 管理，支持友情链接、RSS、站点地图、页面预渲染和响应式阅读体验。

在线地址：<https://blog.pldduck.com>

## 项目特点

- Markdown 驱动内容管理，文章直接存放在 `posts/` 目录。
- 构建期自动生成文章与友链数据，无需数据库。
- 基于 `react-router-dom` 的单页应用，同时输出预渲染页面，兼顾开发体验与 SEO。
- 自动生成 `sitemap.xml` 和 `feed.xml`。
- 支持文章搜索、分类筛选、置顶、精选展示。
- 友情链接采用 JSON 文件管理，适合通过 PR 协作维护。
- 适合部署到 Cloudflare Pages、Vercel、Netlify、Nginx 等静态托管环境。

## 技术栈

- React 19
- Vite 6
- TypeScript
- Tailwind CSS
- Framer Motion
- React Router
- React Markdown + Remark GFM + Rehype Highlight
- Gray Matter

## 目录结构

```text
D-blog/
├─ config/                 # 站点配置、Tailwind、TS 配置
├─ friends/                # 友情链接数据（JSON）
├─ posts/                  # 博客文章（Markdown）
├─ public/                 # 静态资源
├─ scripts/                # 构建期脚本
├─ src/                    # 前端源码
├─ generated/              # 构建生成的数据文件（自动生成）
├─ index.html
├─ package.json
└─ vite.config.ts
```

## 快速开始

### 环境要求

- Node.js 20+
- npm 10+

### 安装依赖

```bash
npm install
```

### 本地开发

```bash
npm run dev
```

启动后会先执行数据生成脚本，再进入 Vite 开发模式。

### 生产构建

```bash
npm run build
```

该命令会依次执行：

```text
生成站点数据 -> Vite 打包 -> 预渲染静态页面
```

构建完成后：

- `dist/` 为可部署产物
- `generated/posts.json` 为文章索引
- `generated/friends.json` 为友链索引
- `public/sitemap.xml` 为站点地图
- `public/feed.xml` 为 RSS 订阅源

### 本地预览

```bash
npm run preview
```

## 内容管理

### 新增文章

在 `posts/` 目录下新增 `.md` 文件，推荐使用以下 Front Matter：

```yaml
---
id: my-first-post
title: 文章标题
excerpt: 文章摘要
date: 2026-03-08
category: 随笔
tags:
  - React
  - Vite
readTime: 5分钟阅读
coverImage: /posts-img/example.png
featured: false
top: 1
---
```

字段说明：

- `id`：文章唯一标识，对应路由 `/post/:id`
- `title`：文章标题
- `excerpt`：列表摘要和 SEO 描述
- `date`：发布日期，推荐 `YYYY-MM-DD`
- `category`：分类名称
- `tags`：标签数组
- `readTime`：阅读时长说明
- `coverImage`：封面图路径
- `featured`：是否以精选样式展示
- `top`：置顶优先级，数值越小优先级越高；不需要时可省略

### 新增友情链接

在 `friends/` 目录下新增一个 `.json` 文件，格式如下：

```json
{
  "name": "站点名称",
  "description": "站点简介",
  "avatar": "https://example.com/avatar.png",
  "url": "https://example.com"
}
```

必填字段：

- `name`
- `description`
- `avatar`
- `url`

构建脚本会自动跳过字段缺失或 JSON 非法的友链文件。

## 站点配置

主要配置位于 [config/site.config.ts](/d:/program/website/D-blog/config/site.config.ts)：

- 站点标题、副标题、描述
- 站点地址
- 作者信息
- 社交链接
- 友情链接页说明
- 页脚与备案信息

如果你要二次开发自己的博客，优先修改这个文件。

## 构建流程

项目的核心构建流程如下：

```text
posts/*.md + friends/*.json
  -> scripts/generate-site-data.mjs
  -> generated/*.json + sitemap.xml + feed.xml
  -> vite build
  -> scripts/prerender.mjs
  -> dist/
```

说明：

- `scripts/generate-site-data.mjs` 负责解析 Markdown Front Matter、校验友链数据、生成文章索引、RSS 和 Sitemap。
- `scripts/prerender.mjs` 会为文章页、关于页、友链页输出预渲染 HTML，提升静态托管场景下的首屏和 SEO 表现。

## 部署说明

这是一个纯前端静态项目，构建产物为 `dist/`，可直接部署到任意静态托管平台。

常见方式：

- Cloudflare Pages：构建命令 `npm run build`，输出目录 `dist`
- Vercel：Framework Preset 选择 `Vite`
- Netlify：Build command `npm run build`，Publish directory `dist`
- Nginx：将 `dist/` 目录内容发布到站点根目录

如果使用单页应用回退规则，建议将所有未知路由回退到 `index.html`；如果直接使用预渲染输出，也可以按静态页面路径访问。

## 开源协作建议

- 提交前先执行 `npm run build`
- 新增文章时保证 Front Matter 完整
- 新增友链时保证 JSON 可解析且字段完整
- PR 尽量聚焦单一主题，方便审查和回滚

## 已验证命令

以下命令已在当前仓库执行通过：

```bash
npm install
npm run build
```

## License

当前仓库尚未添加 `LICENSE` 文件。若准备正式开源，建议尽快补充许可证后再长期对外传播。
