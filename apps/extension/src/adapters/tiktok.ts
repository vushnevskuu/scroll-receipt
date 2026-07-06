import type { CleanupFunction, ObserverCallback, PlatformAdapter } from '@src/types';
import {
  buildDetectedContent,
  findLargestVisibleVideo,
} from '@src/adapters/types';

const VIDEO_PATH = /@([^/]+)\/video\/(\d+)/;
const FORYOU_PATH = /^\/foryou\/?$/;

export function createTikTokAdapter(): PlatformAdapter {
  let observer: MutationObserver | null = null;

  return {
    matchesCurrentPage(): boolean {
      if (!/tiktok\.com$/i.test(window.location.hostname)) return false;
      const path = window.location.pathname;
      return FORYOU_PATH.test(path) || VIDEO_PATH.test(path);
    },

    getPlatform: () => 'tiktok',

    getCurrentContent() {
      const id = this.getStableContentIdentifier();
      if (!id) return null;
      return buildDetectedContent(id, this.getActiveVideoElement());
    },

    getActiveVideoElement(): HTMLVideoElement | null {
      const candidates = Array.from(
        document.querySelectorAll(
          '[data-e2e="browse-video"] video, div[data-e2e="recommend-list-item"] video, video',
        ),
      ) as HTMLVideoElement[];
      return findLargestVisibleVideo(candidates);
    },

    getStableContentIdentifier(): string | null {
      const match = window.location.pathname.match(VIDEO_PATH);
      if (match?.[2]) return match[2];

      const video = this.getActiveVideoElement();
      const container = video?.closest('[data-e2e="recommend-list-item"], [data-e2e="browse-video"]');
      const link = container?.querySelector('a[href*="/video/"]') as HTMLAnchorElement | null;
      const linkMatch = link?.href.match(/\/video\/(\d+)/);
      if (linkMatch?.[1]) return linkMatch[1];

      const xgContainer = video?.closest('[id^="xgwrapper"]');
      if (xgContainer?.id) return xgContainer.id;

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
