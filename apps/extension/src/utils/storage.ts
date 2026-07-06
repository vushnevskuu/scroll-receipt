import { browser } from 'wxt/browser';

export async function getStorageItem<T>(key: string): Promise<T | null> {
  const result = await browser.storage.local.get(key);
  return (result[key] as T) ?? null;
}

export async function setStorageItem<T>(key: string, value: T): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}

export async function removeStorageItem(key: string): Promise<void> {
  await browser.storage.local.remove(key);
}
