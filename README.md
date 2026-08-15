# D-blog

<div align="center">

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen.svg)
![React](https://img.shields.io/badge/react-19-61dafb.svg)
![Vite](https://img.shields.io/badge/vite-6-646cff.svg)
![CI](https://github.com/ououduck/D-blog/actions/workflows/ci.yml/badge.svg)

基于 React 19 + Vite 6 + TypeScript 的静态博客：构建期生成站点数据与全站静态 HTML（SSG），客户端以 SPA 水合运行。

**在线演示**：<https://blog.pldduck.com>

</div>

## 目录

- [核心特性](#核心特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [内容管理](#内容管理)
- [构建与质量](#构建与质量)
- [配置](#配置)
- [部署](#部署)
- [自动化与通知](#自动化与通知)
- [贡献指南](#贡献指南)
- [许可证](#许可证)

## 核心特性

- **Markdown 驱动**：Front Matter 元数据校验、多作者、分类白名单、草稿过滤均在构建时完成
- **增强渲染**：代码高亮（diff 行高亮、文件名、折叠、行号复制、换行开关）、KaTeX 公式、Mermaid 图表（缩放/平移）、GFM 表格、图片预览，全部按需懒加载
- **全文搜索**：构建时生成索引，多维权重评分，支持范围筛选与搜索历史；首页/弹窗/独立页 `/search` 共用同一套评分
- **阅读体验**：目录导航、阅读进度恢复、专注阅读模式、深色模式图片柔和降亮、标题锚点复制链接、上一篇/下一篇（`Alt + ←/→`）与系列文章
- **分享与互动**：分享弹窗与竖版分享海报（Canvas 本地绘制）；Giscus 评论区（文章卡片评论数为构建期快照）；独立留言板 `/guestbook`；说说 `/shuoshuo` 独立静态页
- **内置工具箱**：封面生成器 `/cover`（含批量 ZIP 导出）、水印工具 `/watermark`（图片不离开浏览器）
- **主题系统**：浅色/深色/跟随系统，CSS View Transitions 过渡
- **构建期 SSG**：每页独立 HTML + 精准 SEO meta 与 JSON-LD，爬虫可直接读取正文
- **PWA**：Service Worker 缓存 + 收藏文章 IndexedDB 离线阅读
- **SEO 与订阅**：OG/Twitter Card、JSON-LD、RSS、`llms.txt`、Sitemap、`robots.txt`
- **质量保障**：`typecheck` 全量类型检查、`gen:data` 元数据校验、构建与 SEO 双审计

## 技术栈

| 领域 | 选型 |
| --- | --- |
| 前端框架 | React 19 + React Router 6 |
| 构建工具 | Vite 6（客户端 + SSR 双构建） |
| 样式 | Tailwind CSS + PostCSS |
| 动画 | Framer Motion + CSS View Transitions API |
| Markdown | react-markdown + remark-gfm/math + rehype-highlight/katex |
| 安全 | DOMPurify |
| 其他 | Mermaid、KaTeX、highlight.js、Lucide、gray-matter、sharp、dotenv |

## 快速开始

```bash
git clone https://github.com/ououduck/D-blog.git
cd D-blog
npm install
cp .env.example .env          # 可选：覆盖站点 URL 与子路径（Windows 用 copy .env.example .env）
npm run check                 # 数据生成校验 + 类型检查
npm run dev                   # 本地开发（http://localhost:3000）
npm run test                  # 单元测试
npm run build                 # 生产构建（SSG 全量静态化）
npm run preview               # 预览构建产物
```

Node.js >= 20，npm >= 10。

## 项目结构

```text
D-blog/
├── config/                  # 站点/内容/广告配置（site.config.json、content.config.json、ads.config.ts）、tsconfig、tailwind、postcss
├── posts/                   # Markdown 文章
├── friends/                 # 友链数据（JSON，PagesCMS 直接读写）
├── shuoshuo/                # 说说（短动态）Markdown 内容
├── .pages.yml               # PagesCMS 配置
├── generated/               # 构建产物：posts.json / posts-search.json / site-stats.json 等
├── public/                  # favicon、PWA 图标、sw.js、offline.html，以及构建生成的 feed/sitemap
├── scripts/                 # 构建/自动化脚本（lib/ 为共享 HTTP 与日志库）
├── functions/               # Pages 边缘函数（img-proxy 同源图片代理）
├── .github/workflows/       # 部署、友链审核、评论检查、更新通知
└── src/
    ├── components/          # Layout、Seo、TableOfContents、SearchModal、ImageViewer 等（effects/、ui/ 为动效与基础组件）
    ├── pages/               # 页面组件（懒加载）；cover/、watermark/、archive/、friends/ 为模块集
    ├── config/              # 封面生成器配置：coverTemplates / coverPresets
    ├── services/            # posts / friends / shuoshuo / offlinePosts / readingHistory 等
    ├── hooks/               # useMediaQuery / useModalOverlay / usePostSearch / useOfflinePosts 等
    ├── utils/               # 日期、排序、目录树、站点 URL、动画、标题解析等
    ├── ssr/routeData.tsx    # SSG 路由数据构造与客户端读取
    ├── App.tsx              # 路由 + 错误边界
    └── index.tsx            # 渲染入口（水合 / 客户端渲染）
```

## 内容管理

内容通过 [PagesCMS](https://pagescms.org/) 管理——基于 Git 的无后端 CMS，直接读写本仓库的 Markdown 文件。

### 新建文章

在 PagesCMS「文章」集合中点击新建，填写 frontmatter：

```yaml
---
id: my-first-post             # 对应 /post/:id，全站唯一，不可含空白/斜杠
title: 我的第一篇文章
excerpt: 文章摘要，用于列表展示和 SEO（必填）
date: 2026-03-14
updatedAt: 2026-03-20         # 可选
category: 技术                 # 必须在 content.config.json 白名单内
tags: [React, Vite]
coverImage: https://cdn.example.com/cover.png  # 可选，图床链接
author: 跑路的duck             # 可选，支持对象形式
featured: false               # 首页精选展示
featured-top: 1              # 精选置顶排序（仅 featured: true 时生效）
series: false                # 是否属于文章系列（series-name / series-order 配套）
draft: false                  # 草稿不会发布
---
```

封面与正文图片均通过图床（PicGo）托管。批量迁移本地图片可运行 `npm run migrate:images`（支持 `--dry-run`）。

### Markdown 增强

````md
```ts title="utils/format.ts"   # 文件名：显示在工具栏，下载时也以此命名
export const format = (value: string) => value.trim();
```

```diff
- const oldValue = 1;          # diff：+ / - / @@ 行自动整行高亮
+ const newValue = 2;
```

![终端截图](https://cdn.example.com/terminal.png "no-dark")  # 深色模式图片豁免
````

正文图片在深色模式下自动柔和降亮（悬停恢复），`"no-dark"` 可单图豁免。长代码块默认折叠为 30 行，可展开；工具栏提供「自动换行」开关，点击行号复制该行。

### 友链申请

在友链页面展开「申请友链」，按步骤完成 GitHub Issue 申请：先添加本站友链 → 登录 GitHub → 填写资料 → 提交 Issue → Actions 自动校验反链后写入 `friends/`。友链数据为 `friends/*.json`，可直接在 PagesCMS「友链」集合编辑。可手动运行「检查友链可用状态」：失联友链写入 `"unavailable": true` 并归入页面的「已失联的博客」折叠板块，恢复后自动回到主列表。

### 说说

`/shuoshuo` 是类似朋友圈的短动态页。内容存放在 `shuoshuo/*.md`，用 Markdown 书写（无需标题），可选 `images` frontmatter 字段（图片链接数组）以九宫格展示配图：

```yaml
---
id: my-first-shuoshuo        # 全站唯一
date: 2026-08-14
images:
  - https://cdn.example.com/photo-1.png
---
今天也是元气满满的一天 🎉
```

每条说说生成独立静态页 `/shuoshuo/<id>`，完整 SSR 正文与 SEO 标签，收录进 `sitemap-shuoshuo.xml` 与 `llms.txt`；旧的 `?id=` 定位链接仍兼容。在 PagesCMS「说说」集合中新建即可，无需写代码。

### 留言板

`/guestbook` 通过 Giscus `mapping=number` 固定指向仓库的「D-blog 留言板」Discussion（`config/site.config.ts` 的 `guestbook.discussionId`）。与文章评论共用 Akismet 反垃圾，并叠加自建关键词过滤（`config/comment-keywords.json`，可直接在 PagesCMS「评论关键词」中编辑）。

### 文章更新订阅

在文章页/关于页可订阅 GitHub Issue（`src/components/IssueSubscriptionCard.tsx`），新文章发布时 `.github/workflows/notify-post-update.yml` 自动在指定 Issue 发布更新通知。

### Giscus 评论与大陆网络可达性

giscus.app 在大陆网络被 DNS 污染/阻断（本地解析被替换为 198.18.x.x 等假地址，真实 IP 也不可达），直连官方地址会导致评论区「加载很久后显示加载失败」。因此评论走 **站点同源代理**：

- `config/site.config.json` 的 `comments.origin` 默认为 `"/giscus"`（同源相对路径）；
- 生产环境由 `functions/_middleware.ts`（Cloudflare Pages）与根目录 `middleware.ts`（EdgeOne Pages）把 giscus 的 client.js、widget 页面、`/_next` 静态资源、主题 CSS 与相对 API 全部经站点同源路径转发到 `https://giscus.app`；两条中间件逻辑一致，改动需同步；
- 前端 `src/components/GiscusComments.tsx` 按「同源代理 → 官方 giscus.app」顺序回退加载：同源代理不可用（如本地开发未起代理、函数未部署）时自动回退官方地址；
- 本地开发：`vite.config.ts` 内置 `dev-giscus-proxy` 中间件，行为与生产边缘函数一致，`npm run dev` 下评论即走同源代理。

限制说明：GitHub OAuth 登录回调固定指向 `giscus.app`，经同源代理访问时，海外网络可正常登录评论；大陆网络下 giscus.app 不可达，登录无法完成（读评论、看讨论不受影响）。如需大陆网络完整登录，需自托管 giscus 实例并将 `comments.origin` 指向自托管地址。

## 构建与质量

`npm run build` 依次执行：数据生成 → OG 卡生成 → 客户端构建 → SSR 构建 → 模板快照 → SSG 预渲染 → 产物审计 → SEO 审计，最终输出 `dist/`。各阶段独立超时并汇总耗时，任一阶段失败立即终止流水线并在日志中标明失败阶段（[N/M] 前缀）。

- **数据生成**（`gen:data`）：校验 Front Matter、文章 ID、图片与链接，生成 `generated/` 索引、Sitemap、RSS、`llms.txt`、`robots.txt`
- **SSG 预渲染**（`ssg`）：用 SSR bundle 按路由渲染全站静态 HTML，注入 SEO meta / JSON-LD 与封面 preload

`generated/`、RSS 与 Sitemap 均为构建产物，不应手工编辑。

| 命令 | 功能 |
| --- | --- |
| `npm run dev` | 启动开发服务器（端口 3000），自动执行 `gen:data` |
| `npm run build` / `build:verbose` | 生产构建 / 详细模式（保留 Vite 完整输出） |
| `npm run build:ssr` | 仅构建 SSR bundle（`dist-ssr/`） |
| `npm run preview` | 预览生产构建结果 |
| `npm run migrate:images` | 批量迁移本地图片至图床（支持 `--dry-run`） |
| `npm run gen:data` | 数据生成 + 全量校验 |
| `npm run ssg` | 仅执行 SSG 预渲染（需先完成两端构建） |
| `npm run audit:build` / `audit:seo` | 构建产物完整性 / 全站 SEO 清单审计（均已接入 build） |
| `npm run typecheck` / `check` | 类型检查 / 数据生成校验 + 类型检查 |
| `npm run test` / `test:watch` / `test:coverage` | vitest 单元测试 / 监听 / 覆盖率（均先执行 `gen:data`） |
| `npm run lint` / `lint:fix` | ESLint 检查 / 自动修复 |
| `npm run format` / `format:check` | Prettier 格式化 / 格式检查 |

## 配置

- **站点配置**：`config/site.config.json` — 标题、描述、URL、社交链接、作者信息、备案号等，可在 PagesCMS「站点配置」中编辑
- **赞助与广告**：赞助方式定义于 `src/pages/Sponsor.tsx`；广告横幅在 `config/ads.config.ts` 配置
- **文章分类白名单**：`config/content.config.json` 的 `postCategories` 数组
- **环境变量**：`VITE_SITE_URL`（站点公开访问地址）、`VITE_BASE_PATH`（子路径部署时使用，留空为根路径），见 `.env.example`

## 部署

采用 **GitHub Actions 构建 + 双平台直传**：构建在 GitHub 完成（公开仓库 Actions 免费额度），产物直传 Cloudflare Pages 与 EdgeOne Pages。日常 push 不触发部署，仅手动触发。

### 触发方式

1. **Pages CMS**：侧边栏「🚀 部署到 Cloudflare & EdgeOne」按钮（配置见 `.pages.yml`）
2. **GitHub Actions**：手动 Run workflow（`deploy.yml`，payload 最小可用 `{"repository":{"ref":"main"}}`）

### 一次性前置配置

| 项 | 说明 |
| --- | --- |
| Cloudflare Pages | 项目类型 **Direct Upload**（直传），自定义域名与缓存策略（`public/_headers`）已就位 |
| EdgeOne Pages | 项目类型 **直传**，域名 CNAME 已切换，缓存规则需在控制台手动配置 |
| 仓库 Secrets | `CLOUDFLARE_API_TOKEN`（Pages:Edit 权限）、`CLOUDFLARE_ACCOUNT_ID`、`EDGEONE_API_TOKEN` |

两个平台的项目名均为 `d-blog`（已在 `deploy.yml` 配置，不一致时修改 `--project-name` / `-n`）。

### 其他平台

SPA fallback 配置（未知路径回退到 `index.html`）：

```json
// Vercel (vercel.json)
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

```toml
# Netlify (netlify.toml)
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

```nginx
# Nginx
location / { try_files $uri $uri/ /index.html; }
```

Service Worker 作用域跟随部署路径，在线按页面/静态资源/图片分别缓存；断网时优先页面缓存，SPA 路由未命中则启动应用壳并从 IndexedDB 渲染已保存正文。

## 自动化与通知

仓库事件通过 [`telegram-notify.yml`](.github/workflows/telegram-notify.yml) 实时推送到 Telegram（站长消息提醒）：

- 💬 **新评论 / 新讨论 / 新 Issue**：giscus 评论、留言板留言、友链申请
- 🚀 **push 到 main 的提交**：提交列表 + 对比链接
- ⚙️ **Action 运行结果**：任一 workflow 完成时推送成功 / 失败 / 取消（通知自身的结果会被跳过，不会循环）
- 🔔 **手动测试**：Pages CMS 侧边栏「🔔 测试 Telegram 通知」按钮，或直接运行 `Telegram Notify` workflow

**一次性配置**：在 [@BotFather](https://t.me/BotFather) 创建机器人获取 `TELEGRAM_BOT_TOKEN`，通过 [@userinfobot](https://t.me/userinfobot) 获取 `TELEGRAM_CHAT_ID`，然后在仓库 **Settings → Secrets and variables → Actions** 添加（可选 `TELEGRAM_TOPIC_ID` 指定论坛话题）。未配置 token / chat id 时 workflow 优雅跳过（`::warning::` 正常退出，不红叉）。

其他自动化：`ci.yml` 每次 push/PR 自动跑类型检查 + 完整构建 + 双审计；友链申请审核（`friend-link-bot.yml`）、友链可用性检查（`friend-link-check.yml`）、评论 Akismet 反垃圾（`akismet-discussion-comment-check.yml`）与关键词过滤（`comment-keyword-filter.yml` / `comment-keyword-recheck.yml`）、文章更新订阅通知（`notify-post-update.yml`）均为独立 workflow。

## 贡献指南

欢迎提交 Issue 和 PR：Fork → 创建特性分支 → `npm run check` 通过校验 → 提交 PR。

## 许可证

[MIT](./LICENSE)
