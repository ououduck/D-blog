# Telegram 通知（telegram-notify）— AI 修改规则

## 功能概述

GitHub 事件 → Telegram 推送：新评论/新讨论/新 Issue、push 到 main 的提交列表、白名单内 Action 运行结果；手动测试入口。

## 关键文件

- `scripts/telegram-notify.mjs`
- `scripts/lib/telegram.mjs`（sendTelegramMessage 共享库：截断/错误提示/重试）
- `.github/workflows/telegram-notify.yml`（含 workflow_run 白名单）

## 修改规则（必须遵守）

1. **发送走共享库**：所有 Telegram 发送必须经 `lib/telegram.mjs` 的 `sendTelegramMessage`（截断、HTML 注入防护、401/403/400 排障提示、重试超时），禁止在调用方重复实现。
2. **配置缺失优雅跳过**：TELEGRAM_BOT_TOKEN/CHAT_ID 未配置时返回 null 且正常退出（::warning::，不红叉）。
3. **白名单手动维护**：workflow_run 白名单**必须手动补充新增 workflow**（含周度定时任务，其失败需要提醒）；不得用 `**` 通配（双倍 Actions 消耗 + 自我触发）。
4. **消息安全**：HTML parse mode 下所有用户可控文本（评论/标题/URL）必须转义；密钥不得进日志。
5. **message_thread_id**：仅正整数才附带（浮点会让 Telegram API 报错）。

## 常见陷阱

- 推送消息超长必须截断（4096 上限，4000 安全预算）；
- workflow 名称变更需同步白名单（名称精确匹配）。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
