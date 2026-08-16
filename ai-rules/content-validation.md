# 内容校验（post-content-validator）— AI 修改规则

## 功能概述

文章内容构建期校验：Markdown 链接/图片解析（含行号）、站内路由与锚点目标校验、本地图片文件存在性校验；作为 gen:data 的一部分 fail-closed 阻断错误内容进入构建。

## 关键文件

- `scripts/post-content-validator.mjs`
- `src/utils/headings-core.mjs`（maskFencedCodeBlocks 等共享正则）

## 修改规则（必须遵守）

1. **代码块屏蔽**：围栏/缩进代码块与行内代码（`...` / `...`）中的括号结构**必须**在链接解析前屏蔽（讲解 Markdown 语法的文章会被误杀，这是已修过的真实事故）。
2. **行号准确**：校验错误必须带真实文件行号，便于作者定位。
3. **锚点校验口径**：校验构建端 headingIds 时，与客户端 TOC 的 id 生成必须同源（headings-core）。
4. **fail-closed**：校验错误必须阻止构建（配合 generate-site-data），禁止静默放行。
5. **外链 vs 站内**：站内路由/锚点与外部 URL 的分类判定保持既有规则（不校验外部 URL 可达性，那是 check-broken-links 的职责）。

## 常见陷阱

- 修改 maskFencedCodeBlocks（headings-core）会影响标题提取与锚点 id —— 必须全量回归；
- 校验通过后 generate-site-data 会继续消费解析结果，两者字段契约一致。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
