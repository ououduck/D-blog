# 构建与 SSG — AI 修改规则

## 功能概述

构建流水线：数据生成 → OG 卡片 → 客户端构建 → SSR 构建 → 模板快照 → SSG 全量静态化 → 构建/SEO 双审计。`build.mjs` 是唯一入口，deploy 与 CI 共用同一构建源。

## 关键文件

- `scripts/build.mjs`（阶段编排、超时/总预算双控）
- `scripts/ssg.mjs`（SSG 渲染、Suspense 展平、路由数据注入、预算控制）
- `src/ssr-entry.tsx`（renderToPipeableStream + StaticRouter）
- `scripts/audit-build.mjs` / `seo-audit.mjs`
- `vite.config.ts` / `vite.ssr.config.ts`

## 修改规则（必须遵守）

1. **构建唯一入口**：deploy 与 CI 必须共用 `npm run build` 的同一流程，禁止出现两套构建漂移。
2. **SSG 失败语义**：单页渲染失败不中断整站（failedPages 汇总），全部完成后返回失败；预算（TOTAL_BUDGET_MS）超限跳过剩余页面 —— 此语义保持。
3. **Suspense 展平**：`flattenSuspenseBoundaries` 必须正确展平嵌套边界（真实内容就地内联，爬虫可读）。
4. **水合数据注入**：路由数据（ssg-route-data JSON）必须经转义注入（escapeJsonForHtml），防 script 注入。
5. **路径解析**：所有脚本基于 `__dirname` 解析仓库根（禁止依赖进程 cwd）；子进程显式传 cwd。
6. **阶段超时**：单阶段超时与总预算取较小者；失败必须结构化记录并给可诊断信息。
7. **审计门禁**：build 审计（JS/CSS 体积、必备标签）与 SEO 审计（0 错误）是构建门禁，不得绕过。

## 常见陷阱

- SSR 端 framer-motion 的 initial/animate 组合：SSR 输出应为可见态（animate 态），禁止把内容渲染成 opacity:0；
- ssr-entry 的渲染超时（30s）防止懒加载 chunk 永不 resolve 导致构建挂起；
- 修改 ssg.mjs 的 HTML 注入顺序会影响水合正确性（routeData script 必须在 root div 前）。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
