# 评论过滤与反垃圾（comment-moderation）— AI 修改规则

## 功能概述

评论/讨论自动治理：Akismet 反垃圾判定（`akismet-comment-check.mjs`）+ 关键词过滤（`comment-keyword-filter.mjs`，命中即 minimize/delete）+ 全量复查（`comment-keyword-recheck.mjs`）。配置在 `config/comment-keywords.json`。

## 关键文件

- `scripts/akismet-comment-check.mjs`（Akismet 判定 + GraphQL 处理）
- `scripts/comment-keyword-filter.mjs` / `comment-keyword-recheck.mjs`
- `scripts/lib/keyword-filter-core.mjs`（匹配核心，共享）
- `scripts/lib/http.mjs`（fetchWithRetry/超时/错误分类）
- `.github/workflows/{akismet-discussion-comment-check,comment-keyword-filter,comment-keyword-recheck}.yml`

## 修改规则（必须遵守）

1. **宁可漏删不误删**：判定为 undetermined（网络失败/无法确认）时必须放行评论并告警，禁止默认删除。
2. **超时语义**：外层信号只做总预算（单次超时 × (重试+1) × 2），单次超时与重试由 fetchWithRetry 管理 —— 禁止外层与内层同长（会废掉重试）。
3. **已处理跳过**：已最小化（isMinimized）的评论不得重复处理（recheck 语义）。
4. **重试语义**：429/5xx 按 fetchWithRetry 退避重试；权限类 403 必须区分（不按限流等待）。
5. **配置语义**：comment-keywords.json 的 action（minimize/delete/none）由配置决定，脚本忠实执行；**修改关键词表属于内容策略，需用户确认**。
6. **GraphQL 载荷**：评论/讨论处理 mutation 的查询字段与结果解析保持一致；错误必须可诊断。

## 常见陷阱

- 两个 workflow 都监听 `discussion_comment: created`（双过滤器设计），处理失败是告警噪音而非数据损坏；
- Akismet key 在 URL 子域中，日志必须脱敏（sanitizeUrlForLogs）。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
