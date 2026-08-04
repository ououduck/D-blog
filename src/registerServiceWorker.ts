import { getSiteBasePath } from '@/utils/siteUrl';

export type ServiceWorkerStatus =
  | 'idle'
  | 'unsupported'
  | 'registering'
  | 'installing'
  | 'ready'
  | 'update-available'
  | 'updating'
  | 'error';

export interface ServiceWorkerState {
  readonly status: ServiceWorkerStatus;
  readonly registration?: ServiceWorkerRegistration;
}

export type ServiceWorkerStateListener = (state: ServiceWorkerState) => void;

const listeners = new Set<ServiceWorkerStateListener>();
let state: ServiceWorkerState = { status: 'idle' };
let registration: ServiceWorkerRegistration | undefined;
let registrationPromise: Promise<ServiceWorkerRegistration | undefined> | undefined;
let updateRequested = false;
let hasRefreshedForUpdate = false;
const watchedWorkers = new WeakSet<ServiceWorker>();

const setState = (status: ServiceWorkerStatus, nextRegistration = registration) => {
  state = nextRegistration ? { status, registration: nextRegistration } : { status };
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (error) {
      warn('state listener failed', error);
    }
  });
};

export const getState = (): ServiceWorkerState => state;

export const subscribe = (listener: ServiceWorkerStateListener): (() => void) => {
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
  // Resolve relative Vite builds from the inferred deployment directory rather
  // than the current article URL (for example /repo/post/id -> /repo/).
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
  worker.addEventListener('statechange', () => {
    if (worker.state === 'installed') {
      setState(isUpdate ? 'update-available' : 'ready', currentRegistration);
    } else if (worker.state === 'redundant') {
      warn('worker installation became redundant');
    }
  });
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

export const applyUpdate = (): boolean => {
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
    warn('update activation failed', error);
    return false;
  }
};

// Descriptive aliases keep the small public API convenient for consumers.
export const subscribeToServiceWorker = subscribe;
export const getServiceWorkerState = getState;
export const applyServiceWorkerUpdate = applyUpdate;
