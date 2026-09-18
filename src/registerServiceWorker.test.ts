import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 模块级状态（listeners/registrationPromise/state）跨用例残留：
// 每个用例通过 vi.resetModules + 动态 import 获取全新模块实例。
const loadModule = async () => {
  vi.resetModules();
  return import('./registerServiceWorker');
};

const makeServiceWorker = (state: string) => {
  const listeners = new Set<() => void>();
  const worker = {
    state,
    addEventListener: vi.fn((type: string, cb: () => void) => {
      if (type === 'statechange') listeners.add(cb);
    }),
    removeEventListener: vi.fn(),
    postMessage: vi.fn(),
    // 测试辅助：模拟状态迁移触发 statechange
    _setState(next: string) {
      worker.state = next;
      listeners.forEach((cb) => cb());
    },
  };
  return worker as unknown as ServiceWorker & { _setState: (s: string) => void };
};

const makeRegistration = (worker: ServiceWorker) =>
  ({
    active: worker,
    waiting: null,
    installing: worker,
    scope: '/',
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    update: vi.fn(),
    unregister: vi.fn(),
  }) as unknown as ServiceWorkerRegistration;

const mockNavigatorServiceWorker = (overrides: Record<string, unknown> = {}) => {
  const base = {
    controller: null,
    ready: Promise.resolve({ active: null }),
    register: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ...base, ...overrides },
  });
  return navigator.serviceWorker as unknown as ServiceWorkerContainer & {
    register: ReturnType<typeof vi.fn>;
  };
};

