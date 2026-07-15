import type { ExtensionMessage } from '@src/types/messages';
import { parseExtensionMessage } from '@src/types/messages';
import { browser } from 'wxt/browser';

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
