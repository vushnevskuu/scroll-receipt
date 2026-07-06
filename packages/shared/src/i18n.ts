export type Locale = 'ru' | 'en';

const messages = {
  ru: {
    appName: 'Scroll Receipt',
    trackingOn: 'Отслеживание включено',
    trackingPaused: 'Отслеживание на паузе',
    todayTotal: 'Сегодня',
    views: 'Просмотров',
    settings: 'Настройки',
    syncOk: 'Синхронизировано',
    syncPending: 'Ожидает синхронизации',
    syncError: 'Ошибка синхронизации',
    offline: 'Нет сети',
    empty: 'Пока нет активности',
    onboardingTitle: 'Scroll Receipt',
    onboardingDesc: 'Считает время просмотра Reels, Shorts и TikTok только в браузере.',
    email: 'Email',
    sendOtp: 'Отправить код',
    otp: 'Код из письма',
    verify: 'Подтвердить',
    timezone: 'Часовой пояс',
    reportEnabled: 'Ежедневный чек на email',
    reportTime: 'Время отправки',
    testReceipt: 'Отправить тестовый чек',
    exportData: 'Экспорт данных',
    deleteData: 'Удалить все данные',
    privacy: 'Политика конфиденциальности',
    browserOnly: 'Только активность в браузере',
  },
  en: {
    appName: 'Scroll Receipt',
    trackingOn: 'Tracking on',
    trackingPaused: 'Tracking paused',
    todayTotal: 'Today',
    views: 'Views',
    settings: 'Settings',
    syncOk: 'Synced',
    syncPending: 'Pending sync',
    syncError: 'Sync error',
    offline: 'Offline',
    empty: 'No activity yet',
    onboardingTitle: 'Scroll Receipt',
    onboardingDesc: 'Counts Reels, Shorts, and TikTok watch time in your browser only.',
    email: 'Email',
    sendOtp: 'Send code',
    otp: 'Verification code',
    verify: 'Verify',
    timezone: 'Timezone',
    reportEnabled: 'Daily email receipt',
    reportTime: 'Send time',
    testReceipt: 'Send test receipt',
    exportData: 'Export data',
    deleteData: 'Delete all data',
    privacy: 'Privacy policy',
    browserOnly: 'Browser activity only',
  },
} as const;

export function t(locale: Locale, key: keyof (typeof messages)['ru']): string {
  return messages[locale][key];
}

export { messages };
