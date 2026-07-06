import type { DetectedContent, PlatformAdapter, SupportedPlatform } from '@src/types';

export type { PlatformAdapter };

export function createBaseAdapter(platform: SupportedPlatform): Pick<
  PlatformAdapter,
  'getPlatform' | 'matchesCurrentPage'
> {
  return {
    getPlatform: () => platform,
    matchesCurrentPage: () => false,
  };
}

export function extractVideoIdFromPath(pathname: string, pattern: RegExp): string | null {
  const match = pathname.match(pattern);
  return match?.[1] ?? null;
}

export function getVideoDuration(video: HTMLVideoElement): number | null {
  if (Number.isFinite(video.duration) && video.duration > 0) {
    return video.duration;
  }
  return null;
}

export function findLargestVisibleVideo(videos: HTMLVideoElement[]): HTMLVideoElement | null {
  let best: HTMLVideoElement | null = null;
  let bestArea = 0;

  for (const video of videos) {
    const rect = video.getBoundingClientRect();
    const visibleWidth = Math.max(0, Math.min(rect.right, window.innerWidth) - Math.max(rect.left, 0));
    const visibleHeight = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
    const area = visibleWidth * visibleHeight;
    if (area > bestArea) {
      bestArea = area;
      best = video;
    }
  }

  return best;
}

export function buildDetectedContent(contentId: string, video: HTMLVideoElement | null): DetectedContent {
  return {
    contentId,
    durationSeconds: video ? getVideoDuration(video) : null,
  };
}
