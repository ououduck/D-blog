import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pageLoaders, preloadPage } from './preload';

describe('preloadPage', () => {
  beforeEach(() => {
    // 默认无 NetworkInformation：允许预加载
    Object.defineProperty(navigator, 'connection', { value: undefined, configurable: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('不支持网络信息时允许预加载并调用对应 loader', () => {
    const spy = vi.spyOn(pageLoaders, '/about').mockReturnValue(Promise.resolve({ default: (() => null) as never }));
    preloadPage('/about');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('saveData 开启时不预加载', () => {
    Object.defineProperty(navigator, 'connection', {
      value: { saveData: true, effectiveType: '4g' },
      configurable: true,
    });
    // preloadedPaths 为模块级 Set，各用例使用不同路径避免互相影响
    const spy = vi.spyOn(pageLoaders, '/stats');
    preloadPage('/stats');
    expect(spy).not.toHaveBeenCalled();
  });

  it('slow-2g / 2g 网络不预加载', () => {
    Object.defineProperty(navigator, 'connection', {
      value: { saveData: false, effectiveType: 'slow-2g' },
      configurable: true,
    });
    const spy = vi.spyOn(pageLoaders, '/archive');
    preloadPage('/archive');
    expect(spy).not.toHaveBeenCalled();
  });

  it('同一路径只预加载一次', () => {
    const spy = vi.spyOn(pageLoaders, '/tags').mockReturnValue(Promise.resolve({ default: (() => null) as never }));
    preloadPage('/tags');
    preloadPage('/tags');
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('未注册的路径不抛错', () => {
    expect(() => preloadPage('/unknown-route')).not.toThrow();
  });
});
