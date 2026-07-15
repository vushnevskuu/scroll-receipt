import { browser } from 'wxt/browser';

export interface RuntimeMessage {
  type: string;
  payload?: unknown;
}

export async function sendMessage<T = unknown>(message: RuntimeMessage): Promise<T> {
  return browser.runtime.sendMessage(message) as Promise<T>;
}

export async function safeSendMessage<T = unknown>(
  message: RuntimeMessage,
): Promise<T | null> {
  try {
    return await sendMessage<T>(message);
  } catch {
    return null;
  }
}
