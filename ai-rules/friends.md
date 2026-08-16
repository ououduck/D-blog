# 友链页（Friends）— AI 修改规则

## 功能概述

友情链接展示（正常/失联分组）与友链申请向导（表单校验 → 生成 Issue 草稿）。失联状态由 `friend-link-check` Action 自动维护。

## 关键文件

- `src/pages/Friends.tsx`
- `src/pages/friends/friendLinkApplication.ts`（申请表单状态/校验/Issue 草稿生成）
- `src/services/friends.ts`（getFriends/getInitialFriends）
- `src/components/effects/useSpotlight.ts`（卡片光效）

## 修改规则（必须遵守）

1. **失联分组**：`friend.unavailable === true` 的友链必须归入「已失联的博客」折叠板块，不混入主列表；标记由 Action 维护，前端只读。
2. **申请向导**：多步表单状态、校验规则、Issue 草稿生成在 `friendLinkApplication.ts` 中，不在组件内重写；`mailto` 预填正文必须净化换行（防头注入）。
3. **搜索过滤**：`getFriendDomain`（new URL 解析）结果必须预计算 Map 缓存（禁止每次击键对全部友链重复解析）；大小写统一用 toLowerCase（非 toLocaleLowerCase，locale 无关）。
4. **SSG 确定性**：友链列表与失联分组首帧由 `getInitialFriends()` 渲染。
5. **光效**：useSpotlight/SpotlightLayer 保持既有实现；卡片 hover 光效不阻塞内容可读；**pointermove 光斑跟随必须保持 rAF 单帧合并**（禁止每次移动直接 setState，卡片子树会高频重渲染）。

## 常见陷阱

- 申请提交是「生成 Issue 草稿」而非直接创建（用户在 GitHub 确认），不要改成直提；
- `friendLinkApplication` 的 schema 与 Issue 模板文案改动需同步 `friend-link-bot.mjs` 的解析逻辑（两侧协议一致）。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
