import { createTikTokAdapter } from '@src/adapters/tiktok';
import { initPlatformTracking } from '@src/tracking/active-viewing';

export default defineContentScript({
  matches: ['*://www.tiktok.com/*'],
  runAt: 'document_idle',
  main() {
    const cleanup = initPlatformTracking(createTikTokAdapter());
    window.addEventListener('beforeunload', cleanup);
  },
});
