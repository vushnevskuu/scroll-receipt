const globalConfig = (globalThis as typeof globalThis & {
  __zod_globalConfig?: { jitless?: boolean };
}).__zod_globalConfig;

if (globalConfig) {
  globalConfig.jitless = true;
} else {
  (globalThis as typeof globalThis & {
    __zod_globalConfig?: { jitless?: boolean };
  }).__zod_globalConfig = { jitless: true };
}

export {};
