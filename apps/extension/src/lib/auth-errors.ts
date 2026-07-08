export function isEmailRateLimitError(error?: string | null): boolean {
  if (!error) return false;

  const normalized = error.toLowerCase();
  return (
    normalized.includes('email rate limit exceeded') ||
    normalized.includes('over_email_send_rate_limit') ||
    normalized.includes('rate limit')
  );
}

export function formatAuthSendError(
  error: string | undefined,
  locale: 'ru' | 'en',
): string {
  if (!error) {
    return locale === 'ru' ? 'Не удалось отправить письмо.' : 'Could not send the sign-in email.';
  }

  if (isEmailRateLimitError(error)) {
    return locale === 'ru'
      ? 'Сервер временно ограничил отправку писем. Если у вас уже есть код или ссылка из недавнего письма, вставьте их ниже. Иначе подождите пару минут и попробуйте снова.'
      : 'The server is temporarily rate-limiting sign-in emails. If you already have a recent code or sign-in link, paste it below. Otherwise wait a few minutes and try again.';
  }

  if (
    error.includes('RESEND_API_KEY not configured') ||
    error.includes('Missing Supabase secrets')
  ) {
    return locale === 'ru'
      ? 'В Supabase ещё не настроен email sender для auth-писем. Нужно добавить RESEND_API_KEY и RESEND_FROM в Secrets у Edge Functions.'
      : 'The Supabase project does not have an email sender configured for auth emails yet. Add RESEND_API_KEY and RESEND_FROM to the Edge Function secrets.';
  }

  return error;
}
