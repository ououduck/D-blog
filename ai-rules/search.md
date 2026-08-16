# 搜索（Search）— AI 修改规则

## 功能概述

全站搜索页：独立于首页的搜索界面（`?q=` 参数）、搜索范围切换（全部/分类/正文/标题）、结果相关度排序、分享/收藏/保存。

## 关键文件

- `src/pages/Search.tsx`
- `src/hooks/usePostSearch.ts`
- `src/services/posts.ts`（searchPosts、getFieldMatchScore、搜索索引）

## 修改规则（必须遵守）

1. **URL ↔ 状态同步**：同首页规则（lastEditedQueryRef 追平后清空；`?q=` 直访水合后同步）。
2. **搜索范围**：`scope` 状态与 URL 参数联动（切换范围不丢查询）；范围选项文案/语义在组件常量中，保持既有五档（全部/分类/正文内容/仅标题等）。
3. **相关度排序**：`getFieldMatchScore`（精确/前缀/包含加权）与日期降序在 `services/posts.ts` 中，不得在组件内重写。
4. **竞态与防抖**：usePostSearch 的防抖清理、requestId 比对不得移除。
5. **SSG 确定性**：SSG 只预渲染无 q 默认界面；带 q 的结果在客户端执行。
6. **分享 URL**：`post.id` 必须 `encodeURIComponent`。

## 常见陷阱

- 搜索索引在 services 层构建（懒加载），修改 `searchPosts` 签名会同时影响 Home/Archive/Tags/SearchModal；
- 无结果页的 SEO title 应保持「搜索：X」语义。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
