export type ReturnIntentKind = 'match'

export interface ReturnIntent {
  kind: ReturnIntentKind
  id: string
}

export const DEFAULT_LANDING: string

export function encodeReturnIntent(kind: ReturnIntentKind, id: string): string

export function parseReturnIntent(raw: string | null | undefined): ReturnIntent | null

export function returnIntentPath(raw: string | null | undefined): string
