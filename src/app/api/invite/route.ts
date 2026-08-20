import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerSupabase } from '@/lib/supabase/server'
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from '@/lib/supabase/env'
import type { UserRole } from '@/types/database'

const INVITABLE_ROLES = ['disciple', 'discipler', 'graduate'] as const
type InvitableRole = (typeof INVITABLE_ROLES)[number]

function isInvitableRole(role: unknown): role is InvitableRole {
  return typeof role === 'string' && INVITABLE_ROLES.includes(role as InvitableRole)
}

export async function POST(request: NextRequest) {
  // Verify the caller is an authenticated admin
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('auth_id', user.id)
    .single()

  if (profileError || profile?.role !== ('admin' satisfies UserRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { email, full_name, role } = body as Record<string, unknown>
  if (typeof email !== 'string' || !email.trim() ||
      typeof full_name !== 'string' || !full_name.trim() ||
      !isInvitableRole(role)) {
    return NextResponse.json({ error: 'A valid email, full name, and non-admin role are required' }, { status: 400 })
  }

  const { url } = getSupabasePublicEnv()
  const adminClient = createClient(
    url,
    getSupabaseServiceRoleKey(),
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const normalizedEmail = email.trim().toLowerCase()
  const normalizedName = full_name.trim()
  const { error: invitationError } = await adminClient.from('invitations').insert({
    email: normalizedEmail,
    full_name: normalizedName,
    role,
    invited_by: profile.id,
  })

  if (invitationError) {
    return NextResponse.json({ error: invitationError.message }, { status: 400 })
  }

  const { error } = await adminClient.auth.admin.inviteUserByEmail(normalizedEmail, {
    data: { full_name: normalizedName },
  })

  if (error) {
    await adminClient.from('invitations').delete().eq('email', normalizedEmail)
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
