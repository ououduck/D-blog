# 404 页（NotFound）— AI 修改规则

## 功能概述

未匹配路由的 404 页：标题/描述/返回入口 + 当前路径调试信息，noindex。

## 关键文件

- `src/pages/NotFound.tsx`
- `src/components/NotFoundState.tsx`（与文章/说说缺失页共用状态块）

## 修改规则（必须遵守）

1. **不嵌套 `<main>`**：Layout 已渲染 `<main>` 包裹路由内容，本页只能渲染 `<div>`（HTML 规范禁止 main 嵌套 main）。
2. **noindex**：404 页必须 `Seo noindex`（SPA 内 200 响应，避免被收录）。
3. **debugLabel**：仅在开发/缺失场景展示调试信息；文章/说说缺失页复用 NotFoundState 时保持一致文案模式。

## 常见陷阱

- NotFoundState 的修改会同时影响文章缺失与说说缺失页；
- 调试信息（路径/id）不得泄露敏感内容（当前仅 pathname/id，保持此范围）。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
