import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import test from 'node:test'

test('latest profile phone constraint accepts normalized Zimbabwean mobile numbers', async () => {
  const directory = new URL('../supabase/migrations/', import.meta.url)
  const migrationNames = (await readdir(directory))
    .filter((name) => name.endsWith('.sql'))
    .sort()

  const definitions = []
  for (const migrationName of migrationNames) {
    const sql = await readFile(new URL(migrationName, directory), 'utf8')
    definitions.push(
      ...sql.matchAll(
        /ADD CONSTRAINT profiles_phone_e164_check\s+CHECK \(phone IS NULL OR phone ~ '([^']+)'\)/g,
      ),
    )
  }

  assert.ok(definitions.length > 0, 'phone constraint definition is missing')
  const latestPattern = definitions.at(-1)[1]
  const constraintPattern = new RegExp(latestPattern)

  assert.equal(constraintPattern.test('+263772829203'), true)
  assert.equal(constraintPattern.test('0772829203'), false)
})
