# 布局与导航（Layout）— AI 修改规则

## 功能概述

全站外壳：头部导航（桌面下拉/移动抽屉）、主题切换按钮、移动端滑动抽屉手势、滚动进度/返回顶部、页脚、Cookie 提示条、Service Worker 更新提示、错误边界与 View Transitions 页面切换。

## 关键文件

- `src/components/Layout.tsx`（约 1350 行）
- `src/App.tsx`（路由 + 错误边界 + View Transitions）
- `src/components/{BackToTop, OfflineStatus, ServiceWorkerUpdatePrompt, CookieNotice, ReadingModeToggle}.tsx`
- `src/hooks/useModalOverlay.ts`（弹层栈/滚动锁/焦点陷阱，全局共享）

## 修改规则（必须遵守）

1. **弹层栈语义**：useModalOverlay 的 openOverlayStack/scrollLockCount 是全局共享状态（多层弹层叠加时只第一个锁滚动、最后一个恢复）；hasOpenOverlay 用于页面快捷键守卫 —— 全部不得破坏。
2. **View Transitions**：页面切换必须 try/catch 回退（已有活动 transition 时同步抛 InvalidStateError）；水合首帧 `hasViewTransition=false`。
3. **移动抽屉手势**：touchmove 非 passive 监听、滑动距离/阈值、scrollTop<=1 判定 —— 保持既有行为。
4. **监听器清理**：window/document 监听、计时器必须成对清理（含主题切换计时器）。
5. **Cookie 提示**：「同意」永久持久化（localStorage）、「关闭」会话级（sessionStorage）语义保持。
6. **返回顶部**：隐藏时同步 visibility/tabIndex 并主动 blur 焦点。
7. **SSG 确定性**：主题/网络状态先渲染默认态再在 effect 中纠正；getServiceWorkerState 只读模块变量。

## 常见陷阱

- 修改 Layout 的动画时序会影响 Layout.test（真实计时器等待）；
- 导航菜单项与路由表（App.tsx Routes）需同步维护；
- z-index 体系（z-nav/z-modal/z-floating 等）由 tailwind 配置定义，改动需全局评估遮挡关系。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
