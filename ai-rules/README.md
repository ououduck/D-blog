# ai-rules — AI 修改规则总则

本目录为 D-blog 项目的 **AI 硬性约束集**：为每一个功能制定详细的修改规则，约束 AI 在修改代码、实现功能、调整文档时必须遵守的行为边界。

## 规则效力

- 本目录下所有 `*.md` 文档中的「修改规则」小节为**硬性约束**，AI 默认必须逐条遵守；
- 规则约束的对象包括：**实现功能、修改代码、修改本目录内的文档**；
- 任何与规则冲突的操作（含修改本目录文档本身）都属于「破例」。

## 破例流程（必须遵守）

当 AI 认为有必要打破某条规则时，必须执行以下流程：

1. **先说明、后行动**：向用户说明需要打破哪条规则、为什么要打破、破例后的影响与回退方案；
2. **等待授权**：在获得用户明确准许之前，**不得**开始任何相关修改；
3. **最小化破例**：获准后，破例改动应尽量缩小影响范围，并在 git 提交信息中注明「依据用户授权破例：<规则编号/条款>」；
4. **事后恢复**：如破例是临时的（如排查问题），完成后应恢复规则约束并说明。

> 用户的口头/文字明确准许是唯一授权方式；AI 不得自行推断授权、不得用「为了效率」「通常可以」等理由绕过破例流程。

## 与 AGENT.md 的关系

根目录 [AGENT.md](../AGENT.md) 是 AI 的总行为准则（工作方式、git 纪律、沟通语言等）；
本目录是**功能级技术规则**（每个功能可做什么、不可做什么、常见陷阱）。
两者冲突时，以更严格者为准；AGENT.md 的修改同样需要用户授权。

## 文档索引

### 前端页面
- [首页](home.md) · [文章详情页](post.md) · [归档页](archive.md) · [标签页](tags.md) · [搜索](search.md) · [统计页](stats.md) · [友链页](friends.md) · [说说](shuoshuo.md) · [留言板](guestbook.md) · [关于页](about.md) · [赞助页](sponsor.md) · [收藏页](favorites.md) · [404 页](not-found.md)
- [封面生成器](cover-generator.md) · [水印工具](watermark.md)

### 通用系统
- [布局与导航](layout-nav.md) · [主题系统](theme.md) · [评论系统（Giscus）](giscus-comments.md) · [离线收藏](offline-posts.md) · [Service Worker 离线缓存](service-worker.md) · [SEO 与结构化数据](seo.md) · [访问分析（Clarity）](clarity-analytics.md)

### 构建与自动化
- [构建与 SSG](build-ssg.md) · [站点数据生成](data-generation.md) · [内容校验](content-validation.md) · [文章外链死链检查](broken-links.md) · [友链机器人](friend-link-bot.md) · [Telegram 通知](telegram-notify.md) · [评论过滤与反垃圾](comment-moderation.md) · [CI/CD workflows](ci-cd.md) · [OG 分享卡片](og-card.md) · [RSS/Feed](feed.md)

### 工程
- [测试约定](testing.md) · [配置体系](config.md)
