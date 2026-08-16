# 归档页（Archive）— AI 修改规则

## 功能概述

按「年份 → 月份」钻取式时间线展示全部文章：年份/月份折叠、搜索过滤、`?year=` / `?q=` URL 参数联动、结构化数据（CollectionPage + ItemList）。

## 关键文件

- `src/pages/Archive.tsx`
- `src/pages/archive/archiveState.ts`（分组构建、展开状态、year 归一化）

## 修改规则（必须遵守）

1. **year 参数格式**：URL 写**纯数字**（`?year=2026`），展示层保留本地化文案（`2026年`）；所有比较必须经 `normalizeYearKey` 归一化（getInitialExpansion / ensureYearExpanded / URL 校验 / toggleYear 写入四处置为一致）。禁止把「2026年」写入 URL。
2. **展开状态**：默认展开最新年份首月；`?year=` 直访展开对应年份；非法 year 参数必须从 URL 移除并回退最新年份；搜索后自动展开全部（仅一次，用户手动折叠不被反弹）。
3. **URL ↔ 状态同步**：同首页规则（lastEditedQueryRef 追平后清空、清除搜索移除 q 与 year）。
4. **SSG 确定性**：首帧由 `getInitialPosts()` 分组渲染，不得依赖客户端时间。
5. **无效日期**：`buildArchiveGroups` 对非法日期承诺不抛错（月份回退 1、未知年份排最后），不得移除该容错。
6. **动画**：年份/月份展开折叠动画尊重 reducedMotion。

## 常见陷阱

- 空数据 mock 会让年份相关行为零覆盖（测试必须用非空固定数据集）；
- 钻取式交互：文章标题需要「年份 + 月份」两级都展开才可见。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
