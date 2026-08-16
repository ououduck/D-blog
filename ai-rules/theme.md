# 主题系统（Theme）— AI 修改规则

## 功能概述

亮/暗/跟随系统三态主题：localStorage 持久化、系统媒体查询监听、主题切换动画（View Transition 或 class 过渡）、阅读模式。

## 关键文件

- `src/components/Layout.tsx`（主题逻辑段）
- `src/components/ReadingModeContext.tsx` / `ReadingModeToggle.tsx`
- `src/hooks/{useMediaQuery, useReducedMotion}.ts`
- `tailwind.config.js`（darkMode: 'class'）

## 修改规则（必须遵守）

1. **darkMode 实现**：`dark:` 变体基于 `<html>` 的 dark class；不得改为媒体查询模式（与现有 class 策略冲突）。
2. **SSR/水合**：首帧渲染默认态（无 dark class），水合后 effect 中应用已保存主题；`document.startViewTransition` 必须 try/catch 回退。
3. **持久化**：`localStorage.theme` 存 'light'|'dark'|'system'；存储不可用时静默降级（不影响功能）。
4. **系统跟随**：system 模式下监听 `prefers-color-scheme` 变化并实时切换（含跨标签页）。
5. **阅读模式**：ReadingModeContext 的栈式 Escape 守卫（ESC 栈顶退出）保持。

## 常见陷阱

- 主题切换计时器（theme-switching class 过渡）必须清理；
- 全站动效（motion.ts 的 easeOut/easeSmooth）与 reducedMotion 是跨组件契约。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
