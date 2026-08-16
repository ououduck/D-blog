# 收藏页（Favorites）— AI 修改规则

## 功能概述

离线收藏文章列表：IndexedDB 主存储 + localStorage 降级镜像、收藏/取消收藏、收藏状态同步。

## 关键文件

- `src/pages/Favorites.tsx`
- `src/services/offlinePosts.ts`（存储拓扑/墓碑/同步）
- `src/hooks/useOfflinePosts.ts`

## 修改规则（必须遵守）

1. **存储拓扑**：IndexedDB 为主、localStorage 为降级镜像；墓碑（tombstone）机制与 `reconcileStores` 同步逻辑不得移除（并发保存/删除的正确性依赖它）。
2. **读路径不回写**：`writeFallbackPosts` 只在内容变化时写（快照去重），禁止恢复「每次读取全量回写」。
3. **mountedRef/StrictMode**：卸载守卫必须在 effect setup 中复位（StrictMode 双挂载下收藏功能不能失效）。
4. **链接无障碍**：同一卡片封面与标题两个链接指向同一 URL，封面链接必须 `aria-hidden + tabIndex={-1}`（避免读屏重复播报）。
5. **SSG 确定性**：收藏列表是纯客户端数据，SSG 不预渲染收藏内容。

## 常见陷阱

- `offlinePosts` 被 Post/Home/Search/PostCard 等多处使用，改签名影响面大；
- localStorage 镜像与 IndexedDB 数据一致性由「墓碑 + 快照」保证，改动需全量测试。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