describe('registerServiceWorker', () => {
  beforeEach(() => {
    // 默认提供 serviceWorker 环境。
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        controller: null,
        ready: Promise.resolve({ active: null }),
        register: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('浏览器不支持 Service Worker 时状态为 unsupported', async () => {
    // 属性不存在（而非 undefined）：'serviceWorker' in navigator 必须为 false。
    delete (navigator as unknown as Record<string, unknown>).serviceWorker;
    const { registerServiceWorker, getServiceWorkerState } = await loadModule();
    registerServiceWorker();
    expect(getServiceWorkerState().status).toBe('unsupported');
  });

  it('注册成功后状态流转到 installing/ready', async () => {
    const worker = makeServiceWorker('installing');
    const registration = makeRegistration(worker);
    const sw = mockNavigatorServiceWorker({ register: vi.fn().mockResolvedValue(registration) });

    const { registerServiceWorker, getServiceWorkerState } = await loadModule();
    registerServiceWorker();
    await vi.waitFor(() => {
      expect(getServiceWorkerState().status).toBe('installing');
    });
    // 模拟 worker 安装完成。
    worker._setState('installed');
    await vi.waitFor(() => {
      expect(getServiceWorkerState().status).toBe('ready');
    });
    expect(sw.register).toHaveBeenCalled();
  });

  it('有 controller 时新 worker 安装完成视为 update-available', async () => {
    const worker = makeServiceWorker('installing');
    const registration = makeRegistration(worker);
    mockNavigatorServiceWorker({
      controller: makeServiceWorker('activated'),
      register: vi.fn().mockResolvedValue(registration),
    });

    const { registerServiceWorker, getServiceWorkerState } = await loadModule();
    registerServiceWorker();
    worker._setState('installed');
    await vi.waitFor(() => {
      expect(getServiceWorkerState().status).toBe('update-available');
    });
  });

  it('快速安装竞态：worker 已越过 installed（activating）时同步检查补发 ready', async () => {
    // 模拟监听附加时 worker 已是 activating（快速安装场景，statechange 不会再触发）。
    const worker = makeServiceWorker('activating');
    const registration = makeRegistration(worker);
    mockNavigatorServiceWorker({ register: vi.fn().mockResolvedValue(registration) });

    const { registerServiceWorker, getServiceWorkerState } = await loadModule();
    registerServiceWorker();
    // 同步检查路径：attach 后立即检查 worker.state === activating → ready。
    await vi.waitFor(() => {
      expect(getServiceWorkerState().status).toBe('ready');
    });
  });

  it('注册失败状态为 error', async () => {
    mockNavigatorServiceWorker({ register: vi.fn().mockRejectedValue(new Error('denied')) });
    const { registerServiceWorker, getServiceWorkerState } = await loadModule();
    registerServiceWorker();
    await vi.waitFor(() => {
      expect(getServiceWorkerState().status).toBe('error');
    });
  });

  it('applyServiceWorkerUpdate 对 waiting worker 发送 SKIP_WAITING', async () => {
    const waitingWorker = makeServiceWorker('installed');
    const registration = {
      waiting: waitingWorker,
      addEventListener: vi.fn(),
    } as unknown as ServiceWorkerRegistration;
    mockNavigatorServiceWorker({ register: vi.fn().mockResolvedValue(registration) });

    const { registerServiceWorker, applyServiceWorkerUpdate } = await loadModule();
    registerServiceWorker();
    // 直接测试 apply 逻辑：模块内部 registration 已记录。
    await vi.waitFor(() => {
      expect(applyServiceWorkerUpdate()).toBe(true);
    });
    expect(waitingWorker.postMessage).toHaveBeenCalledWith({ type: 'SKIP_WAITING' });
  });

  it('postMessage 抛错时返回 false 且状态回到 update-available（updateFailed 标记，复位 updateRequested）', async () => {
    const waitingWorker = makeServiceWorker('installed');
    (waitingWorker as unknown as { postMessage: () => void }).postMessage = vi.fn(() => {
      throw new Error('postMessage failed');
    });
    const registration = {
      waiting: waitingWorker,
      addEventListener: vi.fn(),
    } as unknown as ServiceWorkerRegistration;
    mockNavigatorServiceWorker({ register: vi.fn().mockResolvedValue(registration) });

    const { registerServiceWorker, applyServiceWorkerUpdate, getServiceWorkerState } = await loadModule();
    registerServiceWorker();
    // registration.waiting 存在 → 初始即为 update-available
    await vi.waitFor(() => {
      expect(getServiceWorkerState().status).toBe('update-available');
    });

    expect(applyServiceWorkerUpdate()).toBe(false);
    expect(getServiceWorkerState().status).toBe('update-available');
    expect(getServiceWorkerState().updateFailed).toBe(true);
  });

  it('subscribeToUpdateApplied 收到广播后触发回调，可取消订阅', async () => {
    class MockBroadcastChannel {
      static instances: MockBroadcastChannel[] = [];
      listeners = new Set<(event: { data?: unknown }) => void>();
      constructor(public name: string) {
        MockBroadcastChannel.instances.push(this);
      }
      postMessage(data: unknown) {
        this.listeners.forEach((cb) => cb({ data }));
      }
      addEventListener(_type: string, cb: (event: { data?: unknown }) => void) {
        this.listeners.add(cb);
      }
      removeEventListener(_type: string, cb: (event: { data?: unknown }) => void) {
        this.listeners.delete(cb);
      }
    }
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);

    const { subscribeToUpdateApplied } = await loadModule();
    const handler = vi.fn();
    const unsubscribe = subscribeToUpdateApplied(handler);

    // 同一模块实例共享 channel：找到已创建的实例并投递消息
    const channel = MockBroadcastChannel.instances.at(-1) as MockBroadcastChannel;
    channel.postMessage({ type: 'dblog:update-applied' });
    expect(handler).toHaveBeenCalledTimes(1);
    // 无关消息不触发
    channel.postMessage({ type: 'other' });
    expect(handler).toHaveBeenCalledTimes(1);

    unsubscribe();
    channel.postMessage({ type: 'dblog:update-applied' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('consumeReloadScrollRestore 恢复刷新前滚动位置（一次性）', async () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    Object.defineProperty(window, 'scrollY', { configurable: true, value: 480 });
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      cb(0);
      return 0;
    });
    sessionStorage.setItem('dblog:sw-reload-scroll', '480');

    const { consumeReloadScrollRestore } = await loadModule();
    consumeReloadScrollRestore();

    // 双 rAF 后恢复
    await vi.waitFor(() => {
      expect(scrollTo).toHaveBeenCalledWith({ top: 480, behavior: 'auto' });
    });
    expect(sessionStorage.getItem('dblog:sw-reload-scroll')).toBeNull();

    // 第二次调用：记录已消费，不再滚动
    consumeReloadScrollRestore();
    expect(scrollTo).toHaveBeenCalledTimes(1);
  });
});
