import type { EquivalentRates, SupportedPlatform, TrackingSettings } from '@src/types';

type Locale = TrackingSettings['locale'];

interface HeartbeatPayload {
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

interface ContentChangedPayload {
  eventId: string;
  platform: SupportedPlatform;
  timestamp: string;
  contentId: string | null;
  contentDurationSeconds: number | null;
}

interface PageStatePayload {
  eventId: string;
  platform: SupportedPlatform;
  timestamp: string;
  tabActive: boolean;
  windowFocused: boolean;
  documentVisible: boolean;
}

interface PlaybackStatePayload {
  eventId: string;
  platform: SupportedPlatform;
  timestamp: string;
  isPlaying: boolean;
  visibilityRatio: number;
}

interface SendTestReceiptPayload {
  locale?: Locale;
}

interface SignInOtpPayload {
  email: string;
  locale?: Locale;
}

interface VerifyOtpPayload {
  email: string;
  token: string;
}

interface UpdateProfilePayload {
  timezone?: string;
  reportEnabled?: boolean;
  reportTimeLocal?: string;
  locale?: Locale;
}

type ExtensionMessageWithoutPayload =
  | { type: 'GET_TRACKING_STATUS' }
  | { type: 'GET_TODAY_SUMMARY' }
  | { type: 'GET_WEEKLY_SUMMARY' }
  | { type: 'GET_HISTORY' }
  | { type: 'GET_SETTINGS' }
  | { type: 'PAUSE_TRACKING' }
  | { type: 'RESUME_TRACKING' }
  | { type: 'DELETE_TODAY' }
  | { type: 'DELETE_ALL' }
  | { type: 'EXPORT_DATA' }
  | { type: 'GET_SYNC_STATE' }
  | { type: 'SYNC_NOW' }
  | { type: 'SIGN_OUT' }
  | { type: 'FINALIZE_STALE_SESSIONS' }
  | { type: 'REGENERATE_AGGREGATES' };

export type ExtensionMessage =
  | { type: 'TRACKING_HEARTBEAT'; payload: HeartbeatPayload }
  | { type: 'CONTENT_CHANGED'; payload: ContentChangedPayload }
  | { type: 'PAGE_STATE_CHANGED'; payload: PageStatePayload }
  | { type: 'PLAYBACK_STATE_CHANGED'; payload: PlaybackStatePayload }
  | { type: 'UPDATE_SETTINGS'; payload: Partial<TrackingSettings> }
  | { type: 'SEND_TEST_RECEIPT'; payload: SendTestReceiptPayload }
  | { type: 'SIGN_IN_OTP'; payload: SignInOtpPayload }
  | { type: 'VERIFY_OTP'; payload: VerifyOtpPayload }
  | { type: 'UPDATE_PROFILE'; payload: UpdateProfilePayload }
  | ExtensionMessageWithoutPayload;

const simpleMessageTypes = new Set<ExtensionMessage['type']>([
  'GET_TRACKING_STATUS',
  'GET_TODAY_SUMMARY',
  'GET_WEEKLY_SUMMARY',
  'GET_HISTORY',
  'GET_SETTINGS',
  'PAUSE_TRACKING',
  'RESUME_TRACKING',
  'DELETE_TODAY',
  'DELETE_ALL',
  'EXPORT_DATA',
  'GET_SYNC_STATE',
  'SYNC_NOW',
  'SIGN_OUT',
  'FINALIZE_STALE_SESSIONS',
  'REGENERATE_AGGREGATES',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isNonEmptyString(value: unknown): value is string {
  return isString(value) && value.trim().length > 0;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isPositiveNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || isString(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isEmail(value: unknown): value is string {
  return isString(value) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isLocale(value: unknown): value is Locale {
  return value === 'ru' || value === 'en';
}

function isSupportedPlatform(value: unknown): value is SupportedPlatform {
  return value === 'youtube' || value === 'instagram' || value === 'tiktok';
}

function isSupportedPlatformList(value: unknown): value is SupportedPlatform[] {
  return Array.isArray(value) && value.every(isSupportedPlatform);
}

function isEquivalentRates(value: unknown): value is EquivalentRates {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isPositiveNumber(value.readingPagesPerMinute) &&
    isPositiveNumber(value.walkingStepsPerMinute) &&
    isPositiveNumber(value.languageCardsPerMinute) &&
    isPositiveNumber(value.scrollDistancePerAdvance)
  );
}

function hasOnlyAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isHeartbeatPayload(value: unknown): value is HeartbeatPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.eventId) &&
    isSupportedPlatform(value.platform) &&
    isNonEmptyString(value.timestamp) &&
    isNullableString(value.contentId) &&
    isNullableNumber(value.contentDurationSeconds) &&
    Number.isInteger(value.deltaSeconds) &&
    Number(value.deltaSeconds) >= 0 &&
    Number(value.deltaSeconds) <= 30 &&
    isBoolean(value.qualifiedActiveSecond) &&
    isBoolean(value.contentChanged) &&
    isBoolean(value.isPlaying) &&
    isFiniteNumber(value.visibilityRatio) &&
    value.visibilityRatio >= 0 &&
    value.visibilityRatio <= 1 &&
    isBoolean(value.tabActive) &&
    isBoolean(value.windowFocused) &&
    isBoolean(value.documentVisible) &&
    isBoolean(value.isIdle)
  );
}

function isContentChangedPayload(value: unknown): value is ContentChangedPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.eventId) &&
    isSupportedPlatform(value.platform) &&
    isNonEmptyString(value.timestamp) &&
    isNullableString(value.contentId) &&
    isNullableNumber(value.contentDurationSeconds)
  );
}

