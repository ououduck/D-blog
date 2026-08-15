// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { createActionLogger } from './gh-actions-logger.mjs';

describe('createActionLogger', () => {
  it('info 输出带作用域前缀的日志', () => {
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      const logger = createActionLogger('test-scope');
      logger.info('hello');
    } finally {
      console.log = originalLog;
    }
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0]).toContain('[test-scope]');
    expect(logs[0]).toContain('hello');
  });

  it('字段值中的换行被折叠为空格（防 Actions 命令注入）', () => {
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      const logger = createActionLogger('inject-test');
      logger.info('report', { title: '恶意\r\n::error::fake' });
    } finally {
      console.log = originalLog;
    }
    // 换行被折叠：::error:: 不再位于行首，无法被 Actions 解析为命令
    expect(logs[0]).not.toContain('\r\n');
    expect(logs[0].trim().startsWith('::error::')).toBe(false);
  });

  it('数组字段以逗号拼接', () => {
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      const logger = createActionLogger('arr-test');
      logger.info('done', { items: ['a', 'b'] });
    } finally {
      console.log = originalLog;
    }
    expect(logs[0]).toContain('items=a,b');
  });

  it('对象字段 JSON 序列化', () => {
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      const logger = createActionLogger('obj-test');
      logger.info('done', { detail: { ok: true } });
    } finally {
      console.log = originalLog;
    }
    expect(logs[0]).toContain('{"ok":true}');
  });

  it('undefined/null 字段被跳过', () => {
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      const logger = createActionLogger('skip-test');
      logger.info('done', { a: undefined, b: null, c: 1 });
    } finally {
      console.log = originalLog;
    }
    expect(logs[0]).not.toContain('a=');
    expect(logs[0]).not.toContain('b=');
    expect(logs[0]).toContain('c=1');
  });

  it('group 在 finally 中关闭（异常时也 endGroup）', () => {
    const logs = [];
    const originalLog = console.log;
    console.log = (...args) => logs.push(args.join(' '));
    try {
      const logger = createActionLogger('grp-test');
      const result = logger.group('任务', async () => {
        return 'inner';
      });
      return result.then(() => {
        const joined = logs.join('\n');
        expect(joined).toContain('任务');
      });
    } finally {
      console.log = originalLog;
    }
  });
});
