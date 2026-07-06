import type {
  ActiveSessionCheckpoint,
  CompletedSession,
  DailyAggregate,
  SupportedPlatform,
} from '@src/types';
import type { HeartbeatPayload } from '@src/tracking/types';
import { ContentTracker } from '@src/tracking/content-tracker';
import { rebuildDailyAggregates } from '@src/tracking/daily-aggregation';
import { createSessionId, storageRepo } from '@src/storage/repositories';
import { SESSION_GAP_MERGE_SECONDS, STALE_SESSION_SECONDS } from '@src/utils/constants';

export class SessionEngine {
  private contentTracker: ContentTracker | null = null;

  async initialize(): Promise<void> {
    const progress = await storageRepo.getContentProgress();
    this.contentTracker = ContentTracker.fromProgress(progress);
  }

  async processHeartbeat(payload: HeartbeatPayload): Promise<void> {
    const isNew = await storageRepo.addProcessedEventId(payload.eventId);
    if (!isNew) return;

    const settings = await storageRepo.getSettings();
    if (!settings.trackingEnabled || !settings.enabledPlatforms.includes(payload.platform)) {
      return;
    }

    if (!this.contentTracker) {
      await this.initialize();
    }

    const checkpoint = await storageRepo.getCheckpoint();
    const now = payload.timestamp;

    if (payload.deltaSeconds > 0 || payload.qualifiedActiveSecond) {
      await this.handleQualifiedHeartbeat(payload, checkpoint, now);
    } else if (checkpoint) {
      await this.maybeFinalizeSession(checkpoint, now);
    }
  }

  async finalizeStaleSessions(now = new Date().toISOString()): Promise<void> {
    const checkpoint = await storageRepo.getCheckpoint();
    if (!checkpoint) return;

    const elapsed =
      (new Date(now).getTime() - new Date(checkpoint.lastQualifiedHeartbeatAt).getTime()) / 1000;

    if (elapsed > STALE_SESSION_SECONDS) {
      await this.finalizeCheckpoint(checkpoint, checkpoint.lastQualifiedHeartbeatAt);
    }
  }

  async regenerateAggregates(): Promise<DailyAggregate[]> {
    const sessions = await storageRepo.getSessions();
    const aggregates = rebuildDailyAggregates(sessions);
    await storageRepo.saveDailyAggregates(aggregates);
    return aggregates;
  }

  private async handleQualifiedHeartbeat(
    payload: HeartbeatPayload,
    checkpoint: ActiveSessionCheckpoint | null,
    now: string,
  ): Promise<void> {
    let activeCheckpoint = checkpoint;

    if (!activeCheckpoint) {
      activeCheckpoint = this.createCheckpoint(payload.platform, now);
    } else if (activeCheckpoint.platform !== payload.platform) {
      await this.finalizeCheckpoint(activeCheckpoint, now);
      activeCheckpoint = this.createCheckpoint(payload.platform, now);
    } else {
      const gapSeconds =
        (new Date(now).getTime() - new Date(activeCheckpoint.lastQualifiedHeartbeatAt).getTime()) /
        1000;

      if (gapSeconds > SESSION_GAP_MERGE_SECONDS) {
        await this.finalizeCheckpoint(activeCheckpoint, activeCheckpoint.lastQualifiedHeartbeatAt);
        activeCheckpoint = this.createCheckpoint(payload.platform, now);
      }
    }

    activeCheckpoint.lastQualifiedHeartbeatAt = now;
    if (payload.deltaSeconds > 0) {
      activeCheckpoint.activeSeconds += payload.deltaSeconds;

      const salt = await storageRepo.getContentHashSalt();
      for (let i = 0; i < payload.deltaSeconds; i++) {
        const contentResult = await this.contentTracker!.processQualifiedSecond(
          payload.contentId,
          payload.contentDurationSeconds,
          salt,
          payload.contentChanged && i === 0,
        );
        if (contentResult.contentAdvance) activeCheckpoint.contentAdvances += 1;
        if (contentResult.videoViewed) {
          activeCheckpoint.videosViewed += 1;
        }
        if (contentResult.quickSkip) activeCheckpoint.quickSkips += 1;
        if (contentResult.engagedView) activeCheckpoint.engagedViews += 1;
        if (contentResult.completedView) activeCheckpoint.completedViews += 1;
        await storageRepo.saveContentProgress(contentResult.progress);
      }
    }

    await storageRepo.saveCheckpoint(activeCheckpoint);
  }

  private createCheckpoint(platform: SupportedPlatform, now: string): ActiveSessionCheckpoint {
    return {
      sessionId: createSessionId(),
      platform,
      startedAt: now,
      lastQualifiedHeartbeatAt: now,
      activeSeconds: 0,
      videosViewed: 0,
      contentAdvances: 0,
      quickSkips: 0,
      engagedViews: 0,
      completedViews: 0,
      processedEventIds: [],
    };
  }

  private async maybeFinalizeSession(
    checkpoint: ActiveSessionCheckpoint,
    now: string,
  ): Promise<void> {
    const elapsed =
      (new Date(now).getTime() - new Date(checkpoint.lastQualifiedHeartbeatAt).getTime()) / 1000;
    if (elapsed > STALE_SESSION_SECONDS) {
      await this.finalizeCheckpoint(checkpoint, checkpoint.lastQualifiedHeartbeatAt);
    }
  }

  private async finalizeCheckpoint(
    checkpoint: ActiveSessionCheckpoint,
    endedAt: string,
  ): Promise<void> {
    if (checkpoint.activeSeconds <= 0) {
      await storageRepo.saveCheckpoint(null);
      return;
    }

    const session: CompletedSession = {
      id: checkpoint.sessionId,
      platform: checkpoint.platform,
      startedAt: checkpoint.startedAt,
      endedAt,
      activeSeconds: checkpoint.activeSeconds,
      videosViewed: checkpoint.videosViewed,
      contentAdvances: checkpoint.contentAdvances,
      quickSkips: checkpoint.quickSkips,
      engagedViews: checkpoint.engagedViews,
      completedViews: checkpoint.completedViews,
    };

    await storageRepo.addSession(session);
    await storageRepo.saveCheckpoint(null);
    await storageRepo.pruneOldSessions();
    await this.regenerateAggregates();
  }

}

export const sessionEngine = new SessionEngine();
