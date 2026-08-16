# 首页（Home）— AI 修改规则

## 功能概述

站点首页：英雄区、分类筛选栏、文章卡片网格（精选大卡 + 普通卡）、搜索框（?q= 客户端搜索）、继续阅读入口、排序/分页、分享与离线收藏。

## 关键文件

- `src/pages/Home.tsx`（约 780 行）
- `src/components/PostCard.tsx`（首页与搜索共用卡片，已 React.memo）
- `src/hooks/usePostSearch.ts`（搜索 hook：防抖 + requestId 竞态 + 空查询兜底）
- `src/utils/postSelection.ts` / `postSorting.ts` / `homeQuery.ts`（精选/排序/URL 查询状态）

## 修改规则（必须遵守）

1. **水合一致性**：首帧用 `getInitialPosts()` 同步渲染（无 q 默认界面）；`?q=` 直访时首帧保持空查询渲染，水合后在 effect 中同步（Home.tsx 既有模式，不得改为 useState 初值）。
2. **URL ↔ 状态单向同步**：`lastEditedQueryRef` 守卫只挡「击键后 URL 未提交」窗口期；URL 追平编辑值后必须清空 ref（否则后退/前进失同步）。任何对同步 effect 的修改都要保持此语义。
3. **搜索竞态**：空查询分支、防抖清理、requestId 比对不得移除；`emptyResults` 必须传稳定引用（否则渲染循环）。
4. **分类/排序/分页**：状态必须与 URL 参数（category/sort/page）双向一致；页码越界要自愈（钳制后 replace URL）。
5. **精选置顶**：`isPinnedFeaturedPost` 等选择逻辑在 utils 中，不得在组件内复制实现。
6. **动画**：framer-motion 变体（fadeInUp/staggerContainer）仅做入场；尊重 `prefers-reduced-motion`（`shouldReduceMotion` 传透）；SSR 输出不得为 opacity:0 的内容。
7. **性能**：PostCard 保持 memo；不要引入整页重渲染的依赖。
8. **分享/收藏**：分享 URL 的 `/post/<id>` 路径用裸 `post.id`（构建期 `validateId` 已校验 URL 安全，与 SSG/sitemap/canonical 口径一致；encodeURIComponent 反而会与产物路径不一致）；收藏走 `useOfflinePosts`。

## 常见陷阱

- 修改 `usePostSearch` 的返回结构会同时影响 Search/Archive/Tags；
- 骨架屏/加载态切换不应在每次击键时卸载整个文章网格（旧结果应保留）；
- SEO title：有查询时输出「搜索：X」，无结果也应保持搜索语义而非回退站点默认标题。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
