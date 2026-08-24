import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL(
  '../supabase/migrations/20260821_phone_auth_and_account_admin.sql',
  import.meta.url,
)

async function readMigration() {
  return readFile(migrationUrl, 'utf8')
}

test('account lifecycle migration adds forced-password and activation state', async () => {
  const sql = await readMigration()

  assert.match(sql, /must_change_password\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+false/i)
  assert.match(sql, /is_active\s+BOOLEAN\s+NOT NULL\s+DEFAULT\s+true/i)
  assert.match(sql, /password_initialized_at\s+TIMESTAMPTZ/i)
  assert.match(sql, /deactivated_at\s+TIMESTAMPTZ/i)
  assert.match(sql, /created_by\s+UUID\s+REFERENCES\s+public\.profiles/i)
})

test('database serializes administrator creation and rejects a sixth active admin', async () => {
  const sql = await readMigration()

  assert.match(sql, /pg_advisory_xact_lock/i)
  assert.match(sql, /role\s*=\s*'admin'.*is_active\s*=\s*true/is)
  assert.match(sql, /active administrator limit is five/i)
})

test('ordinary clients cannot alter account lifecycle security fields', async () => {
  const sql = await readMigration()

  for (const field of [
    'must_change_password',
    'is_active',
    'created_by',
    'password_initialized_at',
    'deactivated_at',
  ]) {
    assert.match(sql, new RegExp(`OLD\\.${field}\\s+IS DISTINCT FROM\\s+NEW\\.${field}`, 'i'))
  }
})

test('audit records are append-only to application users', async () => {
  const sql = await readMigration()

  assert.match(sql, /CREATE TABLE public\.admin_audit_log/i)
  assert.match(sql, /ALTER TABLE public\.admin_audit_log ENABLE ROW LEVEL SECURITY/i)
  assert.match(sql, /REVOKE\s+(?:UPDATE|DELETE|ALL).*admin_audit_log/is)
})

test('initial password completion only updates the authenticated profile', async () => {
  const sql = await readMigration()

  assert.match(sql, /FUNCTION public\.complete_initial_password_change\(\)/i)
  assert.match(sql, /WHERE auth_id = auth\.uid\(\)/i)
  assert.match(sql, /must_change_password\s*=\s*false/i)
  assert.match(sql, /initial_password_changed/i)
})
