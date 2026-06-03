import type { SupportedLocale } from '@fit-five/shared';

export const DEFAULT_PREFERRED_LOCALE: SupportedLocale = 'fr';

export function isSupportedPreferredLocale(
  value: unknown,
): value is SupportedLocale {
  return value === 'fr' || value === 'en';
}

export function normalizePreferredLocale(value: string): SupportedLocale {
  return isSupportedPreferredLocale(value) ? value : DEFAULT_PREFERRED_LOCALE;
}
