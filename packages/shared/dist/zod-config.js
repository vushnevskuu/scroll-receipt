const globalConfig = globalThis.__zod_globalConfig;
if (globalConfig) {
    globalConfig.jitless = true;
}
else {
    globalThis.__zod_globalConfig = { jitless: true };
}
export {};
