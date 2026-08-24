import assert from 'node:assert/strict'
import test from 'node:test'
import { validateBootstrapUsers } from '../scripts/bootstrap-users.ts'

const validUsers = [
  { fullName: 'Admin One', phone: '0772829203', role: 'admin' },
  { fullName: 'Admin Two', phone: '0772202290', role: 'admin' },
  ...Array.from({ length: 18 }, (_, index) => ({
    fullName: `Discipler ${index + 1}`,
    phone: `071${String(index).padStart(7, '0')}`,
    role: 'discipler',
  })),
]

test('validates exactly two admins and eighteen disciplers', () => {
  const result = validateBootstrapUsers(validUsers)
  assert.equal(result.length, 20)
  assert.equal(result.filter((user) => user.role === 'admin').length, 2)
  assert.equal(result[0]?.phone, '+263772829203')
})

test('rejects wrong counts, duplicate phones, roles, and password input', () => {
  assert.throws(() => validateBootstrapUsers(validUsers.slice(0, 19)), /exactly 20/)
  assert.throws(() => validateBootstrapUsers(validUsers.map((user, index) => index === 2 ? { ...user, phone: '0772829203' } : user)), /unique/)
  assert.throws(() => validateBootstrapUsers(validUsers.map((user, index) => index === 2 ? { ...user, role: 'disciple' } : user)), /roles/)
  assert.throws(() => validateBootstrapUsers(validUsers.map((user, index) => index === 2 ? { ...user, password: 'secret' } : user)), /password/)
})
