import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const startedAt = Date.now();
const verbose = process.env.BUILD_VERBOSE === '1' || process.argv.includes('--verbose');
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const color = (code, value) => useColor ? `\u001B[${code}m${value}\u001B[0m` : value;
const elapsed = (from) => `${((Date.now() - from) / 1000).toFixed(2)}s`;
const write = (status, message, detail = '') => {
  const label = status === 'done'
    ? color('32', status)
    : status === 'error'
      ? color('31', status)
      : color('36', status);
  console.log(`[build] ${label} ${message}${detail ? ` ${detail}` : ''}`);
};

const viteCli = path.resolve('node_modules/vite/bin/vite.js');
const stages = [
  { name: 'Generate responsive images', command: process.execPath, args: ['scripts/generate-image-assets.mjs'] },
  { name: 'Generate site data', command: process.execPath, args: ['scripts/generate-site-data.mjs'] },
  {
    name: 'Bundle application',
    command: process.execPath,
    args: [viteCli, 'build', ...(verbose ? [] : ['--logLevel', 'warn'])]
  },
  {
    name: 'Bundle server-side renderer',
    command: process.execPath,
    args: [viteCli, 'build', '--config', 'vite.ssr.config.ts', ...(verbose ? [] : ['--logLevel', 'warn'])]
  },
  {
    name: 'Snapshot clean HTML template',
    command: process.execPath,
    args: ['-e', "const fs=require('fs');const s='dist/index.html',d='dist-ssr/index.template.html';fs.copyFileSync(s,d);console.log('[build] template snapshot saved')"]
  },
  { name: 'Generate static HTML (SSG)', command: process.execPath, args: ['scripts/ssg.mjs'] },
  { name: 'Audit build output', command: process.execPath, args: ['scripts/audit-build.mjs'] }
];

const run = ({ command, args }) => new Promise((resolve, reject) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      BUILD_VERBOSE: verbose ? '1' : undefined,
      FORCE_COLOR: '0',
      NO_COLOR: '1'
    }
  });
  child.once('error', reject);
  child.once('close', (code, signal) => {
    if (code === 0) resolve();
    else reject(new Error(signal ? `stopped by ${signal}` : `exited with code ${code}`));
  });
});

write('start', 'Production build', `stages=${stages.length} mode=${verbose ? 'verbose' : 'concise'}`);

for (const [index, stage] of stages.entries()) {
  const stageStartedAt = Date.now();
  const position = `[${index + 1}/${stages.length}]`;
  write('step', `${position} ${stage.name}`);

  try {
    await run(stage);
    write('done', `${position} ${stage.name}`, `elapsed=${elapsed(stageStartedAt)}`);
  } catch (error) {
    write('error', `${position} ${stage.name}`, `elapsed=${elapsed(stageStartedAt)} ${error.message}`);
    process.exitCode = 1;
    break;
  }
}

if (process.exitCode) {
  write('error', 'Production build failed', `elapsed=${elapsed(startedAt)}`);
} else {
  write('done', 'Production build complete', `elapsed=${elapsed(startedAt)}`);
}
