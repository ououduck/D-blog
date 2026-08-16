# 说说（ShuoShuo）— AI 修改规则

## 功能概述

朋友圈式短动态流：Markdown 正文、图片九宫格、独立详情页 `/shuoshuo/<id>`、搜索过滤、`?id=` 定位高亮、分享（自动复制链接）。

## 关键文件

- `src/pages/ShuoShuo.tsx` / `ShuoShuoDetail.tsx`
- `src/components/ShuoShuoItem.tsx` / `ShuoShuoShareModal.tsx`
- `src/services/shuoshuo.ts`

## 修改规则（必须遵守）

1. **性能**：`stripMarkdown` 结果必须按 id 缓存（`strippedContents`）并贯通到 ShuoShuoItem（shareSnippet prop）与 schema ItemList；禁止在渲染期对全部说说重复跑剥离正则。
2. **SSG 确定性**：说说列表/详情页首帧由构建期内联数据渲染（`getInitialShuoShuo()`）；`?id=` 定位在水合后执行。
3. **分享竞态**：分享弹窗的复制结果必须用 seq/generation 防护（快速关闭重开时旧弹窗迟到结果不得覆盖新弹窗的 autoCopied）。
4. **定位高亮**：`?id=` 定位 + 高亮 + 定时清除的既有实现不得移除；不存在 id 时按普通列表显示。
5. **无障碍**：分享/永久链接按钮有 aria-label（用预计算 snippet）；图片预览走 ImageViewer。

## 常见陷阱

- 详情页与列表页共用 ShuoShuoItem，新增 prop 要提供默认值；
- ShuoShuo.test 曾以 stub 整体替换 ShuoShuoItem 导致分享/定位逻辑不可测，测试应避免过度 mock。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
