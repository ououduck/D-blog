# 质量、性能与安全基线

## 质量门禁

所有提交前必须通过：

- `npm run typecheck` — TypeScript 无类型错误
- `npx eslint .` — ESLint 无错误
- `npm test` — 全量 Vitest 单测（当前 88 个测试文件 / 679 用例）
- 涉及构建逻辑的改动：`npm run build`（含构建审计 + SEO 审计）

CI（`.github/workflows/ci.yml`）与本地保持一致，避免“本地过、CI 挂”。

## 测试约定

- `src/` 测试运行在 jsdom；`scripts/` 测试文件头部必须声明 `// @vitest-environment node`。
- 断言必须真实行为验证，禁止恒真断言。
- 修复 bug 必须补回归测试，覆盖失败分支（存储不可用、加载失败、竞态、边界输入）。
- mock 必须使用 `vi.hoisted` 避免 TDZ，测试后恢复全局。
- 页面测试使用固定非空数据集，避免空数据导致行为零覆盖。
- 覆盖率门槛：stmts/lines/funcs 50，branches 45（见 `vitest.config.ts`）。

## 性能基线

- 渲染期避免重复计算：派生数据走 `useMemo`/模块级缓存。
- 大列表/卡片使用稳定 key；`PostCard` 保持 `React.memo`。
- 高频事件（pointermove/scroll/wheel/touchmove）使用 rAF 节流或非 passive 监听。
- 搜索、导出、批量任务使用 requestId/generation/cancelled 等竞态防护，并 `yieldToBrowser` 让出主线程。
- 封面预览的模糊层 canvas 惰性重建；字体适配循环必须有界。
- 友链域名解析、Markdown 剥离、数字格式化等昂贵结果按需缓存。

## 无障碍基线

- 交互元素必须有可访问名称；图标按钮提供 `aria-label`。
- 弹层必须有焦点管理（打开聚焦、关闭归还焦点）；动态内容有 `aria-live` 或等效播报。
- 同一卡片封面与标题两个链接指向同一 URL 时，封面链接 `aria-hidden + tabIndex={-1}`。
- 不嵌套 `<main>`；Mermaid 的 `role="application"` 仅限视口容器。
- 动效尊重 `prefers-reduced-motion`。

## 安全基线

- 用户可控 URL 发请求前必须 `isSafePublicHttpUrl`（SSRF 防护）。
- 日志不得输出密钥（Telegram token、Akismet key）；用户可控文本发到 Telegram 必须转义。
- `dangerouslySetInnerHTML` 内容必须经 DOMPurify 净化。
- 构建期注入 HTML 的数据必须转义（`escapeJsonForHtml`）。
- 外部链接 `target="_blank"` 必须 `rel="noopener noreferrer"`。
- 存储读取的不可信数据必须校验后再使用。

## 文档与规则

- 行为规则：`AGENT.md` + `ai-rules/`（硬性约束）。
- 技术说明：`ai-doc/`（本文档目录）。
- 修改 `ai-rules/` 或 `AGENT.md` 需用户明确授权；破例必须在提交信息注明。
