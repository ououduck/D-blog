# 前端模块速查

## 入口

| 文件                | 职责                                                  |
| ------------------- | ----------------------------------------------------- |
| `src/index.tsx`     | 浏览器渲染入口（水合 / 客户端渲染）                   |
| `src/ssr-entry.tsx` | SSR 渲染入口（StaticRouter + renderToPipeableStream） |
| `src/App.tsx`       | 路由表 + 错误边界 + View Transitions                  |
| `src/types.ts`      | 全局共享类型                                          |

## 页面（src/pages）

| 页面                                  | 说明                                                              |
| ------------------------------------- | ----------------------------------------------------------------- |
| `Home.tsx`                            | 首页：英雄区、分类筛选、文章卡片、搜索、排序分页                  |
| `Post.tsx`                            | 文章详情：Markdown 渲染、代码块、Mermaid、TOC、阅读进度、分享收藏 |
| `Archive.tsx`                         | 归档：年份/月份钻取 + 搜索                                        |
| `Tags.tsx`                            | 标签云 + 标签筛选                                                 |
| `Search.tsx`                          | 全站搜索页                                                        |
| `Stats.tsx`                           | 数据统计面板                                                      |
| `Friends.tsx`                         | 友链展示 + 申请向导                                               |
| `ShuoShuo.tsx` / `ShuoShuoDetail.tsx` | 说说列表 / 说说详情                                               |
| `Guestbook.tsx`                       | 留言板（Giscus 固定 Discussion）                                  |
| `About.tsx`                           | 关于页                                                            |
| `Sponsor.tsx`                         | 赞助页（广告数据写死在组件内）                                    |
| `Favorites.tsx`                       | 离线收藏列表                                                      |
| `NotFound.tsx`                        | 404 页                                                            |
| `CoverGenerator.tsx`                  | 封面生成器（大模块，逻辑在 `pages/cover/`）                       |
| `Watermark.tsx`                       | 水印工具（逻辑在 `pages/watermark/`）                             |

## 通用组件（src/components）

- 布局：`Layout.tsx`、`BackToTop.tsx`、`OfflineStatus.tsx`、`CookieNotice.tsx`
- SEO：`Seo.tsx`
- 文章：`PostCard.tsx`、`Pagination.tsx`、`TableOfContents.tsx`、`ReadingProgressBadge.tsx`、`ProgressiveImage.tsx`、`ImageViewer.tsx`
- 交互：`SearchField.tsx`、`SearchModal.tsx`、`ShareModal.tsx`、`ShuoShuoShareModal.tsx`、`SlideModal.tsx`、`ServiceWorkerUpdatePrompt.tsx`
- 评论：`GiscusComments.tsx`、`IssueSubscriptionCard.tsx`
- 阅读：`ReadingModeContext.tsx`、`ReadingModeToggle.tsx`
- 状态：`ContentStatus.tsx`、`NotFoundState.tsx`
- 动效：`effects/`（`CountUp`、`Magnet`、`Reveal`、`RotatingText`、`SpotlightLayer`）
- UI：`ui/Surface.tsx`

## Hooks（src/hooks）

| Hook                | 用途                                   |
| ------------------- | -------------------------------------- |
| `useMediaQuery`     | CSS 媒体查询响应式订阅                 |
| `useReducedMotion`  | `prefers-reduced-motion` 订阅          |
| `useModalOverlay`   | 全局弹层栈/滚动锁/焦点管理             |
| `usePostSearch`     | 搜索防抖 + requestId 竞态 + 空查询兜底 |
| `useOfflinePosts`   | 离线收藏状态同步                       |
| `useReadingHistory` | 阅读历史                               |
| `useSpotlight`      | 卡片 hover 光效                        |
| `useResetTimer`     | 重置计时器工具                         |

## Services（src/services）

| Service             | 数据                                   |
| ------------------- | -------------------------------------- |
| `posts.ts`          | 文章读取/搜索/评分/统计                |
| `friends.ts`        | 友链读取与初始数据                     |
| `shuoshuo.ts`       | 说说读取                               |
| `offlinePosts.ts`   | IndexedDB + localStorage 离线收藏/阅读 |
| `readingHistory.ts` | 阅读进度/历史                          |
| `siteStats.ts`      | 站点统计                               |
| `busuanzi.ts`       | 不蒜子访问统计                         |

## Utils（src/utils）

- 通用：`clamp`、`classNames`、`date`、`download`、`clipboard`、`scroll`
- Markdown/标题：`markdown-core.mjs`、`headings-core.mjs`、`headings.ts`、`markdownText.ts`、`remarkCodeMeta.ts`、`toc.ts`
- 业务：`postSorting`、`postSelection`、`homeQuery`、`postRelations`、`readingProgress`、`sharePoster`、`siteUrl`、`searchParams`、`preload`、`motion`、`yieldToBrowser`
- 注意：`*-core.mjs` 被 `src/` 与 `scripts/` 共享，修改需两端回归。

## 页面私有模块

| 目录                   | 内容                                                                     |
| ---------------------- | ------------------------------------------------------------------------ |
| `src/pages/cover/`     | 封面生成器全部领域逻辑（渲染、布局、配色、存储、批量、导出、模板、预设） |
| `src/pages/watermark/` | 水印工具渲染逻辑                                                         |
| `src/pages/archive/`   | 归档分组/展开状态                                                        |
| `src/pages/friends/`   | 友链申请表单状态/校验/Issue 草稿生成                                     |
