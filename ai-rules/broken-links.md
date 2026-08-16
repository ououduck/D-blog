# 文章外链死链检查（check-broken-links）— AI 修改规则

## 功能概述

构建期/CI 扫描 `posts/*.md` 全部 http/https 外链（Markdown 链接 + HTML `<a href>`），逐个请求检查可达性，失效链接按文章分组（带行号与 HTTP 状态）推送 Telegram。每周定时 + PagesCMS 按钮手动触发。

## 关键文件

- `scripts/check-broken-links.mjs`
- `scripts/lib/telegram.mjs`（发送共享库）
- `.github/workflows/check-broken-links.yml`
- `.pages.yml`（「🔗 检查失效外链」动作按钮）

## 修改规则（必须遵守）

1. **代码块/行内代码屏蔽**：外链提取前必须经 `maskFencedCodeBlocks`（headings-core 共享）+ 行内代码屏蔽 —— 代码示例中的 URL 不得被当作真实外链检查（已修事故）。
2. **SSRF 防护（含重定向逐跳）**：请求任意 URL 前必须调用 `isSafePublicHttpUrl`（lib/http.mjs），内网/回环/带凭据地址不发起请求直接判为不可访问；**重定向链必须手动逐跳跟随**（`redirect: 'manual'`），每一跳重新 `isSafePublicHttpUrl` —— 初始 URL 安全不代表跳转目标安全，公开站点可 302 到 127.0.0.1/169.254.169.254 形成绕过（与 friend-link-bot 的 fetchPublicPage 口径一致）。重定向超过上限（MAX_REDIRECTS）判失效（防环）。
3. **重试语义**：单 URL 检查必须复用 `fetchWithRetry`（瞬时抖动不误判死链）。
4. **忽略名单**：`--ignore-hosts` 语义保持（已知反爬站点如 Cloudflare Dashboard 的 403 误报）。
5. **并发与礼貌**：固定并发池（4）+ 每请求 150ms 间隔的平衡保持。
6. **上报**：失效报告走 `sendTelegramMessage`（配置缺失优雅跳过返回 null）；`--dry-run` 不上报；`--fail` 非零退出。
7. **导入副作用**：模块被 import 时不得执行 main()（入口判定 pathToFileURL 比较）。
8. **日志脱敏**：输出用户可控 URL 前必须 `sanitizeUrlForLogs`（URL 可能含 userinfo 凭据，如 https://user:secret@host）。

## 常见陷阱

- 不要在本脚本内重新实现 fetch/重试/脱敏（lib/http.mjs 已有）；
- 重定向 Location 为相对路径时必须 `new URL(location, current)` 解析后再校验，直接拼接会漏掉跳转目标；
- Telegram 消息为 HTML parse mode，URL/错误文本必须 escapeHtml；
- workflow 的 npm ci 只为 gray-matter（headings-core 无依赖）。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
