# 配置体系（config）— AI 修改规则

## 功能概述

站点/构建/内容配置分层：`config/site.config.json`（站点信息，CMS 可编辑）、`config/content.config.json`（分类白名单等）、构建配置（tsconfig/tailwind/postcss/vite）、环境变量（.env.example）。

## 关键文件

- `config/site.config.json` + `scripts/site-config-loader.mjs`（fail-closed 加载）
- `config/content.config.json`
- `config/tsconfig.json` / `tailwind.config.js` / `postcss.config.js`
- `vite.config.ts` / `vite.ssr.config.ts` / `vitest.config.ts`
- `.env.example`（环境变量文档）

## 修改规则（必须遵守）

1. **fail-closed**：site.config.json 缺失/损坏/URL 非法时构建必须抛错中止（禁止静默回退默认值）。
2. **CMS 字段白名单同步**：.pages.yml 的 siteConfig fields 必须与 site.config.json 实际键一一对应（缺字段 CMS 保存会静默丢字段）。
3. **环境变量文档化**：脚本实际读取的每个环境变量必须在 .env.example 中注释说明（含默认值/语义/CI vs 本地）；数值型变量支持显式 0（parseEnvNumber 语义）。
4. **构建配置**：修改 tsconfig/vite/tailwind 需全量回归（typecheck + 构建 + 测试）；启用的严格项不得擅自关闭。
5. **路径别名**：`@/*`（src）、`@config/*`（config）语义保持，新增目录不得引入新别名。
6. **依赖升级**：安全相关升级（如 react-router 修复 CVE）优先；major 升级需全量验证并评估迁移成本。

## 常见陷阱

- config/ 根目录（构建配置）与 src/config（已删除）勿混淆；
- site.config.json 的 author/social/comments 等嵌套结构被多处消费，增删字段需全局检索消费方。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
