import type { ExtensionMessage } from '@src/types/messages';
import { parseExtensionMessage } from '@src/types/messages';
import { browser } from 'wxt/browser';

export async function sendMessage<T = unknown>(message: ExtensionMessage): Promise<T> {
  return browser.runtime.sendMessage(message) as Promise<T>;
}

export function onMessage(
  handler: (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
  ) => Promise<unknown> | unknown,
): void {
  browser.runtime.onMessage.addListener((raw: unknown, sender: chrome.runtime.MessageSender) => {
    const message = parseExtensionMessage(raw);
    if (!message) {
      return undefined;
    }
    return Promise.resolve(handler(message, sender));
  });
}

export async function safeSendMessage<T = unknown>(
  message: ExtensionMessage,
): Promise<T | null> {
  try {
    return await sendMessage<T>(message);
  } catch {
    return null;
  }
}
