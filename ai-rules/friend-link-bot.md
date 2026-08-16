# 友链机器人（friend-link-bot）— AI 修改规则

## 功能概述

友链申请自动化：监听 Issue 事件（打开/评论）→ 校验反链（站点可达性 + 友链页含本站链接）→ 冷却期 → 自动创建 `friends/*.json` 并触发部署。

## 关键文件

- `scripts/friend-link-bot.mjs`（约 1000 行）
- `scripts/friend-link-check.mjs`（友链可用性检查，写 unavailable 标记）
- `.github/workflows/friend-link-bot.yml` / `friend-link-check.yml`
- `.pages.yml`（「🩺 检查友链可用状态」动作）

## 修改规则（必须遵守）

1. **SSRF 防护**：对用户提交的 URL（站点/友链页/头像）发请求前必须 `isSafePublicHttpUrl`（含 DNS 解析逐 IP 私网校验）。
2. **反链校验协议**：申请方必须在本站有友链（友链页包含本站 URL）才可通过 —— 该校验逻辑不得移除。
3. **冷却期**：WAIT_COOLDOWN 语义保持（防止重复处理同一申请）。
4. **Git 纪律**：push 采用 fetch + rebase 再推（吸收远端并发提交）；失败必须告警并留下可诊断信息。
5. **幂等**：同一申请重复触发不得重复创建/覆盖友链文件；`unavailable` 标记由 check 脚本维护，bot 只负责创建。
6. **密钥安全**：GITHUB_TOKEN 只读/写所需最小 scope；日志不得输出 token。
7. **入口判定**：main() 仅在主模块运行时执行（pathToFileURL 比较）。

## 常见陷阱

- 友链 JSON 文件写入保留原缩进与换行风格（本地 CRLF 不整文件重写）；
- 修改申请校验规则需与 `src/pages/friends/friendLinkApplication.ts` 的客户端校验口径一致。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
