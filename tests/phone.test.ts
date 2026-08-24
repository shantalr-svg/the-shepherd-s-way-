import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createPhonePasswordCredentials,
  formatZimbabwePhone,
  normalizeZimbabwePhone,
} from '../src/lib/phone.ts'

test('normalizes supported Zimbabwean mobile formats', () => {
  const inputs = [
    '0772829203',
    '263772829203',
    '+263772829203',
    '077 282 9203',
  ]

  for (const input of inputs) {
    assert.equal(normalizeZimbabwePhone(input), '+263772829203')
  }
})

test('rejects malformed or non-Zimbabwean numbers', () => {
  const inputs = [
    '',
    '772829203',
    '+27111222333',
    '07728abc03',
    '07728292034',
  ]

  for (const input of inputs) {
    assert.throws(
      () => normalizeZimbabwePhone(input),
      /Zimbabwean mobile number/,
    )
  }
})

test('formats a normalized Zimbabwean mobile number for display', () => {
  assert.equal(formatZimbabwePhone('+263772829203'), '+263 77 282 9203')
})

test('builds deterministic internal Auth credentials without changing the password', () => {
  assert.deepEqual(
    createPhonePasswordCredentials('077 282 9203', 'TemporaryPass1!xx'),
    {
      email: '263772829203@phone.invalid',
      password: 'TemporaryPass1!xx',
    },
  )
})
