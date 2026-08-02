const formatDetail = (detail) => detail ? ` ${detail}` : '';

export const createBuildLogger = (scope) => {
  const startedAt = Date.now();
  const warnings = [];

  const write = (level, message, detail = '') => {
    const prefix = `[${scope}] ${level}`;
    console.log(`${prefix} ${message}${formatDetail(detail)}`);
  };

  return {
    start(message) {
      write('start', message);
    },
    step(message, detail = '') {
      write('step', message, detail);
    },
    success(message, detail = '') {
      write('done', message, detail);
    },
    warn(message, detail = '') {
      const text = `${message}${formatDetail(detail)}`;
      warnings.push(text);
      console.warn(`[${scope}] warn ${text}`);
    },
    error(message, detail = '') {
      console.error(`[${scope}] error ${message}${formatDetail(detail)}`);
    },
    summary(items = {}) {
      const elapsed = `${((Date.now() - startedAt) / 1000).toFixed(2)}s`;
      const parts = Object.entries({ ...items, warnings: warnings.length, elapsed })
        .map(([key, value]) => `${key}=${value}`)
        .join(' ');

      write('summary', parts);
    }
  };
};
