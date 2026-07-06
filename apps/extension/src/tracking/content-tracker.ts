import type { ContentProgressEntry } from '@src/storage/repositories';
import {
  COMPLETED_THRESHOLD_RATIO,
  ENGAGED_THRESHOLD_SECONDS,
  VIEWED_THRESHOLD_SECONDS,
} from '@src/utils/constants';
import { hashContentId } from '@src/utils/hash';

export interface ContentUpdateResult {
  progress: Record<string, ContentProgressEntry>;
  contentAdvance: boolean;
  videoViewed: boolean;
  quickSkip: boolean;
  engagedView: boolean;
  completedView: boolean;
}

export class ContentTracker {
  private previousContentId: string | null = null;
  private contentIdToHash = new Map<string, string>();

  constructor(private progress: Record<string, ContentProgressEntry>) {}

  static fromProgress(progress: Record<string, ContentProgressEntry>): ContentTracker {
    return new ContentTracker({ ...progress });
  }

  getProgress(): Record<string, ContentProgressEntry> {
    return { ...this.progress };
  }

  async processQualifiedSecond(
    contentId: string | null,
    contentDurationSeconds: number | null,
    dailySalt: string,
    contentChanged: boolean,
  ): Promise<ContentUpdateResult> {
    const result: ContentUpdateResult = {
      progress: this.progress,
      contentAdvance: false,
      videoViewed: false,
      quickSkip: false,
      engagedView: false,
      completedView: false,
    };

    if (!contentId) {
      if (this.previousContentId && contentChanged) {
        result.quickSkip = await this.markQuickSkipIfNeeded(this.previousContentId);
      }
      this.previousContentId = null;
      return result;
    }

    if (contentChanged && this.previousContentId && this.previousContentId !== contentId) {
      result.contentAdvance = true;
      result.quickSkip = await this.markQuickSkipIfNeeded(this.previousContentId);
    }

    const hash = await hashContentId(contentId, dailySalt);
    this.contentIdToHash.set(contentId, hash);

    const entry = this.progress[hash] ?? {
      hash,
      qualifiedSeconds: 0,
      viewed: false,
      engaged: false,
      completed: false,
      quickSkip: false,
    };

    entry.qualifiedSeconds += 1;

    if (!entry.viewed && entry.qualifiedSeconds >= VIEWED_THRESHOLD_SECONDS) {
      entry.viewed = true;
      result.videoViewed = true;
    }

    if (!entry.engaged && entry.qualifiedSeconds >= ENGAGED_THRESHOLD_SECONDS) {
      entry.engaged = true;
      result.engagedView = true;
    }

    if (
      !entry.completed &&
      contentDurationSeconds &&
      contentDurationSeconds > 0 &&
      entry.qualifiedSeconds >= contentDurationSeconds * COMPLETED_THRESHOLD_RATIO
    ) {
      entry.completed = true;
      result.completedView = true;
    }

    this.progress[hash] = entry;
    this.previousContentId = contentId;
    result.progress = this.progress;
    return result;
  }

  private async markQuickSkipIfNeeded(contentId: string): Promise<boolean> {
    const hash =
      this.contentIdToHash.get(contentId) ?? (await hashContentId(contentId, 'memory-only'));
    const entry = this.progress[hash];
    if (!entry) {
      return false;
    }
    if (!entry.viewed && !entry.quickSkip) {
      entry.quickSkip = true;
      return true;
    }
    return false;
  }
}
