import { generateId } from '@src/utils/hash';
import { getStorageItem, setStorageItem } from '@src/utils/storage';

const DEVICE_ID_KEY = 'deviceId';

export async function getOrCreateDeviceId(): Promise<string> {
  const existing = await getStorageItem<string>(DEVICE_ID_KEY);
  if (existing) return existing;
  const id = generateId();
  await setStorageItem(DEVICE_ID_KEY, id);
  return id;
}
