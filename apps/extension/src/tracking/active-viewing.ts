import type { PlatformAdapter, SupportedPlatform } from '@src/types';
import { HEARTBEAT_INTERVAL_MS, VISIBILITY_THRESHOLD } from '@src/utils/constants';
import { capDeltaSeconds } from '@scroll-receipt/shared';
import { generateEventId } from '@src/utils/hash';
import { sendMessage } from '@src/utils/messaging';

interface ActiveViewingState {
  contentId: string | null;
  contentDurationSeconds: number | null;
  visibilityRatio: number;
  isPlaying: boolean;
  isBuffering: boolean;
  timeAdvancing: boolean;
  lastCurrentTime: number;
  lastTimeCheckAt: number;
  tabActive: boolean;
  windowFocused: boolean;
  documentVisible: boolean;
  isIdle: boolean;
}

export class ActiveViewingDetector {
  private state: ActiveViewingState = {
    contentId: null,
    contentDurationSeconds: null,
    visibilityRatio: 0,
    isPlaying: false,
    isBuffering: false,
    timeAdvancing: false,
    lastCurrentTime: 0,
    lastTimeCheckAt: 0,
    tabActive: true,
    windowFocused: true,
    documentVisible: true,
    isIdle: false,
  };

  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private intersectionObserver: IntersectionObserver | null = null;
  private observedVideo: HTMLVideoElement | null = null;
  private previousContentId: string | null = null;
  private playbackStartedAt: number | null = null;
  private accumulatedMs = 0;

  constructor(
    private adapter: PlatformAdapter,
    private platform: SupportedPlatform,
  ) {}

  start(): () => void {
    this.updatePageState();
    const cleanObserver = this.adapter.startObserving(() => {
      this.attachToActiveVideo();
    });

    document.addEventListener('visibilitychange', this.onVisibilityChange);
    window.addEventListener('focus', this.onFocus);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('pageshow', this.onPageShow);

    this.attachToActiveVideo();
    this.tickTimer = setInterval(() => this.tickPlayback(), 1000);
    this.flushTimer = setInterval(() => void this.flushDelta(false), HEARTBEAT_INTERVAL_MS);

    void this.setupIdleDetection();

    return () => {
      void this.flushDelta(true);
      cleanObserver();
      document.removeEventListener('visibilitychange', this.onVisibilityChange);
      window.removeEventListener('focus', this.onFocus);
      window.removeEventListener('blur', this.onBlur);
      window.removeEventListener('pagehide', this.onPageHide);
      window.removeEventListener('pageshow', this.onPageShow);
      if (this.tickTimer) clearInterval(this.tickTimer);
      if (this.flushTimer) clearInterval(this.flushTimer);
      this.intersectionObserver?.disconnect();
      this.detachVideoListeners();
    };
  }

  private onVisibilityChange = (): void => {
    this.state.documentVisible = document.visibilityState === 'visible';
    if (!this.state.documentVisible) void this.flushDelta(true);
  };

  private onFocus = (): void => {
    this.state.windowFocused = true;
    this.state.tabActive = true;
  };

  private onBlur = (): void => {
    this.state.windowFocused = false;
    void this.flushDelta(true);
  };

  private onPageHide = (): void => {
    this.state.tabActive = false;
    void this.flushDelta(true);
  };

  private onPageShow = (): void => {
    this.state.tabActive = true;
    this.state.documentVisible = document.visibilityState === 'visible';
  };

  private updatePageState(): void {
    this.state.documentVisible = document.visibilityState === 'visible';
    this.state.windowFocused = document.hasFocus();
    this.state.tabActive = document.visibilityState === 'visible';
  }

  private async setupIdleDetection(): Promise<void> {
    try {
      chrome.idle.setDetectionInterval(60);
      chrome.idle.onStateChanged.addListener(this.onIdleChange);
    } catch {
      this.state.isIdle = false;
    }
  }

  private onIdleChange = (state: 'active' | 'idle' | 'locked'): void => {
    this.state.isIdle = state === 'idle' || state === 'locked';
    if (this.state.isIdle) void this.flushDelta(true);
  };

