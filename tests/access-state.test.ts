import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveAccessDestination } from '../src/lib/access-state.ts'

test('missing and inactive profiles return to login', () => {
  assert.equal(resolveAccessDestination(null), '/login')
  assert.equal(resolveAccessDestination({ role: 'admin', is_active: false, must_change_password: false }), '/login')
})

test('initial password replacement takes precedence over role routing', () => {
  for (const role of ['admin', 'discipler', 'disciple', 'graduate'] as const) {
    assert.equal(resolveAccessDestination({ role, is_active: true, must_change_password: true }), '/initial-password')
  }
})

test('active initialized users reach only their role dashboard', () => {
  assert.equal(resolveAccessDestination({ role: 'admin', is_active: true, must_change_password: false }), '/dashboard/admin')
  assert.equal(resolveAccessDestination({ role: 'discipler', is_active: true, must_change_password: false }), '/dashboard/discipler')
  assert.equal(resolveAccessDestination({ role: 'disciple', is_active: true, must_change_password: false }), '/dashboard/disciple')
  assert.equal(resolveAccessDestination({ role: 'graduate', is_active: true, must_change_password: false }), '/dashboard/disciple')
})
