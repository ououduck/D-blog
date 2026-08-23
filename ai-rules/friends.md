# 友链页（Friends）— AI 修改规则

## 功能概述

友情链接展示（正常/失联分组）与友链申请入口（两步向导：① 展示本站信息引导添加友链 → ② 跳转外部在线表单 `siteConfig.friendsPage.applyUrl` 提交申请/修改，Tally 表单）。失联状态由站长在 Pages CMS「友链」集合手动维护（勾选「已失联」写入 `unavailable: true`）；未配置时默认视为正常。

## 关键文件

- `src/pages/Friends.tsx`
- `src/services/friends.ts`（getFriends/getInitialFriends）
- `src/components/effects/useSpotlight.ts`（卡片光效）

## 修改规则（必须遵守）

1. **失联分组**：`friend.unavailable === true` 的友链必须归入「已失联的博客」折叠板块，不混入主列表；标记由站长在 Pages CMS 手动维护，前端只读。
2. **申请入口**：申请/修改友链统一跳转 `siteConfig.friendsPage.applyUrl`（Tally 外部表单），按钮 `target="_blank" rel="noopener noreferrer"`；两步向导的步骤状态（`currentApplicationStep`）与本站信息卡（`siteInfo`）保留在组件内，不得引入 GitHub Issue/表单逻辑。
3. **搜索过滤**：`getFriendDomain`（new URL 解析）结果必须预计算 Map 缓存（禁止每次击键对全部友链重复解析）；大小写统一用 toLowerCase（非 toLocaleLowerCase，locale 无关）。
4. **SSG 确定性**：友链列表与失联分组首帧由 `getInitialFriends()` 渲染。
5. **光效**：useSpotlight/SpotlightLayer 保持既有实现；卡片 hover 光效不阻塞内容可读；**pointermove 光斑跟随必须保持 rAF 单帧合并**（禁止每次移动直接 setState，卡片子树会高频重渲染）。

## 常见陷阱

- 友链申请已改为外部表单跳转，GitHub Action bot 与客户端 Issue 草稿逻辑已移除；不要恢复 Issue 流程。
- `friend.unavailable` 标记只读自 `friends/*.json`（Pages CMS 维护），前端不得写入。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
