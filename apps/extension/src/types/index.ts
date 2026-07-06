export type SupportedPlatform = 'youtube' | 'instagram' | 'tiktok';

export type MessageType =
  | 'TRACKING_HEARTBEAT'
  | 'CONTENT_CHANGED'
  | 'PLAYBACK_STATE_CHANGED'
  | 'PAGE_STATE_CHANGED'
  | 'SESSION_CHECKPOINT'
  | 'GET_TRACKING_STATUS'
  | 'GET_TODAY_SUMMARY'
  | 'GET_WEEKLY_SUMMARY'
  | 'GET_HISTORY'
  | 'GET_SETTINGS'
  | 'UPDATE_SETTINGS'
  | 'PAUSE_TRACKING'
  | 'RESUME_TRACKING'
  | 'DELETE_TODAY'
  | 'DELETE_ALL'
  | 'EXPORT_DATA'
  | 'FINALIZE_STALE_SESSIONS'
  | 'REGENERATE_AGGREGATES';

export interface EquivalentRates {
  readingPagesPerMinute: number;
  walkingStepsPerMinute: number;
  languageCardsPerMinute: number;
  scrollDistancePerAdvance: number;
}

export interface TrackingSettings {
  trackingEnabled: boolean;
  enabledPlatforms: SupportedPlatform[];
  idleDetectionEnabled: boolean;
  dailyReceiptTime: string;
  retentionDays: number;
  equivalentRates: EquivalentRates;
  onboardingComplete: boolean;
  locale: 'ru' | 'en';
  timezone: string;
  reportEnabled: boolean;
  email: string | null;
  emailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformTotals {
  youtube: number;
  instagram: number;
  tiktok: number;
}

export interface PlatformViewTotals {
  youtube: number;
  instagram: number;
  tiktok: number;
}

export interface ActiveSessionCheckpoint {
  sessionId: string;
  platform: SupportedPlatform;
  startedAt: string;
  lastQualifiedHeartbeatAt: string;
  activeSeconds: number;
  videosViewed: number;
  contentAdvances: number;
  quickSkips: number;
  engagedViews: number;
  completedViews: number;
  processedEventIds: string[];
}

export interface CompletedSession {
  id: string;
  platform: SupportedPlatform;
  startedAt: string;
  endedAt: string;
  activeSeconds: number;
  videosViewed: number;
  contentAdvances: number;
  quickSkips: number;
  engagedViews: number;
  completedViews: number;
}

export interface DailyAggregate {
  date: string;
  timezone: string;
  platformTotals: PlatformTotals;
  platformViews: PlatformViewTotals;
  activeSeconds: number;
  videosViewed: number;
  contentAdvances: number;
  quickSkips: number;
  engagedViews: number;
  completedViews: number;
  sessionCount: number;
  longestSessionSeconds: number;
}

export interface TrackingStatus {
  trackingEnabled: boolean;
  isPaused: boolean;
  currentPlatform: SupportedPlatform | null;
  currentSessionActiveSeconds: number;
  todayActiveSeconds: number;
  todayVideosViewed: number;
  platformTotals: PlatformTotals;
  adapterHealth: Record<SupportedPlatform, 'ok' | 'degraded' | 'unavailable'>;
}

export interface DetectedContent {
  contentId: string;
  durationSeconds: number | null;
}

export interface TodaySummary {
  aggregate: DailyAggregate | null;
  checkpoint: ActiveSessionCheckpoint | null;
  status: TrackingStatus;
}

export interface WeeklySummary {
  weekStart: string;
  weekEnd: string;
  totalActiveSeconds: number;
  dailyAverages: number;
  mostUsedPlatform: SupportedPlatform | null;
  longestDaySeconds: number;
  aggregates: DailyAggregate[];
}

export interface PersonalEquivalent {
  id: string;
  label: string;
  value: string;
  unit: string;
}

export interface ReceiptData {
  receiptId: string;
  date: string;
  status: string;
  platformLines: Array<{ label: string; seconds: number }>;
  videosViewed: number;
  contentAdvances: number;
  quickSkips: number;
  avgViewSeconds: number;
  totalActiveSeconds: number;
  equivalents: PersonalEquivalent[];
  estimatedScrollDistance: string | null;
}

export interface StorageSchema {
  settings: TrackingSettings;
  checkpoint: ActiveSessionCheckpoint | null;
  sessions: CompletedSession[];
  dailyAggregates: DailyAggregate[];
  contentHashSalt: string;
  processedEventIds: string[];
  adapterHealth: Record<SupportedPlatform, 'ok' | 'degraded' | 'unavailable'>;
}

export type CleanupFunction = () => void;

export type ObserverCallback = (event: ContentObserverEvent) => void;

export interface ContentObserverEvent {
  type: 'content_changed' | 'playback_changed' | 'page_state_changed';
  content: DetectedContent | null;
  isPlaying: boolean;
  visibilityRatio: number;
}

export interface PlatformAdapter {
  matchesCurrentPage(): boolean;
  getPlatform(): SupportedPlatform;
  getCurrentContent(): DetectedContent | null;
  getActiveVideoElement(): HTMLVideoElement | null;
  startObserving(callback: ObserverCallback): CleanupFunction;
  getStableContentIdentifier(): string | null;
}
