/**
 * Service Worker 注册与状态管理：注册、更新检测与更新可用提示，
 * 通过订阅通知 UI（ServiceWorkerUpdatePrompt）并由其触发刷新。
 * 多标签页：仅触发更新的标签页自动刷新，其余标签页经 BroadcastChannel
 * 收到「已更新」通知后由用户自行决定是否刷新（禁止意外刷新打断输入）。
 */
import { getSiteBasePath } from '@/utils/siteUrl';

type ServiceWorkerStatus =
  'idle' | 'unsupported' | 'registering' | 'installing' | 'ready' | 'update-available' | 'updating' | 'error';

export interface ServiceWorkerState {
  readonly status: ServiceWorkerStatus;
  readonly registration?: ServiceWorkerRegistration;
  /** 最近一次「立即更新」是否失败（update-available 态下用于 UI 错误反馈）。 */
  readonly updateFailed?: boolean;
}

type ServiceWorkerStateListener = (state: ServiceWorkerState) => void;

const listeners = new Set<ServiceWorkerStateListener>();
let state: ServiceWorkerState = { status: 'idle' };
let registration: ServiceWorkerRegistration | undefined;
let registrationPromise: Promise<ServiceWorkerRegistration | undefined> | undefined;
let updateRequested = false;
let hasRefreshedForUpdate = false;
const watchedWorkers = new WeakSet<ServiceWorker>();

const setState = (
  status: ServiceWorkerStatus,
  nextRegistration = registration,
  extra: Partial<ServiceWorkerState> = {},
) => {
  state = nextRegistration ? { status, registration: nextRegistration, ...extra } : { status, ...extra };
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (error) {
      warn('state listener failed', error);
    }
  });
};

const getState = (): ServiceWorkerState => state;

const subscribe = (listener: ServiceWorkerStateListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const warn = (message: string, error?: unknown) => {
  if (error === undefined) {
    console.warn(`[service-worker] ${message}`);
  } else {
    console.warn(`[service-worker] ${message}`, error);
  }
};

const getBaseUrl = () => {
  const configuredBase = import.meta.env.BASE_URL || '/';
  // 相对路径的 Vite 构建从推断出的部署目录解析，而非当前文章 URL
  // （例如 /repo/post/id → /repo/）。
  const basePath = getSiteBasePath(window.location.pathname);
  const baseUrl = new URL(
    configuredBase === '.' || configuredBase === './' ? basePath : configuredBase,
    window.location.href,
  );
  if (!baseUrl.pathname.endsWith('/')) {
    baseUrl.pathname += '/';
  }
  baseUrl.search = '';
  baseUrl.hash = '';
  return baseUrl;
};

const watchInstallingWorker = (currentRegistration: ServiceWorkerRegistration, worker: ServiceWorker) => {
  if (watchedWorkers.has(worker)) {
    return;
  }
  watchedWorkers.add(worker);
  const isUpdate = Boolean(navigator.serviceWorker.controller);
  setState('installing', currentRegistration);
  const handleStateChange = () => {
    if (worker.state === 'installed') {
      setState(isUpdate ? 'update-available' : 'ready', currentRegistration);
    } else if (worker.state === 'redundant') {
      warn('worker installation became redundant');
    }
  };
  worker.addEventListener('statechange', handleStateChange);
  // 附加监听时 worker 可能已越过 installed（快速安装竞态下 statechange 不会
  // 再触发），需同步检查一次当前状态，否则状态会卡在 installing。除了
  // installed，还要覆盖 activating/activated：页面主线程繁忙期间小型 SW 可能
  // 已走完 install → skipWaiting → activate 全流程，此时同步检查只会看到
  // 这些后续状态，漏掉则 update-available/ready 永远不会下发。
  if (worker.state === 'installed' || worker.state === 'activating' || worker.state === 'activated') {
    setState(isUpdate ? 'update-available' : 'ready', currentRegistration);
  } else if (worker.state === 'redundant') {
    warn('worker installation became redundant');
  }
};

const UPDATE_CHANNEL_NAME = 'dblog-sw-update';
const RELOAD_SCROLL_STORAGE_KEY = 'dblog:sw-reload-scroll';

let updateChannel: BroadcastChannel | null = null;

const getUpdateChannel = (): BroadcastChannel | null => {
  if (typeof BroadcastChannel === 'undefined') {
    return null;
  }
  if (!updateChannel) {
    try {
      updateChannel = new BroadcastChannel(UPDATE_CHANNEL_NAME);
    } catch (error) {
      warn('broadcast channel unavailable', error);
      return null;
    }
  }
  return updateChannel;
};

/** 刷新前记录阅读位置：更新重载后恢复（URL/主题天然随地址与 localStorage 保持）。 */
const saveScrollForReload = () => {
  try {
    sessionStorage.setItem(RELOAD_SCROLL_STORAGE_KEY, String(Math.round(window.scrollY)));
  } catch {
    // 存储不可用（隐私模式等）：仅丢失位置恢复，不阻断刷新。
  }
};

/** 更新重载完成后恢复刷新前的阅读位置（一次性消费）。 */
export const consumeReloadScrollRestore = () => {
  try {
    const raw = sessionStorage.getItem(RELOAD_SCROLL_STORAGE_KEY);
    if (raw === null) {
      return;
    }
    sessionStorage.removeItem(RELOAD_SCROLL_STORAGE_KEY);
    const top = Number.parseInt(raw, 10);
    if (!Number.isFinite(top) || top <= 0) {
      return;
    }
    // 等正文布局（含懒加载首帧）落定后再恢复，双 rAF 保证至少渲染过一帧。
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ top, behavior: 'auto' });
      });
    });
  } catch {
    // 忽略：位置恢复属尽力而为的增强。
  }
};

