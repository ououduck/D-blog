# 离线收藏（OfflinePosts）— AI 修改规则

## 功能概述

文章离线收藏与离线阅读：IndexedDB 主存储 + localStorage 降级镜像、墓碑删除、跨页同步、离线正文渲染。

## 关键文件

- `src/services/offlinePosts.ts`（约 850 行：存储拓扑/校验/同步）
- `src/hooks/useOfflinePosts.ts`
- `src/pages/Favorites.tsx` / `Post.tsx`（收藏入口）

## 修改规则（必须遵守）

1. **存储拓扑**：IndexedDB 为主、localStorage 为降级镜像的层次**不得反转**；墓碑（tombstone）与 `reconcileStores`（localStorage 墓碑并入 IDB）逻辑不得移除。
2. **读路径不回写**：`writeFallbackPosts` 快照去重保持（仅内容变化时写），禁止恢复每次读取全量回写。
3. **数据校验**：从存储读出的不可信数据必须经 `validateOfflinePost` 校验（版本/字段/时间戳），不得直接信任。
4. **StrictMode**：useOfflinePosts 的 mountedRef 必须在 effect setup 复位。
5. **同步**：跨标签页订阅（subscribeOfflinePosts）与 navigator.locks 串行化保持。

## 常见陷阱

- 大字段（正文/封面）序列化成本高，读路径任何新增写入都属性能回归；
- localStorage 被禁用时 IndexedDB 仍是权威数据源（try/catch 边界）。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
