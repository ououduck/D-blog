# D-Umami 访问分析（index.html）— AI 修改规则

## 功能概述

D-Umami（自托管 Umami，`https://umami.pldduck.com`，站点 ID：`01a4a9ca-6dda-48c6-814a-f1cf912a0ee4`）
通过 `index.html` 中的标准 `<script defer>` 标签注入，用于访问行为分析
（与不蒜子的文章阅读量互补）。脚本解析后异步加载，不阻塞渲染。

## 关键文件

- `index.html` — 标签注入的唯一位置（脚本 URL 与站点 ID 写死于此）
- `public/_headers` / `edgeone.json` — CSP：`script-src` 放行 `https://umami.pldduck.com`
  （加载 script.js），`connect-src` 放行 `https://umami.pldduck.com`（上报 /api/send）
- `scripts/audit-build.mjs` — 构建审计断言 Umami 标签存在、含 data-website-id
  且为 defer 异步加载（检测到 load 延迟注入即构建失败）
- `src/pages/Stats.tsx` — 统计页底部「D-Umami 访问分析」板块与「跳转D-Umami查看」
  按钮（跳转共享看板，公开 URL 无需登录）

## 修改规则（必须遵守）

1. **写死，不拆配置**：脚本 URL（`https://umami.pldduck.com/script.js`）与站点 ID
   （`01a4a9ca-6dda-48c6-814a-f1cf912a0ee4`）必须直接写死在 `index.html` 中，
   **不得**拆到 `config/`、环境变量或任何其他配置文件。统计代码属于页面模板层，
   不参与站点内容配置。
2. **注入时机**：标签必须使用标准 `<script defer>` 形态，**不得**推迟到
   `window load` 事件——延迟注入会漏掉快速离开或首屏即交互的会话（漏记录）。
3. **同步审计**：修改注入代码（时机/URL/形态）时，必须同步更新
   `scripts/audit-build.mjs` 的 Umami 断言（脚本 URL + data-website-id +
   load 延迟注入检测），保持源码与审计一致。
4. **CSP 同步**：CSP 需同时存在于 `public/_headers` 与 `edgeone.json` 两处，
   `script-src` 与 `connect-src` 均含 `https://umami.pldduck.com`；
   增删 Umami 域名必须两处一起改。
5. **不混改统计**：不蒜子（busuanzi）只负责文章阅读量展示，与 Umami 是两套独立
   体系，改 Umami 时不得牵动 busuanzi 逻辑，反之亦然。

## 常见陷阱

- 把脚本 URL / 站点 ID 抽成变量或配置是常见误改方向——本项目明确要求写死；
- Umami 的共享看板 URL（`share/zWEt3cddtxLtAA0r`）是公开统计入口，改动后需同步
  更新 Stats 页按钮的 `href` 与 Stats.test.tsx 断言；
- 不得通过 `umami.track()` 等 API 增加条件上报逻辑——默认脚本按正常采集即可，
  本项目不设拒绝采集开关。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