  private attachToActiveVideo(): void {
    const video = this.adapter.getActiveVideoElement();
    if (video === this.observedVideo) {
      this.updateContentFromAdapter();
      return;
    }

    if (this.observedVideo && video !== this.observedVideo) {
      void this.flushDelta(true);
    }

    this.detachVideoListeners();
    this.observedVideo = video;

    if (!video) {
      this.state.visibilityRatio = 0;
      this.state.isPlaying = false;
      this.updateContentFromAdapter();
      return;
    }

    video.addEventListener('play', this.onPlaybackChange);
    video.addEventListener('playing', this.onPlaybackChange);
    video.addEventListener('pause', this.onPlaybackChange);
    video.addEventListener('ended', this.onPlaybackChange);
    video.addEventListener('waiting', this.onWaiting);
    video.addEventListener('stalled', this.onWaiting);
    video.addEventListener('seeking', this.onWaiting);
    video.addEventListener('seeked', this.onPlaybackChange);
    video.addEventListener('timeupdate', this.onTimeUpdate);
    video.addEventListener('ratechange', this.onPlaybackChange);

    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        this.state.visibilityRatio = entry?.intersectionRatio ?? 0;
      },
      { threshold: [0, 0.25, 0.5, 0.6, 0.75, 1] },
    );
    this.intersectionObserver.observe(video);

    this.onPlaybackChange();
    this.updateContentFromAdapter();
  }

  private detachVideoListeners(): void {
    if (!this.observedVideo) return;
    const v = this.observedVideo;
    v.removeEventListener('play', this.onPlaybackChange);
    v.removeEventListener('playing', this.onPlaybackChange);
    v.removeEventListener('pause', this.onPlaybackChange);
    v.removeEventListener('ended', this.onPlaybackChange);
    v.removeEventListener('waiting', this.onWaiting);
    v.removeEventListener('stalled', this.onWaiting);
    v.removeEventListener('seeking', this.onWaiting);
    v.removeEventListener('seeked', this.onPlaybackChange);
    v.removeEventListener('timeupdate', this.onTimeUpdate);
    v.removeEventListener('ratechange', this.onPlaybackChange);
    this.intersectionObserver?.disconnect();
    this.intersectionObserver = null;
    this.observedVideo = null;
  }

  private onWaiting = (): void => {
    this.state.isBuffering = true;
    this.playbackStartedAt = null;
  };

  private onPlaybackChange = (): void => {
    this.state.isPlaying = this.observedVideo?.paused === false && !this.observedVideo?.ended;
    this.state.isBuffering = false;
    if (!this.state.isPlaying) {
      this.playbackStartedAt = null;
      void this.flushDelta(true);
    }
  };

  private onTimeUpdate = (): void => {
    if (!this.observedVideo) return;
    const now = Date.now();
    const currentTime = this.observedVideo.currentTime;
    this.state.timeAdvancing =
      currentTime > this.state.lastCurrentTime && now - this.state.lastTimeCheckAt < 2000;
    this.state.lastCurrentTime = currentTime;
    this.state.lastTimeCheckAt = now;
  };

  private updateContentFromAdapter(): void {
    const content = this.adapter.getCurrentContent();
    const nextId = content?.contentId ?? null;
    if (nextId && nextId !== this.state.contentId) {
      void this.flushDelta(true);
    }
    this.state.contentId = nextId;
    this.state.contentDurationSeconds = content?.durationSeconds ?? null;
  }

  private isQualifiedActiveViewing(): boolean {
    if (!this.adapter.matchesCurrentPage()) return false;
    if (!this.state.tabActive || !this.state.windowFocused || !this.state.documentVisible) {
      return false;
    }
    if (this.state.isIdle) return false;
    if (!this.state.contentId || !this.observedVideo) return false;
    if (this.state.visibilityRatio < VISIBILITY_THRESHOLD) return false;
    if (!this.state.isPlaying || this.state.isBuffering) return false;
    if (!this.state.timeAdvancing) return false;
    return true;
  }

  private tickPlayback(): void {
    this.attachToActiveVideo();
    this.updatePageState();

    if (!this.isQualifiedActiveViewing()) {
      this.playbackStartedAt = null;
      return;
    }

    const now = performance.now();
    if (this.playbackStartedAt === null) {
      this.playbackStartedAt = now;
      return;
    }

    const deltaMs = now - this.playbackStartedAt;
    this.playbackStartedAt = now;
    this.accumulatedMs += deltaMs;
  }

  private async flushDelta(force: boolean): Promise<void> {
    if (this.accumulatedMs <= 0 && !force) return;

    const deltaSeconds = capDeltaSeconds(this.accumulatedMs, 30);
    this.accumulatedMs = 0;

    if (deltaSeconds <= 0 && !force) return;

    this.updateContentFromAdapter();
    const timestamp = new Date().toISOString();
    const contentChanged =
      this.state.contentId !== null &&
      this.previousContentId !== null &&
      this.state.contentId !== this.previousContentId;

    await sendMessage({
      type: 'TRACKING_HEARTBEAT',
      payload: {
        eventId: generateEventId(this.platform, timestamp, this.state.contentId, 'delta'),
        platform: this.platform,
        timestamp,
        contentId: this.state.contentId,
        contentDurationSeconds: this.state.contentDurationSeconds,
        deltaSeconds,
        qualifiedActiveSecond: deltaSeconds > 0,
        contentChanged: Boolean(contentChanged),
        isPlaying: this.state.isPlaying,
        visibilityRatio: this.state.visibilityRatio,
        tabActive: this.state.tabActive,
        windowFocused: this.state.windowFocused,
        documentVisible: this.state.documentVisible,
        isIdle: this.state.isIdle,
      },
    });

    if (this.state.contentId) {
      this.previousContentId = this.state.contentId;
    }
  }
}

export function initPlatformTracking(adapter: PlatformAdapter): () => void {
  if (!adapter.matchesCurrentPage()) {
    return () => undefined;
  }

  try {
    const detector = new ActiveViewingDetector(adapter, adapter.getPlatform());
    return detector.start();
  } catch {
    return () => undefined;
  }
}
