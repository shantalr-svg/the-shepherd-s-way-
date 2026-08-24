import type { AdminAuditAction, UserRole } from '../../types/database'

export interface ProvisionAccountInput {
  fullName: string
  phone: string
  role: Extract<UserRole, 'admin' | 'discipler' | 'disciple'>
}

export interface ProvisionAccountResult {
  profileId: string
  authId: string
  normalizedPhone: string
  temporaryPassword: string
}

export interface AccountAuditEvent {
  actorProfileId: string | null
  targetProfileId: string
  action: AdminAuditAction
  details?: Record<string, unknown>
}
