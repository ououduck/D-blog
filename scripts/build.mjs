/**
 * build.mjs — D-blog 生产构建流水线（阶段编排器）。
 *
 * 依次执行：图片资产生成 → 站点数据生成 → 分享卡片 → 客户端构建 →
 * SSR 构建 → 模板快照 → SSG 全量静态化 → 产物审计。
 *
 * 生产级重构要点（Phase 1 审计修复）：
 *  1. 每阶段强制超时：spawn 子进程挂起时（网络卡死、SSR 死循环、内存压力）
 *     默认 20 分钟后被 SIGKILL，由 build.mjs 判定该阶段失败并终止流水线，
 *     彻底避免整个 job 挂到 GitHub Actions 的 6 小时上限。
 *     可通过环境变量 BUILD_STAGE_TIMEOUT_MS 覆盖（本地调试用）。
 *  2. 子进程 stderr/stdout 以流式透传，日志实时可见（Actions 友好）。
 *  3. 任一阶段失败：立即终止后续阶段、汇总耗时与退出码，便于在
 *     Actions 日志中一眼定位失败阶段（[N/M] 前缀）。
 */

import { spawn } from 'node:child_process';
import path from 'node:path';

/** 单阶段默认超时（毫秒）：20 分钟。 */
const DEFAULT_STAGE_TIMEOUT_MS = 20 * 60 * 1000;
const stageTimeoutMs = Number(process.env.BUILD_STAGE_TIMEOUT_MS) || DEFAULT_STAGE_TIMEOUT_MS;

/**
 * 整条流水线的总预算（毫秒）：55 分钟。
 * 防御性兜底：即使每个阶段都逼近各自的 stageTimeoutMs，叠加后也可能撞上
 * Actions job 的 60 分钟硬超时（ci.yml / deploy.yml 均设 timeout-minutes: 60），
 * job 被强杀时阶段汇总日志来不及打印。超过总预算立即停止剩余阶段并汇总
 * 已执行阶段耗时 —— job 永远在可控时长内结束，汇总始终可打印。
 * 可通过环境变量 BUILD_TOTAL_TIMEOUT_MS 覆盖（本地调试用）。
 */
const DEFAULT_TOTAL_TIMEOUT_MS = 55 * 60 * 1000;
const totalTimeoutMs = Number(process.env.BUILD_TOTAL_TIMEOUT_MS) || DEFAULT_TOTAL_TIMEOUT_MS;

const startedAt = Date.now();
const verbose = process.env.BUILD_VERBOSE === '1' || process.argv.includes('--verbose');
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const color = (code, value) => (useColor ? `\u001B[${code}m${value}\u001B[0m` : value);
const elapsed = (from) => `${((Date.now() - from) / 1000).toFixed(2)}s`;
const write = (status, message, detail = '') => {
  const label =
    status === 'done'
      ? color('32', status)
      : status === 'error'
        ? color('31', status)
        : status === 'timeout'
          ? color('33', status)
          : color('36', status);
  console.log(`[build] ${label} ${message}${detail ? ` ${detail}` : ''}`);
};

const viteCli = path.resolve('node_modules/vite/bin/vite.js');
const stages = [
  { name: 'Generate site data', command: process.execPath, args: ['scripts/generate-site-data.mjs'] },
  { name: 'Generate social share card', command: process.execPath, args: ['scripts/generate-og-card.mjs'] },
  {
    name: 'Bundle application',
    command: process.execPath,
    args: [viteCli, 'build', ...(verbose ? [] : ['--logLevel', 'warn'])],
  },
  {
    name: 'Bundle server-side renderer',
    command: process.execPath,
    args: [viteCli, 'build', '--config', 'vite.ssr.config.ts', ...(verbose ? [] : ['--logLevel', 'warn'])],
  },
  {
    name: 'Snapshot clean HTML template',
    command: process.execPath,
    args: [
      '-e',
      "const fs=require('fs');const s='dist/index.html',d='dist-ssr/index.template.html';fs.copyFileSync(s,d);console.log('[build] template snapshot saved')",
    ],
  },
  { name: 'Generate static HTML (SSG)', command: process.execPath, args: ['scripts/ssg.mjs'] },
  { name: 'Audit build output', command: process.execPath, args: ['scripts/audit-build.mjs'] },
  { name: 'Audit SEO output', command: process.execPath, args: ['scripts/seo-audit.mjs'] },
];

