import type { CleanupFunction, ObserverCallback, PlatformAdapter } from '@src/types';
import {
  buildDetectedContent,
  extractVideoIdFromPath,
  findLargestVisibleVideo,
} from '@src/adapters/types';

const REEL_PATH = /\/reel(?:s)?\/([^/?#]+)/;

export function createInstagramAdapter(): PlatformAdapter {
  let observer: MutationObserver | null = null;

  return {
    matchesCurrentPage(): boolean {
      if (!/instagram\.com$/i.test(window.location.hostname)) return false;
      const path = window.location.pathname;
      return path.startsWith('/reels') || REEL_PATH.test(path);
    },

    getPlatform: () => 'instagram',

    getCurrentContent() {
      const id = this.getStableContentIdentifier();
      if (!id) return null;
      return buildDetectedContent(id, this.getActiveVideoElement());
    },

    getActiveVideoElement(): HTMLVideoElement | null {
      const candidates = Array.from(
        document.querySelectorAll('article video, div[role="presentation"] video, video'),
      ) as HTMLVideoElement[];
      return findLargestVisibleVideo(candidates);
    },

    getStableContentIdentifier(): string | null {
      const fromPath = extractVideoIdFromPath(window.location.pathname, REEL_PATH);
      if (fromPath && fromPath !== 'reels') return fromPath;

      const link = document.querySelector('a[href*="/reel/"]') as HTMLAnchorElement | null;
      if (link?.href) {
        const match = link.href.match(/\/reel\/([^/?#]+)/);
        if (match?.[1]) return match[1];
      }

      const video = this.getActiveVideoElement();
      const article = video?.closest('article');
      if (article) {
        const reelLink = article.querySelector('a[href*="/reel/"]') as HTMLAnchorElement | null;
        const match = reelLink?.href.match(/\/reel\/([^/?#]+)/);
        if (match?.[1]) return match[1];
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
      window.addEventListener('popstate', notify);

      return () => {
        observer?.disconnect();
        window.removeEventListener('popstate', notify);
      };
    },
  };
}
