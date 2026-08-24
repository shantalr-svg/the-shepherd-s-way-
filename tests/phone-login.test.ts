import assert from 'node:assert/strict'
import test from 'node:test'

import { signInWithPhonePassword } from '../src/lib/phone-login.ts'

test('signs in with the derived internal email and unchanged password', async () => {
  let received: unknown
  const auth = {
    signInWithPassword: async (credentials: { email: string; password: string }) => {
      received = credentials
      return { error: null }
    },
  }

  await signInWithPhonePassword(
    auth,
    '077 282 9203',
    'TemporaryPass1!xx',
  )

  assert.deepEqual(received, {
    email: '263772829203@phone.invalid',
    password: 'TemporaryPass1!xx',
  })
})

test('surfaces the Supabase password-login error', async () => {
  const expected = new Error('Invalid login credentials')
  const auth = {
    signInWithPassword: async () => ({ error: expected }),
  }

  await assert.rejects(
    signInWithPhonePassword(auth, '0772829203', 'wrong-password'),
    expected,
  )
})
