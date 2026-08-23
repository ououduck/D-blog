# CI/CD Workflows — AI 修改规则

## 功能概述

GitHub Actions 自动化：ci（push/PR 全量门禁）、deploy（手动双平台部署）、telegram-notify、comment 三件套、akismet、notify-post-update、check-broken-links；PagesCMS 动作按钮（.pages.yml）。

## 关键文件

- `.github/workflows/*.yml`（8 个）
- `.pages.yml`（CMS 集合/字段/动作按钮）

## 修改规则（必须遵守）

1. **权限最小化**：每个 workflow 只声明所需 scope（contents/discussions 等），禁止 id-token 滥用与写权限冗余。
2. **并发与超时**：所有 workflow 保持 concurrency 策略（串行/取消语义按事件类型合理选择）与 timeout-minutes。
3. **secrets 最小传递**：只传给需要的步骤；日志不得输出 secrets（GitHub 会脱敏 CI 侧，本地运行无保护）。
4. **构建同源**：deploy 与 ci 必须共用 `npm run build` 同一流程，禁止双套构建。
5. **白名单同步**：新增 workflow 必须同步 telegram-notify.yml 的 workflow_run 白名单。
6. **版本固定**：第三方 action 用 major tag（checkout@v5 等）；CLI 工具（wrangler/edgeone）用精确版本（部署可复现）。
7. **PagesCMS 字段白名单**：.pages.yml 的 siteConfig fields 必须覆盖 site.config.json 实际使用的全部键（缺字段 CMS 保存会丢数据）。
8. **CI 门禁**：check/test/build 三 job 的职责边界保持（类型+内容校验 / 单测 / 构建+审计）。

## 常见陷阱

- workflow 名称（name:）是 telegram-notify 白名单与 .pages.yml 动作的匹配键，改名需三处同步；
- concurrency group 名跨 workflow 同值时互相串行（评论双过滤器的既有行为）。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
