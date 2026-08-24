import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from './env'

export function createAdminClient() {
  const { url } = getSupabasePublicEnv()
  const serviceRoleKey = getSupabaseServiceRoleKey()

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
