# RSS/Feed — AI 修改规则

## 功能概述

构建期生成 RSS 2.0 feed（`public/feed.xml`）：文章条目（标题/链接/摘要/全文或摘要模式/日期/分类）、站点元信息、与 sitemap/llms 数据同源。

## 关键文件

- `scripts/feed-generator.mjs` / `scripts/feed-markdown.mjs`
- `scripts/generate-site-data.mjs`（feed 生成入口）

## 修改规则（必须遵守）

1. **XML 转义**：feed 内所有用户可控文本（标题/摘要/正文片段/作者）必须完整 XML 转义（& < > " '），禁止注入。
2. **URL 口径**：条目链接与站点 URL 必须为绝对地址，base path 正确拼接。
3. **日期格式**：条目 pubDate 必须为 RSS 规范格式（RFC 822）；无效日期容错。
4. **摘要/全文模式**：既有内容模式（摘要 vs 全文）语义保持；Markdown → 纯文本/HTML 的转换复用共享剥离核心。
5. **数据同源**：feed 条目来自 generated posts 数据，不得单独解析 posts/*.md（避免双源漂移）。

## 常见陷阱

- 修改 feed-markdown 的正文转换会影响 feed 正文模式与 llms 生成；
- 更新 feed 需与 sitemap 的 URL 集合保持一致。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
