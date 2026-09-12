# 飞书机器人 Webhook 通知（feishu-webhook）— AI 修改规则

## 功能概述

GitHub 事件 → 飞书机器人 Webhook 推送：新评论/新讨论/新 Issue、push 到 main 的提交列表、白名单内 Action 运行结果；手动测试入口。

## 关键文件

- `scripts/feishu-webhook.mjs`
- `scripts/lib/feishu-webhook.mjs`（sendFeishuWebhookMessage 共享库：截断/错误提示/重试）
- `.github/workflows/feishu-webhook.yml`（含 workflow_run 白名单）

## 修改规则（必须遵守）

1. **发送走共享库**：所有飞书机器人 Webhook 发送必须经 `lib/feishu-webhook.mjs` 的 `sendFeishuWebhookMessage`（飞书文本格式、截断、重试超时、错误提示），禁止在调用方重复实现。
2. **配置缺失优雅跳过**：FEISHU_WEBHOOK_URL 未配置时返回 null 且正常退出（::warning::，不红叉）。
3. **白名单手动维护**：workflow_run 白名单**必须手动补充新增 workflow**（含周度定时任务，其失败需要提醒）；不得用 `**` 通配（双倍 Actions 消耗 + 自我触发）。
4. **消息安全**：消息使用飞书 `msg_type: text` 纯文本格式；用户可控内容不得污染控制字符，密钥不得进日志。
5. **消息长度限制**：发送前保留 4000 字符安全预算；超出内容必须截断，并在末尾明确提示。

## 常见陷阱

- 推送消息超长必须截断（4000 字符安全预算）；
- workflow 名称变更需同步白名单（名称精确匹配）。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
