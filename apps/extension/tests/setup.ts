import '@testing-library/jest-dom/vitest';

const memoryStore: Record<string, unknown> = {};

const storageLocal = {
  get: async (keys?: string | string[] | Record<string, unknown> | null) => {
    if (typeof keys === 'string') {
      return { [keys]: memoryStore[keys] };
    }
    if (Array.isArray(keys)) {
      return Object.fromEntries(keys.map((key) => [key, memoryStore[key]]));
    }
    return { ...memoryStore };
  },
  set: async (items: Record<string, unknown>) => {
    Object.assign(memoryStore, items);
  },
  remove: async (keys: string | string[]) => {
    const list = Array.isArray(keys) ? keys : [keys];
    for (const key of list) {
      delete memoryStore[key];
    }
  },
  clear: async () => {
    for (const key of Object.keys(memoryStore)) {
      delete memoryStore[key];
    }
  },
};

// @ts-expect-error test mock
globalThis.browser = {
  storage: { local: storageLocal },
  runtime: {
    id: 'test-extension-id',
    getURL: (path: string) => `chrome-extension://test/${path}`,
    sendMessage: async () => ({}),
    onMessage: { addListener: () => undefined },
  },
  alarms: {
    create: () => undefined,
    onAlarm: { addListener: () => undefined },
  },
  permissions: {
    contains: async () => false,
  },
  notifications: {
    create: () => undefined,
  },
  idle: undefined,
  tabs: { create: async () => ({}) },
};

export function resetTestStorage(): void {
  for (const key of Object.keys(memoryStore)) {
    delete memoryStore[key];
  }
}
