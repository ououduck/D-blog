# 关于页（About）— AI 修改规则

## 功能概述

站点作者介绍：头像、简介、社交链接、RotatingText 词条轮换、Magnet 磁吸效果、Reveal 滚动揭示。

## 关键文件

- `src/pages/About.tsx`
- `src/components/effects/{RotatingText, Magnet, Reveal}.tsx`

## 修改规则（必须遵守）

1. **SSG 确定性**：RotatingText 首帧渲染第一段短语（无 JS 展示静态文本）；`staggerFrom='random'` 的随机锚点必须 useMemo 固化（渲染期禁止 Math.random）；reducedMotion 时跳过入场动画与自动轮换。
2. **动效组件通用性**：RotatingText/Magnet/Reveal 是通用组件（可能被其他页面使用），props 接口变更需向后兼容；`{...props}` 展开顺序必须保持在 className/style 之前（防覆盖）。
3. **内容**：关于文案在组件内（可含站点配置引用），不在独立配置文件。

## 常见陷阱

- Magnet 的 rAF 竞态（reset 必须 cancelAnimationFrame 挂起帧）；
- 动效组件的 reducedMotion 行为是跨页面契约，改动需全局验证。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
