# SEO 与结构化数据 — AI 修改规则

## 功能概述

全站 SEO：页面 title/description、robots、canonical、hreflang、Open Graph/Twitter 卡片、JSON-LD 结构化数据（Article/BlogPosting/CollectionPage/WebSite 等）、sitemap、RSS 自发现、SEO 构建期审计。

## 关键文件

- `src/components/Seo.tsx`（页面级 SEO 组件）
- `src/pages/Post.tsx`（文章 JSON-LD）等页面
- `scripts/ssg.mjs`（SSG 注入 SEO 头）
- `scripts/seo-audit.mjs`（构建期审计门禁）
- `scripts/generate-site-data.mjs`（sitemap/robots 生成）

## 修改规则（必须遵守）

1. **noindex 语义**：404/搜索/缺失页必须 noindex；可索引页必须 index,follow（token 级判断，不精确串匹配）。
2. **canonical**：必须为同源绝对 URL（origin 精确比较，禁止前缀比较被 evil.com 绕过）；参数化页面 canonical 自指保留参数。
3. **JSON-LD 转义**：结构化数据中的标题/描述/URL 必须正确转义（HTML 实体/引号），不得注入未净化文本。
4. **articleBody**：必须为纯文本（stripMarkdown 结果），长度截断（6000 字）保持。
5. **robots.txt/sitemap**：生成逻辑在 generate-site-data.mjs；robots.txt 用 LF 换行；sitemap URL 必须是绝对站点 URL。
6. **SEO 审计门禁**：seo-audit.mjs 是构建门禁（缺失 title/description/robots/canonical 即失败），新增页面必须满足全部检查项。

## 常见陷阱

- SSG 的 schemaFromSeo 标记（页面级 schema 由 Seo 组件输出 vs SSG 注入）双源机制不要混淆；
- 修改 Seo 组件会影响全部页面，改动后必须跑完整构建 + SEO 审计。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
