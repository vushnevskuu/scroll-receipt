import type { SupportedPlatform } from '@src/types';

export interface HeartbeatPayload {
  eventId: string;
  platform: SupportedPlatform;
  timestamp: string;
  contentId: string | null;
  contentDurationSeconds: number | null;
  deltaSeconds: number;
  qualifiedActiveSecond: boolean;
  contentChanged: boolean;
  isPlaying: boolean;
  visibilityRatio: number;
  tabActive: boolean;
  windowFocused: boolean;
  documentVisible: boolean;
  isIdle: boolean;
}
