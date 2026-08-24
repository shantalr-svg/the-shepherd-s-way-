import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createConfirmedInternalAuthUser,
  createSecuredProfileUpdate,
} from '../src/lib/accounts/auth-user.ts'

const input = {
  email: '263772829203@phone.invalid',
  password: 'TemporaryPass1!xx',
  fullName: 'Shantal Renco',
}

test('creates a confirmed internal-email Auth user', async () => {
  let received: unknown
  const admin = {
    createUser: async (attributes: unknown) => {
      received = attributes
      return { data: { user: { id: 'auth-1' } }, error: null }
    },
  }

  const result = await createConfirmedInternalAuthUser(admin, input)

  assert.deepEqual(received, {
    email: '263772829203@phone.invalid',
    password: 'TemporaryPass1!xx',
    email_confirm: true,
    user_metadata: { full_name: 'Shantal Renco' },
  })
  assert.deepEqual(result, { authId: 'auth-1' })
})

test('surfaces a Supabase administrator error', async () => {
  const expected = new Error('Auth service unavailable')
  const admin = {
    createUser: async () => ({ data: { user: null }, error: expected }),
  }

  await assert.rejects(createConfirmedInternalAuthUser(admin, input), expected)
})

test('rejects a successful response without an Auth user', async () => {
  const admin = {
    createUser: async () => ({ data: { user: null }, error: null }),
  }

  await assert.rejects(
    createConfirmedInternalAuthUser(admin, input),
    /Auth user creation failed/,
  )
})

test('builds a secured profile update without retaining the Auth-only email', () => {
  assert.deepEqual(
    createSecuredProfileUpdate(
      {
        fullName: 'Shantal Renco',
        phone: '+263772829203',
        role: 'admin',
      },
      'admin-1',
    ),
    {
      full_name: 'Shantal Renco',
      phone: '+263772829203',
      email: null,
      role: 'admin',
      must_change_password: true,
      is_active: true,
      created_by: 'admin-1',
    },
  )
})
