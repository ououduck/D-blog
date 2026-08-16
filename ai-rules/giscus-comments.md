# 评论系统（Giscus）— AI 修改规则

## 功能概述

Giscus 评论区（文章评论 + 留言板）：懒加载、多来源回退链（同源代理 → 官方）、超时重试、主题同步、评论数构建期快照。

## 关键文件

- `src/components/GiscusComments.tsx`
- `src/pages/Guestbook.tsx`（mapping=number）
- `scripts/fetch-giscus-comments.mjs`（构建期评论数快照）
- `config/site.config.json`（comments 段）

## 修改规则（必须遵守）

1. **回退链**：来源解析（resolveGiscusOrigins）保持「配置 origin → 官方兜底」有序回退；8s 单源超时 + 自动重试的既有机制不得移除。
2. **非法配置容错**：origin 配置非法（非 URL）时必须在来源解析阶段过滤并告警，禁止在 message 处理器中抛 TypeError 中断监听。
3. **成功判定兜底**：isLoaded 依赖 giscus postMessage；改动时需考虑 iframe load 兜底信号（防止占位常驻）。
4. **主题同步**：iframe 就绪前丢弃的 postMessage 需要补发机制（主题切换后同步）。
5. **mapping 语义**：pathname（文章自动建讨论）/ number（留言板精确锁定）语义不可混淆；缺 term 时禁止静默注入。
6. **构建期评论数**：fetch-giscus-comments 用 fetchWithRetry（防抖动），失败优雅降级（不阻塞构建）。
7. **BASE_PATH 匹配口径**：discussion 标题（页面 URL pathname）与文章路由匹配必须叠加 BASE_PATH（withBasePath）—— 子路径部署时硬编码 `/post/<id>` 匹配不上，评论数会静默全缺。

## 常见陷阱

- 大陆网络下 giscus.app 可能被 DNS 污染：回退链与超时是核心体验保障；
- 评论数快照写入 post 数据（commentCount），改动生成逻辑需同步 SSG 数据流。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
