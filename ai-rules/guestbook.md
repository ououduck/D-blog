# 留言板（Guestbook）— AI 修改规则

## 功能概述

固定指向一个 GitHub Discussion 的留言区，由 Giscus 承载（mapping=number 精确锁定）。

## 关键文件

- `src/pages/Guestbook.tsx`
- `src/components/GiscusComments.tsx`（见 [giscus-comments.md](giscus-comments.md)）
- `config/site.config.json`（guestbook.discussionId）

## 修改规则（必须遵守）

1. **固定讨论**：留言板使用 `mapping="number"` + 固定 `discussionId`，**绝不自动创建新讨论**（number 映射语义）。
2. **配置校验**：`discussionId` 缺失或非数字时，应回退「留言功能暂未开启」状态而非静默注入无效 giscus。
3. **回退链**：giscus 来源（官方/自托管/同源代理）与超时重试逻辑在 GiscusComments 内，留言板不重复实现。

## 常见陷阱

- 修改 site.config.json 的 discussionId 必须与 GitHub 实际 Discussion 编号一致；
- giscus mapping 语义：specific 按 term 搜索（可能自动建讨论），number 才是精确锁定 —— 留言板只能用 number。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
