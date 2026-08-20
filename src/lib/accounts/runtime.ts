import 'server-only'

import { createAdminAccountHandlers } from './admin-handlers'
import { createDefaultPasswordGenerator, provisionAccount, resetAccountPassword, type AccountDependencies } from './provision'
import { createAdminClient } from '../supabase/admin'
import { createClient } from '../supabase/server'

async function authorize() {
  const client = await createClient()
  const { data: { user } } = await client.auth.getUser()
  if (!user) return { ok: false as const, status: 401 as const }
  const { data } = await client.from('profiles').select('id, role, is_active').eq('auth_id', user.id).single()
  if (!data || data.role !== 'admin' || !data.is_active) return { ok: false as const, status: 403 as const }
  return { ok: true as const, profileId: data.id }
}

function accountDependencies(actorProfileId: string): AccountDependencies {
  const client = createAdminClient()
  const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message) }
  return {
    findProfileByPhone: async (phone) => { const { data, error } = await client.from('profiles').select('id').eq('phone', phone).maybeSingle(); fail(error); return data ? { profileId: data.id } : null },
    createAuthUser: async ({ phone, password, fullName }) => { const { data, error } = await client.auth.admin.createUser({ phone, password, phone_confirm: true, user_metadata: { full_name: fullName } }); fail(error); if (!data.user) throw new Error('Auth user creation failed.'); return { authId: data.user.id } },
    secureProfile: async (authId, input) => { const { data, error } = await client.from('profiles').update({ full_name: input.fullName, phone: input.phone, role: input.role, must_change_password: true, is_active: true, created_by: actorProfileId }).eq('auth_id', authId).select('id').single(); fail(error); if (!data) throw new Error('Profile security update failed.'); return { profileId: data.id } },
    deleteProfile: async (id) => { const { error } = await client.from('profiles').delete().eq('id', id); fail(error) },
    deleteAuthUser: async (id) => { const { error } = await client.auth.admin.deleteUser(id); fail(error) },
    recordAudit: async (event) => { const { error } = await client.from('admin_audit_log').insert({ actor_profile_id: actorProfileId, target_profile_id: event.targetProfileId, action: event.action, details: event.details ?? {} }); fail(error) },
    findProfileById: async (id) => { const { data, error } = await client.from('profiles').select('auth_id, is_active').eq('id', id).maybeSingle(); fail(error); return data?.auth_id ? { authId: data.auth_id, isActive: data.is_active } : null },
    updateAuthPassword: async (id, password) => { const { error } = await client.auth.admin.updateUserById(id, { password }); fail(error) },
    markPasswordResetRequired: async (id) => { const { error } = await client.from('profiles').update({ must_change_password: true, password_initialized_at: null }).eq('id', id); fail(error) },
    generatePassword: createDefaultPasswordGenerator(),
  }
}

export const adminAccountHandlers = createAdminAccountHandlers({
  authorize,
  provision: (input, actor) => provisionAccount(input, accountDependencies(actor)),
  resetPassword: (id, actor) => resetAccountPassword(id, accountDependencies(actor)),
  setActive: async (id, isActive, actor) => {
    const client = createAdminClient()
    const { error } = await client.from('profiles').update({ is_active: isActive, deactivated_at: isActive ? null : new Date().toISOString() }).eq('id', id)
    if (error) throw new Error(error.message)
    const { error: auditError } = await client.from('admin_audit_log').insert({ actor_profile_id: actor, target_profile_id: id, action: isActive ? 'account_activated' : 'account_deactivated' })
    if (auditError) throw new Error(auditError.message)
  },
})
