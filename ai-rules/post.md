# 文章详情页（Post）— AI 修改规则

## 功能概述

文章正文页：SSG 预渲染完整正文、Markdown 渲染（react-markdown + remark/rehype 插件）、代码块工具栏（复制/下载/行号/折叠）、Mermaid 图表（缩放/平移/主题同步）、阅读进度保存与恢复、目录 TOC 与锚点、相邻文章快捷键、分享/收藏、离线阅读。

## 关键文件

- `src/pages/Post.tsx`（约 2600 行，全站最大文件）
- `src/utils/headings-core.mjs` / `headings.ts`（标题提取/锚点 id，**构建端与客户端共享**）
- `src/utils/remarkCodeMeta.ts` / `markdown-core.mjs` / `markdownText.ts`
- `src/components/{TableOfContents, GiscusComments, ShareModal, ReadingProgressBadge, ProgressiveImage, ImageViewer}.tsx`
- `src/utils/readingProgress.ts`

## 修改规则（必须遵守）

1. **SSG 确定性**：正文、标题、阅读时长等全部锚定文章数据；渲染期禁用时钟/随机。
2. **TOC/锚点一致性**：DOM 标题 id 必须与构建端 `extractMarkdownHeadings` 输出的 id 一致；`resolveHeadingId` 的二次扫描必须跳过已占用 id（防重复 id）；修改 headings-core 时同步考虑 post-content-validator 与 TOC。
3. **竞态防护**：文章加载（cancelled）、Mermaid 渲染（cancelled）、阅读进度保存（节流 + 卸载守卫）、分享/复制（seq/generation）的既有防护不得移除。
4. **代码块**：行号折叠（MAX_CODE_LINES）保持惰性初始化；复制/下载走既有工具；代码内容不进行任何 HTML 注入（高亮由 rehype-highlight 处理）。
5. **Mermaid**：缩放必须矢量缩放（改 width 而非 transform: scale）；wheel 用原生非 passive 监听（否则页面同步滚动）；SVG 必须经 DOMPurify 净化（useMemo 缓存）；拖动用 rAF 节流。
6. **HTML 净化**：`dangerouslySetInnerHTML` 内容必须经 DOMPurify（含 KaTeX/Mermaid 注入）。
7. **阅读进度**：进度/恢复逻辑在 `readingProgress.ts`（start/end 阈值、clamp、完成阈值），不得在组件内重写公式。
8. **无障碍**：`role="application"` 仅限 Mermaid 视口容器（其确实接管键盘）；复制/分享按钮有可访问名称；快捷键有 kbd 提示。
9. **性能**：`stripMarkdown(post.content)` 结果必须 useMemo 缓存（meta description 与 articleBody 共用）；useMemo 不得放在条件早退之后（Hooks 规则）。

## 常见陷阱

- 标题含图片/公式时渲染文本与 rawText 不一致 → 锚点错位（按既有 usedHeadingIds 兜底）；
- 修改 headings-core 的正则会影响构建期校验（锚点链接校验）；
- Post.tsx 体量极大，新增逻辑优先抽到 utils/组件，避免继续膨胀。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
