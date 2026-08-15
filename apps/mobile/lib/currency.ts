import { getLocales } from 'expo-localization'

/**
 * The currencies a host can price a match in.
 *
 * `matches.currency` has been in the schema since it was written, defaulting to
 * EUR — but creation never sent one, so every match everywhere was priced in
 * euros and the match card only ever knew how to render that one symbol. This
 * is the list both ends now agree on; the ISO code is what is stored, the
 * symbol is display only.
 */
export const CURRENCIES: { code: string; symbol: string }[] = [
  { code: 'EUR', symbol: '€' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '£' },
  { code: 'CHF', symbol: 'CHF' },
  { code: 'PLN', symbol: 'zł' },
  { code: 'SEK', symbol: 'kr' },
]

/** Symbol for an ISO code, falling back to the code itself for anything else. */
export function currencySymbol(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.symbol ?? code
}

/**
 * The device's own currency, when the OS reports one we can render. Anything
 * unrecognised falls back to EUR — the schema default — rather than offering a
 * code with no symbol behind it.
 */
export function resolveDeviceCurrency(): string {
  const code = getLocales()[0]?.currencyCode
  return code && CURRENCIES.some((c) => c.code === code) ? code : 'EUR'
}
