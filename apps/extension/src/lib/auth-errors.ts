function extractJsonMessage(value: string): string | null {
  try {
    const parsed = JSON.parse(value) as
      | string
      | { error?: unknown; message?: unknown };

    if (typeof parsed === 'string') return parsed;
    if (typeof parsed?.error === 'string') return parsed.error;
    if (typeof parsed?.message === 'string') return parsed.message;
  } catch {
    return null;
  }

  return null;
}

function unwrapProviderError(error: string): string {
  let current = error.trim();

  for (let depth = 0; depth < 4; depth += 1) {
    if (!current) break;

    if (current.startsWith('Resend error:')) {
      current = current.slice('Resend error:'.length).trim();
      continue;
    }

    const parsed = extractJsonMessage(current);
    if (parsed && parsed !== current) {
      current = parsed.trim();
      continue;
    }

    const nestedJsonStart = current.indexOf('{"statusCode"');
    if (nestedJsonStart >= 0) {
      const parsedNested = extractJsonMessage(current.slice(nestedJsonStart));
      if (parsedNested) {
        current = parsedNested.trim();
        continue;
      }
    }

    break;
  }

  return current;
}

export function getEmailProviderErrorText(error?: string | null): string | null {
  if (!error) return null;
  return unwrapProviderError(error);
}

export function isEmailRateLimitError(error?: string | null): boolean {
  if (!error) return false;

  const normalized = (getEmailProviderErrorText(error) ?? error).toLowerCase();
  return (
    normalized.includes('email rate limit exceeded') ||
    normalized.includes('over_email_send_rate_limit') ||
    normalized.includes('rate limit')
  );
}

function isResendTestModeError(error?: string | null): boolean {
  if (!error) return false;

  const normalized = (getEmailProviderErrorText(error) ?? error).toLowerCase();
  return (
    normalized.includes('you can only send testing emails to your own email address') ||
    normalized.includes('resend test mode is enabled') ||
    normalized.includes('resend is configured in test mode') ||
    normalized.includes('onboarding@resend.dev')
  );
}

function isSuppressedRecipientError(error?: string | null): boolean {
  if (!error) return false;

  const normalized = (getEmailProviderErrorText(error) ?? error).toLowerCase();
  return (
    normalized.includes('temporarily blocked because previous emails') ||
    normalized.includes('marked as spam') ||
    normalized.includes('suppression')
  );
}

function formatKnownEmailSendError(
  error: string | undefined,
  locale: 'ru' | 'en',
): string | null {
  if (!error) return null;

  const normalized = (getEmailProviderErrorText(error) ?? error).toLowerCase();

  if (isEmailRateLimitError(error)) {
    return locale === 'ru'
      ? 'Сервер временно ограничил отправку писем. Если у вас уже есть код или ссылка из недавнего письма, вставьте их ниже. Иначе подождите пару минут и попробуйте снова.'
      : 'The server is temporarily rate-limiting sign-in emails. If you already have a recent code or sign-in link, paste it below. Otherwise wait a few minutes and try again.';
  }

  if (isResendTestModeError(error)) {
    return locale === 'ru'
      ? 'Сервис отправки писем всё ещё в режиме теста Resend. Чтобы письма уходили всем пользователям, нужно в Resend подтвердить свой домен и указать RESEND_FROM на адресе этого домена, например Scroll Receipt <hello@mail.yourdomain.com>.'
      : 'Email delivery is still using Resend test mode. To send emails to all users, verify your domain in Resend and set RESEND_FROM to an address on that domain, for example Scroll Receipt <hello@mail.yourdomain.com>.';
  }

  if (isSuppressedRecipientError(error)) {
    return locale === 'ru'
      ? 'Этот email сейчас заблокирован для отправки, потому что прошлые письма на него вернулись или были помечены как спам. Укажите другой адрес или попросите администратора снять блокировку после исправления почтового ящика.'
      : 'This email is currently blocked because previous messages to it bounced or were marked as spam. Use a different address or ask the admin to clear the suppression after the inbox issue is fixed.';
  }

  if (
    normalized.includes('resend_api_key not configured') ||
    normalized.includes('resend_from not configured') ||
    normalized.includes('missing supabase secrets')
  ) {
    return locale === 'ru'
      ? 'В Supabase ещё не настроен production email sender. Нужно добавить RESEND_API_KEY и RESEND_FROM в Secrets у Edge Functions.'
      : 'The Supabase project does not have a production email sender configured yet. Add RESEND_API_KEY and RESEND_FROM to the Edge Function secrets.';
  }

  if (normalized.includes('domain is not verified')) {
    return locale === 'ru'
      ? 'Домен отправителя в Resend ещё не подтверждён. Подтвердите домен в Resend и оставьте RESEND_FROM на адресе этого домена.'
      : 'The sender domain is not verified in Resend yet. Verify the domain in Resend and keep RESEND_FROM on an address from that domain.';
  }

  return null;
}

export function formatEmailSendError(
  error: string | undefined,
  locale: 'ru' | 'en',
): string {
  if (!error) {
    return locale === 'ru' ? 'Не удалось отправить письмо.' : 'Could not send the email.';
  }

  return (
    formatKnownEmailSendError(error, locale) ??
    getEmailProviderErrorText(error) ??
    (locale === 'ru' ? 'Не удалось отправить письмо.' : 'Could not send the email.')
  );
}

export function formatAuthSendError(
  error: string | undefined,
  locale: 'ru' | 'en',
): string {
  if (!error) {
    return locale === 'ru' ? 'Не удалось отправить письмо.' : 'Could not send the sign-in email.';
  }

  return (
    formatKnownEmailSendError(error, locale) ??
    getEmailProviderErrorText(error) ??
    (locale === 'ru' ? 'Не удалось отправить письмо.' : 'Could not send the sign-in email.')
  );
}
