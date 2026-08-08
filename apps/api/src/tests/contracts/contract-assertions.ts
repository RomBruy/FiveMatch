/** Fields that must never be exposed to the subject of a rating/report or a public viewer. */
export const FORBIDDEN_RESPONSE_KEYS = [
  'raterPlayerId',
  'raterUserId',
  'reporterPlayerId',
  'reporterUserId',
  'ratingRef',
  'rawRating',
  'rawRatings',
  'ratingRecord',
  'ratingRecords',
  'individualRating',
  'individualScore',
  'userId',
  'internalUserId',
  'privateNotes',
  'latitude',
  'longitude',
  'ratingEventId',
  'ratingRecordId',
  'reportRecordId',
] as const

const normalizedForbidden = new Set(
  FORBIDDEN_RESPONSE_KEYS.map((key) => key.replace(/[_-]/g, '').toLowerCase()),
)

export function findForbiddenResponseFields(value: unknown, path = '$'): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((child, index) => findForbiddenResponseFields(child, `${path}[${index}]`))
  }
  if (value === null || typeof value !== 'object') return []

  const findings: string[] = []
  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`
    if (normalizedForbidden.has(key.replace(/[_-]/g, '').toLowerCase())) findings.push(childPath)
    findings.push(...findForbiddenResponseFields(child, childPath))
  }
  return findings
}
