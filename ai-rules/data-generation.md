# 站点数据生成（generate-site-data）— AI 修改规则

## 功能概述

构建期生成全部站点数据：`generated/posts.json`、`generated/shuoshuo.json` 等（前端 services 消费）、sitemap（页面/图片/索引）、robots.txt、RSS/feed、llms.txt/llms-full.txt；同时校验文章 front matter 与内部链接/本地图片引用。

## 关键文件

- `scripts/generate-site-data.mjs`（约 1100 行）
- `scripts/post-content-validator.mjs`（内容校验）
- `scripts/feed-generator.mjs` / `feed-markdown.mjs`
- `src/services/*`（消费 generated JSON）

## 修改规则（必须遵守）

1. **前端契约**：`generated/posts.json` 的字段结构被 src/services 直接消费，增删字段必须同步更新前端类型与消费方。
2. **fail-closed**：front matter 校验失败、输出写入失败必须非零退出阻断构建（禁止带缺文件件继续）。
3. **草稿语义**：`draft: true` 的文章跳过内容校验但不出现在发布列表（既有用户确认的行为）。
4. **URL 口径**：sitemap/RSS/OG 的 URL 必须为绝对站点 URL（siteAbsoluteUrl），base path 正确拼接。
5. **robots.txt**：LF 换行（与 .gitattributes eol=lf 一致），sitemap 引用绝对地址。
6. **产物计数**：summary 的 outputs 从 generated//public/ 实际统计（禁止硬编码）。
7. **共享核心**：front matter 剥离（markdown-core.mjs）、标题提取（headings-core.mjs）是 src/scripts 共享模块，改动必须两端一致。

## 常见陷阱

- 修改 front matter 字段解析会影响全部文章数据（日期/分类/tags 等）；
- 校验器对代码块/行内代码内的伪链接已做屏蔽，新增解析规则要保持该屏蔽（防构建误杀）；
- 图片引用校验（posts-img 本地路径）与外部图床 URL 的处理口径不要混淆。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
