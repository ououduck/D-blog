# 封面生成器（CoverGenerator）— AI 修改规则

## 功能概述

在线封面生成器：文字/图标/背景配置、画布预览与导出（PNG/JPEG 多倍率）、模板与尺寸预设、草稿自动保存、自定义预设（localStorage）、批量导入（Markdown/CSV/JSON）与 ZIP 导出、Iconify 图标搜索、自动文字配色。

## 关键文件

- `src/pages/CoverGenerator.tsx`（约 3200 行，全站第二大文件）
- `src/pages/cover/`：coverRenderer（绘制）、coverLayout（布局/文字适配）、coverColor（配色/采样）、coverStorage（草稿/预设）、coverTypes/coverConstants、coverBatch（批量解析）、coverFiles（文件读取）、coverExport（导出/预加载）、coverImageCache、coverTemplates/coverPresets

## 修改规则（必须遵守）

1. **领域边界**：封面全部逻辑集中在 `src/pages/cover/`，新增代码必须放该目录，禁止外溢到 utils/components。
2. **canvas 健壮性**：所有 getContext 必须判空并如实反馈（禁止 `?.` 吞掉后静默画空白）；`ctx.roundRect` 必须特性检测回退 `rect`（老浏览器缺 API）。
3. **存储诚实语义**：writeDraft/writePreset/deletePreset 在 localStorage 不可用时必须如实返回 false/null（禁止假报成功）；版本号容错（COVER_STORAGE_VERSION）保持。
4. **导出**：JPEG 导出必须铺白底（JPEG 不支持透明）；导出尺寸/像素上限与加载上限保持一致；导出失败必须给明确错误文案。
5. **批量解析**：CSV 表头检测（首行含 title/name 等已知字段才算表头，无表头文件首行不得被吞）；错误提示必须用真实文件行号；slug 去重（dedupeSlugs）保持跨文件唯一性。
6. **自动配色**：sampleRegion 网格抽样（stride 4）保持；chooseTextColor 的 lowContrast 语义完整。
7. **性能**：预览渲染避免不必要的大内存分配（模糊层 canvas 惰性重建）；fitText 缩小字号循环不得无界。
8. **SSG 确定性**：封面页静态结构由 SSG 渲染，画布预览仅客户端。
9. **大文件治理**：CoverGenerator.tsx 已超 3000 行，新增逻辑优先抽入 cover/ 子模块，禁止继续膨胀。

## 常见陷阱

- 模板/预设数据（coverTemplates/coverPresets）已随领域迁移进 cover/，勿恢复 config 目录；
- 批量导出 Zip 用 JSZip，逐项 yieldToBrowser 让出主线程（大批量不卡死）；
- Iconify 图标搜索/缓存（coverImageCache）改动需验证跨会话缓存一致性。

## 破例条款

> 本文件规则为硬性约束。当 AI 认为有必要打破其中任何一条规则时，必须**先向用户说明理由并请求授权**；在获得用户明确准许之前，不得违反规则实现功能、修改代码或修改本文件。获准后应在提交信息中注明依据的授权。
