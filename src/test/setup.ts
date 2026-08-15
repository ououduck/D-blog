import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// 未启用 vitest globals 时，@testing-library/react 无法自动注册 afterEach 清理，
// 手动挂载，避免多次 render 的 DOM 在用例间累积。
afterEach(() => {
  cleanup();
});

// jsdom 未实现 scrollIntoView：搜索结果高亮、目录自动滚动等组件依赖它。
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}

// jsdom 未实现 Element.scrollTo：目录面板的自动滚动依赖它。
if (typeof Element !== 'undefined' && !Element.prototype.scrollTo) {
  Element.prototype.scrollTo = () => {};
}
