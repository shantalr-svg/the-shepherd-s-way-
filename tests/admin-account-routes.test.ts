import assert from 'node:assert/strict'
import test from 'node:test'

import { createAdminAccountHandlers } from '../src/lib/accounts/admin-handlers.ts'

const provisioned = {
  profileId: 'profile-1', authId: 'auth-1', normalizedPhone: '+263772829203',
  temporaryPassword: 'TemporaryPass1!xx',
}

function handlers(overrides: Record<string, unknown> = {}) {
  return createAdminAccountHandlers({
    authorize: async () => ({ ok: true as const, profileId: 'admin-1' }),
    provision: async () => provisioned,
    resetPassword: async () => ({ temporaryPassword: 'TemporaryPass1!xx' }),
    setActive: async () => undefined,
    ...overrides,
  })
}

test('account APIs reject unauthenticated and non-admin callers', async () => {
  const unauthorized = handlers({ authorize: async () => ({ ok: false, status: 401 as const }) })
  assert.equal((await unauthorized.create(new Request('http://x', { method: 'POST' }))).status, 401)
  const forbidden = handlers({ authorize: async () => ({ ok: false, status: 403 as const }) })
  assert.equal((await forbidden.reset('profile-1')).status, 403)
})

test('create validates JSON and returns a one-time credential', async () => {
  const api = handlers()
  assert.equal((await api.create(new Request('http://x', { method: 'POST', body: '{' }))).status, 400)
  const response = await api.create(new Request('http://x', {
    method: 'POST', body: JSON.stringify({ fullName: 'Shantal Renco', phone: '0772829203', role: 'admin' }),
  }))
  assert.equal(response.status, 201)
  assert.deepEqual(await response.json(), provisioned)
})

test('admin limit and duplicate phone errors become conflicts', async () => {
  for (const message of ['active administrator limit is five', 'phone number already exists']) {
    const api = handlers({ provision: async () => { throw new Error(message) } })
    const response = await api.create(new Request('http://x', {
      method: 'POST', body: JSON.stringify({ fullName: 'Test User', phone: '0772829203', role: 'admin' }),
    }))
    assert.equal(response.status, 409)
  }
})

test('reset and activation handlers return safe results', async () => {
  const api = handlers()
  assert.equal((await api.reset('profile-1')).status, 200)
  assert.equal((await api.setStatus('profile-1', new Request('http://x', { method: 'PATCH', body: '{"isActive":false}' }))).status, 200)
})
