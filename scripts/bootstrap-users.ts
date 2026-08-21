import { readFile, writeFile } from 'node:fs/promises'
import { isAbsolute, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { normalizeZimbabwePhone } from '../src/lib/phone.ts'
import { createDefaultPasswordGenerator, provisionAccount, type AccountDependencies } from '../src/lib/accounts/provision.ts'
import type { ProvisionAccountInput } from '../src/lib/accounts/types.ts'

type BootstrapDatabase = { public: { Tables: {
  profiles: { Row: { id: string; auth_id: string | null; phone: string | null; is_active: boolean }; Insert: Record<string, unknown>; Update: { full_name?: string; phone?: string; role?: string; must_change_password?: boolean; is_active?: boolean }; Relationships: [] }
  admin_audit_log: { Row: Record<string, unknown>; Insert: { target_profile_id: string; action: string; details: Record<string, unknown> }; Update: Record<string, never>; Relationships: [] }
}; Views: Record<string, never>; Functions: Record<string, never>; Enums: Record<string, never>; CompositeTypes: Record<string, never> } }

export function validateBootstrapUsers(value: unknown): ProvisionAccountInput[] {
  if (!Array.isArray(value) || value.length !== 20) throw new Error('Bootstrap input must contain exactly 20 users.')
  const users = value.map((item, index) => {
    if (!item || typeof item !== 'object') throw new Error(`User ${index + 1} is invalid.`)
    const record = item as Record<string, unknown>
    if ('password' in record || 'temporaryPassword' in record) throw new Error('Bootstrap input must not contain password fields.')
    if (typeof record.fullName !== 'string' || record.fullName.trim().length < 2 || typeof record.phone !== 'string') throw new Error(`User ${index + 1} requires a name and phone.`)
    if (record.role !== 'admin' && record.role !== 'discipler') throw new Error('Bootstrap roles must be admin or discipler.')
    const role = record.role as 'admin' | 'discipler'
    return { fullName: record.fullName.trim(), phone: normalizeZimbabwePhone(record.phone), role }
  })
  if (users.filter((user) => user.role === 'admin').length !== 2 || users.filter((user) => user.role === 'discipler').length !== 18) throw new Error('Bootstrap requires exactly two admins and eighteen disciplers.')
  if (new Set(users.map((user) => user.phone)).size !== users.length) throw new Error('Bootstrap phone numbers must be unique.')
  return users
}

function dependencies(client: ReturnType<typeof createClient<BootstrapDatabase>>): AccountDependencies {
  const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message) }
  return {
    findProfileByPhone: async (phone) => { const { data, error } = await client.from('profiles').select('id').eq('phone', phone).maybeSingle(); fail(error); return data ? { profileId: data.id } : null },
    createAuthUser: async ({ phone, password, fullName }) => { const { data, error } = await client.auth.admin.createUser({ phone, password, phone_confirm: true, user_metadata: { full_name: fullName } }); fail(error); if (!data.user) throw new Error('Auth creation failed.'); return { authId: data.user.id } },
    secureProfile: async (authId, input) => { const { data, error } = await client.from('profiles').update({ full_name: input.fullName, phone: input.phone, role: input.role, must_change_password: true, is_active: true }).eq('auth_id', authId).select('id').single(); fail(error); if (!data) throw new Error('Profile update failed.'); return { profileId: data.id } },
    deleteProfile: async (id) => { const { error } = await client.from('profiles').delete().eq('id', id); fail(error) },
    deleteAuthUser: async (id) => { const { error } = await client.auth.admin.deleteUser(id); fail(error) },
    recordAudit: async (event) => { const { error } = await client.from('admin_audit_log').insert({ target_profile_id: event.targetProfileId, action: event.action, details: event.details ?? {} }); fail(error) },
    findProfileById: async () => null, updateAuthPassword: async () => undefined, markPasswordResetRequired: async () => undefined,
    generatePassword: createDefaultPasswordGenerator(),
  }
}

async function main() {
  const inputFlag = process.argv.indexOf('--input'); const outputFlag = process.argv.indexOf('--output')
  const inputPath = process.argv[inputFlag + 1]; const outputPath = process.argv[outputFlag + 1]
  if (inputFlag < 0 || !inputPath || !isAbsolute(inputPath)) throw new Error('--input requires an absolute path.')
  const users = validateBootstrapUsers(JSON.parse(await readFile(inputPath, 'utf8')))
  if (process.argv.includes('--validate-only')) { console.log(`Validated ${users.length} users: 2 admins and 18 disciplers.`); return }
  if (outputFlag < 0 || !outputPath || !isAbsolute(outputPath)) throw new Error('--output requires an absolute path.')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.')
  const client = createClient<BootstrapDatabase>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const deps = dependencies(client); const rows = ['full_name,phone,role,temporary_password']
  for (const user of users) {
    if (await deps.findProfileByPhone(user.phone)) { console.log(`Skipped existing account: ${user.fullName}`); continue }
    const result = await provisionAccount(user, deps)
    const escaped = (text: string) => `"${text.replaceAll('"', '""')}"`
    rows.push([user.fullName, result.normalizedPhone, user.role, result.temporaryPassword].map(escaped).join(','))
  }
  await writeFile(outputPath, `${rows.join('\n')}\n`, { encoding: 'utf8', flag: 'wx' })
  console.log(`Created credential report at ${outputPath}. Keep it private and delete it after distribution.`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
