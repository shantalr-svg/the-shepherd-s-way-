import assert from 'node:assert/strict'
import test from 'node:test'
import { createAccountClient } from '../src/lib/accounts/client.ts'

test('managed user client uses protected account endpoints', async () => {
  const requests: Array<{ url: string; method: string }> = []
  const client = createAccountClient(async (input, init) => {
    requests.push({ url: String(input), method: init?.method ?? 'GET' })
    return Response.json({ temporaryPassword: 'TemporaryPass1!xx' })
  })
  await client.createManagedUser({ fullName: 'Test User', phone: '0772829203', role: 'discipler' })
  await client.resetManagedUserPassword('profile-1')
  await client.setManagedUserActive('profile-1', false)
  assert.deepEqual(requests, [
    { url: '/api/admin/users', method: 'POST' },
    { url: '/api/admin/users/profile-1/password', method: 'POST' },
    { url: '/api/admin/users/profile-1/status', method: 'PATCH' },
  ])
})

test('managed user client safely reports non-JSON failures', async () => {
  const client = createAccountClient(async () => new Response('gateway failure', { status: 502 }))
  await assert.rejects(client.resetManagedUserPassword('profile-1'), /Account request failed/)
})
