import type { Group } from '@fivematch/types'

export type TestDb = {
  query: (sql: string, params?: unknown[]) => Promise<unknown[]>
  close: () => Promise<void>
}

export type ClerkMock = {
  verifyToken: (_token: string) => Promise<{ userId: string }>
}

export const createTestDb = (): Promise<TestDb> => {
  throw new Error('not implemented')
}

export const createClerkMock = (): ClerkMock => {
  throw new Error('not implemented')
}

export const createTestGroup = (_params?: { name?: string }): Promise<Group> => {
  throw new Error('not implemented')
}
