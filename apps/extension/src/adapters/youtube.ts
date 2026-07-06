import type { CleanupFunction, ObserverCallback, PlatformAdapter } from '@src/types';
import {
  buildDetectedContent,
  extractVideoIdFromPath,
  findLargestVisibleVideo,
} from '@src/adapters/types';

const SHORTS_PATH = /\/shorts\/([^/?#]+)/;

export function createYouTubeAdapter(): PlatformAdapter {
  let observer: MutationObserver | null = null;
  let routeObserver: MutationObserver | null = null;

  return {
    matchesCurrentPage(): boolean {
      return /youtube\.com$/i.test(window.location.hostname) && SHORTS_PATH.test(window.location.pathname);
    },

    getPlatform: () => 'youtube',

    getCurrentContent() {
      const id = this.getStableContentIdentifier();
      if (!id) return null;
      return buildDetectedContent(id, this.getActiveVideoElement());
    },

    getActiveVideoElement(): HTMLVideoElement | null {
      const videos = Array.from(document.querySelectorAll('video')) as HTMLVideoElement[];
      return findLargestVisibleVideo(videos);
    },

    getStableContentIdentifier(): string | null {
      const fromPath = extractVideoIdFromPath(window.location.pathname, SHORTS_PATH);
      if (fromPath) return fromPath;

      const active = this.getActiveVideoElement();
      if (active) {
        const dataId = active.closest('[data-context-item-id]')?.getAttribute('data-context-item-id');
        if (dataId) return dataId;
      }

      return null;
    },

    startObserving(callback: ObserverCallback): CleanupFunction {
      const notify = () => {
        callback({
          type: 'content_changed',
          content: this.getCurrentContent(),
          isPlaying: this.getActiveVideoElement()?.paused === false,
          visibilityRatio: 0,
        });
      };

      observer = new MutationObserver(notify);
      observer.observe(document.body, { childList: true, subtree: true });

      routeObserver = new MutationObserver(notify);
      const title = document.querySelector('title');
      if (title) {
        routeObserver.observe(title, { childList: true, characterData: true, subtree: true });
      }

      window.addEventListener('popstate', notify);
      window.addEventListener('yt-navigate-finish', notify as EventListener);

      return () => {
        observer?.disconnect();
        routeObserver?.disconnect();
        window.removeEventListener('popstate', notify);
        window.removeEventListener('yt-navigate-finish', notify as EventListener);
      };
    },
  };
}
