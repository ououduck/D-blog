# Service Worker 离线缓存 — AI 修改规则

## 功能概述

PWA Service Worker：页面/静态资源/图片分级缓存、断网离线渲染（页面缓存 → 应用壳 → IndexedDB 正文）、更新提示与强制刷新。

## 关键文件

- `public/sw.js`（或生成位置）
- `src/registerServiceWorker.ts`
- `src/components/ServiceWorkerUpdatePrompt.tsx`

## 修改规则（必须遵守）

1. **缓存策略分级**：页面/静态资源/图片的缓存优先级与过期策略保持既有分层，不得统一粗暴缓存。
2. **更新语义**：SW 更新 → waiting → SKIP_WAITING → controllerchange 单次刷新的状态机保持；updateRequested 失败路径必须复位。
3. **作用域**：SW 作用域跟随部署路径（含子路径部署）；`./` 相对 base 推断逻辑保持。
4. **SSR 安全**：注册逻辑在客户端执行（typeof navigator 守卫），SSG 不触发。
5. **版本化**：资源 URL 带哈希（vite 构建产物），缓存清理策略与构建 hash 联动。

## 常见陷阱

- SW 更新死循环（每次刷新都提示更新）是常见回归，改动更新逻辑必须验证；
- 断网离线路径（页面缓存 → 应用壳）覆盖 SPA 路由，改动路由表必须同步 `SPA_ROUTE_PATTERNS`。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
