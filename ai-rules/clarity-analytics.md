# Clarity 访问分析（index.html）— AI 修改规则

## 功能概述

Microsoft Clarity（项目 ID：`yk9n836sio`）通过 `index.html` 中的官方异步脚本接入，用于访问行为分析；不蒜子仅负责文章阅读量展示。

## 关键文件

- `index.html` — Clarity 官方标签的唯一注入位置，项目 ID 直接写在标签中
- `public/_headers` / `edgeone.json` — CSP 同步放行 Clarity 脚本与数据上报域名
- `scripts/audit-build.mjs` — 构建审计 Clarity 脚本 URL、项目 ID 和 CSP
- `src/components/CookieNotice.tsx` — 访问分析隐私提示

## 修改规则（必须遵守）

1. **使用官方标签**：Clarity 脚本保持官方异步注入形态，项目 ID 为 `yk9n836sio`。
2. **唯一入口**：统计脚本只在 `index.html` 注入，不在 React 组件、配置文件或环境变量中重复维护。
3. **同步审计**：修改脚本 URL、项目 ID或注入形态时，同步更新 `scripts/audit-build.mjs`。
4. **CSP 同步**：`public/_headers` 与 `edgeone.json` 必须一起更新，`script-src` 放行 `https://www.clarity.ms`，`connect-src` 放行 Clarity 上报域名。
5. **不混改统计**：不蒜子仅负责文章阅读量，改动 Clarity 时不得牵动 `src/services/busuanzi.ts`。
6. **统计页不设入口**：`src/pages/Stats.tsx` 不展示 Clarity 外部卡片或控制台链接。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须先向用户说明理由并请求授权；在获得用户明确准许之前，不得违反规则实现功能或修改本文件。
