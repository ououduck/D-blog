# 统计页（Stats）— AI 修改规则

## 功能概述

站点数据面板：概览卡片（文章数/字数/评论等）、GitHub 风格写作日历热力图、分类/标签/字数/图片排行、外部统计链接（不蒜子/Busuanzi）。

## 关键文件

- `src/pages/Stats.tsx`
- `src/components/WritingCalendar.tsx`（写作日历热力图）
- `src/services/siteStats.ts` / `busuanzi.ts`
- `src/services/posts.ts`（getInitialPosts 提供文章日期）

## 修改规则（必须遵守）

1. **SSG/水合确定性**：写作日历窗口**必须锚定「最近发布日期」而非「今天」**（构建与客户端水合数据一致）；月份标签节距必须与单元格实际尺寸联动（移动端 14px / sm+ 16px，用 CSS 变量，禁止写死单值导致移动端漂移）。
2. **数据源**：统计值来自 `getInitialSiteStats()`（构建期内联）与 `getInitialPosts()`；异步加载仅作兜底，不得作为主路径。
3. **数字格式化**：`Intl.NumberFormat('zh-CN')` 必须是模块级单例；NaN/Infinity 显示占位符「—」。
4. **动画**：CountUp 尊重 prefers-reduced-motion（SSR 首帧渲染最终值）；柱状图 width 动画进入视口触发，不得影响首帧可读性。
5. **布局**：站点概览 → 写作日历 → 分类/标签/最近更新三列 → 字数/图片两列 → 外部统计；新增板块需与既有栅格协调。

## 常见陷阱

- WritingCalendar 的 aria-label 汇总（总篇数/活跃天数）是读屏主要信息来源，改动计数逻辑要同步更新；
- 日历颜色分级（LEVEL_CLASSES）与图例必须保持一致。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
