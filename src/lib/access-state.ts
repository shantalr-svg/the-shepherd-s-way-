import type { UserRole } from '../types/database'

export interface AccessProfile {
  role: UserRole
  is_active: boolean
  must_change_password: boolean
}

export type AccessDestination =
  | '/login'
  | '/initial-password'
  | '/dashboard/admin'
  | '/dashboard/discipler'
  | '/dashboard/disciple'

export function resolveAccessDestination(
  profile: AccessProfile | null,
): AccessDestination {
  if (!profile?.is_active) return '/login'
  if (profile.must_change_password) return '/initial-password'
  if (profile.role === 'admin') return '/dashboard/admin'
  if (profile.role === 'discipler') return '/dashboard/discipler'
  return '/dashboard/disciple'
}
