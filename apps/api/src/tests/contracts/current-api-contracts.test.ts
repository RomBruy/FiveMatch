import { describe, expect, it } from 'vitest'
import { findForbiddenResponseFields } from './contract-assertions'

describe('recursive forbidden-field assertion', () => {
  it('detects sensitive fields regardless of nesting, array position or snake_case', () => {
    const unsafe = {
      safe: true,
      nested: [{ reporter_user_id: 'user-1' }, { deeper: { individualScore: 7 } }],
    }
    expect(findForbiddenResponseFields(unsafe)).toEqual([
      '$.nested[0].reporter_user_id',
      '$.nested[1].deeper.individualScore',
    ])
  })
})
