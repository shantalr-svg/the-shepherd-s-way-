import assert from 'node:assert/strict'
import test from 'node:test'

import {
  provisionAccount,
  resetAccountPassword,
  type AccountDependencies,
} from '../src/lib/accounts/provision.ts'

function createDependencies(overrides: Partial<AccountDependencies> = {}) {
  const events: Array<{ name: string; value?: unknown }> = []
  const dependencies: AccountDependencies = {
    findProfileByPhone: async () => null,
    createAuthUser: async (input) => {
      events.push({ name: 'auth-created', value: input })
      return { authId: 'auth-1' }
    },
    secureProfile: async (authId, input) => {
      events.push({ name: 'profile-secured', value: { authId, input } })
      return { profileId: 'profile-1' }
    },
    deleteAuthUser: async (authId) => {
      events.push({ name: 'auth-deleted', value: authId })
    },
    deleteProfile: async (profileId) => {
      events.push({ name: 'profile-deleted', value: profileId })
    },
    recordAudit: async (event) => {
      events.push({ name: 'audit', value: event })
    },
    findProfileById: async () => ({ authId: 'auth-1', isActive: true }),
    updateAuthPassword: async () => undefined,
    markPasswordResetRequired: async () => undefined,
    generatePassword: () => 'TemporaryPass1!xx',
    ...overrides,
  }
  return { dependencies, events }
}

test('provisions a normalized phone account and returns its password once', async () => {
  const { dependencies, events } = createDependencies()
  const result = await provisionAccount(
    { fullName: 'Shantal Renco', phone: '0772829203', role: 'admin' },
    dependencies,
  )

  assert.deepEqual(result, {
    profileId: 'profile-1',
    authId: 'auth-1',
    normalizedPhone: '+263772829203',
    temporaryPassword: 'TemporaryPass1!xx',
  })
  assert.equal(events[0]?.name, 'auth-created')
  assert.deepEqual(events[0]?.value, {
    email: '263772829203@phone.invalid',
    password: 'TemporaryPass1!xx',
    fullName: 'Shantal Renco',
  })
  assert.doesNotMatch(JSON.stringify(result), /phone\.invalid/)
  assert.equal(events[1]?.name, 'profile-secured')
  assert.equal(events[2]?.name, 'audit')
  assert.doesNotMatch(JSON.stringify(events[2]), /TemporaryPass1!xx/)
})

test('removes the auth user when securing the profile fails', async () => {
  const { dependencies, events } = createDependencies({
    secureProfile: async () => {
      throw new Error('profile write failed')
    },
  })

  await assert.rejects(
    provisionAccount(
      { fullName: 'Test User', phone: '0772829203', role: 'discipler' },
      dependencies,
    ),
    /profile write failed/,
  )
  assert.equal(events.at(-1)?.name, 'auth-deleted')
})

test('removes the secured profile and auth user when auditing fails', async () => {
  const { dependencies, events } = createDependencies({
    recordAudit: async () => {
      throw new Error('audit write failed')
    },
  })

  await assert.rejects(
    provisionAccount(
      { fullName: 'Test User', phone: '0772829203', role: 'discipler' },
      dependencies,
    ),
    /audit write failed/,
  )
  assert.deepEqual(
    events.slice(-2).map((event) => event.name),
    ['profile-deleted', 'auth-deleted'],
  )
})

test('rejects an existing normalized phone before creating auth state', async () => {
  const { dependencies, events } = createDependencies({
    findProfileByPhone: async () => ({ profileId: 'existing' }),
  })

  await assert.rejects(
    provisionAccount(
      { fullName: 'Existing User', phone: '0772829203', role: 'discipler' },
      dependencies,
    ),
    /already exists/,
  )
  assert.equal(events.length, 0)
})

test('password reset forces another replacement without auditing the password', async () => {
  const { dependencies, events } = createDependencies({
    updateAuthPassword: async (authId, password) => {
      events.push({ name: 'password-updated', value: { authId, password } })
    },
    markPasswordResetRequired: async (profileId) => {
      events.push({ name: 'reset-required', value: profileId })
    },
  })

  const result = await resetAccountPassword('profile-1', dependencies)

  assert.deepEqual(result, { temporaryPassword: 'TemporaryPass1!xx' })
  assert.equal(events[0]?.name, 'password-updated')
  assert.equal(events[1]?.name, 'reset-required')
  assert.equal(events[2]?.name, 'audit')
  assert.doesNotMatch(JSON.stringify(events[2]), /TemporaryPass1!xx/)
})
