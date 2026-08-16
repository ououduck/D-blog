# AGENT.md — D-blog 的 AI 开发者行为准则

本文件约束所有参与 D-blog 仓库工作的 AI 开发者（含代码审查、功能实现、bug 修复、文档维护、脚本编写等全部工作形态）。**修改本文件需用户明确授权。**

## 一、最高约束：功能规则集

- 仓库根目录 [`ai-rules/`](ai-rules/README.md) 为每个功能制定了详细的修改规则（硬性约束）。
- AI 在修改任何功能前，**必须先阅读对应的 ai-rules/\*.md**，并逐条遵守其中的「修改规则」。
- **破例必须请求授权**：当 AI 认为有必要打破任何规则（含修改 ai-rules/ 目录内的文档）时，必须先向用户说明理由并请求准许；**未获明确准许前不得动手**。获准后须在提交信息中注明「依据用户授权破例」。

## 二、项目身份与工作方式

- 项目：D-blog（React 19 + Vite 6 + TypeScript 的 SSG 静态博客，客户端 SPA 水合；Node 构建脚本为 ESM .mjs）。
- 沟通语言：与用户使用**中文**交流；git 提交信息使用**中文**。
- 每完成一个小任务提交一次 git，**只 commit 不 push**（除非用户明确要求推送）。
- 提交前必须通过：`npm run typecheck`、`eslint`、相关单测；涉及构建逻辑的改动需 `npm run build` 验证。
- 用户说「继续」时持续工作；用户没有喊停前不要自行停止。

## 三、技术硬性约束（全仓库通用）

1. **SSG/水合确定性**：任何组件在渲染期不得依赖当前时钟、随机值或客户端专属 API（`Date.now()`、`Math.random()`、`window`/`document` 等）；日期类 UI 必须锚定数据字段（如 `date`/`updatedAt`），渲染期访问客户端 API 需 useEffect 守卫。
2. **UI/主题/功能不变**：除用户明确要求的改动外，不得改变页面 UI、主题样式与既有功能行为。
3. **错误处理**：网络/存储/解析类操作必须有 try/catch 兜底；「失败」必须如实反馈（返回 null/false 或抛错），禁止静默假装成功。
4. **竞态防护**：异步操作（加载、导出、复制、搜索）必须处理竞态（generation/requestId/cancelled/mountedRef 等既有模式），卸载后不 setState。
5. **资源清理**：事件监听器、定时器、IntersectionObserver/ResizeObserver、订阅必须成对清理。
6. **无障碍**：交互元素有可访问名称；弹层有焦点管理；动态内容有 aria-live 或等效播报；不嵌套 `<main>`。
7. **日志安全**：日志不得输出密钥（Telegram token、Akismet key 等）；对用户可控文本做净化，防 Actions 命令注入；输出用户可控 URL 前必须脱敏（`sanitizeUrlForLogs`，URL 可能含 userinfo 凭据）。
8. **安全**：对用户可控 URL 发起请求前必须做 SSRF 防护（复用 `scripts/lib/http.mjs` 的 `isSafePublicHttpUrl`）；**重定向必须手动逐跳跟随并重新校验**（`redirect: 'manual'`，公开站点可 302 到内网/回环地址形成跳转绕过），重定向超限判失败（防环）。
9. **性能**：渲染期避免重复计算（useMemo/缓存）；事件高频路径（pointermove/scroll）用 rAF 节流；大列表用稳定 key。
10. **测试**：修复 bug 必须补回归测试；新增逻辑补充单测；测试断言必须有真实行为验证（不得恒真）。
11. **入口守卫**：Node 脚本（scripts/*.mjs）的 main() 只在作为主模块直接运行时执行（`import.meta.url === pathToFileURL(process.argv[1]).href` 判定），被 import 时不得触发网络/写文件副作用。
12. **HTML 结构合法**：交互元素遵循内容模型（`<button>` 内不嵌套标题等 flow content；`<ol>` 直接子元素只允许 `<li>`）；弹层关闭态必须移出可访问性树（`visibility: hidden` 或条件渲染，不能只靠 opacity/pointer-events）。

## 四、目录约定

- `src/` 前端源码（components/pages/hooks/services/utils/ssr）；
- `scripts/` 构建与自动化脚本（Node ESM），共享库在 `scripts/lib/`；
- `ai-rules/` 功能规则集（见第一节）；
- `config/` 构建配置与站点配置（`site.config.json` 等）；
- 跨 src/scripts 共享的剥离/提取核心：`src/utils/*-core.mjs`，改动需同时考虑两端调用方。

## 五、验证清单（提交前自查）

- [ ] 已阅读并遵守相关 ai-rules/*.md
- [ ] `npm run typecheck` 通过
- [ ] `npx eslint .` 无错误
- [ ] 相关单测通过（全量 `npm test` 不回归）
- [ ] 构建相关改动已 `npm run build` 验证
- [ ] 提交信息中文、粒度为一个逻辑任务、未 push

## 六、免责与授权

本文件与 `ai-rules/` 的效力来源于用户对 D-blog 仓库的治理意愿。用户保留随时修改、增删任何规则的权力；AI 对规则的理解冲突时，以用户当面的明确指示为准。
