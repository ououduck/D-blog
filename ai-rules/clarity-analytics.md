# Clarity 访问分析（index.html）— AI 修改规则

## 功能概述

Microsoft Clarity（项目 ID：`wloc3f723i`）通过 `index.html` 中的内联标签注入，
用于会话录制与行为分析（与不蒜子的访问量展示互补）。标签在页面解析时立即异步注入，
不等待 `window load`。

## 关键文件

- `index.html` — 标签注入的唯一位置（项目 ID 与注入代码写死于此）
- `public/_headers` / `edgeone.json` — CSP：`script-src` 放行 `https://www.clarity.ms`
  `https://scripts.clarity.ms`，`connect-src` 放行 `https://*.clarity.ms`
- `scripts/audit-build.mjs` — 构建审计断言 Clarity 标签存在且为「解析即异步注入」
  （检测到延迟注入模式即构建失败）

## 修改规则（必须遵守）

1. **写死，不拆配置**：Clarity 项目 ID（`wloc3f723i`）与注入代码必须直接写死在
   `index.html` 内联脚本中，**不得**拆到 `config/site.config.json`、环境变量或任何
   其他配置文件。统计代码属于页面模板层，不参与站点内容配置。
2. **注入时机**：标签必须在页面解析时立即异步注入（`t.async = 1`，标准 Microsoft
   标签形态），**不得**推迟到 `window load` 事件——延迟注入会漏掉快速离开或
   首屏即交互的会话（漏记录）。历史「等 load 再注入」的实现是明确要避免的。
3. **同步审计**：修改注入代码（时机/URL/形态）时，必须同步更新
   `scripts/audit-build.mjs` 的 Clarity 断言（标签 URL + 无 load 延迟注入），
   保持源码与审计一致。
4. **CSP 同步**：CSP 需同时存在于 `public/_headers` 与 `edgeone.json` 两处，
   `script-src` 含 `https://www.clarity.ms`、`https://scripts.clarity.ms`，
   `connect-src` 含 `https://*.clarity.ms`；增删 Clarity 域名必须两处一起改。
5. **不混改统计**：不蒜子（busuanzi）的访问量展示与 Clarity 是两套独立体系，
   改 Clarity 时不得牵动 busuanzi 逻辑，反之亦然。

## 常见陷阱

- 把项目 ID 抽成变量/配置是常见误改方向——本项目明确要求写死；
- 审计脚本的旧断言（`c.addEventListener('load', inject`）已随延迟注入一起移除，
  改回延迟注入会导致构建审计失败，这是刻意设计而非缺陷；
- 不要通过 `clarity('consent', false)` 等 API 增加条件注入——本项目要求始终记录。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
