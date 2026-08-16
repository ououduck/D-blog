# 标签页（Tags）— AI 修改规则

## 功能概述

标签云 + 标签筛选：搜索文章/标签、`?tag=` / `?q=` URL 参数联动、选中标签的文章列表、标签大小按文章数分级。

## 关键文件

- `src/pages/Tags.tsx`
- `src/utils/postRelations.ts`（buildTagList 等标签聚合）

## 修改规则（必须遵守）

1. **URL ↔ 状态同步**：同首页规则（lastEditedQueryRef 追平后清空；`?tag=` 直访要筛选对应标签；非法 tag 回退）。
2. **派生状态记忆化**：`tags`/`allTags`/`selectedTagInfo`/`maxCount` 必须走 useMemo 链（每次渲染对全量 posts 重算 buildTagList 是明确禁止的性能回退）。
3. **标签大小分级**：`getTagSize` 按 count/maxCount 比例分档，保持阈值语义。
4. **SSG 确定性**：标签云首帧由构建期内联数据渲染，不得依赖客户端时间/随机。
5. **无障碍**：标签按钮有 aria-pressed；「返回全部标签」按钮必须显式 `type="button"`。

## 常见陷阱

- 修改 `postRelations.ts` 的 buildTagList 会影响归档/首页的标签派生；
- 搜索结果与全量标签两个数据源（results vs allPosts）不要混淆。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
