import { createYouTubeAdapter } from '@src/adapters/youtube';
import { initPlatformTracking } from '@src/tracking/active-viewing';

export default defineContentScript({
  matches: ['*://www.youtube.com/*', '*://youtube.com/*', '*://m.youtube.com/*'],
  runAt: 'document_idle',
  main() {
    const cleanup = initPlatformTracking(createYouTubeAdapter());
    window.addEventListener('beforeunload', cleanup);
  },
});