/**
 * 运行一个子进程阶段。
 * - 流式透传 stdio（实时日志）。
 * - 超时（stageTimeoutMs）后 SIGKILL 强杀，返回 timeout 标记。
 * - 非零退出码或信号终止均判定为失败。
 *
 * @param {{ command: string, args: string[] }} stage
 * @returns {Promise<'ok' | 'timeout' | { code: number | null, signal: string | null }>}
 */
const run = ({ command, args }) =>
  new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        // 条件展开而非显式 undefined：Node 会把 env 中的 undefined 值序列化为
        // 字符串 "undefined" 注入子进程，污染其环境变量。
        ...(verbose ? { BUILD_VERBOSE: '1' } : {}),
        FORCE_COLOR: '0',
        NO_COLOR: '1',
      },
    });

    let timedOut = false;
    // 阶段超时与总预算取较小者：单阶段不允许把流水线拖过总预算（最坏情况
    // 8 阶段 × 20min 远超 job 的 60min 硬超时，汇总日志会被强杀吞掉）。
    // 总预算已耗尽时该值 ≤ 0，定时器立即触发，与总预算检查一致地终止流水线。
    const remainingBudget = totalTimeoutMs - (Date.now() - startedAt);
    const effectiveTimeoutMs = Math.min(stageTimeoutMs, Math.max(0, remainingBudget));
    const timer = setTimeout(() => {
      timedOut = true;
      write('timeout', `Killing stage after ${Math.round(effectiveTimeoutMs / 1000)}s`, `pid=${child.pid}`);
      // 先 SIGTERM 给优雅退出机会，3s 后仍不退出再 SIGKILL。
      // 注意不能靠 child.killed 判断存活：kill() 调用后该标志同步置 true，
      // 无论进程是否真的退出。signalCode/exitCode 在 close 事件后才被填充。
      child.kill('SIGTERM');
      setTimeout(() => {
        if (child.exitCode === null && !child.signalCode) {
          child.kill('SIGKILL');
        }
      }, 3000).unref();
    }, effectiveTimeoutMs);

    child.once('error', (error) => {
      clearTimeout(timer);
      // spawn 失败（如命令不存在）：作为失败结果返回，不抛未处理异常。
      resolve({ code: null, signal: null, spawnError: error });
    });

    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (timedOut) {
        resolve('timeout');
        return;
      }
      resolve({ code, signal });
    });
  });

// run() 只 resolve 'timeout' 或 { code, signal, spawnError }，成功即 code === 0 且无 spawn 错误。
const isOk = (result) => result && typeof result === 'object' && result.code === 0 && !result.spawnError;

const describeFailure = (result) => {
  if (result === 'timeout') return 'killed by stage timeout';
  if (result && result.spawnError) return `failed to spawn: ${result.spawnError.message}`;
  if (result && result.signal) return `stopped by ${result.signal}`;
  return `exited with code ${result && result.code}`;
};

write(
  'start',
  'Production build',
  `stages=${stages.length} mode=${verbose ? 'verbose' : 'concise'} stageTimeout=${Math.round(stageTimeoutMs / 1000)}s totalTimeout=${Math.round(totalTimeoutMs / 1000)}s`,
);

let failed = false;
for (const [index, stage] of stages.entries()) {
  const stageStartedAt = Date.now();
  const position = `[${index + 1}/${stages.length}]`;

  // 总预算检查：已耗时超过总预算时，剩余阶段直接标记为跳过并终止流水线。
  if (Date.now() - startedAt > totalTimeoutMs) {
    write('timeout', `${position} ${stage.name} skipped (total budget exceeded)`, `elapsed=${elapsed(startedAt)}`);
    failed = true;
    break;
  }

  write('step', `${position} ${stage.name}`);

  const result = await run(stage);
  if (isOk(result)) {
    write('done', `${position} ${stage.name}`, `elapsed=${elapsed(stageStartedAt)}`);
  } else {
    failed = true;
    write('error', `${position} ${stage.name}`, `elapsed=${elapsed(stageStartedAt)} ${describeFailure(result)}`);
    break;
  }
}

if (failed) {
  write('error', 'Production build failed', `elapsed=${elapsed(startedAt)}`);
  process.exitCode = 1;
} else {
  write('done', 'Production build complete', `elapsed=${elapsed(startedAt)}`);
}
