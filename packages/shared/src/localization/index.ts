import { en } from './en.js';
import { fr } from './fr.js';

export const DEFAULT_LOCALE = 'fr';
export const supportedLocales = ['fr', 'en'] as const;

export type SupportedLocale = (typeof supportedLocales)[number];
type DeepStringDictionary<T> = {
  readonly [K in keyof T]: T[K] extends string ? string : DeepStringDictionary<T[K]>;
};

export type LocalizationDictionary = DeepStringDictionary<typeof fr>;

const dictionaries: Record<SupportedLocale, LocalizationDictionary> = {
  en,
  fr,
};

export function isSupportedLocale(value: unknown): value is SupportedLocale {
  return supportedLocales.includes(value as SupportedLocale);
}

export function normalizeLocale(value: unknown): SupportedLocale {
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

export function getLocalization(locale: unknown): LocalizationDictionary {
  return dictionaries[normalizeLocale(locale)] ?? dictionaries[DEFAULT_LOCALE];
}
