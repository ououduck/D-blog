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
- [AI 开发者约束](#ai-开发者约束)
- [构建与质量](#构建与质量)
- [配置](#配置)
- [部署](#部署)
- [自动化与通知](#自动化与通知)
- [许可证](#许可证)

## 核心特性

- **Markdown 驱动**：Front Matter 元数据校验、多作者、分类白名单、草稿过滤均在构建时完成
- **增强渲染**：代码高亮（diff 行高亮、文件名、折叠、行号复制、换行开关）、KaTeX 公式、Mermaid 图表、GFM 表格、图片预览，按需懒加载
- **全文搜索**：构建期生成索引，多维权重评分，支持范围筛选与搜索历史；首页/弹窗/独立页 `/search` 共用同一套评分
- **阅读体验**：目录导航、阅读进度恢复、专注阅读模式、深色模式图片柔和降亮、标题锚点复制、上一篇/下一篇（`Alt + ←/→`）与系列文章
- **分享与互动**：分享弹窗与竖版分享海报（Canvas 本地绘制）；Giscus 评论区；独立留言板 `/guestbook`；说说 `/shuoshuo` 独立静态页
- **内置工具箱**：封面生成器 `/cover`（含批量 ZIP 导出）、水印工具 `/watermark`（图片不离开浏览器）
- **主题与外观**：浅色/深色/跟随系统，CSS View Transitions 过渡
- **构建期 SSG**：每页独立 HTML + 精准 SEO meta 与 JSON-LD，爬虫可直接读取正文
- **PWA**：Service Worker 缓存 + 收藏文章 IndexedDB 离线阅读
- **SEO 与订阅**：OG/Twitter Card、JSON-LD、RSS、`llms.txt`、Sitemap、`robots.txt`

## 技术栈

| 领域 | 选型 |
| --- | --- |
| 前端框架 | React 19 + React Router 7 |
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
cp .env.example .env          # 可选：覆盖站点 URL 与子路径（Windows 用 copy）
npm run check                 # 数据生成校验 + 类型检查
npm run dev                   # 本地开发（http://localhost:3000）
```

验证改动是否合规（提交前自查，详见 [AGENT.md](AGENT.md)）：

```bash
npm run typecheck             # TypeScript 类型检查
npx eslint .                  # ESLint 检查
npm test                      # Vitest 单元测试（先执行 gen:data）
```

其余命令见[构建与质量](#构建与质量)。Node.js >= 20，npm >= 10。

## 项目结构

```text
D-blog/
├── config/                  # 站点/内容配置、tsconfig、tailwind、postcss
├── posts/ friends/ shuoshuo/  # Markdown 文章、友链 JSON、说说（短动态）
├── ai-rules/                # 各功能模块的 AI 修改规则集（硬性约束，见下文）
├── AGENT.md                 # AI 开发者总行为准则
├── .pages.yml               # PagesCMS 配置
├── generated/               # 构建产物：posts.json / posts-search.json / site-stats.json 等
├── public/                  # favicon、PWA 图标、sw.js、offline.html，以及构建生成的 feed/sitemap
├── scripts/                 # 构建/自动化脚本（lib/ 为共享 HTTP 与日志库）
├── .github/workflows/       # 部署、友链审核、评论检查、更新通知
└── src/
    ├── components/          # Layout、PostCard、Seo、TableOfContents、SearchModal、ImageViewer 等
    ├── pages/               # 页面组件（懒加载）；cover/、watermark/、archive/、friends/ 为模块集
    ├── services/            # posts / friends / shuoshuo / offlinePosts / readingHistory 等
    ├── hooks/ utils/        # 自定义 Hook 与工具函数（日期、排序、站点 URL、标题解析等）
    │                        # utils 下 *.mjs 为客户端与构建脚本共享的纯逻辑（frontmatter 剥离、标题提取）
    ├── ssr/routeData.tsx    # SSG 路由数据构造与客户端读取
    ├── test/setup.ts        # Vitest 测试环境（jest-dom matchers 等）
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

- 代码块 `title="文件.ts"` 显示文件名（下载时以此命名）；`diff` 代码块中 `+ / - / @@` 行自动整行高亮；长代码块默认折叠为 30 行，工具栏提供「自动换行」，点击行号复制该行
- 正文图片在深色模式下自动柔和降亮（悬停恢复），`"no-dark"` 可单图豁免

### 友链申请

友链页展开「申请友链」→ 先添加本站友链 → 登录 GitHub → 填写资料 → 提交 Issue → Actions 自动校验反链后写入 `friends/`。友链数据为 `friends/*.json`，可在 PagesCMS「友链」集合直接编辑；「检查友链可用状态」会为失联站点写入 `"unavailable": true` 并归入页面的「已失联的博客」板块，恢复后自动回到主列表。

### 说说

`/shuoshuo` 是类似朋友圈的短动态页，内容存放在 `shuoshuo/*.md`（无需标题），可选 `images` frontmatter 字段（图片链接数组）以九宫格展示配图。每条说说生成独立静态页 `/shuoshuo/<id>`，完整 SSR 正文与 SEO 标签，收录进 `sitemap-shuoshuo.xml` 与 `llms.txt`；旧的 `?id=` 定位链接仍兼容。

```yaml
---
id: my-first-shuoshuo        # 全站唯一
date: 2026-08-14
images:
  - https://cdn.example.com/photo-1.png
---
今天也是元气满满的一天 🎉
```

### 留言板

`/guestbook` 通过 Giscus `mapping=number` 固定指向仓库的「D-blog 留言板」Discussion（`config/site.config.json` 的 `guestbook.discussionId`）。与文章评论共用 Akismet 反垃圾，并叠加自建关键词过滤（`config/comment-keywords.json`，可在 PagesCMS「评论关键词」中编辑）。

### 文章更新订阅

文章页/关于页可订阅 GitHub Issue（`src/components/IssueSubscriptionCard.tsx`），新文章发布时 `.github/workflows/notify-post-update.yml` 自动在指定 Issue 发布更新通知。

### Giscus 评论

评论区直连官方 [https://giscus.app](https://giscus.app)（`config/site.config.json` 的 `comments.origin`）。大陆网络下 giscus.app 被 DNS 污染/阻断，评论区可能加载失败；可将 `comments.origin` 指向自托管 giscus 实例或可达镜像的完整 URL（前端按「配置来源 → 官方 giscus.app」顺序回退加载）。注意：GitHub OAuth 登录回调固定指向 `giscus.app`，大陆网络下无法完成登录（读评论、看讨论不受影响）。

## AI 开发者约束

> 给后续参与本仓库工作的 **AI 开发者**：本仓库为 AI 制定了强制行为准则，请务必遵守。

- **[`AGENT.md`](AGENT.md)** — AI 总行为准则：沟通语言、git 纪律（每小任务一提交、不 push）、技术硬性约束（SSG/水合确定性、UI/主题不变、错误处理、竞态防护、日志安全、SSRF 防护等）。
- **[`ai-rules/`](ai-rules/README.md)** — 每个功能的详细修改规则（硬性约束）：功能概述、关键文件、修改规则、常见陷阱。
- **破例流程**：当 AI 认为有必要打破任何规则（含修改 `ai-rules/` 内文档）时，**必须先向用户说明理由并请求授权**；未获明确准许前不得动手。获准后须在提交信息中注明「依据用户授权破例」。
- 修改 `AGENT.md` 本身同样需要用户明确授权。

## 构建与质量

`npm run build` 依次执行：数据生成 → OG 卡生成 → 客户端构建 → SSR 构建 → 模板快照 → SSG 预渲染 → 产物审计 → SEO 审计，最终输出 `dist/`。各阶段独立超时并汇总耗时，任一阶段失败立即终止流水线并在日志中标明失败阶段（[N/M] 前缀）。`generated/`、RSS 与 Sitemap 均为构建产物，不应手工编辑。

| 命令 | 功能 |
| --- | --- |
| `npm run dev` | 启动开发服务器（端口 3000），自动执行 `gen:data` |
| `npm run build` / `build:verbose` | 生产构建 / 详细模式（保留 Vite 完整输出） |
| `npm run build:ssr` / `ssg` | 仅构建 SSR bundle（`dist-ssr/`）/ 仅 SSG 预渲染（需先完成两端构建） |
| `npm run preview` | 预览生产构建结果 |
| `npm run migrate:images` | 批量迁移本地图片至图床（支持 `--dry-run`） |
| `npm run gen:data` | 数据生成 + 全量校验（frontmatter、文章 ID、图片与链接） |
| `npm run audit:build` / `audit:seo` | 构建产物完整性 / 全站 SEO 清单审计（均已接入 build） |
| `npm run typecheck` / `check` | 类型检查 / 数据生成校验 + 类型检查 |
| `npm run test` / `test:watch` / `test:coverage` | vitest 单元测试 / 监听 / 覆盖率（均先执行 `gen:data`） |
| `npm run lint` / `lint:fix` | ESLint 检查 / 自动修复 |
| `npm run format` / `format:check` | Prettier 格式化 / 格式检查 |

## 配置

- **站点配置**：`config/site.config.json` — 标题、描述、URL、社交链接、作者信息、备案号等，可在 PagesCMS「站点配置」中编辑
- **赞助与广告**：赞助方式与广告横幅均写死在 `src/pages/Sponsor.tsx`（增删广告直接编辑该文件的 `adsConfig` 数组）
- **文章分类白名单**：`config/content.config.json` 的 `postCategories` 数组
- **环境变量**：`VITE_SITE_URL`（站点公开访问地址）、`VITE_BASE_PATH`（子路径部署时使用，留空为根路径），见 `.env.example`

## 部署

采用 **GitHub Actions 构建 + 双平台直传**：构建在 GitHub 完成（公开仓库 Actions 免费额度），产物直传 Cloudflare Pages 与 EdgeOne Pages。日常 push 不触发部署，仅手动触发。

**触发方式**：① Pages CMS 侧边栏「🚀 部署到 Cloudflare & EdgeOne」按钮（配置见 `.pages.yml`）；② GitHub Actions 手动 Run workflow（`deploy.yml`，payload 最小可用 `{"repository":{"ref":"main"}}`）。

**一次性前置配置**：

| 项 | 说明 |
| --- | --- |
| Cloudflare Pages | 项目类型 **Direct Upload**（直传），自定义域名与缓存策略（`public/_headers`）已就位 |
| EdgeOne Pages | 项目类型 **直传**，域名 CNAME 已切换，缓存规则需在控制台手动配置 |
| 仓库 Secrets | `CLOUDFLARE_API_TOKEN`（Pages:Edit 权限）、`CLOUDFLARE_ACCOUNT_ID`、`EDGEONE_API_TOKEN` |

两个平台的项目名均为 `d-blog`（已在 `deploy.yml` 配置，不一致时修改 `--project-name` / `-n`）。

**其他平台**：需配置 SPA fallback（未知路径回退到 `index.html`），如 Vercel（`vercel.json`）`{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}`、Netlify（`netlify.toml`）`[[redirects]] from="/*" to="/index.html" status=200`、Nginx `try_files $uri $uri/ /index.html;`。

Service Worker 作用域跟随部署路径，在线按页面/静态资源/图片分别缓存；断网时优先页面缓存，SPA 路由未命中则启动应用壳并从 IndexedDB 渲染已保存正文。

## 自动化与通知

仓库事件通过 [`telegram-notify.yml`](.github/workflows/telegram-notify.yml) 实时推送到 Telegram：新评论/新讨论/新 Issue、push 到 main 的提交、任一 Action 运行结果（成功/失败/取消，通知自身的结果被跳过）。**一次性配置**：在 [@BotFather](https://t.me/BotFather) 创建机器人获取 `TELEGRAM_BOT_TOKEN`，通过 [@userinfobot](https://t.me/userinfobot) 获取 `TELEGRAM_CHAT_ID`，在仓库 **Settings → Secrets and variables → Actions** 添加（可选 `TELEGRAM_TOPIC_ID` 指定论坛话题）。未配置时 workflow 优雅跳过（`::warning::` 正常退出，不红叉）。

其他自动化：`ci.yml` 每次 push/PR 自动跑类型检查 + 单元测试 + 完整构建 + 双审计；友链申请审核（`friend-link-bot.yml`）、友链可用性检查（`friend-link-check.yml`）、评论 Akismet 反垃圾（`akismet-discussion-comment-check.yml`）与关键词过滤（`comment-keyword-filter.yml` / `comment-keyword-recheck.yml`）、文章更新订阅通知（`notify-post-update.yml`）均为独立 workflow。

### 🔗 文章外链失效扫描（check-broken-links）

博客内容会随外部站点改版/下线产生死链，且完全可以在构建期检测。`scripts/check-broken-links.mjs` 扫描 `posts/*.md` 中全部 http/https 外链（Markdown 链接 + HTML `<a href>`，排除图片与站内锚点），逐个请求检查可达性，失效链接按文章分组汇总（带行号与 HTTP 状态）推送到 Telegram。只读操作，不修改仓库、不触发部署。

- **触发**：Pages CMS 侧边栏「🔗 检查失效外链」按钮（`check-broken-links.yml`，workflow_dispatch），或每周一 02:00 UTC 定时自动巡检（schedule）；
- **本地运行**：`npm run check:links`（默认仅报告退出码 0）；`--dry-run` 只打印不上报；`--fail` 发现失效链接时非零退出（可用于 CI 红叉门禁）；`--ignore-hosts=a.com,b.com` 跳过指定域名（用于已知反爬/机器人拦截的站点，如 Cloudflare Dashboard 对非浏览器 GET 返回 403 属误报，CI 中已内置该域名）；
- **本地 TUN 代理**：开着 Clash/Surge 等 TUN 代理时，DNS 会把全部域名解析到 198.18.0.0/15 fake-IP 段，脚本会自动识别（日志提示 `Detected local TUN proxy`）并跳过 IP 级 SSRF 校验、经代理转发请求，不会误报死链；如需强制禁用自动识别可设 `ALLOW_PROXY_ARTIFACT_DNS=0`；
- **通知配置**：复用 Telegram Secrets（`TELEGRAM_BOT_TOKEN` / `TELEGRAM_CHAT_ID`，可选 `TELEGRAM_TOPIC_ID`），未配置时优雅跳过；报告发送复用 `scripts/lib/telegram.mjs`（与 `telegram-notify` 共享）。

## 许可证

[MIT](./LICENSE)