function isPageStatePayload(value: unknown): value is PageStatePayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.eventId) &&
    isSupportedPlatform(value.platform) &&
    isNonEmptyString(value.timestamp) &&
    isBoolean(value.tabActive) &&
    isBoolean(value.windowFocused) &&
    isBoolean(value.documentVisible)
  );
}

function isPlaybackStatePayload(value: unknown): value is PlaybackStatePayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isNonEmptyString(value.eventId) &&
    isSupportedPlatform(value.platform) &&
    isNonEmptyString(value.timestamp) &&
    isBoolean(value.isPlaying) &&
    isFiniteNumber(value.visibilityRatio) &&
    value.visibilityRatio >= 0 &&
    value.visibilityRatio <= 1
  );
}

function isTrackingSettingsPatch(value: unknown): value is Partial<TrackingSettings> {
  if (!isRecord(value)) {
    return false;
  }

  const allowedKeys = [
    'trackingEnabled',
    'enabledPlatforms',
    'idleDetectionEnabled',
    'dailyReceiptTime',
    'retentionDays',
    'equivalentRates',
    'onboardingComplete',
    'locale',
    'timezone',
    'reportEnabled',
    'email',
    'emailVerified',
    'createdAt',
    'updatedAt',
  ] as const;

  if (!hasOnlyAllowedKeys(value, allowedKeys)) {
    return false;
  }

  return (
    (value.trackingEnabled === undefined || isBoolean(value.trackingEnabled)) &&
    (value.enabledPlatforms === undefined || isSupportedPlatformList(value.enabledPlatforms)) &&
    (value.idleDetectionEnabled === undefined || isBoolean(value.idleDetectionEnabled)) &&
    (value.dailyReceiptTime === undefined || isNonEmptyString(value.dailyReceiptTime)) &&
    (value.retentionDays === undefined || isPositiveInteger(value.retentionDays)) &&
    (value.equivalentRates === undefined || isEquivalentRates(value.equivalentRates)) &&
    (value.onboardingComplete === undefined || isBoolean(value.onboardingComplete)) &&
    (value.locale === undefined || isLocale(value.locale)) &&
    (value.timezone === undefined || isNonEmptyString(value.timezone)) &&
    (value.reportEnabled === undefined || isBoolean(value.reportEnabled)) &&
    (value.email === undefined || value.email === null || isEmail(value.email)) &&
    (value.emailVerified === undefined || isBoolean(value.emailVerified)) &&
    (value.createdAt === undefined || isNonEmptyString(value.createdAt)) &&
    (value.updatedAt === undefined || isNonEmptyString(value.updatedAt))
  );
}

function isSendTestReceiptPayload(value: unknown): value is SendTestReceiptPayload {
  if (!isRecord(value)) {
    return false;
  }

  return hasOnlyAllowedKeys(value, ['locale']) && (value.locale === undefined || isLocale(value.locale));
}

function isSignInOtpPayload(value: unknown): value is SignInOtpPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasOnlyAllowedKeys(value, ['email', 'locale']) &&
    isEmail(value.email) &&
    (value.locale === undefined || isLocale(value.locale))
  );
}

function isVerifyOtpPayload(value: unknown): value is VerifyOtpPayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasOnlyAllowedKeys(value, ['email', 'token']) &&
    isEmail(value.email) &&
    isNonEmptyString(value.token) &&
    value.token.trim().length >= 4
  );
}

function isUpdateProfilePayload(value: unknown): value is UpdateProfilePayload {
  if (!isRecord(value)) {
    return false;
  }

  return (
    hasOnlyAllowedKeys(value, ['timezone', 'reportEnabled', 'reportTimeLocal', 'locale']) &&
    (value.timezone === undefined || isNonEmptyString(value.timezone)) &&
    (value.reportEnabled === undefined || isBoolean(value.reportEnabled)) &&
    (value.reportTimeLocal === undefined || isNonEmptyString(value.reportTimeLocal)) &&
    (value.locale === undefined || isLocale(value.locale))
  );
}

export function parseExtensionMessage(data: unknown): ExtensionMessage | null {
  if (!isRecord(data) || !isString(data.type)) {
    return null;
  }

  if (simpleMessageTypes.has(data.type as ExtensionMessage['type'])) {
    return { type: data.type as ExtensionMessageWithoutPayload['type'] };
  }

  switch (data.type) {
    case 'TRACKING_HEARTBEAT':
      return isHeartbeatPayload(data.payload)
        ? { type: data.type, payload: data.payload }
        : null;
    case 'CONTENT_CHANGED':
      return isContentChangedPayload(data.payload)
        ? { type: data.type, payload: data.payload }
        : null;
    case 'PAGE_STATE_CHANGED':
      return isPageStatePayload(data.payload)
        ? { type: data.type, payload: data.payload }
        : null;
    case 'PLAYBACK_STATE_CHANGED':
      return isPlaybackStatePayload(data.payload)
        ? { type: data.type, payload: data.payload }
        : null;
    case 'UPDATE_SETTINGS':
      return isTrackingSettingsPatch(data.payload)
        ? { type: data.type, payload: data.payload }
        : null;
    case 'SEND_TEST_RECEIPT':
      return isSendTestReceiptPayload(data.payload)
        ? { type: data.type, payload: data.payload }
        : null;
    case 'SIGN_IN_OTP':
      return isSignInOtpPayload(data.payload)
        ? { type: data.type, payload: data.payload }
        : null;
    case 'VERIFY_OTP':
      return isVerifyOtpPayload(data.payload)
        ? { type: data.type, payload: data.payload }
        : null;
    case 'UPDATE_PROFILE':
      return isUpdateProfilePayload(data.payload)
        ? { type: data.type, payload: data.payload }
        : null;
    default:
      return null;
  }
}
