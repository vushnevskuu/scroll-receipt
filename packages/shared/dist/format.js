export function getLocalDateString(date = new Date(), timeZone) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date);
}
export function getLocalTimezone() {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
}
export function getPreviousLocalDate(timeZone, now = new Date()) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return getLocalDateString(yesterday, timeZone);
}
export function formatDurationHms(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return [hours, minutes, seconds].map((n) => String(n).padStart(2, '0')).join(':');
}
export function formatDurationHuman(totalSeconds, locale = 'ru') {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (locale === 'en') {
        if (hours === 0)
            return `${minutes} min`;
        return minutes === 0 ? `${hours} hr` : `${hours} hr ${minutes} min`;
    }
    if (hours === 0)
        return `${minutes} мин`;
    return minutes === 0 ? `${hours} ч` : `${hours} ч ${minutes} мин`;
}
export function formatReceiptDate(date, locale = 'ru') {
    const [year, month, day] = date.split('-');
    const monthsRu = ['ЯНВ', 'ФЕВ', 'МАР', 'АПР', 'МАЙ', 'ИЮН', 'ИЮЛ', 'АВГ', 'СЕН', 'ОКТ', 'НОЯ', 'ДЕК'];
    const monthsEn = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
    const m = Number(month) - 1;
    if (locale === 'en') {
        return `${day} ${monthsEn[m]} ${year}`;
    }
    return `${day} ${monthsRu[m]} ${year}`;
}
export function generateReceiptNumber(date, userSuffix) {
    const compact = date.replace(/-/g, '');
    return `SR-${compact}-${userSuffix.slice(0, 4).toUpperCase()}`;
}
export function emptyPlatformTotals() {
    return {
        instagram: { seconds: 0, views: 0 },
        youtube: { seconds: 0, views: 0 },
        tiktok: { seconds: 0, views: 0 },
    };
}
export function sumPlatformTotals(a, b) {
    return {
        instagram: {
            seconds: a.instagram.seconds + b.instagram.seconds,
            views: a.instagram.views + b.instagram.views,
        },
        youtube: {
            seconds: a.youtube.seconds + b.youtube.seconds,
            views: a.youtube.views + b.youtube.views,
        },
        tiktok: {
            seconds: a.tiktok.seconds + b.tiktok.seconds,
            views: a.tiktok.views + b.tiktok.views,
        },
    };
}
export function capDeltaSeconds(deltaMs, maxSeconds = 30) {
    const seconds = Math.max(0, deltaMs / 1000);
    return Math.min(Math.round(seconds), maxSeconds);
}
