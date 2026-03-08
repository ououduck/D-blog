# D-blog

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)

一个基于 React + Vite 构建的静态博客项目，内容以 Markdown 管理，支持友情链接、RSS、站点地图、页面预渲染和响应式阅读体验。

**在线预览：** <https://blog.pldduck.com>

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

## 贡献指南

欢迎提交 Issue 和 Pull Request！

### 提交文章

1. Fork 本仓库
2. 在 `posts/` 目录下新增 Markdown 文件
3. 确保 Front Matter 字段完整
4. 本地执行 `npm run build` 验证构建通过
5. 提交 PR

### 申请友链

1. Fork 本仓库
2. 在 `friends/` 目录下新增 JSON 文件（文件名建议使用站点域名或英文名称）
3. 确保包含所有必填字段：`name`、`description`、`avatar`、`url`
4. 提交 PR，标题格式：`feat: 添加友链 - [站点名称]`

### 代码贡献

- 提交前先执行 `npm run build` 确保构建通过
- PR 尽量聚焦单一主题，方便审查和回滚
- 遵循项目现有的代码风格和目录结构

## License

本项目采用 [MIT License](LICENSE) 开源协议。

## Clarity 统计页

- 统计页路由：`/stats`
- 数据来源：Microsoft Clarity Export API
- 安全策略：仅在构建阶段读取 `CLARITY_API_TOKEN`，前端只消费生成后的 `generated/clarity.json`
- 本地变量模板见 `.env.example`

### Cloudflare Pages 配置

Cloudflare Pages 可直接使用当前静态站点方案，无需额外后端：

1. 构建命令：`npm run build`
2. 输出目录：`dist`
3. Node 版本：仓库已提供 `.nvmrc`
4. 在 Pages 项目的环境变量中配置：
   - `CLARITY_API_TOKEN`
   - `CLARITY_EXPORT_DAYS`
   - `CLARITY_DIMENSION_1`
   - `CLARITY_DIMENSION_2`
   - `CLARITY_DIMENSION_3`

### 变量示例

```env
CLARITY_API_TOKEN=eyJhbGciOi...
CLARITY_EXPORT_DAYS=1
CLARITY_DIMENSION_1=URL
CLARITY_DIMENSION_2=Browser
CLARITY_DIMENSION_3=Device
```

说明：

- `CLARITY_API_TOKEN`：Clarity 项目管理员在项目设置中生成的 Bearer Token
- `CLARITY_EXPORT_DAYS`：导出最近 1、2、3 天的数据，官方仅支持这三个值
- `CLARITY_DIMENSION_1~3`：最多传三个维度，推荐先用 `URL`、`Browser`、`Device`

### 如何获取

#### 获取 `CLARITY_API_TOKEN`

根据 Microsoft Clarity Export API 官方文档：

1. 进入你的 Clarity 项目
2. 打开 `Settings`
3. 进入 `Data Export`
4. 点击 `Generate new API token`
5. 输入一个 token 名称
6. 生成后立即复制并保存到 Cloudflare Pages 环境变量 `CLARITY_API_TOKEN`

注意：

- 只有项目管理员可以管理和生成 token
- token 只会在生成时完整显示一次，不要写入前端代码
- 本项目只在构建阶段读取该变量，不会下发到浏览器

#### 选择 `CLARITY_DIMENSION_1~3`

根据官方文档，Export API 当前可用维度包括：

- `Browser`
- `Device`
- `Country/Region`
- `OS`
- `Source`
- `Medium`
- `Campaign`
- `Channel`
- `URL`

推荐的起步组合：

```env
CLARITY_DIMENSION_1=URL
CLARITY_DIMENSION_2=Browser
CLARITY_DIMENSION_3=Device
```

这个组合更适合博客场景，能直接看页面、浏览器和设备分布。

构建流程如下：

```text
Cloudflare Pages Build
  -> npm run build
  -> scripts/generate-site-data.mjs
  -> Clarity Export API
  -> generated/clarity.json
  -> vite build + prerender
  -> dist/
```
