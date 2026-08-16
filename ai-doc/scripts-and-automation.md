# 脚本与自动化体系

D-blog 的构建与自动化全部使用 Node ESM（`.mjs`），分为构建脚本、站点数据生成、内容校验、部署辅助与 GitHub Actions 自动化。

## 构建脚本

| 脚本                          | 职责                                                                  |
| ----------------------------- | --------------------------------------------------------------------- |
| `scripts/build.mjs`           | 唯一生产构建入口：串联数据生成、OG 卡、客户端/SSR 构建、SSG、双审计   |
| `scripts/ssg.mjs`             | SSG 全量静态化：渲染每个路由、注入 routeData、Suspense 展平、预算控制 |
| `scripts/ssg-data-loader.mjs` | 加载 `generated/*.json` 供 SSG 路由数据构造使用                       |
| `scripts/audit-build.mjs`     | 构建产物完整性审计（JS/CSS 体积、必备标签、_headers 等）              |
| `scripts/seo-audit.mjs`       | 全站 SEO 审计（title/description/robots/canonical 等）                |
| `scripts/build-logger.mjs`    | 构建阶段日志与耗时统计                                                |

## 数据生成与内容校验

| 脚本                                               | 职责                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `scripts/generate-site-data.mjs`                   | 扫描 `posts/`、`friends/`、`shuoshuo/`，生成 `generated/*.json`、sitemap、robots、feed、llms |
| `scripts/post-content-validator.mjs`               | Markdown 链接/图片/站内路由/锚点/本地图片校验，fail-closed                                   |
| `scripts/feed-generator.mjs` / `feed-markdown.mjs` | 生成 RSS/feed，Markdown → 纯文本/HTML 转换                                                   |
| `scripts/fetch-giscus-comments.mjs`                | 构建期抓取 Giscus 评论数快照，失败优雅降级                                                   |
| `scripts/generate-og-card.mjs`                     | 基于 `public/logo.png` 生成 1200×630 OG 分享卡                                               |

## 自动化脚本

| 脚本                                  | 职责                                                              |
| ------------------------------------- | ----------------------------------------------------------------- |
| `scripts/telegram-notify.mjs`         | GitHub 事件 → Telegram 推送（评论/Issue/push/workflow 结果）      |
| `scripts/lib/telegram.mjs`            | Telegram 发送共享库（转义、截断、重试、错误提示）                 |
| `scripts/akismet-comment-check.mjs`   | Akismet 反垃圾判定 + GraphQL 处理                                 |
| `scripts/comment-keyword-filter.mjs`  | 评论关键词过滤（命中即 minimize/delete）                          |
| `scripts/comment-keyword-recheck.mjs` | 历史评论全量复查                                                  |
| `scripts/lib/keyword-filter-core.mjs` | 关键词匹配核心（与脚本共享）                                      |
| `scripts/friend-link-bot.mjs`         | 友链申请自动审核：反链校验、冷却、创建 `friends/*.json`、推送部署 |
| `scripts/friend-link-check.mjs`       | 友链可用性检查，维护 `unavailable` 标记                           |
| `scripts/check-broken-links.mjs`      | 扫描文章外链死链并上报 Telegram                                   |
| `scripts/migrate-images-picgo.mjs`    | 批量迁移本地图片到图床（PicGo）                                   |

## 共享库

| 文件                                  | 内容                                                                       |
| ------------------------------------- | -------------------------------------------------------------------------- |
| `scripts/lib/http.mjs`                | `fetchWithRetry`、超时/错误分类、`isSafePublicHttpUrl` SSRF 防护、日志脱敏 |
| `scripts/lib/telegram.mjs`            | Telegram 消息发送共享能力                                                  |
| `scripts/lib/gh-actions-logger.mjs`   | GitHub Actions 友好日志/分组/注解                                          |
| `scripts/lib/keyword-filter-core.mjs` | 评论关键词匹配核心                                                         |
| `scripts/lib/env.mjs`                 | 环境变量读取与数值解析                                                     |
| `scripts/site-config-loader.mjs`      | 站点配置 fail-closed 加载                                                  |

## 注意事项

- 所有脚本基于 `__dirname`/`import.meta.url` 解析仓库根，禁止依赖进程 cwd。
- 对用户可控 URL 发请求前必须使用 `isSafePublicHttpUrl`（SSRF 防护）。
- 脚本被 import 时不得执行 `main()`，入口判定使用 `pathToFileURL` 比较。
- 新增 workflow 必须同步 `telegram-notify.yml` 的 `workflow_run` 白名单。
- 详细规则见 `ai-rules/` 下对应文档（`build-ssg.md`、`data-generation.md`、`broken-links.md`、`telegram-notify.md`、`friend-link-bot.md`、`comment-moderation.md` 等）。