const watchRegistration = (currentRegistration: ServiceWorkerRegistration) => {
  registration = currentRegistration;

  currentRegistration.addEventListener('updatefound', () => {
    const worker = currentRegistration.installing;
    if (worker) {
      watchInstallingWorker(currentRegistration, worker);
    }
  });

  if (currentRegistration.installing) {
    watchInstallingWorker(currentRegistration, currentRegistration.installing);
  } else if (currentRegistration.waiting) {
    setState('update-available', currentRegistration);
  } else {
    setState('ready', currentRegistration);
  }

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!updateRequested || hasRefreshedForUpdate) {
      return;
    }
    hasRefreshedForUpdate = true;
    // 通知其他标签页「站点已更新」：它们不自动刷新（避免打断用户输入/阅读），
    // 由各自 UI 显示轻提示，用户主动刷新。
    try {
      getUpdateChannel()?.postMessage({ type: 'dblog:update-applied' });
    } catch {
      // 通知失败不影响本页更新。
    }
    saveScrollForReload();
    window.location.reload();
  });
};

const register = async (): Promise<ServiceWorkerRegistration | undefined> => {
  try {
    const baseUrl = getBaseUrl();
    const currentRegistration = await navigator.serviceWorker.register(new URL('sw.js', baseUrl).href, {
      scope: baseUrl.pathname,
    });
    watchRegistration(currentRegistration);
    return currentRegistration;
  } catch (error) {
    setState('error');
    warn('registration failed', error);
    return undefined;
  }
};

export const registerServiceWorker = (): Promise<ServiceWorkerRegistration | undefined> | undefined => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    setState('unsupported');
    return undefined;
  }

  if (registrationPromise) {
    return registrationPromise;
  }

  setState('registering');
  registrationPromise = new Promise((resolve) => {
    const registerAfterLoad = () => {
      void register().then(resolve);
    };

    if (document.readyState === 'complete') {
      registerAfterLoad();
    } else {
      window.addEventListener('load', registerAfterLoad, { once: true });
    }
  });

  return registrationPromise;
};

const applyUpdate = (): boolean => {
  const waitingWorker = registration?.waiting;
  if (!waitingWorker) {
    return false;
  }

  try {
    updateRequested = true;
    setState('updating', registration);
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    return true;
  } catch (error) {
    // 失败必须复位 updateRequested：否则后续任意 controllerchange（含其他
    // 原因的接管）会触发一次用户未请求的自动刷新。
    updateRequested = false;
    setState('update-available', registration, { updateFailed: true });
    warn('update activation failed', error);
    return false;
  }
};

/**
 * 订阅「站点已更新」跨标签页广播。返回取消订阅函数；广播能力不可用时返回 no-op。
 */
export const subscribeToUpdateApplied = (handler: () => void): (() => void) => {
  const channel = getUpdateChannel();
  if (!channel) {
    return () => {};
  }
  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === 'dblog:update-applied') {
      handler();
    }
  };
  channel.addEventListener('message', onMessage);
  return () => channel.removeEventListener('message', onMessage);
};

// 语义化别名让小型公共 API 更便于调用方使用。
export const subscribeToServiceWorker = subscribe;
export const getServiceWorkerState = getState;
export const applyServiceWorkerUpdate = applyUpdate;
