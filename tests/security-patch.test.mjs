import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('follow-up migration blocks protected profile fields and limits disciple task updates', () => {
  const sql = read('supabase/migrations/20260820_security_patch_1.sql')

  assert.match(sql, /OLD\.role\s+IS DISTINCT FROM NEW\.role/i)
  assert.match(sql, /OLD\.auth_id\s+IS DISTINCT FROM NEW\.auth_id/i)
  assert.match(sql, /OLD\.discipler_id\s+IS DISTINCT FROM NEW\.discipler_id/i)
  assert.match(sql, /OLD\.enrollment_id\s+IS DISTINCT FROM NEW\.enrollment_id/i)
  assert.match(sql, /OLD\.completed_at\s+IS NOT NULL/i)
})

test('signup role comes from a server-created invitation, never user metadata', () => {
  const sql = read('supabase/migrations/20260820_security_patch_1.sql')

  assert.doesNotMatch(sql, /raw_user_meta_data\s*->>\s*'role'/i)
  assert.match(sql, /CREATE TABLE (?:public\.)?invitations/i)
  assert.match(sql, /CHECK\s*\(role\s+IN\s*\('discipler',\s*'disciple',\s*'graduate'\)\)/i)
  assert.match(sql, /DELETE FROM public\.invitations/i)
})

test('normal invitation flow has an explicit non-admin role allowlist', () => {
  const route = read('src/app/api/invite/route.ts')

  assert.match(route, /INVITABLE_ROLES/)
  assert.match(route, /'disciple'/)
  assert.match(route, /'discipler'/)
  assert.match(route, /'graduate'/)
  assert.doesNotMatch(route, /data:\s*\{\s*full_name,\s*role\s*\}/)
})

test('Supabase clients use explicit environment validation without placeholders', () => {
  const files = [
    read('src/lib/supabase/client.ts'),
    read('src/lib/supabase/server.ts'),
    read('src/proxy.ts'),
  ]

  for (const source of files) {
    assert.doesNotMatch(source, /placeholder\.supabase\.co|placeholder-anon-key/)
    assert.match(source, /getSupabasePublicEnv/)
  }
})

test('Supabase environment validation throws a clear error when configuration is missing', async () => {
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const previousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  try {
    const { getSupabasePublicEnv } = await import('../src/lib/supabase/env.ts')
    assert.throws(
      () => getSupabasePublicEnv(),
      /NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required/
    )
  } finally {
    if (previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousKey
  }
})

test('critical dashboard mutations inspect and surface Supabase errors', () => {
  for (const path of [
    'src/components/AdminDashboard.tsx',
    'src/components/DisciplerDashboard.tsx',
    'src/components/DiscipleDashboard.tsx',
  ]) {
    const source = read(path)
    assert.match(source, /setError\(/, `${path} must expose mutation errors`)
    assert.match(source, /catch\s*\(/, `${path} must handle unexpected mutation failures`)
  }
})
