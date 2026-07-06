import { createInstagramAdapter } from '@src/adapters/instagram';
import { initPlatformTracking } from '@src/tracking/active-viewing';

export default defineContentScript({
  matches: ['*://www.instagram.com/*', '*://instagram.com/*'],
  runAt: 'document_idle',
  main() {
    const cleanup = initPlatformTracking(createInstagramAdapter());
    window.addEventListener('beforeunload', cleanup);
  },
});
