import assert from 'node:assert/strict'
import test from 'node:test'

import {
  generateTemporaryPassword,
  validateReplacementPassword,
} from '../src/lib/password.ts'

test('temporary passwords satisfy every required character class', () => {
  const password = generateTemporaryPassword((size) =>
    Uint8Array.from({ length: size }, (_, index) => index),
  )

  assert.equal(password.length, 18)
  assert.match(password, /[a-z]/)
  assert.match(password, /[A-Z]/)
  assert.match(password, /[0-9]/)
  assert.match(password, /[^A-Za-z0-9]/)
})

test('replacement passwords require length and all character classes', () => {
  assert.equal(validateReplacementPassword('StrongEnough1!'), null)
  assert.match(validateReplacementPassword('Short1!') ?? '', /12 characters/)
  assert.match(validateReplacementPassword('alllowercase1!') ?? '', /uppercase/)
  assert.match(validateReplacementPassword('ALLUPPERCASE1!') ?? '', /lowercase/)
  assert.match(validateReplacementPassword('NoNumbersHere!') ?? '', /number/)
  assert.match(validateReplacementPassword('NoSymbolsHere1') ?? '', /symbol/)
})
