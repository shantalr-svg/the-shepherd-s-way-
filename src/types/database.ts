export type UserRole = 'admin' | 'discipler' | 'disciple' | 'graduate'
export type EnrollmentStatus = 'active' | 'completed' | 'dropped'
export type TaskType = 'scripture' | 'assignment' | 'reading' | 'other'
export type SmsStatus = 'queued' | 'sent' | 'delivered' | 'failed'

export interface Profile {
  id: string
  auth_id: string | null
  phone: string | null
  email: string | null
  full_name: string
  role: UserRole
  discipler_id: string | null
  must_change_password: boolean
  is_active: boolean
  created_by: string | null
  password_initialized_at: string | null
  deactivated_at: string | null
  created_at: string
  updated_at: string
}

export type AdminAuditAction =
  | 'account_created'
  | 'admin_promoted'
  | 'role_changed'
  | 'password_reset'
  | 'account_activated'
  | 'account_deactivated'
  | 'initial_password_changed'

export interface AdminAuditLog {
  id: string
  actor_profile_id: string | null
  target_profile_id: string | null
  action: AdminAuditAction
  details: Record<string, unknown>
  created_at: string
}

export interface Track {
  id: string
  title: string
  description: string | null
  order_index: number
  created_at: string
}

export interface Enrollment {
  id: string
  disciple_id: string
  discipler_id: string
  track_id: string
  status: EnrollmentStatus
  started_at: string
  completed_at: string | null
  dropped_at: string | null
  notes: string | null
}

export interface Session {
  id: string
  enrollment_id: string
  session_date: string
  attended: boolean
  notes: string | null
  created_at: string
}

export interface Task {
  id: string
  enrollment_id: string
  type: TaskType
  title: string
  description: string | null
  due_date: string | null
  completed_at: string | null
  created_at: string
}

export interface SmsLog {
  id: string
  sender_id: string | null
  recipient_id: string | null
  phone_to: string
  body: string
  status: SmsStatus
  twilio_sid: string | null
  sent_at: string | null
  created_at: string
}

// Joined types for convenience
export interface EnrollmentWithRelations extends Enrollment {
  disciple: Profile
  discipler: Profile
  track: Track
}
